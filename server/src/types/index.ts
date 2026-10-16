export type RestockUrgency = 'LOW' | 'MEDIUM' | 'CRITICAL';

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
  restockUrgency?: RestockUrgency;
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
  nextRunEstimated?: string;
  totalRuns: number;
  lastFindings?: {
    lowStockFound: number;
    reconciledCount: number;
    delayedOrdersFound: number;
  };
}
