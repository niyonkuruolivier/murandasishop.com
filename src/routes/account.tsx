import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Gift, Package, MessageCircle, Bell, Upload, LogOut, CheckCircle2, Clock, XCircle, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  useMyProfile,
  useMilestones,
  useMyClaims,
  useMyWhatsapp,
  useMyOrders,
  useMyNotifications,
  type Milestone,
} from "@/lib/loyalty";
import { uploadWhatsappProof } from "@/lib/upload";
import { RewardsProgress } from "@/components/RewardsProgress";


export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — Murandasi Shop" },
      { name: "description", content: "Track your purchases, rewards, and progress toward the next gift." },
      { property: "og:title", content: "My Account — Murandasi Shop" },
      { property: "og:description", content: "Your loyalty dashboard on Murandasi Shop." },
    ],
  }),
  component: AccountPage,
});

type Tab = "overview" | "rewards" | "orders" | "whatsapp" | "notifications";

function AccountPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <main className="mx-auto max-w-5xl px-4 py-20 text-center text-muted-foreground">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Header />
      <div className="mb-6 flex flex-wrap gap-2 border-b border-border">
        {(
          [
            { id: "overview", label: "Overview", icon: Trophy },
            { id: "rewards", label: "Rewards", icon: Gift },
            { id: "orders", label: "My Orders", icon: Package },
            { id: "whatsapp", label: "WhatsApp Proofs", icon: MessageCircle },
            { id: "notifications", label: "Notifications", icon: Bell },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              tab === t.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview />}
      {tab === "rewards" && <Rewards />}
      {tab === "orders" && <MyOrders />}
      {tab === "whatsapp" && <WhatsappTab />}
      {tab === "notifications" && <NotificationsTab />}
    </main>
  );
}

