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

export async function createOrder(input: OrderInput) {
  const { error } = await supabase
    .from("orders")
    .insert({
      customer_name: input.customer_name,
      phone: input.phone,
      address: input.address,
      city: input.city,
      country: input.country,
      payment_method: input.payment_method,
      items: input.items as unknown as never,
      total: input.total,
      notes: input.notes ?? null,
    });
  if (error) throw error;
  return { ok: true };
}
