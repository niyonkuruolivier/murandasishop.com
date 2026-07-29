import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, Eye, X, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signPaymentProof, type PaymentAudit, type PaymentVerification } from "@/lib/payment-verification";

export function PaymentVerificationsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [viewing, setViewing] = useState<PaymentVerification | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-payment-verifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_verifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentVerification[];
    },
  });

  const shown = rows.filter((r) => (filter === "all" ? true : r.status === filter));

  const decide = async (r: PaymentVerification, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("payment_verifications")
      .update({ status, admin_notes: note || null })
      .eq("id", r.id);
    if (error) {
      alert(error.message);
      return;
    }
    setViewing(null);
    setNote("");
    setPreviewUrl(null);
    qc.invalidateQueries({ queryKey: ["admin-payment-verifications"] });
  };

  const openView = async (r: PaymentVerification) => {
    setViewing(r);
    setNote(r.admin_notes ?? "");
    try {
      const url = await signPaymentProof(r.screenshot_url);
      setPreviewUrl(url);
    } catch {
      setPreviewUrl(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Payment Verifications</h2>
          <p className="text-xs text-muted-foreground">
            Manual MTN Mobile Money proof review. Every decision is logged.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition ${
                filter === f ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
          No {filter === "all" ? "" : filter} submissions.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold">{r.customer_name}</td>
                  <td className="px-4 py-3">{r.phone}</td>
                  <td className="px-4 py-3">FRW {Number(r.amount).toLocaleString()}</td>
                  <td className="px-4 py-3">{r.order_number || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openView(r)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                    >
                      <Eye className="h-3.5 w-3.5" /> Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-background p-6">
            <button
              onClick={() => {
                setViewing(null);
                setPreviewUrl(null);
              }}
              className="absolute right-4 top-4 rounded-full border border-border p-1.5 hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-black">Review payment proof</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Customer</div>
                <div className="font-semibold">{viewing.customer_name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Phone</div>
                <div className="font-semibold">{viewing.phone}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Amount</div>
                <div className="font-semibold">FRW {Number(viewing.amount).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Order number</div>
                <div className="font-semibold">{viewing.order_number || "—"}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs text-muted-foreground">Customer note</div>
                <div>{viewing.note || "—"}</div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-black/5">
              {previewUrl ? (
                previewUrl.match(/\.pdf(\?|$)/i) ? (
                  <iframe src={previewUrl} title="Proof PDF" className="h-[60vh] w-full" />
                ) : (
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                    <img src={previewUrl} alt="Payment proof" className="max-h-[60vh] w-full object-contain" />
                  </a>
                )
              ) : (
                <div className="p-8 text-center text-muted-foreground">Loading preview…</div>
              )}
            </div>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-accent underline"
              >
                Open full size ↗
              </a>
            )}

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-muted-foreground">Internal note (visible in audit log)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm outline-none focus:border-accent"
                placeholder="e.g. Amount doesn't match order total."
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => decide(viewing, "approved")}
                disabled={viewing.status === "approved"}
                className="inline-flex items-center gap-1 rounded-xl bg-success px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve
              </button>
              <button
                onClick={() => decide(viewing, "rejected")}
                disabled={viewing.status === "rejected"}
                className="inline-flex items-center gap-1 rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </div>

            <AuditLog verificationId={viewing.id} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map = {
    pending: { icon: Clock, cls: "border-border text-muted-foreground" },
    approved: { icon: CheckCircle2, cls: "border-success text-success" },
    rejected: { icon: XCircle, cls: "border-destructive text-destructive" },
  } as const;
  const s = map[status as keyof typeof map] ?? map.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${s.cls}`}>
      <Icon className="h-3 w-3" /> {status}
    </span>
  );
}

function AuditLog({ verificationId }: { verificationId: string }) {
  const { data: entries = [] } = useQuery({
    queryKey: ["payment-audit", verificationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_verification_audit")
        .select("*")
        .eq("verification_id", verificationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentAudit[];
    },
  });
  if (entries.length === 0) return null;
  return (
    <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> Audit log
      </div>
      <ul className="space-y-2 text-xs">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-2">
            <span className="font-semibold capitalize">{e.action}</span>
            <span className="text-muted-foreground">
              by {e.admin_email || e.admin_id || "system"} · {new Date(e.created_at).toLocaleString()}
            </span>
            {e.note && <span className="w-full text-muted-foreground">↳ {e.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
