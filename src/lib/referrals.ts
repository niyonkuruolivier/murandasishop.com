import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SITE_ORIGIN } from "@/lib/site";

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
  try {
    const data = await apiPost<{ result: string }>("/referrals/claim", { code });
    if (data.result !== "unauthenticated") {
      try {
        localStorage.removeItem(REF_KEY);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* retry later */
  }
}

export function referralLink(code: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : SITE_ORIGIN;
  return `${origin}/?ref=${code}`;
}

export function useMyReferralStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-referral-stats", user?.id],
    enabled: !!user,
    queryFn: () => apiGet<ReferralStats>("/referrals/stats"),
    retry: 1,
  });
}

export function useMyReferrals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-referrals", user?.id],
    enabled: !!user,
    queryFn: () => apiGet<ReferralRow[]>("/referrals"),
  });
}
