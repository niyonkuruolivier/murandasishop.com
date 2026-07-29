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

export type Milestone = {
  id: string;
  purchases_required: number;
  title: string;
  description: string;
  emoji: string;
  active: boolean;
  sort_order: number;
};

export type RewardClaim = {
  id: string;
  user_id: string;
  milestone_id: string;
  status: "unlocked" | "claimed" | "redeemed";
  claimed_at: string | null;
  redeemed_at: string | null;
  admin_notes: string | null;
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

export function useMilestones(includeInactive = false) {
  return useQuery({
    queryKey: ["milestones", includeInactive],
    queryFn: async () => {
      let q = supabase
        .from("reward_milestones")
        .select("*")
        .order("purchases_required", { ascending: true });
      if (!includeInactive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
  });
}

export function useMyClaims() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-claims", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_claims")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RewardClaim[];
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
        .select("id,status,total,items,payment_method,created_at")
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
