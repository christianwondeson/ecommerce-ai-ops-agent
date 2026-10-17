import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type FinancialEscrow } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatETB } from "@/lib/currency";

const statusColor: Record<string, string> = {
  LOCKED: "bg-caution/20 text-caution border-caution/40",
  RELEASED: "bg-ok/20 text-ok border-ok/40",
  DISPUTE_HOLD: "bg-destructive/20 text-destructive border-destructive/40",
};

export function EscrowLedger({ escrows }: { escrows: FinancialEscrow[] }) {
  const qc = useQueryClient();

  const releaseMutation = useMutation({
    mutationFn: (orderId: string) => api.releaseEscrow(orderId, 'Operator manual disbursement authorization.'),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Vendor escrow payout successfully released.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalGross = escrows.reduce((sum, e) => sum + e.grossAmount, 0);
  const totalPlatformTake = escrows.reduce((sum, e) => sum + e.platformTake, 0);
  const totalVendorPayout = escrows.reduce((sum, e) => sum + e.netVendorPayout, 0);
  const totalLockedOrHeld = escrows
    .filter((e) => e.status !== "RELEASED")
    .reduce((sum, e) => sum + e.netVendorPayout, 0);

  return (
    <section className="panel">
      <header className="flex flex-col justify-between gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-primary">05</span>
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider">
              Financial Escrow & Vendor Settlement Ledger
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Marketplace 12% take-rate · Zero-trust delivery milestone escrow disburser
            </p>
          </div>
        </div>
        <span className="label-tag">{escrows.length} Escrow Accounts</span>
      </header>

      {/* METRIC PILLS */}
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4 font-mono text-xs">
        <div className="bg-card p-4">
          <p className="text-[10px] uppercase text-muted-foreground">Marketplace GMV</p>
          <p className="mt-1 font-display text-base font-bold text-foreground">{formatETB(totalGross)}</p>
        </div>
        <div className="bg-card p-4">
          <p className="text-[10px] uppercase text-muted-foreground">Platform 12% Take</p>
          <p className="mt-1 font-display text-base font-bold text-primary">{formatETB(totalPlatformTake)}</p>
        </div>
        <div className="bg-card p-4">
          <p className="text-[10px] uppercase text-muted-foreground">Total Vendor Payouts</p>
          <p className="mt-1 font-display text-base font-bold text-ok">{formatETB(totalVendorPayout)}</p>
        </div>
        <div className="bg-card p-4">
          <p className="text-[10px] uppercase text-muted-foreground">Escrow Held / Locked</p>
          <p className="mt-1 font-display text-base font-bold text-caution">{formatETB(totalLockedOrHeld)}</p>
        </div>
      </div>

      {/* ESCROWS LIST */}
      <div className="divide-y divide-line">
        {escrows.map((e) => {
          return (
            <div key={e.id} className="grid grid-cols-12 items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
              <div className="col-span-12 md:col-span-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-foreground">{e.orderNumber}</span>
                  <span className={cn("border px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider", statusColor[e.status] || "")}>
                    {e.status}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-foreground/90">{e.vendorName}</p>
                <p className="font-mono text-[10px] text-muted-foreground">Customer: {e.customerName}</p>
              </div>

              <div className="col-span-6 md:col-span-4 font-mono text-xs space-y-0.5">
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Gross:</span>
                  <strong className="text-foreground">{formatETB(e.grossAmount)}</strong>
                </div>
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Platform Fee (12%):</span>
                  <strong className="text-primary">−{formatETB(e.platformTake)}</strong>
                </div>
                <div className="flex justify-between border-t border-dashed border-line pt-1 text-[11px]">
                  <span>Net Vendor Payout:</span>
                  <strong className="text-ok">{formatETB(e.netVendorPayout)}</strong>
                </div>
              </div>

              <div className="col-span-6 md:col-span-4 flex flex-col items-end justify-center gap-1.5">
                {e.releaseReason && (
                  <p className="text-right text-[11px] text-muted-foreground max-w-xs leading-tight">
                    {e.releaseReason}
                  </p>
                )}
                {e.status !== "RELEASED" && (
                  <button
                    onClick={() => releaseMutation.mutate(e.orderId)}
                    disabled={releaseMutation.isPending}
                    className="btn-op text-[10px]"
                  >
                    Release Escrow
                  </button>
                )}
                {e.status === "RELEASED" && e.releasedAt && (
                  <span className="font-mono text-[9px] text-ok tracking-wider">
                    ✓ RELEASED {new Date(e.releasedAt).toLocaleTimeString([], { hour12: false })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
