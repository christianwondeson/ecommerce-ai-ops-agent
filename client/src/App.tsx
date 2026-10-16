import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MetricsCards } from './components/MetricsCards';
import { InventoryTable } from './components/InventoryTable';
import { OrdersPipeline } from './components/OrdersPipeline';
import { AgentChatConsole } from './components/AgentChatConsole';
import { LiveAuditFeed } from './components/LiveAuditFeed';
import { Product, Order, AuditLog, SchedulerState } from './types';
import { LayoutDashboard, MessageSquareCode, Sparkles } from 'lucide-react';
import { API_BASE } from './config';

export const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [schedulerState, setSchedulerState] = useState<SchedulerState | null>(null);
  const [isSweeping, setIsSweeping] = useState(false);
  const [activeTab, setActiveTab] = useState<'OPERATIONS' | 'AI_CONSOLE'>('OPERATIONS');

  const fetchAllData = async () => {
    try {
      const [invRes, ordRes, auditRes, schedRes] = await Promise.all([
        fetch(`${API_BASE}/api/inventory`),
        fetch(`${API_BASE}/api/orders`),
        fetch(`${API_BASE}/api/audit-logs`),
        fetch(`${API_BASE}/api/scheduler`),
      ]);

      const [invData, ordData, auditData, schedData] = await Promise.all([
        invRes.json(),
        ordRes.json(),
        auditRes.json(),
        schedRes.json(),
      ]);

      if (invData.success) setProducts(invData.products);
      if (ordData.success) setOrders(ordData.orders);
      if (auditData.success) setAuditLogs(auditData.auditLogs);
      if (schedData.success) setSchedulerState(schedData.state);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
    // Poll every 10 seconds to keep live audit feed updated
    const interval = setInterval(fetchAllData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerSweep = async () => {
    setIsSweeping(true);
    try {
      const res = await fetch(`${API_BASE}/api/scheduler/trigger`, { method: 'POST' });
      await res.json();
      await fetchAllData();
    } catch (err) {
      console.error('Sweep trigger failed:', err);
    } finally {
      setIsSweeping(false);
    }
  };

  const handleSimulateSale = async (productId: string) => {
    await fetch(`${API_BASE}/api/inventory/simulate-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    await fetchAllData();
  };

  const handleDispatchPO = async (productId: string) => {
    await fetch(`${API_BASE}/api/inventory/po`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    await fetchAllData();
  };

  const handleToggleFlag = async (productId: string, urgency: 'LOW' | 'MEDIUM' | 'CRITICAL') => {
    await fetch(`${API_BASE}/api/inventory/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, reason: 'Manually toggled from merchant operations console.', urgency }),
    });
    await fetchAllData();
  };

  const handleReconcileOrder = async (orderId: string, deliveryNotes: string) => {
    await fetch(`${API_BASE}/api/orders/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, deliveryNotes }),
    });
    await fetchAllData();
  };

  const handleSimulateWebhook = async (trackingNumber: string, carrier: string) => {
    await fetch(`${API_BASE}/api/courier/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingNumber,
        carrier,
        status: 'DELIVERED_HANDED_TO_RECIPIENT',
        notes: 'Package successfully delivered and signed by customer at delivery address.',
      }),
    });
    await fetchAllData();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        schedulerState={schedulerState}
        onTriggerSweep={handleTriggerSweep}
        isSweeping={isSweeping}
      />

      <main className="max-w-7xl w-full mx-auto px-6 py-6 space-y-6 flex-1">
        {/* Real-time Metric Telemetry Cards */}
        <MetricsCards products={products} orders={orders} />

        {/* Tab Controls */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('OPERATIONS')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'OPERATIONS'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Operations Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('AI_CONSOLE')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'AI_CONSOLE'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <MessageSquareCode className="w-3.5 h-3.5" />
              <span>AI Command Console & Audit Log</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 font-mono">
                Gemini
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-500 hidden sm:block">
            Auto-refreshing every 10s • Level 1 Submission Ready
          </div>
        </div>

        {/* Active View */}
        {activeTab === 'OPERATIONS' ? (
          <div className="space-y-6">
            <InventoryTable
              products={products}
              onSimulateSale={handleSimulateSale}
              onDispatchPO={handleDispatchPO}
              onToggleFlag={handleToggleFlag}
            />

            <OrdersPipeline
              orders={orders}
              onReconcileOrder={handleReconcileOrder}
              onSimulateWebhook={handleSimulateWebhook}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgentChatConsole onRefreshData={fetchAllData} />
            <LiveAuditFeed logs={auditLogs} />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-600">
        Autonomous E-Commerce Operations & Fulfillment Specialist • Designed for Level 1 Evaluation (kidus@brain3.ai)
      </footer>
    </div>
  );
};

export default App;
