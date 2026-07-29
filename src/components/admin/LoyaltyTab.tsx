import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, Eye, Trash2, Plus, ArrowUp, ArrowDown, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signWhatsappProof } from "@/lib/upload";
import type { Milestone, Profile, RewardClaim, WhatsappPurchase } from "@/lib/loyalty";

type Sub = "whatsapp" | "gifts" | "milestones" | "customers";

export function LoyaltyTab() {
  const [sub, setSub] = useState<Sub>("gifts");
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["admin-pending-gift-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("reward_claims")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .is("milestone_id", null);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 15_000,
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            { id: "gifts", label: "Gift Claims", badge: pendingCount },
            { id: "whatsapp", label: "WhatsApp Verifications", badge: 0 },
            { id: "milestones", label: "Milestones", badge: 0 },
            { id: "customers", label: "Customers", badge: 0 },
          ] as const
        ).map((s) => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              sub === s.id
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
            {s.badge > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                {s.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {sub === "whatsapp" && <WhatsappVerifications />}
      {sub === "gifts" && <GiftClaims />}
      {sub === "milestones" && <Milestones />}
      {sub === "customers" && <Customers />}
    </div>
  );
}

function WhatsappVerifications() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-wa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_purchases")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WhatsappPurchase[];
    },
  });

  const [viewing, setViewing] = useState<string | null>(null);

  const decide = async (r: WhatsappPurchase, status: "approved" | "rejected") => {
    const note =
      status === "rejected"
        ? prompt("Reason for rejection? (shown to customer)") || null
        : null;
    await supabase
      .from("whatsapp_purchases")
      .update({
        status,
        admin_notes: note,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["admin-wa"] });
  };

  const view = async (path: string) => {
    try {
      const url = await signWhatsappProof(path, 300);
      setViewing(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (rows.length === 0)
    return (
      <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
        No WhatsApp submissions yet.
      </div>
    );

  return (
    <>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold">FRW {Number(r.amount).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">
                User: {r.user_id.slice(0, 8)}… · {new Date(r.created_at).toLocaleString()}
              </div>
              {r.notes && <div className="mt-1 text-xs">{r.notes}</div>}
            </div>
            <button
              onClick={() => view(r.screenshot_url)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              <Eye className="h-3 w-3" /> View proof
            </button>
            {r.status === "pending" ? (
              <div className="flex gap-2">
                <button
                  onClick={() => decide(r, "approved")}
                  className="inline-flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 text-xs font-bold text-success-foreground hover:brightness-110"
                >
                  <CheckCircle2 className="h-3 w-3" /> Approve
                </button>
                <button
                  onClick={() => decide(r, "rejected")}
                  className="inline-flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground hover:brightness-110"
                >
                  <XCircle className="h-3 w-3" /> Reject
                </button>
              </div>
            ) : r.status === "approved" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-success px-3 py-1 text-xs font-semibold text-success">
                Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-destructive px-3 py-1 text-xs font-semibold text-destructive">
                Rejected
              </span>
            )}
          </li>
        ))}
      </ul>
      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setViewing(null)}
        >
          <div className="relative max-h-[90vh] max-w-3xl">
            <button className="absolute -top-10 right-0 rounded-full bg-white p-2" onClick={() => setViewing(null)}>
              <X className="h-4 w-4" />
            </button>
            <img src={viewing} alt="Proof" className="max-h-[85vh] rounded-xl" />
          </div>
        </div>
      )}
    </>
  );
}

type GiftClaimRow = {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected" | "delivered";
  cycle_index: number | null;
  rejection_reason: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  approved_at: string | null;
  created_at: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    approved_purchases: number;
  } | null;
  latest_order: { address: string | null; city: string | null } | null;
};

const STATUS_STYLES: Record<GiftClaimRow["status"], string> = {
  pending: "border-accent text-accent bg-accent/10",
  approved: "border-success text-success bg-success/10",
  rejected: "border-destructive text-destructive bg-destructive/10",
  delivered: "border-primary text-primary bg-primary/10",
};

