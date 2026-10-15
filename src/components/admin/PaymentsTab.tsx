import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  History,
  Wallet,
  X,
  Trash2,
} from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

type PaymentRow = {
  id: string;
  order_id: string | null;
  phone: string;
  amount: number;
  status: string;
  provider: string;
  provider_ref: string | null;
  external_ref: string | null;
  failure_reason: string | null;
  created_at: string;
};

const frw = (n: number) => `FRW ${Math.round(Number(n) || 0).toLocaleString()}`;
type BalanceResult = {
  ok: boolean;
  balance: number | null;
  currency?: string;
  message?: string | null;
  responseCode?: string | null;
  endpoint?: string;
  timestamp?: string;
  httpStatus?: number;
  raw?: unknown;
  accountNo?: string;
};

const TONE: Record<string, { icon: typeof Clock; cls: string }> = {
  success: { icon: CheckCircle2, cls: "text-success" },
  pending: { icon: Clock, cls: "text-muted-foreground" },
  failed: { icon: XCircle, cls: "text-destructive" },
};

const PAYMENT_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
] as const;

export function PaymentsTab() {
  const qc = useQueryClient();
  const [view, setView] = useState<"collections" | "deposits">("collections");
  const [showDeposit, setShowDeposit] = useState(false);
  const [balanceMsg, setBalanceMsg] = useState<string | null>(null);
  const [balanceResult, setBalanceResult] = useState<BalanceResult | null>(null);
  const [balanceBusy, setBalanceBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["intouchpay-config"],
    queryFn: () =>
      apiGet<{
        configured: boolean;
        username: string | null;
        accountNo: string | null;
        mode: "sandbox" | "live";
      }>(
        "/payments/intouchpay/config",
      ),
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-payments"],
    refetchInterval: 15_000,
    queryFn: () => apiGet<PaymentRow[]>("/payments"),
  });

  const { data: deposits = [], isLoading: depositsLoading } = useQuery({
    queryKey: ["admin-deposits"],
    enabled: view === "deposits",
    refetchInterval: 15_000,
    queryFn: () => apiGet<PaymentRow[]>("/payments/intouchpay/deposits"),
  });

  const collections = rows.filter((r) => r.provider !== "intouchpay_deposit");
  const list = view === "collections" ? collections : deposits;

  const refreshLists = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-payments"] }),
      qc.invalidateQueries({ queryKey: ["admin-deposits"] }),
      qc.invalidateQueries({ queryKey: ["admin-badges"] }),
    ]);
  };

  const deleteOne = async (id: string) => {
    if (!confirm("Delete this history row? This only removes it from your shop database.")) return;
    setDeletingId(id);
    try {
      await apiDelete(`/payments/${id}`);
      await refreshLists();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const setPaymentStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await apiPatch(`/payments/${id}/status`, { status });
      await Promise.all([
        refreshLists(),
        qc.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not update payment status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const clearCurrent = async () => {
    const label = view === "collections" ? "collection" : "deposit";
    if (
      !confirm(
        `Clear all ${label} history from the database?\n\nThis does not reverse money on IntouchPay — it only deletes local records.`,
      )
    ) {
      return;
    }
    setClearing(true);
    try {
      await apiDelete(`/payments/history?type=${view}`);
      await refreshLists();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setClearing(false);
    }
  };

  const checkBalance = async () => {
    setBalanceBusy(true);
    setBalanceMsg(null);
    setBalanceResult(null);
    try {
      const data = await apiGet<BalanceResult>("/payments/intouchpay/balance");
      setBalanceResult(data);
      if (data.balance == null) {
        setBalanceMsg(data.message || "Could not read balance from IntouchPay.");
      } else {
        setBalanceMsg(
          `Account ${data.accountNo || ""} balance: ${frw(data.balance)} ${data.currency || "RWF"}`,
        );
      }
    } catch (e) {
      setBalanceMsg(e instanceof Error ? e.message : "Balance check failed.");
    } finally {
      setBalanceBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">IntouchPay</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {config?.configured
                ? `${config.mode === "live" ? "Live" : "Sandbox"} account ${config.accountNo || ""} (${config.username || ""})`
                : "IntouchPay is not configured in .env"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowDeposit(true)}
            disabled={!config?.configured}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Request Deposit
          </button>
          <button
            type="button"
            onClick={() => setView("deposits")}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800"
          >
            <History className="h-4 w-4" /> Deposit History
          </button>
          <button
            type="button"
            onClick={checkBalance}
            disabled={balanceBusy || !config?.configured}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            <Wallet className="h-4 w-4" /> {balanceBusy ? "Checking…" : "Get Balance"}
          </button>
        </div>

        {balanceResult && (
          <div className="mt-4 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm">
            <div className="font-bold">
              HTTP {balanceResult.httpStatus ?? "unknown"} · IntouchPay code{" "}
              {balanceResult.responseCode || "none"}
            </div>
            <p className="mt-1 font-semibold">
              {balanceResult.balance == null
                ? balanceResult.message || "Could not read balance from IntouchPay."
                : `Account balance: ${frw(balanceResult.balance)} ${balanceResult.currency || "RWF"}`}
            </p>
            {balanceResult.endpoint && (
              <p className="mt-1 break-all text-xs text-muted-foreground">
                Endpoint: {balanceResult.endpoint}
              </p>
            )}
            {balanceResult.timestamp && (
              <p className="text-xs text-muted-foreground">Timestamp: {balanceResult.timestamp} UTC</p>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-bold uppercase text-muted-foreground">
                Full server response
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-3 text-xs">
                {JSON.stringify(balanceResult.raw ?? {}, null, 2)}
              </pre>
            </details>
          </div>
        )}
        {balanceMsg && !balanceResult && (
          <p className="mt-4 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm font-semibold">
            {balanceMsg}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView("collections")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              view === "collections" ? "bg-accent text-accent-foreground" : "border border-border hover:bg-secondary"
            }`}
          >
            Collections
          </button>
          <button
            type="button"
            onClick={() => setView("deposits")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              view === "deposits" ? "bg-accent text-accent-foreground" : "border border-border hover:bg-secondary"
            }`}
          >
            Deposits
          </button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black">
              {view === "collections" ? "Customer collections" : "Deposit history"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {view === "collections"
                ? "Money collected from customers at checkout via IntouchPay."
                : "Money you sent out with Request Deposit."}
            </p>
          </div>
          {list.length > 0 && (
            <button
              type="button"
              onClick={clearCurrent}
              disabled={clearing}
              className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {clearing ? "Clearing…" : "Clear history"}
            </button>
          )}
        </div>

        {(view === "collections" ? isLoading : depositsLoading) ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No {view === "collections" ? "payments" : "deposits"} yet.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Phone</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reference</th>
                  {view === "collections" && <th>Order</th>}
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const tone = TONE[r.status] ?? TONE.pending;
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-3">{new Date(r.created_at).toLocaleString()}</td>
                      <td>{r.phone}</td>
                      <td className="font-semibold">{frw(r.amount)}</td>
                      <td>
                        <select
                          value={r.status}
                          disabled={updatingId === r.id}
                          onChange={(e) => void setPaymentStatus(r.id, e.target.value)}
                          className={`rounded-full border bg-background px-2 py-1 text-xs font-semibold ${tone.cls}`}
                        >
                          {PAYMENT_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        {r.failure_reason && (
                          <div className="mt-1 text-xs text-muted-foreground">{r.failure_reason}</div>
                        )}
                      </td>
                      <td className="font-mono text-xs">{r.provider_ref ?? r.external_ref ?? "—"}</td>
                      {view === "collections" && (
                        <td className="font-mono text-xs">{r.order_id?.slice(0, 8) ?? "—"}</td>
                      )}
                      <td>
                        <button
                          type="button"
                          onClick={() => deleteOne(r.id)}
                          disabled={deletingId === r.id}
                          className="rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          aria-label="Delete"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDeposit && (
        <DepositModal
          onClose={() => setShowDeposit(false)}
          onDone={() => {
            setShowDeposit(false);
            setView("deposits");
            qc.invalidateQueries({ queryKey: ["admin-deposits"] });
            qc.invalidateQueries({ queryKey: ["admin-payments"] });
          }}
        />
      )}
    </section>
  );
}

function DepositModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("Murandasi payout");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost("/payments/intouchpay/deposit", {
        phone,
        amount: Number(amount),
        reason,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-black">Request Deposit</h3>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Send money from your IntouchPay sandbox account to a Mobile Money number.
        </p>
        <label className="block text-sm font-medium">
          Phone (07…)
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0788123456"
            className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3"
          />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Amount (RWF)
          <input
            required
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3"
          />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Reason
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3"
          />
        </label>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 font-semibold hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-emerald-700 px-5 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send deposit"}
          </button>
        </div>
      </form>
    </div>
  );
}
