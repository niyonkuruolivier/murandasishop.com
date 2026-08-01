import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const REF_KEY = "murandasi_ref_code";

export type ReferralStats = {
  code: string | null;
  total: number;
  successful: number;
  earnings: number;
  balance: number;
  reward_amount: number;
};

export type ReferralRow = {
  id: string;
  name: string | null;
  status: string;
  reward_amount: number;
  rewarded_at: string | null;
  created_at: string;
};

/** Stores a ?ref= code from the current URL so it survives the signup round-trip. */
export function captureReferralCodeFromUrl() {
  if (typeof window === "undefined") return;
  const code = new URLSearchParams(window.location.search).get("ref");
  if (!code) return;
  const clean = code.trim().toUpperCase().slice(0, 16);
  if (/^[A-Z0-9]{4,16}$/.test(clean)) {
    try {
      localStorage.setItem(REF_KEY, clean);
    } catch {
      /* storage unavailable */
    }
  }
}

/** Links the signed-in user to their referrer, once. Safe to call repeatedly. */
export async function claimPendingReferral() {
  if (typeof window === "undefined") return;
  let code: string | null = null;
  try {
    code = localStorage.getItem(REF_KEY);
  } catch {
    return;
  }
  if (!code) return;
  const { data, error } = await supabase.rpc("attach_referral", { _code: code });
  if (error) return;
  // Anything other than a transient auth failure is final — stop retrying.
  if (data !== "unauthenticated") {
    try {
      localStorage.removeItem(REF_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function referralLink(code: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://murandasishop.lovable.app";
  return `${origin}/?ref=${code}`;
}

export function useMyReferralStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-referral-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_referral_stats");
      if (error) throw error;
      const r = (data ?? {}) as Record<string, unknown>;
      return {
        code: (r["code"] as string) ?? null,
        total: Number(r["total"] ?? 0),
        successful: Number(r["successful"] ?? 0),
        earnings: Number(r["earnings"] ?? 0),
        balance: Number(r["balance"] ?? 0),
        reward_amount: Number(r["reward_amount"] ?? 1000),
      } satisfies ReferralStats;
    },
  });
}

export function useMyReferrals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-referrals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_referral_list");
      if (error) throw error;
      return (data ?? []) as ReferralRow[];
    },
  });
}
