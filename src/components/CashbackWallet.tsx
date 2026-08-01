import { Wallet, ArrowDownCircle, ArrowUpCircle, RotateCcw, SlidersHorizontal, Users } from "lucide-react";
import { useMyWallet, useMyWalletTransactions, type WalletTransaction } from "@/lib/wallet";

const frw = (n: number) => `FRW ${Math.round(Math.abs(Number(n) || 0)).toLocaleString()}`;

const FALLBACK = { label: "Wallet activity", icon: Wallet, tone: "text-foreground", sign: "" };

const META: Record<
  string,
  { label: string; icon: typeof Wallet; tone: string; sign: string }
> = {
  earned: { label: "Cashback earned", icon: ArrowDownCircle, tone: "text-success", sign: "+" },
  used: { label: "Used at checkout", icon: ArrowUpCircle, tone: "text-foreground", sign: "−" },
  reversed: { label: "Cashback reversed", icon: RotateCcw, tone: "text-destructive", sign: "−" },
  adjustment: { label: "Adjustment", icon: SlidersHorizontal, tone: "text-accent", sign: "" },
  referral: { label: "Referral reward", icon: Users, tone: "text-success", sign: "+" },
};

export function CashbackWallet() {
  const { data: balance = 0, isLoading } = useMyWallet();
  const { data: txs = [] } = useMyWalletTransactions();

  const earned = txs.filter((t) => t.type === "earned").reduce((a, t) => a + Number(t.amount), 0);
  const used = txs.filter((t) => t.type === "used").reduce((a, t) => a + Math.abs(Number(t.amount)), 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-accent bg-accent/5 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
          <Wallet className="h-4 w-4 text-accent" /> Murandasi Cashback Wallet
        </div>
        <div className="mt-3 text-4xl font-black">
          {isLoading ? "…" : frw(balance)}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Use your cashback to pay for your next order — fully or partly. Cashback can only be
          spent on Murandasi purchases; it cannot be deposited, withdrawn or transferred.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Total earned</div>
            <div className="mt-1 text-xl font-black text-success">{frw(earned)}</div>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Total used</div>
            <div className="mt-1 text-xl font-black">{frw(used)}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase text-muted-foreground">
          Transaction history
        </h3>
        {txs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No cashback activity yet. Cashback is added once an order is marked completed.
          </div>
        ) : (
          <ul className="space-y-2">
            {txs.map((t) => {
              const m = META[t.type] ?? FALLBACK;
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <m.icon className={`h-5 w-5 shrink-0 ${m.tone}`} />
                    <div className="min-w-0">
                      <div className="font-semibold">{m.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleString()}
                        {t.note ? ` · ${t.note}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black ${m.tone}`}>
                      {m.sign}
                      {frw(t.amount)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Balance {frw(t.balance_after)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
