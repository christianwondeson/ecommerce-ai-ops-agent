import { Product, Order, AuditLog, FinancialEscrow, CheckoutSession } from '../types/index.js';
import { formatETB } from '../utils/currency.js';

export const initialProducts: Product[] = [
  {
    id: 'prod-001',
    name: 'AcousticPro Wireless Noise-Cancelling Headphones',
    sku: 'AUDIO-ANC-001',
    category: 'Electronics',
    currentStock: 3,
    reorderThreshold: 10,
    suggestedReorderQuantity: 30,
    vendorEmail: 'supplier.electronics@globaltech.com',
    vendorName: 'Apex Audio Supplies Ltd',
    unitPrice: 129.99,
    isRestockFlagged: true,
    restockUrgency: 'CRITICAL',
    lastRestockFlaggedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    predictive: {
      burnRatePerDay: 2.8,
      daysOfInventoryRemaining: 1.1,
      stockoutRiskPercentage: 92,
      leadTimeDays: 5,
      vendorOtifScore: 98.2,
      secondarySupplier: {
        name: 'SoundWave Shenzhen Direct',
        email: 'b2b@soundwave-direct.cn',
        unitPrice: 134.50,
        leadTimeDays: 3, // Faster emergency air freight
      },
    },
  },
  {
    id: 'prod-002',
    name: 'Artisan Ethiopian Yirgacheffe Single-Origin Coffee (1kg)',
    sku: 'FOOD-COF-002',
    category: 'Pantry & Groceries',
    currentStock: 6,
    reorderThreshold: 15,
    suggestedReorderQuantity: 50,
    vendorEmail: 'sales@oromia-coffee-exporters.org',
    vendorName: 'Highland Beans Direct',
    unitPrice: 24.50,
    isRestockFlagged: true,
    restockUrgency: 'MEDIUM',
    lastRestockFlaggedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    predictive: {
      burnRatePerDay: 4.2,
      daysOfInventoryRemaining: 1.4,
      stockoutRiskPercentage: 86,
      leadTimeDays: 7,
      vendorOtifScore: 94.5,
      secondarySupplier: {
        name: 'Sidama Specialty Exporters',
        email: 'orders@sidama-coffee.et',
        unitPrice: 26.00,
        leadTimeDays: 4,
      },
    },
  },
  {
    id: 'prod-003',
    name: 'ErgoDynamic Lumbar Support Mesh Office Chair',
    sku: 'FURN-CHR-003',
    category: 'Office Furniture',
    currentStock: 18,
    reorderThreshold: 5,
    suggestedReorderQuantity: 20,
    vendorEmail: 'orders@ergofurniture.co',
    vendorName: 'Nordic Seating Solutions',
    unitPrice: 289.00,
    isRestockFlagged: false,
    predictive: {
      burnRatePerDay: 0.9,
      daysOfInventoryRemaining: 20.0,
      stockoutRiskPercentage: 8,
      leadTimeDays: 12,
      vendorOtifScore: 99.1,
      secondarySupplier: {
        name: 'EuroErgo Manufacturing GmbH',
        email: 'sales@euroergo.de',
        unitPrice: 295.00,
        leadTimeDays: 8,
      },
    },
  },
  {
    id: 'prod-004',
    name: 'UltraGlow 4K USB-C Conference Webcam with HDR',
    sku: 'ELEC-CAM-004',
    category: 'Electronics',
    currentStock: 2,
    reorderThreshold: 8,
    suggestedReorderQuantity: 25,
    vendorEmail: 'b2b@visiontech-hardware.com',
    vendorName: 'VisionTech Logistics',
    unitPrice: 89.95,
    isRestockFlagged: true,
    restockUrgency: 'CRITICAL',
    lastRestockFlaggedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    predictive: {
      burnRatePerDay: 1.6,
      daysOfInventoryRemaining: 1.2,
      stockoutRiskPercentage: 95,
      leadTimeDays: 6,
      vendorOtifScore: 91.0,
      secondarySupplier: {
        name: 'ClearLens Optoelectronics',
        email: 'procurement@clearlens.tw',
        unitPrice: 94.00,
        leadTimeDays: 3,
      },
    },
  },
  {
    id: 'prod-005',
    name: 'Mechanical RGB Hot-Swappable Gaming Keyboard',
    sku: 'PERI-KEY-005',
    category: 'Gaming & Peripherals',
    currentStock: 24,
    reorderThreshold: 12,
    suggestedReorderQuantity: 40,
    vendorEmail: 'supply@customkeyboards.io',
    vendorName: 'KeebCraft Global',
    unitPrice: 115.00,
    isRestockFlagged: false,
    predictive: {
      burnRatePerDay: 3.1,
      daysOfInventoryRemaining: 7.7,
      stockoutRiskPercentage: 24,
      leadTimeDays: 8,
      vendorOtifScore: 96.8,
      secondarySupplier: {
        name: 'SwitchMaster Keyboards UK',
        email: 'trade@switchmaster.co.uk',
        unitPrice: 118.00,
        leadTimeDays: 5,
      },
    },
  },
];

