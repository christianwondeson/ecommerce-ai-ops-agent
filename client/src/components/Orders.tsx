import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type Order } from "@/lib/api";
import { cn } from "@/lib/utils";

const STAGES = ["PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED"];

export function Orders({ orders }: { orders: Order[] }) {
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="panel">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-primary">02</span>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider">Courier Manifest</h2>
        </div>
        <span className="label-tag">{orders.filter((o) => o.status === "DELIVERED").length}/{orders.length} delivered</span>
      </header>
      <div className="grid gap-px bg-line md:grid-cols-2">
        {orders.map((o) => {
          const stage = Math.max(0, STAGES.indexOf(o.status));
          const done = o.status === "DELIVERED";
          return (
            <article key={o.id} className="bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[10px] text-muted-foreground">{o.orderNumber}</p>
                  <p className="font-display text-sm font-semibold">{o.customerName}</p>
                </div>
                <p className="font-display text-lg font-bold">${o.totalAmount.toFixed(2)}</p>
              </div>
              <div className="mt-4 flex items-center gap-1">
                {STAGES.map((s, i) => (
                  <div key={s} className="flex-1">
                    <div className={cn("h-1", i <= stage ? (done ? "bg-ok" : "bg-primary") : "bg-secondary")} />
                    <p className={cn("mt-1 font-mono text-[8px] tracking-wider", i <= stage ? "text-foreground" : "text-muted-foreground")}>
                      {s.replace("_", " ")}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-l-2 border-primary/60 pl-3">
                <p className="font-mono text-[10px] text-muted-foreground">{o.courierCarrier} · {o.trackingNumber}</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground/80">“{o.lastTrackingNote}”</p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                {o.reconciledByAi ? (
                  <span className="font-mono text-[10px] tracking-widest text-ok">● AI RECONCILED</span>
                ) : <span className="font-mono text-[10px] tracking-widest text-muted-foreground">○ AWAITING PROOF</span>}
                {!done && (
                  <div className="flex gap-1.5">
                    <button className="btn-op" disabled={run.isPending}
                      onClick={() => run.mutate(() => api.webhook(o.trackingNumber, o.courierCarrier).then(() => toast("Courier delivery event sent")))}>Ping courier</button>
                    <button className="btn-op" disabled={run.isPending}
                      onClick={() => run.mutate(() => api.reconcile(o.id).then(() => toast(`${o.orderNumber} marked delivered`)))}>Reconcile</button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
