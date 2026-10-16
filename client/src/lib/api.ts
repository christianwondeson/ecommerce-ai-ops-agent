import { API_BASE } from "../config";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  reorderThreshold: number;
  suggestedReorderQuantity: number;
  vendorEmail: string;
  vendorName: string;
  unitPrice: number;
  isRestockFlagged: boolean;
  restockUrgency?: 'LOW' | 'MEDIUM' | 'CRITICAL';
  lastRestockFlaggedAt?: string;
  lastPoDispatchedAt?: string;
}

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  courierCarrier: string;
  trackingNumber: string;
  courierStatus: string;
  lastTrackingNote: string;
  shippedAt: string;
  deliveredAt?: string;
  reconciledByAi: boolean;
  reconciliationNotes?: string;
}

export type AuditActionType =
  | 'RESTOCK_FLAG'
  | 'PO_DISPATCHED'
  | 'DELIVERY_RECONCILED'
  | 'PROACTIVE_SWEEP'
  | 'AGENT_DIRECTIVE';

export interface AuditLog {
  id: string;
  timestamp: string;
  actionType: AuditActionType;
  summary: string;
  details: Record<string, any>;
  source: 'AUTONOMOUS_CRON' | 'COURIER_WEBHOOK' | 'HUMAN_OVERRIDE' | 'REAL_TIME_INVENTORY';
}

export interface SchedulerState {
  isRunning: boolean;
  cronExpression: string;
  lastRunTimestamp?: string;
  totalRuns: number;
  lastFindings?: {
    lowStockFound: number;
    reconciledCount: number;
    delayedOrdersFound: number;
  };
}

export const api = {
  async getInventory(): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/api/inventory`);
    const data = await res.json();
    return data.products || [];
  },

  async getOrders(): Promise<Order[]> {
    const res = await fetch(`${API_BASE}/api/orders`);
    const data = await res.json();
    return data.orders || [];
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/api/audit-logs`);
    const data = await res.json();
    return data.auditLogs || [];
  },

  async getScheduler(): Promise<SchedulerState> {
    const res = await fetch(`${API_BASE}/api/scheduler`);
    const data = await res.json();
    return data.state;
  },

  async triggerSweep(): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/scheduler/trigger`, { method: 'POST' });
    return await res.json();
  },

  async simulateSale(productId: string, quantity: number = 1): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/inventory/simulate-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity }),
    });
    return await res.json();
  },

  async flag(productId: string, urgency: string = 'MEDIUM'): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/inventory/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        urgency,
        reason: 'Flagged via operator dashboard controls.',
      }),
    });
    return await res.json();
  },

  async po(productId: string, quantity?: number): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/inventory/po`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity }),
    });
    return await res.json();
  },

  async reconcile(orderId: string, deliveryNotes?: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/orders/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        deliveryNotes: deliveryNotes || 'Verified via courier manifest reconciliation.',
      }),
    });
    return await res.json();
  },

  async webhook(trackingNumber: string, carrier: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/courier/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingNumber,
        carrier,
        status: 'DELIVERED_HANDED_TO_RECIPIENT',
        notes: 'Package safely delivered and signed by customer at recipient address.',
      }),
    });
    return await res.json();
  },

  async chat(
    prompt: string,
    history: Array<{ role: string; text?: string; content?: string }>
  ): Promise<{
    reply: string;
    toolsExecuted?: Array<{ name: string; args: any; result: any }>;
  }> {
    const res = await fetch(`${API_BASE}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        history: history.map((h) => ({
          role: h.role === 'model' ? 'model' : 'user',
          content: h.text || h.content || '',
        })),
      }),
    });
    const data = await res.json();
    return {
      reply: data.reply,
      toolsExecuted: data.toolsExecuted,
    };
  },
};
