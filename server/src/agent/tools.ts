import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { db } from '../data/db.js';
import { inventoryService } from '../services/inventory.service.js';
import { courierService } from '../services/courier.service.js';
import { schedulerService } from '../services/scheduler.service.js';
import { scenariosService } from '../services/scenarios.service.js';
import { checkoutService } from '../services/checkout.service.js';

export const agentToolDeclarations: FunctionDeclaration[] = [
  {
    name: 'check_inventory_levels',
    description: 'Retrieves all product SKUs, stock counts, reorder thresholds, and current restock flags across the store catalog.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        filter: {
          type: SchemaType.STRING,
          description: 'Optional filter: "ALL", "LOW_STOCK_ONLY", or "FLAGGED_ONLY"',
        },
      },
    },
  },
  {
    name: 'forecast_inventory_depletion',
    description: 'Forecasts inventory burn rate, calculates Days of Inventory Remaining (DIR), stockout risk percentages, and supplier lead times.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productIdOrSku: {
          type: SchemaType.STRING,
          description: 'Optional SKU or product ID. If omitted, returns depletion analytics for all products.',
        },
      },
    },
  },
  {
    name: 'flag_product_for_restock',
    description: 'Sets the RESTOCK_NEEDED flag for a specific product on the merchant dashboard and assigns an urgency level.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productIdOrSku: {
          type: SchemaType.STRING,
          description: 'The product ID (e.g., "prod-001") or SKU (e.g., "AUDIO-ANC-001")',
        },
        urgency: {
          type: SchemaType.STRING,
          description: 'Restock urgency level: "LOW", "MEDIUM", or "CRITICAL"',
        },
        reason: {
          type: SchemaType.STRING,
          description: 'Reasoning behind flagging this product for restock.',
        },
      },
      required: ['productIdOrSku', 'urgency', 'reason'],
    },
  },
  {
    name: 'dispatch_vendor_restock_email',
    description: 'Generates and dispatches a formal Purchase Order requisition email to the product supplier via the transactional email service.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productIdOrSku: {
          type: SchemaType.STRING,
          description: 'The product ID or SKU to restock.',
        },
        quantity: {
          type: SchemaType.NUMBER,
          description: 'The number of units to order from the vendor.',
        },
        instructions: {
          type: SchemaType.STRING,
          description: 'Special procurement notes or shipping instructions.',
        },
      },
      required: ['productIdOrSku', 'quantity'],
    },
  },
  {
    name: 'execute_supplier_failover',
    description: 'Engages verified secondary supplier for a product when primary vendor supply is depleted or unreliable.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productIdOrSku: {
          type: SchemaType.STRING,
          description: 'Product SKU or ID to failover.',
        },
      },
    },
  },
  {
    name: 'reconcile_delivery_status',
    description: 'Reconciles an in-transit order to DELIVERED status based on verified courier tracking proof, releases escrow funds, and notifies customer.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderIdentifier: {
          type: SchemaType.STRING,
          description: 'Order ID (e.g. "ord-1001"), Order Number (e.g. "ORD-2026-1001"), or Tracking Number.',
        },
        deliveryNotes: {
          type: SchemaType.STRING,
          description: 'Courier delivery proof note or signature confirmation.',
        },
      },
      required: ['orderIdentifier', 'deliveryNotes'],
    },
  },
  {
    name: 'resolve_delivery_exception',
    description: 'Intervenes in stranded or delayed courier delivery shipments, automatically reroutes the parcel via alternative carrier priority corridors, and unfreezes escrow holds.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderIdentifier: {
          type: SchemaType.STRING,
          description: 'Order ID or Order Number.',
        },
        resolutionAction: {
          type: SchemaType.STRING,
          description: 'Mitigation instructions or courier reroute direction.',
        },
      },
      required: ['orderIdentifier'],
    },
  },
  {
    name: 'audit_escrow_settlement_ledger',
    description: 'Audits multi-vendor marketplace escrow accounts, platform take rates (12%), and disburses or holds vendor funds based on delivery milestones.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        filter: {
          type: SchemaType.STRING,
          description: 'Filter by status: "ALL", "LOCKED", "RELEASED", or "DISPUTE_HOLD"',
        },
      },
    },
  },
  {
    name: 'trigger_proactive_audit_sweep',
    description: 'Manually triggers the background cron auditor to scan all inventory thresholds and in-transit delivery statuses immediately.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'simulate_stress_test',
    description: 'Simulates a real-time operational stress scenario: FLASH_SALE_SURGE, CARRIER_BREAKDOWN, or SUPPLIER_STOCKOUT.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        scenario: {
          type: SchemaType.STRING,
          description: '"FLASH_SALE_SURGE", "CARRIER_BREAKDOWN", or "SUPPLIER_STOCKOUT"',
        },
      },
      required: ['scenario'],
    },
  },
  {
    name: 'reconcile_checkout_payment',
    description: 'Reconciles a pending or stalled checkout callback session with payment gateway, confirms order, and locks escrow.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        sessionId: {
          type: SchemaType.STRING,
          description: 'Checkout session ID (e.g. "cs_live_902c4d")',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'release_orphan_checkout_stock',
    description: 'Scans for abandoned checkout sessions and restores reserved inventory stock back to live catalog.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
];