export const initialOrders: Order[] = [
  {
    id: 'ord-1001',
    orderNumber: 'ORD-2026-1001',
    customerName: 'Marcus Vance',
    customerEmail: 'marcus.vance@example.com',
    items: [
      { sku: 'AUDIO-ANC-001', name: 'AcousticPro Headphones', quantity: 1, price: 129.99 }
    ],
    totalAmount: 129.99,
    status: 'IN_TRANSIT',
    courierCarrier: 'Express Courier Logistics (ECL)',
    trackingNumber: 'ECL-892301984-ET',
    courierStatus: 'DELIVERED_PARCEL_LOCKER',
    lastTrackingNote: 'Parcel safely deposited into resident smart parcel locker #14. Confirmation code sent to recipient phone.',
    shippedAt: new Date(Date.now() - 3600000 * 28).toISOString(),
    reconciledByAi: false,
    exception: {
      hasException: false,
    },
  },
  {
    id: 'ord-1002',
    orderNumber: 'ORD-2026-1002',
    customerName: 'Dr. Helen Carter',
    customerEmail: 'helen.carter@hospital-group.org',
    items: [
      { sku: 'ELEC-CAM-004', name: 'UltraGlow 4K Conference Webcam', quantity: 2, price: 89.95 }
    ],
    totalAmount: 179.90,
    status: 'IN_TRANSIT',
    courierCarrier: 'DHL Global Express',
    trackingNumber: 'DHL-391820491-US',
    courierStatus: 'OUT_FOR_DELIVERY',
    lastTrackingNote: 'Package is on delivery courier vehicle. ETA within 45 minutes.',
    shippedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    reconciledByAi: false,
    exception: {
      hasException: false,
    },
  },
  {
    id: 'ord-1003',
    orderNumber: 'ORD-2026-1003',
    customerName: 'Dawit Mengistu',
    customerEmail: 'dawit.m@fintech-africa.com',
    items: [
      { sku: 'FOOD-COF-002', name: 'Artisan Ethiopian Yirgacheffe (1kg)', quantity: 3, price: 24.50 }
    ],
    totalAmount: 73.50,
    status: 'IN_TRANSIT',
    courierCarrier: 'FastRider City Dispatch',
    trackingNumber: 'FR-550291-ADD',
    courierStatus: 'EXCEPTION_HUB_CONGESTION',
    lastTrackingNote: 'Delivery delayed due to central dispatch hub sorting congestion. Automated reroute in progress.',
    shippedAt: new Date(Date.now() - 3600000 * 36).toISOString(),
    reconciledByAi: false,
    exception: {
      hasException: true,
      exceptionType: 'HUB_DELAY',
      severity: 'MEDIUM',
      mitigationAction: 'AI rerouted package to Priority Dispatch Rider #09. Customer notified via automated SMS tracking update.',
    },
  },
  {
    id: 'ord-1004',
    orderNumber: 'ORD-2026-1004',
    customerName: 'Sarah Jenkins',
    customerEmail: 'sarah.j@creative-studio.io',
    items: [
      { sku: 'FURN-CHR-003', name: 'ErgoDynamic Office Chair', quantity: 1, price: 289.00 }
    ],
    totalAmount: 289.00,
    status: 'DELIVERED',
    courierCarrier: 'FedEx Freight Direct',
    trackingNumber: 'FDX-99218203-US',
    courierStatus: 'DELIVERED_FRONT_PORCH',
    lastTrackingNote: 'Delivered to recipient address front porch. Proof photo uploaded to carrier portal.',
    shippedAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    deliveredAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    reconciledByAi: true,
    reconciliationNotes: 'Auto-reconciled by AI Ops Specialist upon carrier proof-of-delivery confirmation.',
    exception: {
      hasException: false,
    },
  },
];

