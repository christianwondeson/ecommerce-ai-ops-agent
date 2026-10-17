import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type CheckoutSession } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatETB } from "@/lib/currency";

const statusBadge: Record<string, string> = {
  RESERVED_PENDING: "bg-caution/15 text-caution border-caution/40",
  CALLBACK_PENDING: "bg-primary/15 text-primary border-primary/40 animate-pulse",
  PAYMENT_CONFIRMED: "bg-ok/15 text-ok border-ok/40",
  ORPHAN_EXPIRED_HEALED: "bg-secondary text-muted-foreground border-line",
};

export function CheckoutReconciliation({ sessions }: { sessions: CheckoutSession[] }) {
  const qc = useQueryClient();

  const cleanCheckout = useMutation({
    mutationFn: () => api.simulateCleanCheckout(),
    onSuccess: (data: any) => {
      qc.invalidateQueries();
      toast.success(data.summary || "Clean checkout reconciled successfully!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const raceCondition = useMutation({
    mutationFn: () => api.simulateCallbackRaceCondition(),
    onSuccess: (data: any) => {
      qc.invalidateQueries();
      toast.warning(data.summary || "Race condition caught & healed by AI Payment Reconciler!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const orphanTimeout = useMutation({
    mutationFn: () => api.simulateOrphanTimeout(),
    onSuccess: (data: any) => {
      qc.invalidateQueries();
      toast.info(data.summary || "Orphan hold detected; stock safely restored to catalog.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reconcileSession = useMutation({
    mutationFn: (sessionId: string) => api.handleCheckoutCallback(sessionId, "success"),
    onSuccess: (data: any) => {
      qc.invalidateQueries();
      toast.success(data.message || "Session reconciled to confirmed order!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isBusy = cleanCheckout.isPending || raceCondition.isPending || orphanTimeout.isPending;

  const confirmedCount = sessions.filter((s) => s.status === "PAYMENT_CONFIRMED").length;
  const pendingCount = sessions.filter((s) => s.status === "CALLBACK_PENDING" || s.status === "RESERVED_PENDING").length;
  const healedCount = sessions.filter((s) => s.status === "ORPHAN_EXPIRED_HEALED").length;

  return (
    <section className="panel">
      <header className="flex flex-col justify-between gap-4 border-b border-line px-5 py-4 lg:flex-row lg:items-center">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-primary">06</span>
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider">
              Checkout & Payment Callback Reconciliation Gateway
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Handles client callback vs webhook race conditions, clearance lag & orphan inventory reservation holds
            </p>
          </div>
        </div>

        {/* 3 TEST HARNESS BUTTONS */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => cleanCheckout.mutate()}
            disabled={isBusy}
            className="btn-op text-[10px] border-ok/50 text-ok hover:bg-ok/10"
            title="Simulate instant in-sync checkout callback"
          >
            {cleanCheckout.isPending ? "Simulating…" : "🟢 Clean Checkout"}
          </button>

          <button
            onClick={() => raceCondition.mutate()}
            disabled={isBusy}
            className="btn-op text-[10px] border-primary/50 text-primary hover:bg-primary/10"
            title="Simulate client arriving at callback before gateway webhook arrives"
          >
            {raceCondition.isPending ? "Healer Working…" : "🟡 Callback Race Condition"}
          </button>

          <button
            onClick={() => orphanTimeout.mutate()}
            disabled={isBusy}
            className="btn-op text-[10px] border-caution/50 text-caution hover:bg-caution/10"
            title="Simulate customer abandoning checkout, AI Orphan Reaper restoring stock"
          >
            {orphanTimeout.isPending ? "Reaping Holds…" : "🔴 Orphan Hold Reaper"}
          </button>
        </div>
      </header>

      {/* KPI METRICS */}
      <div className="grid grid-cols-3 gap-px border-b border-line bg-line font-mono text-xs">
        <div className="bg-card p-3.5">
          <p className="text-[10px] uppercase text-muted-foreground">Orders Converted</p>
          <p className="mt-0.5 font-display text-lg font-bold text-ok">{confirmedCount}</p>
        </div>
        <div className="bg-card p-3.5">
          <p className="text-[10px] uppercase text-muted-foreground">In-Flight / Clearance Lag</p>
          <p className="mt-0.5 font-display text-lg font-bold text-primary">{pendingCount}</p>
        </div>
        <div className="bg-card p-3.5">
          <p className="text-[10px] uppercase text-muted-foreground">Orphan Holds Restored</p>
          <p className="mt-0.5 font-display text-lg font-bold text-muted-foreground">{healedCount}</p>
        </div>
      </div>

      {/* SESSIONS TABLE */}
      <div className="divide-y divide-line">
        {sessions.map((s) => (
          <div key={s.id} className="grid grid-cols-12 items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30">
            <div className="col-span-12 md:col-span-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-foreground">{s.sessionId}</span>
                <span className={cn("border px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider", statusBadge[s.status] || "")}>
                  {s.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium">{s.customerName}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{s.customerEmail} · Ref: {s.gatewayReference}</p>
            </div>

            <div className="col-span-6 md:col-span-4 font-mono text-xs">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Total:</span>
                <strong className="text-primary font-bold">{formatETB(s.totalAmount)}</strong>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Items: {s.items.map((i) => `${i.quantity}× ${i.sku}`).join(", ")}
              </p>
              {s.reconciliationNotes && (
                <p className="mt-1 border-l border-primary/50 pl-2 text-[10px] text-muted-foreground leading-snug">
                  {s.reconciliationNotes}
                </p>
              )}
            </div>

            <div className="col-span-6 md:col-span-4 flex flex-col items-end justify-center gap-1.5">
              {s.confirmedOrderId && (
                <span className="font-mono text-[10px] text-ok tracking-wider">
                  ✓ Order Formulated: {s.confirmedOrderId}
                </span>
              )}
              {s.status === "CALLBACK_PENDING" && (
                <button
                  onClick={() => reconcileSession.mutate(s.sessionId)}
                  disabled={reconcileSession.isPending}
                  className="btn-op text-[10px] border-primary text-primary hover:bg-primary/10"
                >
                  AI Reconcile Callback
                </button>
              )}
              <span className="font-mono text-[9px] text-muted-foreground">
                {new Date(s.createdAt).toLocaleTimeString([], { hour12: false })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
