import { useState } from "react";
import { Gift, Clock, CheckCircle2, XCircle, Lock, Package } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyProfile, useMilestones, useMyClaims, type Milestone, type RewardClaim } from "@/lib/loyalty";

type ClaimRow = RewardClaim & {
  status: "pending" | "approved" | "rejected" | "delivered" | "unlocked" | "claimed" | "redeemed";
  rejection_reason?: string | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
};

type UiStatus =
  | "not_eligible"
  | "eligible"
  | "under_review"
  | "approved"
  | "delivered"
  | "rejected";

const STATUS_LABEL: Record<UiStatus, string> = {
  not_eligible: "Not Eligible",
  eligible: "Eligible to Claim",
  under_review: "Under Review",
  approved: "Approved",
  delivered: "Reward Delivered",
  rejected: "Rejected",
};

function statusFor(purchases: number, milestone: Milestone, claim: ClaimRow | undefined): UiStatus {
  if (claim) {
    if (claim.status === "pending") return "under_review";
    if (claim.status === "approved") return "approved";
    if (claim.status === "delivered" || claim.status === "redeemed") return "delivered";
    if (claim.status === "rejected") return "rejected";
  }
  return purchases >= milestone.purchases_required ? "eligible" : "not_eligible";
}

export function RewardsProgress() {
  const { user } = useAuth();
  const { data: profile } = useMyProfile();
  const { data: milestones = [] } = useMilestones();
  const { data: claims = [] } = useMyClaims();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!user) return null;
  const purchases = profile?.approved_purchases ?? 0;

  // Latest claim per milestone
  const claimByMilestone = new Map<string, ClaimRow>();
  for (const c of claims as ClaimRow[]) {
    if (!c.milestone_id) continue;
    const existing = claimByMilestone.get(c.milestone_id);
    if (!existing || new Date(c.created_at) > new Date(existing.created_at)) {
      claimByMilestone.set(c.milestone_id, c);
    }
  }

  const submitClaim = async (milestoneId: string) => {
    setBusyId(milestoneId);
    setErr(null);
    try {
      const { error } = await supabase.from("reward_claims").insert({
        user_id: user.id,
        milestone_id: milestoneId,
        cycle_index: null,
        status: "pending",
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["my-claims"] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit claim.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-accent" />
        <h3 className="text-base font-bold">Your reward milestones</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        You have <strong className="text-foreground">{purchases}</strong> admin-approved{" "}
        {purchases === 1 ? "purchase" : "purchases"} so far.
      </p>

      <ul className="mt-5 space-y-4">
        {milestones.map((m) => {
          const claim = claimByMilestone.get(m.id);
          const status = statusFor(purchases, m, claim);
          const pct = Math.min(100, Math.round((purchases / m.purchases_required) * 100));
          const remaining = Math.max(0, m.purchases_required - purchases);
          return (
            <li key={m.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-3xl">{m.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{m.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Reach {m.purchases_required} approved purchases
                  </div>
                </div>
                <StatusBadge status={status} />
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                {Math.min(purchases, m.purchases_required)}/{m.purchases_required}
              </div>

              {status === "not_eligible" && (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" /> {remaining} more approved{" "}
                  {remaining === 1 ? "purchase" : "purchases"} to unlock.
                </p>
              )}

              {status === "eligible" && (
                <>
                  <p className="mt-3 text-sm font-semibold text-success">
                    🎉 Congratulations! You are eligible to claim your reward.
                  </p>
                  <button
                    type="button"
                    onClick={() => submitClaim(m.id)}
                    disabled={busyId === m.id}
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
                  >
                    🎁 {busyId === m.id ? "Submitting…" : "Claim Reward"}
                  </button>
                </>
              )}

              {status === "under_review" && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-accent bg-accent/10 p-3 text-sm">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <div>
                    <p className="font-semibold">Claim submitted</p>
                    <p className="text-muted-foreground">
                      Your reward claim is under review by the admin.
                    </p>
                  </div>
                </div>
              )}

              {status === "approved" && (
                <div className="mt-3 rounded-2xl border-2 border-success bg-success/10 p-4 text-center">
                  <p className="text-lg font-black">🎉 Congratulations!</p>
                  <p className="mt-1 text-sm font-semibold">
                    Your reward has been approved.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You will receive your reward soon. We will contact you with the delivery details.
                  </p>
                  {(claim?.delivery_date || claim?.delivery_time) && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Scheduled: <strong>{claim?.delivery_date ?? "TBD"}</strong>
                      {claim?.delivery_time ? (
                        <> at <strong>{claim.delivery_time}</strong></>
                      ) : null}
                    </p>
                  )}
                </div>
              )}

              {status === "delivered" && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary bg-primary/10 p-3 text-sm">
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="font-semibold">Reward delivered</p>
                    <p className="text-muted-foreground">Thanks for being a valued customer!</p>
                  </div>
                </div>
              )}

              {status === "rejected" && (
                <div className="mt-3 rounded-xl border border-destructive bg-destructive/10 p-3 text-sm">
                  <p className="flex items-center gap-2 font-semibold">
                    <XCircle className="h-4 w-4 text-destructive" /> Claim not approved
                  </p>
                  {claim?.rejection_reason && (
                    <p className="mt-1 text-muted-foreground">
                      Reason: {claim.rejection_reason}
                    </p>
                  )}
                  {purchases >= m.purchases_required && (
                    <button
                      type="button"
                      onClick={() => submitClaim(m.id)}
                      disabled={busyId === m.id}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
                    >
                      {busyId === m.id ? "Resubmitting…" : "Resubmit claim"}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {milestones.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No reward milestones configured yet.
          </li>
        )}
      </ul>

      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: UiStatus }) {
  const styles: Record<UiStatus, string> = {
    not_eligible: "border-border text-muted-foreground",
    eligible: "border-accent text-accent bg-accent/10",
    under_review: "border-accent text-accent bg-accent/10",
    approved: "border-success text-success bg-success/10",
    delivered: "border-primary text-primary bg-primary/10",
    rejected: "border-destructive text-destructive bg-destructive/10",
  };
  const Icon =
    status === "approved" || status === "delivered"
      ? CheckCircle2
      : status === "under_review"
        ? Clock
        : status === "rejected"
          ? XCircle
          : status === "eligible"
            ? Gift
            : Lock;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}
    >
      <Icon className="h-3 w-3" />
      {STATUS_LABEL[status]}
    </span>
  );
}
