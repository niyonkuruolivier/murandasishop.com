import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  total: number;
  items: Array<{ name: string; qty: number; price: number }>;
  payment_method: string;
  created_at: string;
  wallet_applied: number;
  momo_amount: number | null;
  cashback_awarded: number;
  cashback_status: string;
};

export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useMyWhatsapp() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-wa", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_purchases")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WhatsappPurchase[];
    },
  });
}

export function useMyOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,status,total,items,payment_method,created_at,wallet_applied,momo_amount,cashback_awarded,cashback_status",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MyOrder[];
    },
  });
}

export function useMyNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-notifs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });
}
