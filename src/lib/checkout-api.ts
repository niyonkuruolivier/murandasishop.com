import { apiPost } from "@/lib/api";

export type CheckoutLine = {
  slug: string;
  qty: number;
  variations?: Record<string, string>;
};

export type CreatedOrder = {
  id: string;
  total: number;
  walletApplied: number;
  momoAmount: number;
  status: "pending" | "success";
};

export type PaymentState = {
  paymentId: string | null;
  orderId: string;
  status: "pending" | "success" | "failed" | "not_configured";
  message: string | null;
  cashback: number;
  amount: number;
};

export async function createCheckoutOrder(input: {
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  payment_method: string;
  notes?: string;
  walletAmount?: number;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_location_label?: string | null;
  items: CheckoutLine[];
}): Promise<CreatedOrder> {
  return apiPost<CreatedOrder>("/orders/checkout", input);
}

export async function initiateMomoPayment(input: {
  orderId: string;
  phone: string;
}): Promise<PaymentState> {
  return apiPost<PaymentState>("/payments/momo", input, false);
}

export async function getPaymentState(input: { paymentId: string }): Promise<PaymentState> {
  return apiPost<PaymentState>("/payments/status", input, false);
}
