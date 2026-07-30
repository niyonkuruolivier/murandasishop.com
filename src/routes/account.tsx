import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet, Package, Bell, LogOut, CheckCircle2, Clock, XCircle, Trophy, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  useMyProfile,
  useMyOrders,
  useMyNotifications,
} from "@/lib/loyalty";
import { useMyWallet } from "@/lib/wallet";
import { CashbackWallet } from "@/components/CashbackWallet";


export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — Murandasi Shop" },
      { name: "description", content: "Track your orders and your Murandasi Cashback Wallet." },
      { property: "og:title", content: "My Account — Murandasi Shop" },
      { property: "og:description", content: "Your cashback dashboard on Murandasi Shop." },
    ],
  }),
  component: AccountPage,
});

type Tab = "overview" | "wallet" | "orders" | "tracking" | "notifications";


function AccountPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // Live sync: when admin approves a payment/order or cashback moves, the
  // customer's dashboard updates instantly.
  useEffect(() => {
    if (!user) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
      qc.invalidateQueries({ queryKey: ["my-orders", user.id] });
      qc.invalidateQueries({ queryKey: ["my-wallet", user.id] });
      qc.invalidateQueries({ queryKey: ["my-wallet-tx", user.id] });
      qc.invalidateQueries({ queryKey: ["my-notifs", user.id] });
    };
    const channel = supabase
      .channel(`account-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` }, invalidate)

      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `user_id=eq.${user.id}` }, invalidate)
      .subscribe();
    // Also refetch when tab regains focus (fallback if realtime isn't enabled).
    const onFocus = () => invalidate();
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, qc]);

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
            { id: "wallet", label: "Cashback Wallet", icon: Wallet },
            { id: "orders", label: "My Orders", icon: Package },
            { id: "tracking", label: "Order Tracking", icon: Truck },
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
      {tab === "wallet" && <CashbackWallet />}
      {tab === "orders" && <MyOrders />}
      {tab === "tracking" && <OrderTracking />}
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
  const { data: orders = [] } = useMyOrders();
  const { data: balance = 0 } = useMyWallet();




  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-accent bg-accent/5 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
          <Wallet className="h-4 w-4 text-accent" /> Cashback Wallet balance
        </div>
        <div className="mt-2 text-4xl font-black">
          FRW {Math.round(balance).toLocaleString()}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Spend it on your next order — cashback is added automatically once an order is completed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Approved purchases" value={profile?.approved_purchases ?? 0} />
        <StatCard
          label="Total spent"
          value={`FRW ${Number(profile?.total_spent ?? 0).toLocaleString()}`}
        />
        <StatCard label="Orders placed" value={orders.length} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-accent" />
          <h2 className="text-lg font-bold">How cashback works</h2>
        </div>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>1. Shop products that show an “Earn X% Cashback” badge.</li>
          <li>2. Pay with Mobile Money — cashback is earned on the Mobile Money amount only.</li>
          <li>3. When your order is marked <strong className="text-foreground">completed</strong>, cashback lands in your wallet.</li>
          <li>4. Use your wallet at checkout, fully or partly, on any future order.</li>
        </ol>
      </div>
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
          <div className="flex flex-wrap gap-2 border-t border-border p-4 text-xs">
            {Number(o.wallet_applied) > 0 && (
              <span className="rounded-full border border-border px-3 py-1 font-semibold">
                Cashback used: FRW {Number(o.wallet_applied).toLocaleString()}
              </span>
            )}
            <span
              className={`rounded-full border px-3 py-1 font-semibold ${
                o.cashback_status === "credited"
                  ? "border-success text-success"
                  : o.cashback_status === "reversed"
                    ? "border-destructive text-destructive"
                    : "border-border text-muted-foreground"
              }`}
            >
              {o.cashback_status === "credited"
                ? `Cashback earned: FRW ${Number(o.cashback_awarded).toLocaleString()}`
                : o.cashback_status === "reversed"
                  ? "Cashback reversed"
                  : "Cashback pending order completion"}
            </span>
          </div>

        </details>
      ))}
    </div>
  );
}

function statusBadge(s: string) {
  switch (s) {
    case "completed":
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

const TRACK_STEPS = [
  { key: "pending", label: "Order placed", hint: "We received your order" },
  { key: "payment_verified", label: "Payment approved", hint: "Admin verified your payment" },
  { key: "processing", label: "Processing", hint: "We're preparing your items" },
  { key: "shipped", label: "Out for delivery", hint: "On the way to you" },
  { key: "delivered", label: "Delivered", hint: "Enjoy your purchase!" },
] as const;

function stepIndexFor(status: string) {
  if (status === "approved") return 1;
  if (status === "completed") return TRACK_STEPS.length - 1;
  const i = TRACK_STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

function OrderTracking() {
  const { data: orders = [], isLoading } = useMyOrders();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (orders.length === 0)
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
        No orders to track yet. <Link to="/" className="text-accent underline">Start shopping</Link>
      </div>
    );

  return (
    <div className="space-y-4">
      {orders.map((o) => {
        const cancelled = o.status === "cancelled";
        const current = stepIndexFor(o.status);
        return (
          <div key={o.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold">Order #{o.id.slice(0, 8).toUpperCase()}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString()} · FRW {Number(o.total).toLocaleString()}
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge(o.status)}`}>
                {o.status.replace(/_/g, " ")}
              </span>
            </div>

            {cancelled ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" /> This order was cancelled. Contact support if this is unexpected.
              </p>
            ) : (
              <ol className="mt-5 space-y-0">
                {TRACK_STEPS.map((s, i) => {
                  const done = i <= current;
                  const isCurrent = i === current;
                  const last = i === TRACK_STEPS.length - 1;
                  return (
                    <li key={s.key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                            done
                              ? "border-accent bg-accent text-accent-foreground"
                              : "border-border bg-background text-muted-foreground"
                          }`}
                        >
                          {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-3.5 w-3.5" />}
                        </span>
                        {!last && (
                          <span
                            className={`w-0.5 flex-1 min-h-[28px] transition ${
                              i < current ? "bg-accent" : "bg-border"
                            }`}
                          />
                        )}
                      </div>
                      <div className={`pb-5 ${last ? "pb-0" : ""}`}>
                        <div className={`text-sm font-semibold ${isCurrent ? "text-accent" : done ? "" : "text-muted-foreground"}`}>
                          {s.label}
                        </div>
                        <div className="text-xs text-muted-foreground">{s.hint}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        );
      })}
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
