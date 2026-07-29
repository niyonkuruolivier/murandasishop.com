import { useState } from "react";
import { Gift } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyProfile, useMyClaims } from "@/lib/loyalty";

const GOAL = 10;

export function RewardsProgress({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { data: profile } = useMyProfile();
  const { data: claims = [] } = useMyClaims();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!user) return null;

  const raw = profile?.approved_purchases ?? 0;
  const count = Math.min(raw, GOAL);
  const pct = Math.round((count / GOAL) * 100);
  const reached = raw >= GOAL;

  const alreadyClaimed = claims.some(
    (c) => c.status === "claimed" || c.status === "redeemed",
  );

  const claim = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const unlocked = claims.find((c) => c.status === "unlocked");
      if (unlocked) {
        const { error } = await supabase
          .from("reward_claims")
          .update({ status: "claimed", claimed_at: new Date().toISOString() })
          .eq("id", unlocked.id);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["my-claims"] });
      }
      setMsg("Your gift claim has been received. Our team will contact you shortly.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not submit claim.");
    } finally {
      setBusy(false);
    }
  };

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
          Congratulations! You've reached {GOAL}/{GOAL} purchases.
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          You have completed {count}/{GOAL} purchases. Keep shopping to unlock
          your gift!
        </p>
      )}

      {reached && (
        <button
          type="button"
          onClick={claim}
          disabled={busy || alreadyClaimed}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
        >
          🎁 {alreadyClaimed ? "Gift claimed" : busy ? "Claiming…" : "Claim Your Gift"}
        </button>
      )}

      {msg && <p className="mt-3 text-sm text-success">{msg}</p>}
    </div>
  );
}
