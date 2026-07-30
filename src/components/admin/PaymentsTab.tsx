import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

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

const TONE: Record<string, { icon: typeof Clock; cls: string }> = {
  success: { icon: CheckCircle2, cls: "text-success" },
  pending: { icon: Clock, cls: "text-muted-foreground" },
  failed: { icon: XCircle, cls: "text-destructive" },
};

export function PaymentsTab() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-payments"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as PaymentRow[];
    },
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-black">Mobile Money Payments</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Live records from the Mobile Money API. Payments are confirmed automatically by the
        provider — there is nothing to approve here.
      </p>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No payments yet.
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
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tone = TONE[r.status] ?? TONE.pending;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-3">{new Date(r.created_at).toLocaleString()}</td>
                    <td>{r.phone}</td>
                    <td className="font-semibold">{frw(r.amount)}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1 font-semibold ${tone.cls}`}>
                        <tone.icon className="h-4 w-4" />
                        {r.status}
                      </span>
                      {r.failure_reason && (
                        <div className="text-xs text-muted-foreground">{r.failure_reason}</div>
                      )}
                    </td>
                    <td className="font-mono text-xs">{r.provider_ref ?? r.external_ref ?? "—"}</td>
                    <td className="font-mono text-xs">{r.order_id?.slice(0, 8) ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
