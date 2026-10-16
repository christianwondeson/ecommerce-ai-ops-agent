import { Product, Order, AuditLog } from '../types/index.js';

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
    courierStatus: 'DELIVERED_HANDED_TO_RECIPIENT',
    lastTrackingNote: 'Package delivered at front reception. Signed by: H. Carter.',
    shippedAt: new Date(Date.now() - 3600000 * 36).toISOString(),
    reconciledByAi: false,
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
    courierStatus: 'OUT_FOR_DELIVERY',
    lastTrackingNote: 'Courier rider is currently en route. Estimated arrival in 25 minutes.',
    shippedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    reconciledByAi: false,
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
  },
];

export const initialAuditLogs: AuditLog[] = [
  {
    id: 'audit-init-01',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    actionType: 'RESTOCK_FLAG',
    summary: 'Flagged SKU AUDIO-ANC-001 as CRITICAL restock on merchant dashboard.',
    details: {
      sku: 'AUDIO-ANC-001',
      unitsRemaining: 3,
      threshold: 10,
      urgency: 'CRITICAL',
    },
    source: 'REAL_TIME_INVENTORY',
  },
  {
    id: 'audit-init-02',
    timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
    actionType: 'DELIVERY_RECONCILED',
    summary: 'Reconciled Order #ORD-2026-1004 to DELIVERED from FedEx tracking confirmation.',
    details: {
      orderId: 'ord-1004',
      orderNumber: 'ORD-2026-1004',
      carrier: 'FedEx Freight Direct',
      trackingProof: 'Delivered to recipient address front porch.',
    },
    source: 'COURIER_WEBHOOK',
  },
];

class DatabaseStore {
  public products: Product[] = [...initialProducts];
  public orders: Order[] = [...initialOrders];
  public auditLogs: AuditLog[] = [...initialAuditLogs];

  addAudit(log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.auditLogs.unshift(newLog);
    // Keep max 100 audit items
    if (this.auditLogs.length > 100) {
      this.auditLogs = this.auditLogs.slice(0, 100);
    }
    return newLog;
  }
}

export const db = new DatabaseStore();
