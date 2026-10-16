import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type Product } from "@/lib/api";
import { cn } from "@/lib/utils";

const urgencyClass: Record<string, string> = {
  CRITICAL: "bg-destructive text-destructive-foreground",
  MEDIUM: "bg-caution text-background",
  LOW: "bg-secondary text-foreground",
};

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
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider">Stock Ledger</h2>
        </div>
        <span className="label-tag">{products.length} SKUs tracked</span>
      </header>
      <div className="divide-y divide-line">
        {products.map((p) => {
          const ratio = Math.min(1, p.currentStock / (p.reorderThreshold * 2));
          const low = p.currentStock <= p.reorderThreshold;
          return (
            <div key={p.id} className="grid grid-cols-12 items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50">
              <div className="col-span-12 md:col-span-5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{p.sku}</span>
                  {p.isRestockFlagged && (
                    <span className={cn("px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest", urgencyClass[p.restockUrgency ?? "LOW"])}>
                      {p.restockUrgency ?? "FLAG"}
                    </span>
                  )}
                  {p.lastPoDispatchedAt && <span className="font-mono text-[9px] tracking-widest text-ok">PO SENT</span>}
                </div>
                <p className="mt-1 text-sm leading-snug">{p.name}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{p.vendorName} · ${p.unitPrice.toFixed(2)}</p>
              </div>
              <div className="col-span-6 md:col-span-3">
                <div className="flex items-baseline gap-1">
                  <span className={cn("font-display text-2xl font-bold", low ? "text-primary" : "text-foreground")}>{p.currentStock}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">/ min {p.reorderThreshold}</span>
                </div>
                <div className="mt-1.5 flex h-1.5 gap-px">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className={cn("flex-1", i / 20 < ratio ? (low ? "bg-primary" : "bg-ok") : "bg-secondary")} />
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
