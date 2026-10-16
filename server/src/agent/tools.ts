import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { inventoryService } from '../services/inventory.service.js';
import { courierService } from '../services/courier.service.js';
import { schedulerService } from '../services/scheduler.service.js';

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
    name: 'trigger_proactive_audit_sweep',
    description: 'Manually triggers the background cron auditor to scan all inventory thresholds and in-transit delivery statuses immediately.',
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

    case 'flag_product_for_restock': {
      return inventoryService.flagProductForRestock(
        args.productIdOrSku,
        args.reason || 'Flagged via AI Ops Agent directive.',
        (args.urgency as any) || 'HIGH',
        'HUMAN_OVERRIDE'
      );
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

    case 'dispatch_vendor_restock_email': {
      return await inventoryService.dispatchVendorRestockPO(
        args.productIdOrSku,
        args.quantity,
        args.instructions,
        'HUMAN_OVERRIDE'
      );
    }

    case 'trigger_proactive_audit_sweep': {
      return await schedulerService.runAuditSweep('HUMAN_OVERRIDE');
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
