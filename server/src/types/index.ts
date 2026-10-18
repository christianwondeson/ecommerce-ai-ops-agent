export type RestockUrgency = 'LOW' | 'MEDIUM' | 'CRITICAL';

export interface PredictiveAnalytics {
  burnRatePerDay: number;
  daysOfInventoryRemaining: number;
  stockoutRiskPercentage: number;
  leadTimeDays: number;
  vendorOtifScore: number; // On-Time In-Full reliability % (e.g. 98.4%)
  secondarySupplier?: {
    name: string;
    email: string;
    unitPrice: number;
    leadTimeDays: number;
  };
}

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
  predictive: PredictiveAnalytics;
}

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

export interface DeliveryException {
  hasException: boolean;
  exceptionType?: 'WEATHER_HOLD' | 'FAILED_ATTEMPT_GATE_LOCKED' | 'ADDRESS_UNCONFIRMED' | 'HUB_DELAY';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  mitigationAction?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  subcity?: string;
  streetAddress?: string;
  deliveryOption?: string;
  deliveryFeeUSD?: number;
  discountUSD?: number;
  items: OrderItem[];
  totalAmount: number;
  totalAmountETB?: number;
  status: OrderStatus;
  courierCarrier: string;
  trackingNumber: string;
  courierStatus: string;
  lastTrackingNote: string;
  shippedAt: string;
  deliveredAt?: string;
  reconciledByAi: boolean;
  reconciliationNotes?: string;
  exception?: DeliveryException;
}

export type EscrowStatus = 'LOCKED' | 'RELEASED' | 'DISPUTE_HOLD';

export interface FinancialEscrow {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  vendorName: string;
  grossAmount: number;
  platformTake: number; // 12% marketplace fee
  gatewayFee: number;   // 2.9% + 0.30 processing
  netVendorPayout: number;
  status: EscrowStatus;
  lockedAt: string;
  releasedAt?: string;
  releaseReason?: string;
}

export type CheckoutStatus =
  | 'RESERVED_PENDING'
  | 'CALLBACK_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'ORPHAN_EXPIRED_HEALED';

export interface CheckoutSession {
  id: string;
  sessionId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  subcity?: string;
  streetAddress?: string;
  deliveryOption?: string;
  deliveryFeeUSD?: number;
  discountUSD?: number;
  items: OrderItem[];
  totalAmount: number;
  totalAmountETB?: number;
  status: CheckoutStatus;
  createdAt: string;
  gatewayReference: string;
  stockReserved: boolean;
  reconciliationNotes?: string;
  confirmedOrderId?: string;
}

export type AuditActionType =
  | 'RESTOCK_FLAG'
  | 'PO_DISPATCHED'
  | 'DELIVERY_RECONCILED'
  | 'PROACTIVE_SWEEP'
  | 'AGENT_DIRECTIVE'
  | 'SCENARIO_SIMULATION'
  | 'CARRIER_EXCEPTION'
  | 'ESCROW_RELEASED'
  | 'SUPPLIER_FAILOVER'
  | 'CHECKOUT_RESERVED'
  | 'PAYMENT_RECONCILED'
  | 'ORPHAN_STOCK_RESTORED'
  | 'RESTOCK_CONFIRMED';

export interface AuditLog {
  id: string;
  timestamp: string;
  actionType: AuditActionType;
  summary: string;
  details: Record<string, any>;
  source: 'AUTONOMOUS_CRON' | 'COURIER_WEBHOOK' | 'HUMAN_OVERRIDE' | 'REAL_TIME_INVENTORY' | 'MULTI_AGENT_DAG';
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

export type StressScenario = 'FLASH_SALE_SURGE' | 'CARRIER_BREAKDOWN' | 'SUPPLIER_STOCKOUT';
