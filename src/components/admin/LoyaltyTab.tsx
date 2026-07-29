import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, Eye, Trash2, Plus, ArrowUp, ArrowDown, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signWhatsappProof } from "@/lib/upload";
import type { Milestone, Profile, RewardClaim, WhatsappPurchase } from "@/lib/loyalty";

type Sub = "whatsapp" | "milestones" | "claims" | "customers";

export function LoyaltyTab() {
  const [sub, setSub] = useState<Sub>("whatsapp");
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            { id: "whatsapp", label: "WhatsApp Verifications" },
            { id: "claims", label: "Reward Claims" },
            { id: "milestones", label: "Milestones" },
            { id: "customers", label: "Customers" },
          ] as const
        ).map((s) => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              sub === s.id
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sub === "whatsapp" && <WhatsappVerifications />}
      {sub === "claims" && <Claims />}
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

function Claims() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_claims")
        .select("*, milestone:reward_milestones(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (RewardClaim & { milestone: Milestone })[];
    },
  });

  const setStatus = async (id: string, status: "unlocked" | "claimed" | "redeemed") => {
    const patch =
      status === "redeemed"
        ? { status, redeemed_at: new Date().toISOString() }
        : { status };
    await supabase.from("reward_claims").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-claims"] });
  };

  if (rows.length === 0)
    return (
      <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
        No unlocked rewards yet.
      </div>
    );

  return (
    <ul className="space-y-3">
      {rows.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="text-3xl">{c.milestone?.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{c.milestone?.title}</div>
            <div className="text-xs text-muted-foreground">
              User: {c.user_id.slice(0, 8)}… · {new Date(c.created_at).toLocaleString()}
            </div>
          </div>
          <select
            value={c.status}
            onChange={(e) => setStatus(c.id, e.target.value as "unlocked" | "claimed" | "redeemed")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              c.status === "redeemed"
                ? "border-success text-success"
                : c.status === "claimed"
                  ? "border-accent text-accent"
                  : "border-border text-muted-foreground"
            }`}
          >
            <option value="unlocked">Unlocked</option>
            <option value="claimed">Claimed</option>
            <option value="redeemed">Redeemed</option>
          </select>
        </li>
      ))}
    </ul>
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
