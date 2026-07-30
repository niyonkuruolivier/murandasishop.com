import { createServerFn } from "@tanstack/react-start";

export type PaymentState = {
  paymentId: string | null;
  orderId: string;
  status: "pending" | "success" | "failed" | "not_configured";
  message: string | null;
  cashback: number;
  amount: number;
};

const uuid = (v: unknown) =>
  typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;

const cleanPhone = (v: unknown) => {
  const s = String(v ?? "").replace(/[^\d+]/g, "");
  if (s.replace(/\D/g, "").length < 9) throw new Error("Enter a valid Mobile Money number.");
  return s;
};

/**
 * Starts a real Mobile Money collection. The amount charged is always the
 * order's outstanding Mobile Money amount (total minus cashback wallet
 * applied) — never the full total when the wallet was used.
 */
export const initiateMomoPayment = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; phone: string }) => {
    const orderId = uuid(input?.orderId);
    if (!orderId) throw new Error("Invalid order.");
    return { orderId, phone: cleanPhone(input?.phone) };
  })
  .handler(async ({ data }): Promise<PaymentState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requestToPay, getMomoConfig } = await import("./momo.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, total, momo_amount, wallet_applied, paid_at, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Order not found.");

    const due = Math.round(Number(order.momo_amount ?? order.total) || 0);

    if (order.paid_at) {
      return { paymentId: null, orderId: order.id, status: "success", message: null, cashback: 0, amount: due };
    }

    // Fully covered by the cashback wallet — nothing to collect.
    if (due <= 0) {
      const { data: cb } = await supabaseAdmin.rpc("mark_order_paid", {
        _order_id: order.id,
        _reference: "wallet",
      });
      return {
        paymentId: null,
        orderId: order.id,
        status: "success",
        message: null,
        cashback: Number(cb ?? 0),
        amount: 0,
      };
    }

    if (!getMomoConfig()) {
      return {
        paymentId: null,
        orderId: order.id,
        status: "not_configured",
        message:
          "Mobile Money is not configured yet. Add the payment API credentials in the backend settings.",
        cashback: 0,
        amount: due,
      };
    }

    const externalRef = crypto.randomUUID();
    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .insert({
        order_id: order.id,
        user_id: order.user_id,
        provider: "momo",
        phone: data.phone,
        amount: due,
        external_ref: externalRef,
        status: "pending",
      })
      .select("id")
      .single();
    if (payErr || !payment) throw new Error("Could not start the payment.");

    try {
      const result = await requestToPay({
        amount: due,
        phone: data.phone,
        externalRef,
        description: `Murandasi order ${order.id.slice(0, 8)}`,
      });

      await supabaseAdmin
        .from("payments")
        .update({
          status: result.ok ? result.status : "failed",
          provider_ref: result.providerRef,
          failure_reason: result.ok ? null : result.message,
          raw_response: result.raw as never,
        })
        .eq("id", payment.id);

      let cashback = 0;
      if (result.ok && result.status === "success") {
        const { data: cb } = await supabaseAdmin.rpc("mark_order_paid", {
          _order_id: order.id,
          _reference: result.providerRef ?? externalRef,
        });
        cashback = Number(cb ?? 0);
      }

      return {
        paymentId: payment.id,
        orderId: order.id,
        status: result.ok ? result.status : "failed",
        message: result.message,
        cashback,
        amount: due,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Payment request failed.";
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed", failure_reason: message })
        .eq("id", payment.id);
      return { paymentId: payment.id, orderId: order.id, status: "failed", message, cashback: 0, amount: due };
    }
  });

/** Polled by the checkout screen while the customer enters their PIN. */
export const getPaymentState = createServerFn({ method: "POST" })
  .inputValidator((input: { paymentId: string }) => {
    const paymentId = uuid(input?.paymentId);
    if (!paymentId) throw new Error("Invalid payment.");
    return { paymentId };
  })
  .handler(async ({ data }): Promise<PaymentState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { queryPaymentStatus } = await import("./momo.server");

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .select("id, order_id, status, amount, failure_reason, provider_ref, external_ref")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (error || !payment) throw new Error("Payment not found.");

    let status = payment.status as PaymentState["status"];
    let message = payment.failure_reason;
    let cashback = 0;

    if (status === "pending") {
      const ref = payment.provider_ref ?? payment.external_ref;
      const remote = ref ? await queryPaymentStatus(ref) : null;
      if (remote && remote.status !== "pending") {
        status = remote.status;
        message = remote.message;
        await supabaseAdmin
          .from("payments")
          .update({ status, failure_reason: remote.status === "failed" ? message : null, raw_response: remote.raw as never })
          .eq("id", payment.id);
      }
    }

    if (status === "success" && payment.order_id) {
      const { data: cb } = await supabaseAdmin.rpc("mark_order_paid", {
        _order_id: payment.order_id,
        _reference: payment.provider_ref ?? payment.external_ref ?? undefined,
      });
      cashback = Number(cb ?? 0);
    }

    return {
      paymentId: payment.id,
      orderId: payment.order_id ?? "",
      status,
      message,
      cashback,
      amount: Number(payment.amount) || 0,
    };
  });