export const initialEscrows: FinancialEscrow[] = [
  {
    id: 'esc-001',
    orderId: 'ord-1001',
    orderNumber: 'ORD-2026-1001',
    customerName: 'Marcus Vance',
    vendorName: 'Apex Audio Supplies Ltd',
    grossAmount: 129.99,
    platformTake: 15.60, // 12%
    gatewayFee: 4.07,    // 2.9% + 0.30
    netVendorPayout: 110.32,
    status: 'LOCKED',
    lockedAt: new Date(Date.now() - 3600000 * 28).toISOString(),
  },
  {
    id: 'esc-002',
    orderId: 'ord-1002',
    orderNumber: 'ORD-2026-1002',
    customerName: 'Dr. Helen Carter',
    vendorName: 'VisionTech Logistics',
    grossAmount: 179.90,
    platformTake: 21.59,
    gatewayFee: 5.52,
    netVendorPayout: 152.79,
    status: 'LOCKED',
    lockedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    id: 'esc-003',
    orderId: 'ord-1003',
    orderNumber: 'ORD-2026-1003',
    customerName: 'Dawit Mengistu',
    vendorName: 'Highland Beans Direct',
    grossAmount: 73.50,
    platformTake: 8.82,
    gatewayFee: 2.43,
    netVendorPayout: 62.25,
    status: 'DISPUTE_HOLD',
    lockedAt: new Date(Date.now() - 3600000 * 36).toISOString(),
    releaseReason: 'Escrow placed on temporary hold due to courier hub delay exception.',
  },
  {
    id: 'esc-004',
    orderId: 'ord-1004',
    orderNumber: 'ORD-2026-1004',
    customerName: 'Sarah Jenkins',
    vendorName: 'Nordic Seating Solutions',
    grossAmount: 289.00,
    platformTake: 34.68,
    gatewayFee: 8.68,
    netVendorPayout: 245.64,
    status: 'RELEASED',
    lockedAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    releasedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    releaseReason: 'Automated escrow release upon AI carrier proof validation.',
  },
];

export const initialAuditLogs: AuditLog[] = [
  {
    id: 'audit-init-01',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    actionType: 'RESTOCK_FLAG',
    summary: 'Flagged SKU AUDIO-ANC-001 as CRITICAL restock (1.1 Days of Inventory Remaining, 92% stockout risk).',
    details: {
      sku: 'AUDIO-ANC-001',
      unitsRemaining: 3,
      threshold: 10,
      burnRatePerDay: 2.8,
      stockoutRisk: '92%',
      urgency: 'CRITICAL',
    },
    source: 'REAL_TIME_INVENTORY',
  },
  {
    id: 'audit-init-02',
    timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
    actionType: 'ESCROW_RELEASED',
    summary: `Released ${formatETB(245.64)} vendor escrow payout to Nordic Seating Solutions following verified delivery of Order #ORD-2026-1004.`,
    details: {
      orderId: 'ord-1004',
      orderNumber: 'ORD-2026-1004',
      gross: 289.00,
      netPayout: 245.64,
      platformTake: 34.68,
    },
    source: 'MULTI_AGENT_DAG',
  },
];

