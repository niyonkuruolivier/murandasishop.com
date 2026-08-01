import { useState } from "react";
import { Users, Copy, Check, Gift, Wallet, TrendingUp, Clock } from "lucide-react";
import { useMyReferralStats, useMyReferrals, referralLink } from "@/lib/referrals";

const frw = (n: number) => `FRW ${Math.round(Number(n) || 0).toLocaleString()}`;

export function ReferralPanel() {
  const { data: stats, isLoading } = useMyReferralStats();
  const { data: rows = [] } = useMyReferrals();
  const [copied, setCopied] = useState(false);

  const link = stats?.code ? referralLink(stats.code) : "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waiting = rows.filter((r) => r.status !== "rewarded").length;
  const rewardAmount = stats?.reward_amount ?? 1000;

  const cards = [
    { label: "Registered referrals", value: stats?.total ?? rows.length, icon: Users, tone: "text-foreground" },
    { label: "Waiting for first purchase", value: waiting, icon: Clock, tone: "text-accent" },
    { label: "Completed referrals", value: stats?.successful ?? 0, icon: TrendingUp, tone: "text-success" },
    { label: "Referral cashback earned", value: frw(stats?.earnings ?? 0), icon: Gift, tone: "text-success" },
    { label: "Wallet balance", value: frw(stats?.balance ?? 0), icon: Wallet, tone: "text-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-accent bg-accent/5 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
          <Users className="h-4 w-4 text-accent" /> Invite friends, earn cashback
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Share your link. When a friend signs up and completes their first purchase, you instantly get{" "}
          <span className="font-bold text-foreground">{frw(stats?.reward_amount ?? 1000)}</span> in your
          Murandasi Cashback Wallet. One reward per friend.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={isLoading ? "Loading…" : link}
            onFocus={(e) => e.currentTarget.select()}
            className="h-12 flex-1 rounded-xl border border-border bg-background px-3 text-base outline-none"
          />
          <button
            onClick={copy}
            disabled={!link}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-bold text-accent-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <c.icon className="h-4 w-4" /> {c.label}
            </div>
            <div className={`mt-1 text-2xl font-black ${c.tone}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Your referrals</h3>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No referrals yet. Share your link to start earning.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div>
                  <div className="font-semibold">
                    {r.status === "rewarded" ? "Successful referral" : "Joined — awaiting first purchase"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                    {r.rewarded_at ? ` · rewarded ${new Date(r.rewarded_at).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <div
                  className={`text-sm font-black ${
                    r.status === "rewarded" ? "text-success" : "text-muted-foreground"
                  }`}
                >
                  {r.status === "rewarded" ? `+${frw(r.reward_amount)}` : "Pending"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
