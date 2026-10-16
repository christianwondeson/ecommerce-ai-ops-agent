import React, { useState } from 'react';
import { Order } from '../types';
import { Truck, CheckCircle2, Clock, Sparkles, Send, ShieldCheck } from 'lucide-react';

interface OrdersPipelineProps {
  orders: Order[];
  onReconcileOrder: (orderId: string, notes: string) => Promise<void>;
  onSimulateWebhook: (trackingNumber: string, carrier: string) => Promise<void>;
}

export const OrdersPipeline: React.FC<OrdersPipelineProps> = ({
  orders,
  onReconcileOrder,
  onSimulateWebhook,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleSimulateDelivery = async (order: Order) => {
    setLoadingAction(`sim-${order.id}`);
    try {
      await onSimulateWebhook(order.trackingNumber, order.courierCarrier);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleManualReconcile = async (order: Order) => {
    setLoadingAction(`rec-${order.id}`);
    try {
      await onReconcileOrder(order.id, 'Verified via merchant dashboard reconciliation trigger.');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span>Fulfillment & Courier Delivery Reconciliation</span>
            <span className="text-xs font-normal text-slate-400">
              (Auto-syncs carrier proof notes & mutates dashboard to DELIVERED)
            </span>
          </h2>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/60 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="px-6 py-3.5">Order & Customer</th>
              <th className="px-4 py-3.5">Courier Carrier & Tracking #</th>
              <th className="px-4 py-3.5">Courier Status & Proof Notes</th>
              <th className="px-4 py-3.5">Dashboard Order Status</th>
              <th className="px-6 py-3.5 text-right">Autonomous Sync Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {orders.map((order) => {
              const isDelivered = order.status === 'DELIVERED';

              return (
                <tr
                  key={order.id}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    isDelivered ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  {/* Order & Customer */}
                  <td className="px-6 py-4">
                    <div className="font-semibold text-white">{order.orderNumber}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{order.customerName}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      ${order.totalAmount.toFixed(2)} • {order.items.length} item(s)
                    </div>
                  </td>

                  {/* Courier & Tracking */}
                  <td className="px-4 py-4">
                    <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{order.courierCarrier}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-1">
                      {order.trackingNumber}
                    </div>
                  </td>

                  {/* Courier Status & Notes */}
                  <td className="px-4 py-4 max-w-xs">
                    <div className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      <span>{order.courierStatus}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 italic line-clamp-2">
                      "{order.lastTrackingNote}"
                    </p>
                  </td>

                  {/* Dashboard Order Status */}
                  <td className="px-4 py-4">
                    {isDelivered ? (
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>DELIVERED</span>
                        </div>
                        {order.reconciledByAi && (
                          <div className="text-[10px] text-purple-400 flex items-center gap-1 mt-1 font-medium">
                            <Sparkles className="w-3 h-3" />
                            <span>AI Reconciled</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Clock className="w-3.5 h-3.5 animate-pulse" />
                        <span>IN TRANSIT</span>
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    {!isDelivered ? (
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleSimulateDelivery(order)}
                          disabled={loadingAction === `sim-${order.id}`}
                          title="Simulate 3PL carrier webhook payload: 'Delivered at destination'"
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          <span>Simulate Delivery</span>
                        </button>

                        <button
                          onClick={() => handleManualReconcile(order)}
                          disabled={loadingAction === `rec-${order.id}`}
                          title="Trigger AI reconciliation manually"
                          className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Reconcile</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 flex items-center justify-end gap-1 font-mono">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Escrow Released</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