function Header() {
  const { user } = useAuth();
  const { data: profile } = useMyProfile();
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-black">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""} 👋
        </h1>
        <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
      </div>
      <div className="flex gap-2">
        <Link
          to="/"
          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          Continue shopping
        </Link>
        <button
          onClick={() => supabase.auth.signOut()}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

function Overview() {
  const { data: profile } = useMyProfile();
  const { data: milestones = [] } = useMilestones();
  const { data: claims = [] } = useMyClaims();

  const purchases = profile?.approved_purchases ?? 0;
  const next = useMemo(
    () => milestones.find((m) => m.purchases_required > purchases),
    [milestones, purchases],
  );
  const progress = next
    ? Math.min(100, Math.round((purchases / next.purchases_required) * 100))
    : 100;

  return (
    <div className="space-y-6">
      <RewardsProgress />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Approved purchases" value={purchases} />
        <StatCard label="Total spent" value={`FRW ${Number(profile?.total_spent ?? 0).toLocaleString()}`} />
        <StatCard label="Rewards unlocked" value={claims.length} />
      </div>


      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-accent" />
          <h2 className="text-lg font-bold">Next reward</h2>
        </div>
        {next ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {purchases} of {next.purchases_required} purchases — {next.purchases_required - purchases} to go to unlock{" "}
              <strong className="text-foreground">
                {next.emoji} {next.title}
              </strong>
            </p>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-accent transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            You've unlocked every reward. New tiers coming soon! 🎉
          </p>
        )}
      </div>

      <MilestoneList milestones={milestones} purchases={purchases} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}

function MilestoneList({ milestones, purchases }: { milestones: Milestone[]; purchases: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-bold">All milestones</h2>
      <ul className="space-y-3">
        {milestones.map((m) => {
          const unlocked = purchases >= m.purchases_required;
          return (
            <li
              key={m.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                unlocked ? "border-accent bg-accent/5" : "border-border"
              }`}
            >
              <div className="text-3xl">{m.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold">{m.title}</div>
                <div className="text-xs text-muted-foreground">{m.description}</div>
              </div>
              <div className="text-right text-xs font-semibold">
                <div>{m.purchases_required} purchases</div>
                <div className={unlocked ? "text-accent" : "text-muted-foreground"}>
                  {unlocked ? "Unlocked" : `${m.purchases_required - purchases} to go`}
                </div>
              </div>
            </li>
          );
        })}
        {milestones.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No milestones yet. Check back soon!
          </li>
        )}
      </ul>
    </div>
  );
}

function Rewards() {
  const qc = useQueryClient();
  const { data: claims = [] } = useMyClaims();
  const { data: milestones = [] } = useMilestones();
  const byId = new Map(milestones.map((m) => [m.id, m]));

  const claim = async (id: string) => {
    await supabase.from("reward_claims").update({ status: "claimed", claimed_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["my-claims"] });
  };

  if (claims.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
        No rewards unlocked yet. Keep shopping to reach your first milestone!
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {claims.map((c) => {
        const m = byId.get(c.milestone_id);
        if (!m) return null;
        return (
          <li key={c.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-4xl">{m.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold">{m.title}</div>
                <div className="text-sm text-muted-foreground">{m.description}</div>
              </div>
              <div>
                {c.status === "unlocked" && (
                  <button
                    onClick={() => claim(c.id)}
                    className="rounded-xl bg-accent px-5 py-2.5 font-bold text-accent-foreground hover:brightness-110"
                  >
                    Claim
                  </button>
                )}
                {c.status === "claimed" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent px-3 py-1 text-xs font-semibold text-accent">
                    <Clock className="h-3 w-3" /> Awaiting admin
                  </span>
                )}
                {c.status === "redeemed" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-success px-3 py-1 text-xs font-semibold text-success">
                    <CheckCircle2 className="h-3 w-3" /> Redeemed
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MyOrders() {
  const { data: orders = [], isLoading } = useMyOrders();
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (orders.length === 0)
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
        No orders yet. <Link to="/" className="text-accent underline">Start shopping</Link>
      </div>
    );

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <details key={o.id} className="rounded-2xl border border-border bg-card">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-bold">Order #{o.id.slice(0, 8).toUpperCase()}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(o.created_at).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black">FRW {Number(o.total).toLocaleString()}</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge(o.status)}`}>
                {o.status}
              </span>
            </div>
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {o.items?.map((it, i) => (
              <li key={i} className="flex justify-between px-4 py-2 text-sm">
                <span>
                  {it.name} × {it.qty}
                </span>
                <span className="font-semibold">FRW {(it.price * it.qty).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function statusBadge(s: string) {
  switch (s) {
    case "delivered":
    case "approved":
      return "border-success text-success";
    case "shipped":
      return "border-accent text-accent";
    case "cancelled":
      return "border-destructive text-destructive";
    default:
      return "border-border text-muted-foreground";
  }
}

function WhatsappTab() {
  const qc = useQueryClient();
  const { data: subs = [] } = useMyWhatsapp();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(false);
    if (!file) {
      setErr("Please attach the WhatsApp order screenshot.");
      return;
    }
    setBusy(true);
    try {
      const path = await uploadWhatsappProof(file);
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase.from("whatsapp_purchases").insert({
        user_id: uid,
        amount: Number(amount) || 0,
        screenshot_url: path,
        notes: notes || null,
        status: "pending",
      });
      if (error) throw error;
      setAmount("");
      setNotes("");
      setFile(null);
      setOk(true);
      qc.invalidateQueries({ queryKey: ["my-wa"] });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-bold">Submit a WhatsApp purchase</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ordered via WhatsApp? Upload your payment screenshot so it counts toward your rewards.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Amount paid (FRW)</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 outline-none focus:border-accent"
              placeholder="e.g. 45000"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Screenshot</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1.5 block w-full text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
              placeholder="Product ordered, date, phone number used…"
            />
          </label>
        </div>
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
        {ok && <p className="mt-3 text-sm text-success">Submitted! We'll review shortly.</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" /> {busy ? "Submitting…" : "Submit for review"}
        </button>
      </form>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Your submissions</h3>
        {subs.length === 0 ? (
          <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
            No submissions yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                <div>
                  <div className="font-semibold">FRW {Number(s.amount).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                  {s.admin_notes && (
                    <div className="mt-1 text-xs text-muted-foreground">Note: {s.admin_notes}</div>
                  )}
                </div>
                <StatusPill status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success px-3 py-1 text-xs font-semibold text-success">
        <CheckCircle2 className="h-3 w-3" /> Approved
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive px-3 py-1 text-xs font-semibold text-destructive">
        <XCircle className="h-3 w-3" /> Rejected
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

function NotificationsTab() {
  const qc = useQueryClient();
  const { data: notifs = [] } = useMyNotifications();

  const markAllRead = async () => {
    const ids = notifs.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ read: true }).in("id", ids);
    qc.invalidateQueries({ queryKey: ["my-notifs"] });
  };

  if (notifs.length === 0)
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
        No notifications yet.
      </div>
    );

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          onClick={markAllRead}
          className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
        >
          Mark all read
        </button>
      </div>
      <ul className="space-y-2">
        {notifs.map((n) => (
          <li
            key={n.id}
            className={`rounded-2xl border p-4 ${
              n.read ? "border-border bg-card" : "border-accent/40 bg-accent/5"
            }`}
          >
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-4 w-4 text-accent" />
              <div className="flex-1">
                <div className="font-semibold">{n.title}</div>
                {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
