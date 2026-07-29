import { supabase } from "@/integrations/supabase/client";
import type { CartLine } from "./cart";

export type OrderInput = {
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  payment_method: string;
  items: CartLine[];
  total: number;
  notes?: string;
};

export async function createOrder(input: OrderInput): Promise<{ ok: true; id: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id ?? null;
  const payload = {
    customer_name: input.customer_name,
    phone: input.phone,
    address: input.address,
    city: input.city,
    country: input.country,
    payment_method: input.payment_method,
    items: input.items as unknown as never,
    total: input.total,
    notes: input.notes ?? null,
    user_id: userId,
  };

  // Authenticated users can read their own inserted row via RLS → returning is safe.
  // Guests can insert but cannot select back; fall back to a plain insert.
  if (userId) {
    const { data, error } = await supabase
      .from("orders")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: data?.id ?? null };
  }
  const { error } = await supabase.from("orders").insert(payload);
  if (error) throw error;
  return { ok: true, id: null };
}
