import type { AuditLog } from "@/lib/api";
import { formatCurrencyString } from "@/lib/currency";

const color: Record<string, string> = {
  RESTOCK_FLAG: "text-caution",
  PO_DISPATCHED: "text-ok",
  DELIVERY_RECONCILED: "text-ok",
  PROACTIVE_SWEEP: "text-primary",
  AGENT_DIRECTIVE: "text-accent",
  SCENARIO_SIMULATION: "text-primary font-bold",
  CARRIER_EXCEPTION: "text-destructive font-bold",
  ESCROW_RELEASED: "text-ok font-bold",
  SUPPLIER_FAILOVER: "text-caution font-bold",
  CHECKOUT_RESERVED: "text-caution",
  PAYMENT_RECONCILED: "text-ok font-bold",
  ORPHAN_STOCK_RESTORED: "text-primary font-bold",
};

export function AuditFeed({ logs }: { logs: AuditLog[] }) {
  return (
    <section className="panel flex max-h-[520px] flex-col">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-primary">03</span>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider">Black Box</h2>
        </div>
        <span className="label-tag flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-destructive animate-blink" />Rec</span>
      </header>
      <ol className="flex-1 overflow-y-auto px-5 py-3 font-mono text-[11px]">
        {logs.length === 0 && <li className="py-6 text-center text-muted-foreground">No events yet.</li>}
        {logs.map((l) => (
          <li key={l.id} className="animate-slidein border-b border-dashed border-line py-2.5 last:border-0">
            <div className="flex justify-between gap-2">
              <span className={color[l.actionType] ?? "text-foreground"}>{l.actionType}</span>
              <span className="text-muted-foreground">{new Date(l.timestamp).toLocaleTimeString([], { hour12: false })}</span>
            </div>
            <p className="mt-1 font-sans text-xs leading-relaxed text-foreground/80">{formatCurrencyString(l.summary.replace(/^\[[^\]]+\]\s*/, ""))}</p>
            <p className="mt-0.5 text-[9px] tracking-widest text-muted-foreground">via {l.source.replace(/_/g, " ")}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
