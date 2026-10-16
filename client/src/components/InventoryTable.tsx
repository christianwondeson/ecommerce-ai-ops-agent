import React, { useState } from 'react';
import { Product } from '../types';
import { AlertCircle, CheckCircle, Mail, ShoppingCart, RefreshCw, AlertTriangle } from 'lucide-react';

interface InventoryTableProps {
  products: Product[];
  onSimulateSale: (productId: string) => Promise<void>;
  onDispatchPO: (productId: string) => Promise<void>;
  onToggleFlag: (productId: string, urgency: 'LOW' | 'MEDIUM' | 'CRITICAL') => Promise<void>;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  products,
  onSimulateSale,
  onDispatchPO,
  onToggleFlag,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleSale = async (id: string) => {
    setLoadingAction(`sale-${id}`);
    try {
      await onSimulateSale(id);
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePO = async (id: string) => {
    setLoadingAction(`po-${id}`);
    try {
      await onDispatchPO(id);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span>Inventory Guard & Restock Telemetry</span>
            <span className="text-xs font-normal text-slate-400">
              (Auto-flags products when stock &le; reorder threshold)
            </span>
          </h2>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/60 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="px-6 py-3.5">SKU & Item Name</th>
              <th className="px-4 py-3.5">Category</th>
              <th className="px-4 py-3.5">Units / Safety Stock</th>
              <th className="px-4 py-3.5">Restock Flag</th>
              <th className="px-4 py-3.5">Supplier Procurement</th>
              <th className="px-6 py-3.5 text-right">Interactive Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {products.map((product) => {
              const isLow = product.currentStock <= product.reorderThreshold;
              const stockPercentage = Math.min(100, Math.round((product.currentStock / (product.reorderThreshold * 2)) * 100));

              return (
                <tr
                  key={product.id}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    product.isRestockFlagged ? 'bg-amber-500/5' : ''
                  }`}
                >
                  {/* SKU & Name */}
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{product.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{product.sku}</div>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-4 text-xs text-slate-400">
                    <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700/60">
                      {product.category}
                    </span>
                  </td>

                  {/* Stock Level Bar */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${isLow ? 'text-amber-400' : 'text-slate-200'}`}>
                        {product.currentStock}
                      </span>
                      <span className="text-xs text-slate-500">/ min {product.reorderThreshold}</span>
                    </div>
                    <div className="w-28 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full transition-all duration-300 ${
                          product.currentStock === 0
                            ? 'bg-rose-500'
                            : isLow
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.max(8, stockPercentage)}%` }}
                      />
                    </div>
                  </td>

                  {/* Restock Status Badge */}
                  <td className="px-4 py-4">
                    {product.isRestockFlagged ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>RESTOCK NEEDED ({product.restockUrgency})</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Healthy Stock</span>
                      </div>
                    )}
                  </td>

                  {/* Supplier & PO Status */}
                  <td className="px-4 py-4">
                    <div className="text-xs text-slate-300">{product.vendorName}</div>
                    {product.lastPoDispatchedAt ? (
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" />
                        <span>PO Sent ({new Date(product.lastPoDispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">No active PO sent</div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => handleSale(product.id)}
                        disabled={loadingAction === `sale-${product.id}`}
                        title="Simulate a customer purchase to trigger stock drop & AI guard"
                        className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        <ShoppingCart className="w-3 h-3 text-blue-400" />
                        <span>Sell 1</span>
                      </button>

                      <button
                        onClick={() => handlePO(product.id)}
                        disabled={loadingAction === `po-${product.id}`}
                        title="Trigger AI purchase order generation & supplier email dispatch"
                        className="px-2.5 py-1.5 rounded-lg text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        <Mail className="w-3 h-3" />
                        <span>Dispatch PO</span>
                      </button>
                    </div>
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