export const initialCheckoutSessions: CheckoutSession[] = [
  {
    id: 'cs-001',
    sessionId: 'cs_live_901a8b',
    customerName: 'Marcus Vance',
    customerEmail: 'marcus.vance@example.com',
    items: [{ sku: 'AUDIO-ANC-001', name: 'AcousticPro Wireless Headphones', quantity: 1, price: 129.99 }],
    totalAmount: 129.99,
    status: 'PAYMENT_CONFIRMED',
    createdAt: new Date(Date.now() - 3600000 * 28).toISOString(),
    gatewayReference: 'ch_3N8zK0Lkd89123',
    stockReserved: false,
    confirmedOrderId: 'ord-1001',
    reconciliationNotes: 'Webhook and callback synced seamlessly within 340ms.',
  },
  {
    id: 'cs-002',
    sessionId: 'cs_live_902c4d',
    customerName: 'Senait Bekele',
    customerEmail: 'senait.bekele@tech-addis.et',
    items: [{ sku: 'FOOD-COF-002', name: 'Artisan Ethiopian Yirgacheffe (1kg)', quantity: 2, price: 24.50 }],
    totalAmount: 49.00,
    status: 'CALLBACK_PENDING',
    createdAt: new Date(Date.now() - 60000 * 4).toISOString(),
    gatewayReference: 'ch_telebirr_882910',
    stockReserved: true,
    reconciliationNotes: 'Client returned via callback. Awaiting gateway clearance or autonomous verification.',
  },
  {
    id: 'cs-003',
    sessionId: 'cs_live_903e1f',
    customerName: 'Thomas Wright',
    customerEmail: 'thomas.w@globalconsulting.com',
    items: [{ sku: 'ELEC-CAM-004', name: 'UltraGlow 4K Webcam', quantity: 1, price: 89.95 }],
    totalAmount: 89.95,
    status: 'RESERVED_PENDING',
    createdAt: new Date(Date.now() - 60000 * 18).toISOString(),
    gatewayReference: 'ch_stripe_pending_4401',
    stockReserved: true,
    reconciliationNotes: 'Customer abandoned payment window. Reserved stock subject to auto-reaper release.',
  },
];

class DatabaseStore {
  public products: Product[] = [...initialProducts];
  public orders: Order[] = [...initialOrders];
  public escrows: FinancialEscrow[] = [...initialEscrows];
  public checkoutSessions: CheckoutSession[] = [...initialCheckoutSessions];
  public auditLogs: AuditLog[] = [...initialAuditLogs];

  addAudit(log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.auditLogs.unshift(newLog);
    if (this.auditLogs.length > 100) {
      this.auditLogs = this.auditLogs.slice(0, 100);
    }
    return newLog;
  }

  recalculateProductMetrics(productId: string): Product | undefined {
    const p = this.products.find((prod) => prod.id === productId);
    if (!p) return undefined;

    const daysRemaining = Number((p.currentStock / Math.max(0.5, p.predictive.burnRatePerDay)).toFixed(1));
    const stockoutRisk = Math.min(
      100,
      Math.max(5, Math.round((1 - daysRemaining / Math.max(1, p.predictive.leadTimeDays)) * 100))
    );

    p.predictive.daysOfInventoryRemaining = daysRemaining;
    p.predictive.stockoutRiskPercentage = p.currentStock === 0 ? 100 : stockoutRisk;

    if (p.currentStock <= p.reorderThreshold) {
      p.isRestockFlagged = true;
      p.restockUrgency = p.currentStock === 0 ? 'CRITICAL' : daysRemaining <= 2 ? 'CRITICAL' : 'MEDIUM';
    } else {
      p.isRestockFlagged = false;
      p.restockUrgency = undefined;
    }

    return p;
  }

  releaseEscrowForOrder(orderId: string, reason: string): FinancialEscrow | undefined {
    const escrow = this.escrows.find((e) => e.orderId === orderId);
    if (escrow && escrow.status !== 'RELEASED') {
      escrow.status = 'RELEASED';
      escrow.releasedAt = new Date().toISOString();
      escrow.releaseReason = reason;

      this.addAudit({
        actionType: 'ESCROW_RELEASED',
        summary: `[Financial Settlement Engine] Disbursed ${formatETB(escrow.netVendorPayout)} vendor escrow to ${escrow.vendorName} for Order #${escrow.orderNumber}. Platform retained ${formatETB(escrow.platformTake)}.`,
        details: {
          escrowId: escrow.id,
          orderNumber: escrow.orderNumber,
          netPayout: escrow.netVendorPayout,
          platformTake: escrow.platformTake,
          reason,
        },
        source: 'MULTI_AGENT_DAG',
      });
    }
    return escrow;
  }
}

export const db = new DatabaseStore();
