import { useState } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { api } from "@/lib/api";
import { ScenarioBar } from "./components/ScenarioBar";
import { Inventory } from "./components/Inventory";
import { Orders } from "./components/Orders";
import { AuditFeed } from "./components/AuditFeed";
import { AgentConsole } from "./components/AgentConsole";
import { EscrowLedger } from "./components/EscrowLedger";
import { CheckoutReconciliation } from "./components/CheckoutReconciliation";
import { CustomerCheckoutDrawer } from "./components/CustomerCheckoutDrawer";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 8000, // Poll every 8s for live multi-agent sync
    },
  },
});

function Dashboard() {
  const qc = useQueryClient();
  const [activeView, setActiveView] = useState<"ALL" | "OPS" | "DISPATCH" | "ESCROW" | "CHECKOUT">("ALL");
  const [isCheckoutDrawerOpen, setIsCheckoutDrawerOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.getInventory(),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.getOrders(),
  });

  const { data: escrows = [] } = useQuery({
    queryKey: ["escrows"],
    queryFn: () => api.getEscrows(),
  });

  const { data: checkoutSessions = [] } = useQuery({
    queryKey: ["checkoutSessions"],
    queryFn: () => api.getCheckoutSessions(),
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: () => api.getAuditLogs(),
  });

  const { data: scheduler } = useQuery({
    queryKey: ["scheduler"],
    queryFn: () => api.getScheduler(),
  });

  const sweepMutation = useMutation({
    mutationFn: () => api.triggerSweep(),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Proactive audit sweep executed successfully.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lowStockCount = products.filter((p) => p.isRestockFlagged || p.currentStock <= p.reorderThreshold).length;
  const inTransitCount = orders.filter((o) => o.status === "IN_TRANSIT").length;
  const deliveredCount = orders.filter((o) => o.status === "DELIVERED").length;
  const exceptionCount = orders.filter((o) => o.exception?.hasException).length;
  const pendingCheckoutCount = checkoutSessions.filter((s) => s.status === "CALLBACK_PENDING" || s.status === "RESERVED_PENDING").length;

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 font-sans">
      <Toaster position="top-right" theme="dark" richColors />

      {/* HEADER BAR */}
      <header className="panel mb-4 flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-primary tracking-widest">[SYS-OPS-2026]</span>
            <h1 className="font-display text-lg font-bold uppercase tracking-wider text-foreground">
              Autonomous Ops Specialist
            </h1>
            <span className="label-tag flex items-center gap-1.5 border border-line bg-secondary px-2 py-0.5 text-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-ok animate-blink" />
              Multi-Agent DAG Active
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            DIR stockout predictive forecasting · Courier exception rerouting · Checkout callback healer · 12% marketplace escrow
          </p>
        </div>

        {/* METRICS & TRIGGER */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 border border-line bg-secondary/50 px-3 py-2 font-mono text-[11px]">
            <div>
              <span className="text-muted-foreground">RESTOCK: </span>
              <strong className={lowStockCount > 0 ? "text-primary" : "text-foreground"}>{lowStockCount}</strong>
            </div>
            <div className="h-3 w-px bg-line" />
            <div>
              <span className="text-muted-foreground">TRANSIT: </span>
              <strong className="text-foreground">{inTransitCount}</strong>
            </div>
            <div className="h-3 w-px bg-line" />
            <div>
              <span className="text-muted-foreground">ANOMALY: </span>
              <strong className={exceptionCount > 0 ? "text-destructive" : "text-foreground"}>{exceptionCount}</strong>
            </div>
            <div className="h-3 w-px bg-line" />
            <div>
              <span className="text-muted-foreground">CHECKOUT LAG: </span>
              <strong className={pendingCheckoutCount > 0 ? "text-caution" : "text-foreground"}>{pendingCheckoutCount}</strong>
            </div>
            <div className="h-3 w-px bg-line" />
            <div>
              <span className="text-muted-foreground">RECONCILED: </span>
              <strong className="text-ok">{deliveredCount}</strong>
            </div>
          </div>

          <button
            onClick={() => setIsCheckoutDrawerOpen(true)}
            className="btn-op flex items-center gap-1.5 border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 font-bold px-3 py-2 text-xs shadow-sm"
          >
            <span className="text-sm">🛒</span>
            <span>Simulate Customer Order</span>
          </button>

          <button
            onClick={() => sweepMutation.mutate()}
            disabled={sweepMutation.isPending}
            className="btn-signal"
          >
            {sweepMutation.isPending ? "Auditing Store…" : "Run Proactive Sweep"}
          </button>
        </div>
      </header>

      {/* ONE-CLICK STRESS-TEST SCENARIOS SIMULATOR BAR */}
      <ScenarioBar />

      {/* VIEW TABS */}
      <div className="mb-6 flex border-b border-line font-mono text-xs overflow-x-auto">
        <button
          onClick={() => setActiveView("ALL")}
          className={`border-b-2 px-4 py-2 uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeView === "ALL" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          All Stations (01–06)
        </button>
        <button
          onClick={() => setActiveView("OPS")}
          className={`border-b-2 px-4 py-2 uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeView === "OPS" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          01/02 Stock & Courier
        </button>
        <button
          onClick={() => setActiveView("DISPATCH")}
          className={`border-b-2 px-4 py-2 uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeView === "DISPATCH" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          03/04 Black Box & Radio
        </button>
        <button
          onClick={() => setActiveView("ESCROW")}
          className={`border-b-2 px-4 py-2 uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeView === "ESCROW" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          05 Escrow Ledger
        </button>
        <button
          onClick={() => setActiveView("CHECKOUT")}
          className={`border-b-2 px-4 py-2 uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeView === "CHECKOUT" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          06 Checkout Gateway
        </button>
      </div>

      {/* MAIN SECTIONS */}
      {activeView === "ALL" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Inventory products={products} />
            <Orders orders={orders} />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AuditFeed logs={auditLogs} />
            <AgentConsole />
          </div>
          <div className="space-y-6">
            <CheckoutReconciliation sessions={checkoutSessions} />
            <EscrowLedger escrows={escrows} />
          </div>
        </div>
      )}

      {activeView === "OPS" && (
        <div className="space-y-6">
          <Inventory products={products} />
          <Orders orders={orders} />
        </div>
      )}

      {activeView === "DISPATCH" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AuditFeed logs={auditLogs} />
          <AgentConsole />
        </div>
      )}

      {activeView === "ESCROW" && (
        <div className="space-y-6">
          <EscrowLedger escrows={escrows} />
        </div>
      )}

      {activeView === "CHECKOUT" && (
        <div className="space-y-6">
          <CheckoutReconciliation sessions={checkoutSessions} />
        </div>
      )}

      {/* CUSTOMER STOREFRONT CHECKOUT DRAWER */}
      <CustomerCheckoutDrawer
        isOpen={isCheckoutDrawerOpen}
        onClose={() => setIsCheckoutDrawerOpen(false)}
        products={products}
      />

      {/* FOOTER */}
      <footer className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-line pt-4 font-mono text-[10px] text-muted-foreground md:flex-row">
        <span>AUTONOMOUS E-COMMERCE OPERATIONS SPECIALIST • LEVEL 1 ASSESSMENT</span>
        <span>SCHEDULER: {scheduler?.cronExpression || "*/15 * * * *"} • TOTAL SWEEPS: {scheduler?.totalRuns || 0}</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
