export type OrderPaymentInfo = {
  payment_method: string;
  total: number;
  wallet_applied?: number;
  momo_amount?: number | null;
};

export type PaymentLine = {
  label: string;
  amount: number;
};

const frw = (n: number) => `FRW ${Math.round(Number(n) || 0).toLocaleString()}`;

export function momoMethodLabel(method: string): string {
  const m = String(method || "").toLowerCase();
  if (m.includes("mtn")) return "MTN Mobile Money";
  if (m.includes("airtel")) return "Airtel Money";
  if (m === "wallet" || m.includes("wallet")) return "Cashback Wallet";
  return method.replace(/_/g, " ").replace(/\+/g, " + ") || "Payment";
}

export function getOrderPaymentLines(order: OrderPaymentInfo): PaymentLine[] {
  const wallet = Math.max(0, Number(order.wallet_applied) || 0);
  const total = Math.max(0, Number(order.total) || 0);
  const momo = Math.max(0, Number(order.momo_amount ?? total - wallet) || 0);
  const method = String(order.payment_method || "").toLowerCase();

  const lines: PaymentLine[] = [];

  if (wallet > 0) {
    lines.push({ label: "Cashback Wallet", amount: wallet });
  }

  if (momo > 0) {
    if (method.includes("mtn")) {
      lines.push({ label: "MTN Mobile Money", amount: momo });
    } else if (method.includes("airtel")) {
      lines.push({ label: "Airtel Money", amount: momo });
    } else if (wallet <= 0) {
      lines.push({ label: momoMethodLabel(order.payment_method), amount: momo });
    } else {
      lines.push({ label: "Mobile Money", amount: momo });
    }
  }

  if (lines.length === 0) {
    lines.push({ label: momoMethodLabel(order.payment_method), amount: total });
  }

  return lines;
}

export function formatOrderPaymentSummary(order: OrderPaymentInfo): string {
  const lines = getOrderPaymentLines(order);
  if (lines.length === 1) return `${lines[0].label} · ${frw(lines[0].amount)}`;
  return lines.map((line) => `${line.label} (${frw(line.amount)})`).join(" + ");
}

export function isSplitPayment(order: OrderPaymentInfo): boolean {
  const wallet = Number(order.wallet_applied) || 0;
  const momo = Number(order.momo_amount ?? 0);
  return wallet > 0 && momo > 0;
}