function GiftClaims() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | GiftClaimRow["status"]>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GiftClaimRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-gift-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_claims")
        .select(
          "id,user_id,status,cycle_index,rejection_reason,delivery_date,delivery_time,approved_at,created_at,profile:profiles(id,full_name,email,phone,approved_purchases)",
        )
        .is("milestone_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const claims = (data ?? []) as unknown as GiftClaimRow[];
      // Fetch latest order address for each user in one go
      const userIds = Array.from(new Set(claims.map((c) => c.user_id)));
      if (userIds.length === 0) return claims;
      const { data: orders } = await supabase
        .from("orders")
        .select("user_id,address,city,created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false });
      const addressByUser = new Map<string, { address: string | null; city: string | null }>();
      for (const o of orders ?? []) {
        if (!addressByUser.has(o.user_id as string)) {
          addressByUser.set(o.user_id as string, { address: o.address, city: o.city });
        }
      }
      return claims.map((c) => ({ ...c, latest_order: addressByUser.get(c.user_id) ?? null }));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        r.profile?.full_name ?? "",
        r.profile?.email ?? "",
        r.profile?.phone ?? "",
        new Date(r.created_at).toLocaleString(),
        r.status,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, statusFilter, search]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-gift-claims"] });
    qc.invalidateQueries({ queryKey: ["admin-pending-gift-count"] });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, email, date…"
          className="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        />
        <div className="flex flex-wrap gap-1">
          {(["all", "pending", "approved", "rejected", "delivered"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition ${
                statusFilter === s
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
          No gift claims match your filters.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="text-3xl">🎁</div>
              <div className="min-w-0 flex-1">
                <div className="font-bold">
                  {c.profile?.full_name || c.profile?.email || `User ${c.user_id.slice(0, 8)}…`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.profile?.phone ?? "no phone"} · Cycle #{c.cycle_index} ·{" "}
                  {new Date(c.created_at).toLocaleString()}
                </div>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[c.status]}`}
              >
                {c.status}
              </span>
              <button
                onClick={() => setSelected(c)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                <Eye className="h-3 w-3" /> View
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <GiftClaimDialog
          claim={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            refresh();
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function GiftClaimDialog({
  claim,
  onClose,
  onChanged,
}: {
  claim: GiftClaimRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"view" | "approve" | "reject">("view");
  const [date, setDate] = useState(claim.delivery_date ?? "");
  const [time, setTime] = useState(claim.delivery_time ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const approve = async () => {
    if (!date || !time) {
      setErr("Please enter delivery date and time.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from("reward_claims")
      .update({ status: "approved", delivery_date: date, delivery_time: time })
      .eq("id", claim.id);
    setBusy(false);
    if (error) return setErr(error.message);
    onChanged();
  };

  const reject = async () => {
    if (!reason.trim()) {
      setErr("Please provide a reason for the customer.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from("reward_claims")
      .update({ status: "rejected", rejection_reason: reason.trim() })
      .eq("id", claim.id);
    setBusy(false);
    if (error) return setErr(error.message);
    onChanged();
  };

  const markDelivered = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("reward_claims")
      .update({ status: "delivered" })
      .eq("id", claim.id);
    setBusy(false);
    if (error) return setErr(error.message);
    onChanged();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-lg font-bold">Gift claim details</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5 text-sm">
          <Row label="Full name" value={claim.profile?.full_name ?? "—"} />
          <Row label="Phone" value={claim.profile?.phone ?? "—"} />
          <Row label="Email" value={claim.profile?.email ?? "—"} />
          <Row
            label="Delivery address"
            value={
              claim.latest_order
                ? [claim.latest_order.address, claim.latest_order.city].filter(Boolean).join(", ") || "—"
                : "—"
            }
          />
          <Row label="Total approved purchases" value={String(claim.profile?.approved_purchases ?? 0)} />
          <Row label="Customer ID" value={claim.user_id} />
          <Row label="Cycle #" value={String(claim.cycle_index ?? "—")} />
          <Row label="Submitted" value={new Date(claim.created_at).toLocaleString()} />
          <Row
            label="Status"
            value={
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[claim.status]}`}
              >
                {claim.status}
              </span>
            }
          />
          {claim.status === "approved" && (
            <Row
              label="Delivery scheduled"
              value={`${claim.delivery_date ?? "—"} at ${claim.delivery_time ?? "—"}`}
            />
          )}
          {claim.status === "rejected" && (
            <Row label="Rejection reason" value={claim.rejection_reason ?? "—"} />
          )}

          {mode === "approve" && (
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Enter delivery details
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs">Delivery date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs">Delivery time</span>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-sm"
                  />
                </label>
              </div>
            </div>
          )}
          {mode === "reject" && (
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Rejection reason (shown to customer)
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder="e.g. Payment proof unclear, please resubmit."
              />
            </div>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          {claim.status === "pending" && mode === "view" && (
            <>
              <button
                onClick={() => setMode("approve")}
                className="inline-flex items-center gap-1 rounded-lg bg-success px-4 py-2 text-sm font-bold text-success-foreground hover:brightness-110"
              >
                <CheckCircle2 className="h-4 w-4" /> Confirm Gift
              </button>
              <button
                onClick={() => setMode("reject")}
                className="inline-flex items-center gap-1 rounded-lg bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground hover:brightness-110"
              >
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </>
          )}
          {mode === "approve" && (
            <>
              <button
                onClick={approve}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg bg-success px-4 py-2 text-sm font-bold text-success-foreground hover:brightness-110 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" /> {busy ? "Confirming…" : "Confirm Gift"}
              </button>
              <button
                onClick={() => setMode("view")}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
              >
                Back
              </button>
            </>
          )}
          {mode === "reject" && (
            <>
              <button
                onClick={reject}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground hover:brightness-110 disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" /> {busy ? "Rejecting…" : "Confirm rejection"}
              </button>
              <button
                onClick={() => setMode("view")}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
              >
                Back
              </button>
            </>
          )}
          {claim.status === "approved" && (
            <button
              onClick={markDelivered}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-60"
            >
              📦 Mark as delivered
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 pb-2 last:border-0">
      <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

function Milestones() {
  const qc = useQueryClient();
  const { data: rows = [], refetch } = useQuery({
    queryKey: ["admin-milestones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_milestones")
        .select("*")
        .order("purchases_required", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
  });
  const [editing, setEditing] = useState<Milestone | "new" | null>(null);

  const remove = async (id: string) => {
    if (!confirm("Delete this milestone?")) return;
    await supabase.from("reward_milestones").delete().eq("id", id);
    refetch();
    qc.invalidateQueries({ queryKey: ["milestones"] });
  };

  const toggleActive = async (m: Milestone) => {
    await supabase.from("reward_milestones").update({ active: !m.active }).eq("id", m.id);
    refetch();
    qc.invalidateQueries({ queryKey: ["milestones"] });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase text-muted-foreground">{rows.length} milestones</h3>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> New milestone
        </button>
      </div>

      <ul className="space-y-3">
        {rows.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="text-3xl">{m.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold">{m.title}</div>
              <div className="text-xs text-muted-foreground">{m.description}</div>
            </div>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold">
              {m.purchases_required} purchases
            </span>
            <button
              onClick={() => toggleActive(m)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                m.active ? "border-success text-success" : "border-border text-muted-foreground"
              }`}
            >
              {m.active ? "Live" : "Hidden"}
            </button>
            <button onClick={() => setEditing(m)} className="rounded-lg p-2 hover:bg-secondary" aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => remove(m.id)}
              className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {editing && (
        <MilestoneEditor
          milestone={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null);
            refetch();
            qc.invalidateQueries({ queryKey: ["milestones"] });
          }}
        />
      )}
    </div>
  );
}

function MilestoneEditor({ milestone, onClose }: { milestone: Milestone | null; onClose: () => void }) {
  const [form, setForm] = useState({
    purchases_required: milestone?.purchases_required ?? 5,
    title: milestone?.title ?? "",
    description: milestone?.description ?? "",
    emoji: milestone?.emoji ?? "🎁",
    active: milestone?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (milestone) {
        const { error } = await supabase.from("reward_milestones").update(form).eq("id", milestone.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reward_milestones").insert(form);
        if (error) throw error;
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-black">{milestone ? "Edit milestone" : "New milestone"}</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-[80px_1fr]">
          <label className="block">
            <span className="text-sm font-medium">Emoji</span>
            <input
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-center text-xl"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1.5 min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Purchases required to unlock</span>
            <input
              type="number"
              min={1}
              value={form.purchases_required}
              onChange={(e) => setForm({ ...form, purchases_required: Number(e.target.value) })}
              className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3"
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4"
            />
            Active (visible to customers)
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-5 py-2.5 font-semibold hover:bg-secondary">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-accent px-6 py-2.5 font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Customers() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("approved_purchases", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (rows.length === 0)
    return (
      <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
        No customers yet.
      </div>
    );

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-secondary text-left">
          <tr>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Purchases</th>
            <th className="px-4 py-3">Total spent</th>
            <th className="px-4 py-3">Joined</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <td className="px-4 py-3">
                <div className="font-semibold">{p.full_name || "—"}</div>
                <div className="text-xs text-muted-foreground">{p.email}</div>
              </td>
              <td className="px-4 py-3 font-bold">{p.approved_purchases}</td>
              <td className="px-4 py-3">FRW {Number(p.total_spent).toLocaleString()}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {new Date(p.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
