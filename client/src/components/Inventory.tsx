import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type Product } from "@/lib/api";
import { cn } from "@/lib/utils";

const urgencyClass: Record<string, string> = {
  CRITICAL: "bg-destructive text-destructive-foreground",
  MEDIUM: "bg-caution text-background",
  LOW: "bg-secondary text-foreground",
};

function SupplierArrivalBar({
  product,
  onIngestComplete,
}: {
  product: Product;
  onIngestComplete: () => void;
}) {
  const qc = useQueryClient();
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (!product.lastPoDispatchedAt) return 0;
    const elapsed = Math.floor((Date.now() - new Date(product.lastPoDispatchedAt).getTime()) / 1000);
    return Math.max(0, 25 - elapsed);
  });
  const autoIngestedRef = useRef(false);

  const confirmRestock = useMutation({
    mutationFn: () => api.confirmRestock(product.id, product.suggestedReorderQuantity),
    onSuccess: (data: any) => {
      qc.invalidateQueries();
      toast.success(data.message || `Supplier batch delivery checked in! +${product.suggestedReorderQuantity} stock replenished.`);
      onIngestComplete();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!product.lastPoDispatchedAt) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(product.lastPoDispatchedAt!).getTime()) / 1000);
      const remaining = Math.max(0, 25 - elapsed);
      setSecondsLeft(remaining);

      if (remaining === 0 && !autoIngestedRef.current && !confirmRestock.isPending) {
        autoIngestedRef.current = true;
        confirmRestock.mutate();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [product.lastPoDispatchedAt]);

  if (!product.lastPoDispatchedAt) return null;

  return (
    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded border border-ok/40 bg-ok/10 px-3 py-1.5 font-mono text-[11px]">
      <div className="flex items-center gap-2 text-ok">
        <span className="text-sm animate-bounce">🚚</span>
        <div>
          <span>Factory Batch In-Transit: </span>
          <strong className="text-foreground">{secondsLeft > 0 ? `${secondsLeft}s remaining` : 'Arrived at Warehouse!'}</strong>
          <span className="text-muted-foreground ml-1">(+{product.suggestedReorderQuantity} units)</span>
        </div>
      </div>
      <button
        onClick={() => {
          autoIngestedRef.current = true;
          confirmRestock.mutate();
        }}
        disabled={confirmRestock.isPending}
        className="rounded border border-ok/50 bg-ok/20 px-2.5 py-0.5 text-[10px] font-bold text-ok hover:bg-ok/30 transition-all shadow-sm"
        title="Bypass countdown and instantly ingest factory inventory batch"
      >
        {confirmRestock.isPending ? "Ingesting…" : "⚡ Fast-Forward Ingest"}
      </button>
    </div>
  );
}

export function Inventory({ products }: { products: Product[] }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries();
  const run = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: () => { refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="panel">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-primary">01</span>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider">
            Stock & Predictive Depletion Ledger
          </h2>
        </div>
        <span className="label-tag">{products.length} SKUs tracked</span>
      </header>
      <div className="divide-y divide-line">
        {products.map((p) => {
          const ratio = Math.min(1, p.currentStock / (p.reorderThreshold * 2));
          const low = p.currentStock <= p.reorderThreshold;
          const dir = p.predictive?.daysOfInventoryRemaining ?? 0;
          const criticalDir = dir <= 2.0;

          return (
            <div key={p.id} className="grid grid-cols-12 items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50">
              <div className="col-span-12 md:col-span-5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground">{p.sku}</span>
                  {p.currentStock === 0 && (
                    <span className="px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest bg-destructive text-destructive-foreground animate-blink">
                      DEPLETED (0)
                    </span>
                  )}
                  {p.isRestockFlagged && p.currentStock > 0 && (
                    <span className={cn("px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest", urgencyClass[p.restockUrgency ?? "LOW"])}>
                      {p.restockUrgency ?? "FLAG"}
                    </span>
                  )}
                  {p.lastPoDispatchedAt && <span className="font-mono text-[9px] tracking-widest text-ok font-bold">PO SENT</span>}
                  
                  {/* PREDICTIVE DIR BADGE */}
                  <span className={cn(
                    "px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider border",
                    criticalDir 
                      ? "border-destructive text-destructive bg-destructive/10" 
                      : dir < 5 
                        ? "border-caution text-caution bg-caution/10" 
                        : "border-ok/40 text-ok bg-ok/10"
                  )}>
                    DIR: {dir}d
                  </span>
                </div>

                <p className="mt-1 text-sm leading-snug font-medium">{p.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span>{p.vendorName} · ${p.unitPrice.toFixed(2)}</span>
                  <span>·</span>
                  <span>Burn: {p.predictive?.burnRatePerDay ?? 1}/d</span>
                  <span>·</span>
                  <span className={p.predictive?.stockoutRiskPercentage > 70 ? "text-destructive font-semibold" : ""}>
                    Risk: {p.predictive?.stockoutRiskPercentage ?? 0}%
                  </span>
                </div>

                {p.predictive?.secondarySupplier && (
                  <div className="mt-1 text-[10px] font-mono text-muted-foreground/80">
                    <span className="text-primary font-semibold">Backup:</span> {p.predictive.secondarySupplier.name} ({p.predictive.secondarySupplier.leadTimeDays}d lead)
                  </div>
                )}

                {/* SUPPLIER TRANSIT COUNTDOWN & INGEST BAR */}
                <SupplierArrivalBar product={p} onIngestComplete={refresh} />
              </div>

              <div className="col-span-6 md:col-span-3">
                <div className="flex items-baseline gap-1">
                  <span className={cn("font-display text-2xl font-bold", p.currentStock === 0 ? "text-destructive" : low ? "text-primary" : "text-foreground")}>
                    {p.currentStock}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">/ min {p.reorderThreshold}</span>
                </div>
                <div className="mt-1.5 flex h-1.5 gap-px">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className={cn("flex-1", i / 20 < ratio ? (low ? (p.currentStock === 0 ? "bg-destructive" : "bg-primary") : "bg-ok") : "bg-secondary")} />
                  ))}
                </div>
              </div>

              <div className="col-span-6 flex flex-wrap justify-end gap-1.5 md:col-span-4">
                <button className="btn-op" disabled={run.isPending || p.currentStock < 1}
                  onClick={() => run.mutate(() => api.simulateSale(p.id, 1).then(() => toast(`Sold 1 × ${p.sku}`)))}>−1 Sale</button>
                <button className="btn-op" disabled={run.isPending}
                  onClick={() => run.mutate(() => api.flag(p.id, low ? "CRITICAL" : "MEDIUM").then(() => toast(`Flagged ${p.sku}`)))}>Flag</button>
                <button className="btn-op" disabled={run.isPending}
                  onClick={() => run.mutate(() => api.po(p.id, p.suggestedReorderQuantity).then(() => toast(`PO for ${p.suggestedReorderQuantity} units sent to ${p.vendorName}`)))}>Send PO</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
