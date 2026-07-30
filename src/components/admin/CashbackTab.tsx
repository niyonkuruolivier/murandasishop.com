import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, RotateCcw, Plus, Minus, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WalletTransaction } from "@/lib/wallet";

const frw = (n: number) => `FRW ${Math.round(Math.abs(Number(n) || 0)).toLocaleString()}`;

type WalletRow = {
  id: string;
  user_id: string;
  balance: number;
  updated_at: string;
};

type ProfileLite = { id: string; full_name: string | null; email: string | null };

type CashbackOrder = {
  id: string;
  customer_name: string;
  total: number;
  status: string;
  wallet_applied: number;
  momo_amount: number | null;
  cashback_awarded: number;
  cashback_status: string;
  created_at: string;
};

function useWallets() {
  return useQuery({
    queryKey: ["admin-wallets"],
    queryFn: async () => {
      const [{ data: wallets, error }, { data: profiles }] = await Promise.all([
        supabase.from("wallets").select("*").order("balance", { ascending: false }),
        supabase.from("profiles").select("id,full_name,email"),
      ]);
      if (error) throw error;
      const byId = new Map((profiles ?? []).map((p) => [p.id, p as ProfileLite]));
      return ((wallets ?? []) as WalletRow[]).map((w) => ({
        ...w,
        profile: byId.get(w.user_id) ?? null,
      }));
    },
  });
}

function useCashbackOrders() {
  return useQuery({
    queryKey: ["admin-cashback-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,customer_name,total,status,wallet_applied,momo_amount,cashback_awarded,cashback_status,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as CashbackOrder[];
    },
  });
}

export function CashbackTab() {
  const [view, setView] = useState<"wallets" | "orders">("wallets");
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            { id: "wallets", label: "Customer wallets" },
            { id: "orders", label: "Order cashback" },
          ] as const
        ).map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              view === v.id ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === "wallets" ? <WalletsView /> : <OrdersCashbackView />}
    </div>
  );
}

function WalletsView() {
  const { data: wallets = [], isLoading, refetch } = useWallets();
  const [q, setQ] = useState("");
  const [adjusting, setAdjusting] = useState<(WalletRow & { profile: ProfileLite | null }) | null>(null);
  const [history, setHistory] = useState<string | null>(null);

  const filtered = wallets.filter((w) => {
    const s = `${w.profile?.full_name ?? ""} ${w.profile?.email ?? ""}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });

  if (isLoading)
    return <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <label className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-background px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customer by name or email"
          className="h-11 flex-1 bg-transparent text-base outline-none"
        />
      </label>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Cashback balance</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => (
              <tr key={w.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-semibold">{w.profile?.full_name || "Customer"}</div>
                  <div className="text-xs text-muted-foreground">{w.profile?.email}</div>
                </td>
                <td className="px-4 py-3 font-black">{frw(w.balance)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(w.updated_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setHistory(w.user_id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                    >
                      History
                    </button>
                    <button
                      onClick={() => setAdjusting(w)}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground hover:brightness-110"
                    >
                      Adjust
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  No customer wallets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {adjusting && (
        <AdjustDialog
          wallet={adjusting}
          onClose={() => {
            setAdjusting(null);
            refetch();
          }}
        />
      )}
      {history && <HistoryDialog userId={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function AdjustDialog({
  wallet,
  onClose,
}: {
  wallet: WalletRow & { profile: ProfileLite | null };
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [dir, setDir] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      setErr("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("admin_adjust_wallet", {
      _user_id: wallet.user_id,
      _amount: value * dir,
      _note: note || (dir > 0 ? "Manual credit by admin" : "Manual deduction by admin"),
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onClose();
  };

  return (
    <Modal title={`Adjust cashback — ${wallet.profile?.full_name || wallet.profile?.email || "Customer"}`} onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        Current balance: <strong className="text-foreground">{frw(wallet.balance)}</strong>
      </p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setDir(1)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-bold ${
            dir === 1 ? "border-success text-success" : "border-border text-muted-foreground"
          }`}
        >
          <Plus className="h-4 w-4" /> Add
        </button>
        <button
          onClick={() => setDir(-1)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-bold ${
            dir === -1 ? "border-destructive text-destructive" : "border-border text-muted-foreground"
          }`}
        >
          <Minus className="h-4 w-4" /> Deduct
        </button>
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-medium">Amount (FRW)</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus:border-accent"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-sm font-medium">Reason (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus:border-accent"
        />
      </label>
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 font-semibold hover:bg-secondary">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="rounded-xl bg-accent px-5 py-2 font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Apply"}
        </button>
      </div>
    </Modal>
  );
}

function HistoryDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["admin-wallet-tx", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as WalletTransaction[];
    },
  });

  return (
    <Modal title="Cashback history" onClose={onClose}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : txs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
          {txs.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
              <div>
                <div className="font-semibold capitalize">{t.type}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleString()}
                  {t.note ? ` · ${t.note}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-black ${Number(t.amount) >= 0 ? "text-success" : "text-destructive"}`}>
                  {Number(t.amount) >= 0 ? "+" : "−"}
                  {frw(t.amount)}
                </div>
                <div className="text-[11px] text-muted-foreground">Balance {frw(t.balance_after)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function OrdersCashbackView() {
  const { data: orders = [], isLoading, refetch } = useCashbackOrders();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const reverse = async (id: string) => {
    const reason = prompt("Reason for reversing this cashback?") ?? undefined;
    setBusy(id);
    const { error } = await supabase.rpc("admin_reverse_cashback", { _order_id: id, _reason: reason });
    setBusy(null);
    if (error) {
      alert(error.message);
      return;
    }
    refetch();
    qc.invalidateQueries({ queryKey: ["admin-wallets"] });
  };

  if (isLoading)
    return <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-secondary text-left">
          <tr>
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Wallet used</th>
            <th className="px-4 py-3">Paid by MoMo</th>
            <th className="px-4 py-3">Cashback</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-border">
              <td className="px-4 py-3">
                <div className="font-semibold">{o.customer_name}</div>
                <div className="text-xs text-muted-foreground">
                  #{o.id.slice(0, 8).toUpperCase()} · {o.status}
                </div>
              </td>
              <td className="px-4 py-3 font-semibold">{frw(o.total)}</td>
              <td className="px-4 py-3">{frw(o.wallet_applied)}</td>
              <td className="px-4 py-3">{frw(o.momo_amount ?? o.total)}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    o.cashback_status === "credited"
                      ? "border-success text-success"
                      : o.cashback_status === "reversed"
                        ? "border-destructive text-destructive"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {o.cashback_status === "credited"
                    ? `+${frw(o.cashback_awarded)}`
                    : o.cashback_status === "reversed"
                      ? "Reversed"
                      : "Not yet"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {o.cashback_status === "credited" && (
                  <button
                    onClick={() => reverse(o.id)}
                    disabled={busy === o.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reverse
                  </button>
                )}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                No orders yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="mt-10 w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-black">
            <Wallet className="h-5 w-5 text-accent" /> {title}
          </h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
