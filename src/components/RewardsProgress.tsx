import { useState } from "react";
import { Gift, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyProfile } from "@/lib/loyalty";

const GOAL = 20;

type CycleClaim = {
  id: string;
  status: "pending" | "approved" | "rejected" | "delivered";
  cycle_index: number;
  rejection_reason: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  created_at: string;
};

export function RewardsProgress({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { data: profile } = useMyProfile();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const approved = profile?.approved_purchases ?? 0;
  const cycleStart = profile?.reward_cycle_start ?? 0;
  const nextCycleIndex = Math.floor(cycleStart / GOAL) + 1;

  const { data: cycleClaim } = useQuery({
    queryKey: ["my-cycle-claim", user?.id, nextCycleIndex],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_claims")
        .select("id,status,cycle_index,rejection_reason,delivery_date,delivery_time,created_at")
        .eq("user_id", user!.id)
        .eq("cycle_index", nextCycleIndex)
        .is("milestone_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as CycleClaim | null) ?? null;
    },
  });

  if (!user) return null;

  const progress = Math.max(0, approved - cycleStart);
  const count = Math.min(progress, GOAL);
  const pct = Math.round((count / GOAL) * 100);
  const reached = progress >= GOAL;

  const submitClaim = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("reward_claims").insert({
        user_id: user.id,
        milestone_id: null,
        cycle_index: nextCycleIndex,
        status: "pending",
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["my-cycle-claim"] });
      await qc.invalidateQueries({ queryKey: ["my-claims"] });
      setMsg("✅ Your gift claim has been submitted successfully. Please wait while our team reviews your request.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not submit claim.");
    } finally {
      setBusy(false);
    }
  };

  const status = cycleClaim?.status;

  return (
    <div
      className={`rounded-2xl border border-border bg-card ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-accent" />
          <h3 className={`font-bold ${compact ? "text-sm" : "text-base"}`}>
            Rewards progress
          </h3>
        </div>
        <span className="text-sm font-black tabular-nums">
          {count}/{GOAL}
        </span>
      </div>

      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {reached ? (
        <p className="mt-3 text-sm font-semibold">
          Congratulations! You've reached {GOAL}/{GOAL} approved purchases.
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          You have completed {count} of {GOAL} purchases. Keep shopping to unlock your gift!
        </p>
      )}

      {(profile?.gifts_claimed ?? 0) > 0 && !reached && (
        <p className="mt-1 text-xs text-muted-foreground">
          Gifts claimed so far: {profile?.gifts_claimed}
        </p>
      )}

      {reached && !status && (
        <button
          type="button"
          onClick={submitClaim}
          disabled={busy}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
        >
          🎁 {busy ? "Submitting…" : "Claim Your Gift"}
        </button>
      )}

      {status === "pending" && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-accent bg-accent/10 p-3 text-sm">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="font-semibold">Gift claim submitted</p>
            <p className="text-muted-foreground">Waiting for admin approval.</p>
          </div>
        </div>
      )}

      {status === "approved" && (
        <div className="mt-4 rounded-2xl border-2 border-success bg-success/10 p-5 text-center">
          <p className="text-2xl font-black">🎉 Congratulations!</p>
          <p className="mt-2 text-sm font-semibold">
            Your gift claim has been accepted successfully.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            We will contact you as soon as possible to arrange delivery or collection of your gift.
          </p>
          <p className="mt-2 text-sm font-semibold">Thank you for being a valued customer! 💛</p>
          {(cycleClaim?.delivery_date || cycleClaim?.delivery_time) && (
            <p className="mt-3 text-xs text-muted-foreground">
              Scheduled: <strong>{cycleClaim?.delivery_date ?? "TBD"}</strong>
              {cycleClaim?.delivery_time ? <> at <strong>{cycleClaim.delivery_time}</strong></> : null}
            </p>
          )}
        </div>
      )}

      {status === "rejected" && (
        <div className="mt-4 rounded-xl border border-destructive bg-destructive/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <XCircle className="h-4 w-4 text-destructive" /> Claim not approved
          </p>
          {cycleClaim?.rejection_reason && (
            <p className="mt-1 text-muted-foreground">Reason: {cycleClaim.rejection_reason}</p>
          )}
          <button
            type="button"
            onClick={submitClaim}
            disabled={busy}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Resubmitting…" : "Resubmit claim"}
          </button>
        </div>
      )}

      {msg && <p className="mt-3 text-sm text-success">{msg}</p>}
    </div>
  );
}
