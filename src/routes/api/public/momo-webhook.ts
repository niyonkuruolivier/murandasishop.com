import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { normalizeStatus } from "@/lib/momo.server";

/**
 * Official Mobile Money provider webhook.
 * Configure this URL with the provider (MOMO_CALLBACK_URL):
 *   https://<your-domain>/api/public/momo-webhook
 * and set MOMO_WEBHOOK_SECRET to the shared signing secret.
 */
export const Route = createFileRoute("/api/public/momo-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.MOMO_WEBHOOK_SECRET;
        const body = await request.text();

        if (secret) {
          const provided = (
            request.headers.get("x-webhook-signature") ??
            request.headers.get("x-signature") ??
            ""
          ).replace(/^sha256=/, "");
          const expected = createHmac("sha256", secret).update(body).digest("hex");
          const a = Buffer.from(provided);
          const b = Buffer.from(expected);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(body) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const inner = (payload.data as Record<string, unknown>) ?? {};
        const externalRef = String(
          payload.external_reference ?? payload.reference ?? inner.external_reference ?? inner.reference ?? "",
        );
        const providerRef = String(
          payload.transaction_id ?? payload.id ?? inner.transaction_id ?? inner.id ?? "",
        );
        const status = normalizeStatus(payload.status ?? payload.state ?? inner.status);

        if (!externalRef && !providerRef) {
          return new Response("Missing reference", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const query = supabaseAdmin
          .from("payments")
          .select("id, order_id, status")
          .limit(1);
        const { data: rows } = externalRef
          ? await query.eq("external_ref", externalRef)
          : await query.eq("provider_ref", providerRef);
        const payment = rows?.[0];
        if (!payment) return new Response("Unknown payment", { status: 404 });

        if (payment.status !== status) {
          await supabaseAdmin
            .from("payments")
            .update({
              status,
              provider_ref: providerRef || undefined,
              failure_reason:
                status === "failed" ? String(payload.message ?? inner.message ?? "Payment failed") : null,
              raw_response: payload as never,
            })
            .eq("id", payment.id);
        }

        // Real confirmation only — cashback is credited by the database routine.
        if (status === "success" && payment.order_id) {
          await supabaseAdmin.rpc("mark_order_paid", {
            _order_id: payment.order_id,
            _reference: providerRef || externalRef,
          });
        }

        return Response.json({ received: true });
      },
    },
  },
});
