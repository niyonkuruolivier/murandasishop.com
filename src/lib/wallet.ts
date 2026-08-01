import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type WalletTransaction = {
  id: string;
  user_id: string;
  order_id: string | null;
  type: "earned" | "used" | "reversed" | "adjustment" | "referral";
  amount: number;
  balance_after: number;
  note: string | null;
  created_at: string;
};

/** Cashback earned on a single line, before the Mobile Money split is applied. */
export function lineCashback(price: number, qty: number, percent: number) {
  return (Number(price) || 0) * (Number(qty) || 0) * (Number(percent) || 0) / 100;
}

/**
 * Cashback is only earned on the Mobile Money portion of a payment.
 * Wallet-funded amounts never generate new cashback.
 */
export function cashbackForOrder(
  lines: Array<{ price: number; qty: number; cashbackPercent?: number }>,
  momoAmount: number,
) {
  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  if (subtotal <= 0 || momoAmount <= 0) return 0;
  const gross = lines.reduce((a, l) => a + lineCashback(l.price, l.qty, l.cashbackPercent ?? 0), 0);
  const ratio = Math.min(1, Math.max(0, momoAmount / subtotal));
  return Math.round(gross * ratio);
}

export function useMyWallet() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_wallet_balance");
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

export function useMyWalletTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-wallet-tx", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as WalletTransaction[];
    },
  });
}

export async function redeemWalletForOrder(orderId: string, amount: number) {
  const { data, error } = await supabase.rpc("redeem_wallet_for_order", {
    _order_id: orderId,
    _amount: amount,
  });
  if (error) throw error;
  return Number(data ?? 0);
}