export async function executeAgentTool(name: string, args: any): Promise<any> {
  console.log(`[AgentToolExecutor] Executing tool "${name}" with args:`, args);

  switch (name) {
    case 'check_inventory_levels': {
      const all = inventoryService.getAllProducts();
      if (args.filter === 'LOW_STOCK_ONLY') {
        return inventoryService.getLowStockProducts();
      }
      if (args.filter === 'FLAGGED_ONLY') {
        return all.filter((p) => p.isRestockFlagged);
      }
      return all;
    }

    case 'forecast_inventory_depletion': {
      if (args.productIdOrSku) {
        const p = inventoryService.getProductById(args.productIdOrSku);
        if (!p) return { error: `Product ${args.productIdOrSku} not found.` };
        return {
          sku: p.sku,
          name: p.name,
          currentStock: p.currentStock,
          burnRatePerDay: p.predictive.burnRatePerDay,
          daysOfInventoryRemaining: p.predictive.daysOfInventoryRemaining,
          stockoutRiskPercentage: p.predictive.stockoutRiskPercentage,
          leadTimeDays: p.predictive.leadTimeDays,
          urgency: p.restockUrgency || 'NORMAL',
          secondarySupplierAvailable: !!p.predictive.secondarySupplier,
        };
      }
      return db.products.map((p) => ({
        sku: p.sku,
        name: p.name,
        currentStock: p.currentStock,
        burnRatePerDay: p.predictive.burnRatePerDay,
        daysOfInventoryRemaining: p.predictive.daysOfInventoryRemaining,
        stockoutRiskPercentage: p.predictive.stockoutRiskPercentage,
        urgency: p.restockUrgency || 'NORMAL',
      }));
    }

    case 'flag_product_for_restock': {
      return inventoryService.flagProductForRestock(
        args.productIdOrSku,
        args.reason || 'Flagged via AI Ops Agent directive.',
        (args.urgency as any) || 'HIGH',
        'HUMAN_OVERRIDE'
      );
    }

    case 'dispatch_vendor_restock_email': {
      return await inventoryService.dispatchVendorRestockPO(
        args.productIdOrSku,
        args.quantity,
        args.instructions,
        'HUMAN_OVERRIDE'
      );
    }

    case 'execute_supplier_failover': {
      return await scenariosService.triggerSupplierFailover(args.productIdOrSku);
    }

    case 'reconcile_delivery_status': {
      return await courierService.reconcileDeliveryStatus(
        args.orderIdentifier,
        {
          deliveryNotes: args.deliveryNotes,
          courierStatus: 'DELIVERED',
        },
        'HUMAN_OVERRIDE'
      );
    }

    case 'resolve_delivery_exception': {
      return await courierService.resolveDeliveryException(
        args.orderIdentifier,
        args.resolutionAction
      );
    }

    case 'audit_escrow_settlement_ledger': {
      let escrows = db.escrows;
      if (args.filter && args.filter !== 'ALL') {
        escrows = escrows.filter((e) => e.status === args.filter);
      }
      const totalGross = escrows.reduce((sum, e) => sum + e.grossAmount, 0);
      const totalPlatformFee = escrows.reduce((sum, e) => sum + e.platformTake, 0);
      const totalVendorPayout = escrows.reduce((sum, e) => sum + e.netVendorPayout, 0);
      return {
        count: escrows.length,
        totalGross: Number(totalGross.toFixed(2)),
        totalPlatformTake: Number(totalPlatformFee.toFixed(2)),
        totalVendorPayout: Number(totalVendorPayout.toFixed(2)),
        escrows,
      };
    }

    case 'trigger_proactive_audit_sweep': {
      return await schedulerService.runAuditSweep('HUMAN_OVERRIDE');
    }

    case 'simulate_stress_test': {
      if (args.scenario === 'FLASH_SALE_SURGE') {
        return await scenariosService.triggerFlashSaleSurge();
      }
      if (args.scenario === 'CARRIER_BREAKDOWN') {
        return await scenariosService.triggerCarrierDisruption();
      }
      if (args.scenario === 'SUPPLIER_STOCKOUT') {
        return await scenariosService.triggerSupplierFailover();
      }
      throw new Error(`Unknown stress scenario: ${args.scenario}`);
    }

    case 'reconcile_checkout_payment': {
      return await checkoutService.handleClientCallback(args.sessionId, 'success');
    }

    case 'release_orphan_checkout_stock': {
      return checkoutService.reconcileOrphanSessions();
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
