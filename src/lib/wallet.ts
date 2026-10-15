import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
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
  return ((Number(price) || 0) * (Number(qty) || 0) * (Number(percent) || 0)) / 100;
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
      const data = await apiGet<{ balance: number }>("/wallet/balance");
      return Number(data.balance ?? 0);
    },
  });
}

export function useMyWalletTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-wallet-tx", user?.id],
    enabled: !!user,
    queryFn: () => apiGet<WalletTransaction[]>("/wallet/transactions"),
  });
}

export async function redeemWalletForOrder(orderId: string, amount: number) {
  const data = await apiPost<{ amount: number }>("/wallet/redeem", { orderId, amount });
  return Number(data.amount ?? 0);
}

export type CashbackPolicy = {
  confirmation_days: number;
};

export function formatConfirmationWindow(days: number): string {
  const n = Math.max(1, Math.floor(Number(days) || 3));
  return n === 1 ? "1 day" : `${n} days`;
}

export function useCashbackPolicy() {
  return useQuery({
    queryKey: ["cashback-policy"],
    queryFn: () => apiGet<CashbackPolicy>("/wallet/cashback-policy"),
    staleTime: 60_000,
  });
}
