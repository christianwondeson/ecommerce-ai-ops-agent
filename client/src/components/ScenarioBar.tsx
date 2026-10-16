import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function ScenarioBar() {
  const qc = useQueryClient();

  const flashSale = useMutation({
    mutationFn: () => api.triggerFlashSale(),
    onSuccess: (data: any) => {
      qc.invalidateQueries();
      toast.success(data.summary || "Flash sale surge completed! Stock depleted & emergency POs dispatched.");
    },
    onError: (e: Error) => toast.error(`Flash Sale failed: ${e.message}`),
  });

  const carrierDisruption = useMutation({
    mutationFn: () => api.triggerCarrierDisruption(),
    onSuccess: (data: any) => {
      qc.invalidateQueries();
      toast.warning(data.summary || "Carrier route breakdown simulated. Escrow frozen on DISPUTE_HOLD & automated reroute dispatched.");
    },
    onError: (e: Error) => toast.error(`Carrier Disruption failed: ${e.message}`),
  });

  const supplierFailover = useMutation({
    mutationFn: () => api.triggerSupplierFailover(),
    onSuccess: (data: any) => {
      qc.invalidateQueries();
      toast.info(data.summary || "Supplier failover protocol executed. Backup vendor engaged with expedited SLA.");
    },
    onError: (e: Error) => toast.error(`Supplier Failover failed: ${e.message}`),
  });

  const isBusy = flashSale.isPending || carrierDisruption.isPending || supplierFailover.isPending;

  return (
    <div className="panel mb-6 border-line bg-card/80 p-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary tracking-wider">⚡ STRESS-TEST ENGINE</span>
            <span className="label-tag bg-secondary px-2 py-0.5 text-foreground">Interactive Simulator</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Test autonomous agent responsiveness under extreme marketplace shocks in real time:
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => flashSale.mutate()}
            disabled={isBusy}
            className="btn-op border-primary/50 text-primary hover:bg-primary/10"
            title="Spikes burn rate 250%, sells 4-12 units per SKU, and triggers emergency double-batch POs."
          >
            {flashSale.isPending ? "Simulating Surge…" : "⚡ 1. Flash Sale Surge"}
          </button>

          <button
            onClick={() => carrierDisruption.mutate()}
            disabled={isBusy}
            className="btn-op border-caution/60 text-caution hover:bg-caution/10"
            title="Simulates highway vehicle breakdown, freezes vendor escrow, and reroutes package."
          >
            {carrierDisruption.isPending ? "Simulating Delay…" : "🚛 2. Carrier Breakdown"}
          </button>

          <button
            onClick={() => supplierFailover.mutate()}
            disabled={isBusy}
            className="btn-op border-ok/50 text-ok hover:bg-ok/10"
            title="Simulates primary factory stockout and engages secondary backup supplier."
          >
            {supplierFailover.isPending ? "Executing Failover…" : "🏭 3. Supplier Failover"}
          </button>
        </div>
      </div>
    </div>
  );
}
