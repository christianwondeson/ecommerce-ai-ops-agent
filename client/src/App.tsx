import { useState } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { api } from "@/lib/api";
import { Inventory } from "./components/Inventory";
import { Orders } from "./components/Orders";
import { AuditFeed } from "./components/AuditFeed";
import { AgentConsole } from "./components/AgentConsole";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 10000, // Poll every 10s for real-time telemetry
    },
  },
});

function Dashboard() {
  const qc = useQueryClient();
  const [activeView, setActiveView] = useState<"ALL" | "OPS" | "DISPATCH">("ALL");

  const { data: products = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.getInventory(),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.getOrders(),
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

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 font-sans">
      <Toaster position="top-right" theme="dark" richColors />

      {/* HEADER BAR */}
      <header className="panel mb-6 flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-primary tracking-widest">[SYS-OPS-2026]</span>
            <h1 className="font-display text-lg font-bold uppercase tracking-wider text-foreground">
              Autonomous Ops Specialist
            </h1>
            <span className="label-tag flex items-center gap-1.5 border border-line bg-secondary px-2 py-0.5 text-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-ok animate-blink" />
              Autopilot Active
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Inventory depletion auto-flagging · Carrier proof-of-delivery sync · Proactive cron engine
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
              <span className="text-muted-foreground">IN-TRANSIT: </span>
              <strong className="text-foreground">{inTransitCount}</strong>
            </div>
            <div className="h-3 w-px bg-line" />
            <div>
              <span className="text-muted-foreground">RECONCILED: </span>
              <strong className="text-ok">{deliveredCount}</strong>
            </div>
          </div>

          <button
            onClick={() => sweepMutation.mutate()}
            disabled={sweepMutation.isPending}
            className="btn-signal"
          >
            {sweepMutation.isPending ? "Auditing Store…" : "Run Proactive Sweep"}
          </button>
        </div>
      </header>

      {/* VIEW TABS */}
      <div className="mb-6 flex border-b border-line font-mono text-xs">
        <button
          onClick={() => setActiveView("ALL")}
          className={`border-b-2 px-4 py-2 uppercase tracking-wider transition-colors ${
            activeView === "ALL" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          All Stations
        </button>
        <button
          onClick={() => setActiveView("OPS")}
          className={`border-b-2 px-4 py-2 uppercase tracking-wider transition-colors ${
            activeView === "OPS" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          01/02 Stock & Manifest
        </button>
        <button
          onClick={() => setActiveView("DISPATCH")}
          className={`border-b-2 px-4 py-2 uppercase tracking-wider transition-colors ${
            activeView === "DISPATCH" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          03/04 Black Box & Radio
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

      {/* FOOTER */}
      <footer className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-line pt-4 font-mono text-[10px] text-muted-foreground md:flex-row">
        <span>AUTONOMOUS E-COMMERCE OPERATIONS SPECIALIST • LEVEL 1 ASSESSMENT</span>
        <span>SCHEDULER: {scheduler?.cronExpression || "*/15 * * * *"} • SWEEPS: {scheduler?.totalRuns || 0}</span>
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
