import { createServerFn } from "@tanstack/react-start";

export type CheckoutLine = { slug: string; qty: number };

export type CreatedOrder = { id: string; total: number };

/**
 * Creates a real order. Prices and the total are recomputed server-side from
 * the products table — client-supplied amounts are never trusted.
 */
export const createCheckoutOrder = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      customer_name: string;
      phone: string;
      address: string;
      city: string;
      country: string;
      payment_method: string;
      notes?: string;
      userId?: string | null;
      items: CheckoutLine[];
    }) => {
      const str = (v: unknown, field: string, max = 200) => {
        const s = String(v ?? "").trim();
        if (!s) throw new Error(`${field} is required.`);
        return s.slice(0, max);
      };
      const items = Array.isArray(input?.items) ? input.items : [];
      if (items.length === 0) throw new Error("Your cart is empty.");
      return {
        customer_name: str(input.customer_name, "Full name"),
        phone: str(input.phone, "Phone"),
        address: str(input.address, "Address", 500),
        city: str(input.city, "City"),
        country: str(input.country || "Rwanda", "Country"),
        payment_method: str(input.payment_method, "Payment method", 40),
        notes: input.notes ? String(input.notes).slice(0, 500) : null,
        userId: typeof input.userId === "string" && input.userId ? input.userId : null,
        items: items.slice(0, 100).map((i) => ({
          slug: String(i.slug),
          qty: Math.max(1, Math.min(100, Math.floor(Number(i.qty) || 1))),
        })),
      };
    },
  )
  .handler(async ({ data }): Promise<CreatedOrder> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const slugs = data.items.map((i) => i.slug);
    const { data: products, error } = await supabaseAdmin
      .from("products")
      .select("slug, name, price, image, cashback_percent")
      .in("slug", slugs);
    if (error) throw new Error("Could not load products.");

    const lines = data.items.flatMap((i) => {
      const p = products?.find((x) => x.slug === i.slug);
      if (!p) return [];
      return [
        {
          slug: p.slug,
          name: p.name,
          image: p.image,
          price: Number(p.price) || 0,
          qty: i.qty,
          quantity: i.qty,
          cashbackPercent: Number(p.cashback_percent) || 0,
        },
      ];
    });
    if (lines.length === 0) throw new Error("Products are no longer available.");

    const total = lines.reduce((a, l) => a + l.price * l.qty, 0);

    const { data: order, error: insErr } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name: data.customer_name,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country,
        payment_method: data.payment_method,
        items: lines as never,
        total,
        momo_amount: total,
        notes: data.notes,
        user_id: data.userId,
        status: "pending",
      })
      .select("id, total")
      .single();
    if (insErr || !order) throw new Error("Could not place the order.");

    return { id: order.id, total: Number(order.total) };
  });
