import React from 'react';
import { Package, AlertTriangle, Truck, CheckCircle, Zap } from 'lucide-react';
import { Product, Order } from '../types';

interface MetricsCardsProps {
  products: Product[];
  orders: Order[];
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ products, orders }) => {
  const lowStockCount = products.filter((p) => p.isRestockFlagged || p.currentStock <= p.reorderThreshold).length;
  const inTransitCount = orders.filter((o) => o.status === 'IN_TRANSIT').length;
  const reconciledCount = orders.filter((o) => o.reconciledByAi && o.status === 'DELIVERED').length;
  
  // Approximate savings: 15 mins per restock PO + 20 mins per delivery tracking audit
  const hoursSaved = ((reconciledCount * 20 + lowStockCount * 15) / 60).toFixed(1);

  const cards = [
    {
      label: 'Catalog SKUs Monitored',
      value: products.length,
      subtext: 'Real-time stock telemetry',
      icon: Package,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      label: 'Restock Action Flags',
      value: lowStockCount,
      subtext: `${products.filter(p => p.restockUrgency === 'CRITICAL').length} critical shortage`,
      icon: AlertTriangle,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      label: 'Active Courier Shipments',
      value: inTransitCount,
      subtext: 'Auto-syncing tracking proofs',
      icon: Truck,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      label: 'AI Auto-Reconciled',
      value: reconciledCount,
      subtext: 'Zero human data entry',
      icon: CheckCircle,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Manual Hours Saved',
      value: `${hoursSaved} hrs`,
      subtext: 'Operational automation ROI',
      icon: Zap,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-4 rounded-xl border ${card.bgColor} bg-slate-900/60 backdrop-blur transition-all hover:border-slate-600`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">{card.label}</span>
              <Icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{card.value}</div>
            <p className="text-[11px] text-slate-500 mt-1">{card.subtext}</p>
          </div>
        );
      })}
    </div>
  );
};
