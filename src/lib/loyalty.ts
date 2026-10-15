import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  approved_purchases: number;
  total_spent: number;
  created_at: string;
};

export type WhatsappPurchase = {
  id: string;
  user_id: string;
  amount: number;
  screenshot_url: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  link: string | null;
  created_at: string;
};

export type MyOrder = {
  id: string;
  status: string;
  payment_status: string;
  delivery_status: string;
  total: number;
  items: Array<{ name: string; qty: number; price: number }>;
  payment_method: string;
  created_at: string;
  wallet_applied: number;
  momo_amount: number | null;
  cashback_awarded: number;
  cashback_status: string;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_location_label: string | null;
  shipping_attachment_url: string | null;
  delivered_at: string | null;
  delivery_confirmed_at: string | null;
  cashback_deadline: string | null;
};

export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: () => apiGet<Profile | null>("/profile/me"),
  });
}

export function useMyWhatsapp() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-wa", user?.id],
    enabled: !!user,
    queryFn: () => apiGet<WhatsappPurchase[]>("/profile/whatsapp"),
  });
}

export function useMyOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: () => apiGet<MyOrder[]>("/orders/me"),
    staleTime: 30_000,
  });
}

export function confirmOrderDelivery(orderId: string) {
  return apiPost<{ ok: boolean; status: string; cashback: number }>(
    `/orders/${encodeURIComponent(orderId)}/confirm-delivery`,
    {},
  );
}

export function useMyNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-notifs", user?.id],
    enabled: !!user,
    queryFn: () => apiGet<Notification[]>("/profile/notifications"),
  });
}

export async function markNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  await apiPatch("/profile/notifications/read", { ids });
}
