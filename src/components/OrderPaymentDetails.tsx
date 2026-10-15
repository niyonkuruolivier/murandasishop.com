import { Wallet, Smartphone } from "lucide-react";
import {
  type OrderPaymentInfo,
  getOrderPaymentLines,
  isSplitPayment,
} from "@/lib/order-payment";

const frw = (n: number) => `FRW ${Math.round(Number(n) || 0).toLocaleString()}`;

function lineIcon(label: string) {
  if (label.includes("Cashback")) return Wallet;
  return Smartphone;
}

export function OrderPaymentDetails({
  order,
  compact = false,
}: {
  order: OrderPaymentInfo;
  total?: number;
  compact?: boolean;
}) {
  const lines = getOrderPaymentLines(order);
  const total = Number(order.total) || 0;
  const split = isSplitPayment(order);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {lines.map((line) => {
          const Icon = lineIcon(line.label);
          return (
            <span
              key={line.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold"
            >
              <Icon className="h-3.5 w-3.5 text-accent" />
              {line.label}: {frw(line.amount)}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background/50 p-3 text-sm">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Payment {split ? "(split)" : ""}
      </div>
      <ul className="space-y-2">
        {lines.map((line) => {
          const Icon = lineIcon(line.label);
          return (
            <li key={line.label} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4 shrink-0 text-accent" />
                {line.label}
              </span>
              <span className="font-semibold">{frw(line.amount)}</span>
            </li>
          );
        })}
      </ul>
      {split && (
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-bold">
          <span>Order total</span>
          <span>{frw(total)}</span>
        </div>
      )}
    </div>
  );
}
