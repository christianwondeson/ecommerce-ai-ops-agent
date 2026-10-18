import { db } from '../data/db.js';
import { Product, RestockUrgency } from '../types/index.js';
import { emailService } from './email.service.js';
import { formatETB } from '../utils/currency.js';

export class InventoryService {
  getAllProducts(): Product[] {
    return db.products;
  }

  getProductById(id: string): Product | undefined {
    return db.products.find((p) => p.id === id || p.sku.toLowerCase() === id.toLowerCase());
  }

  getLowStockProducts(): Product[] {
    return db.products.filter((p) => p.currentStock <= p.reorderThreshold);
  }

  flagProductForRestock(
    productId: string,
    reason: string,
    urgency: RestockUrgency = 'MEDIUM',
    source: 'AUTONOMOUS_CRON' | 'HUMAN_OVERRIDE' | 'REAL_TIME_INVENTORY' = 'REAL_TIME_INVENTORY'
  ): { success: boolean; product?: Product; message: string } {
    const product = this.getProductById(productId);
    if (!product) {
      return { success: false, message: `Product ${productId} not found.` };
    }

    product.isRestockFlagged = true;
    product.restockUrgency = urgency;
    product.lastRestockFlaggedAt = new Date().toISOString();

    db.addAudit({
      actionType: 'RESTOCK_FLAG',
      summary: `[AI Restock Guard] Flagged SKU ${product.sku} (${product.name}) as ${urgency} restock. Current stock: ${product.currentStock} (Threshold: ${product.reorderThreshold})`,
      details: {
        productId: product.id,
        sku: product.sku,
        unitsRemaining: product.currentStock,
        threshold: product.reorderThreshold,
        suggestedPOQuantity: product.suggestedReorderQuantity,
        reason,
        urgency,
      },
      source,
    });

    return {
      success: true,
      product,
      message: `Product ${product.sku} successfully flagged for restock with urgency ${urgency}.`,
    };
  }

  async dispatchVendorRestockPO(
    productId: string,
    quantityOverride?: number,
    customNotes?: string,
    source: 'AUTONOMOUS_CRON' | 'HUMAN_OVERRIDE' = 'HUMAN_OVERRIDE'
  ): Promise<{ success: boolean; message: string; poDetails?: any }> {
    const product = this.getProductById(productId);
    if (!product) {
      return { success: false, message: `Product ${productId} not found.` };
    }

    const reorderQuantity = quantityOverride || product.suggestedReorderQuantity;
    const estimatedCostUSD = Number((reorderQuantity * product.unitPrice * 0.65).toFixed(2)); // estimated wholesale cost

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
          <span style="font-size: 11px; font-weight: 700; color: #2563eb; letter-spacing: 1px; text-transform: uppercase;">Official Purchase Order Requisition</span>
          <h1 style="color: #0f172a; margin: 6px 0 0; font-size: 20px;">Urgent Restock Batch Requisition &bull; ${poNumber}</h1>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px;">
          <p style="margin: 3px 0;"><strong>PO Reference:</strong> ${poNumber}</p>
          <p style="margin: 3px 0;"><strong>Vendor Partner:</strong> ${product.vendorName} (<code>${product.vendorEmail}</code>)</p>
          <p style="margin: 3px 0;"><strong>Billing Currency:</strong> Ethiopian Birr (ETB)</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
          <thead>
            <tr style="border-bottom: 2px solid #cbd5e1; text-align: left; color: #64748b; font-size: 11px; background-color: #f1f5f9;">
              <th style="padding: 10px 8px;">SKU</th>
              <th style="padding: 10px 8px;">Item Description</th>
              <th style="padding: 10px 8px; text-align: center;">Requested Qty</th>
              <th style="padding: 10px 8px; text-align: right;">Unit Wholesale</th>
              <th style="padding: 10px 8px; text-align: right;">Est. Batch Total</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 8px; font-family: monospace; font-weight: 600;">${product.sku}</td>
              <td style="padding: 12px 8px;">${product.name}</td>
              <td style="padding: 12px 8px; text-align: center; font-weight: 700; color: #2563eb;">${reorderQuantity}</td>
              <td style="padding: 12px 8px; text-align: right;">${formatETB(product.unitPrice * 0.65)}</td>
              <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: #0f172a;">${formatETB(estimatedCostUSD)}</td>
            </tr>
          </tbody>
        </table>

        ${customNotes ? `<div style="background-color: #fefce8; border: 1px solid #fef08a; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 12px; color: #854d0e;"><strong>Special Logistics Instructions:</strong> ${customNotes}</div>` : ''}

        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 4px; font-size: 12px; color: #166534; line-height: 1.5;">
          <strong>Autonomous Procurement Notice:</strong> Dispatched automatically by the Autonomous E-Commerce Operations AI Specialist. Estimated total wholesale settlement: <strong>${formatETB(estimatedCostUSD)}</strong>.
        </div>
      </div>
    `;

    const emailResult = await emailService.sendEmail({
      to: product.vendorEmail,
      subject: `[URGENT RESTOCK PO: ${poNumber}] Restock Requisition for SKU ${product.sku} (${formatETB(estimatedCostUSD)})`,
      htmlContent: emailHtml,
    });

    product.lastPoDispatchedAt = new Date().toISOString();

    db.addAudit({
      actionType: 'PO_DISPATCHED',
      summary: `[PO Dispatched] Auto-generated and emailed Restock Requisition ${poNumber} to vendor ${product.vendorName} (${product.vendorEmail}) for ${reorderQuantity} units (${formatETB(estimatedCostUSD)}).`,
      details: {
        poNumber,
        sku: product.sku,
        requestedQuantity: reorderQuantity,
        vendorEmail: product.vendorEmail,
        deliveryMode: emailResult.mode,
        messageId: emailResult.messageId,
        estimatedCostETB: formatETB(estimatedCostUSD),
      },
      source,
    });

    return {
      success: true,
      message: `Purchase order ${poNumber} dispatched to ${product.vendorEmail} (${emailResult.mode}) - Total: ${formatETB(estimatedCostUSD)}`,
      poDetails: {
        poNumber,
        sku: product.sku,
        reorderQuantity,
        vendorEmail: product.vendorEmail,
        estimatedCostETB: formatETB(estimatedCostUSD),
        emailResult,
      },
    };
  }

  simulateStockSale(
    productId: string,
    quantitySold: number = 1
  ): { product: Product; autoFlagged: boolean } {
    const product = this.getProductById(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found.`);
    }

    product.currentStock = Math.max(0, product.currentStock - quantitySold);
    db.recalculateProductMetrics(product.id);
    let autoFlagged = false;

    // Proactive auto-trigger: If stock drops below threshold and not yet flagged
    if (product.currentStock <= product.reorderThreshold && !product.isRestockFlagged) {
      const urgency: RestockUrgency = product.currentStock === 0 ? 'CRITICAL' : 'HIGH' as any;
      this.flagProductForRestock(
        product.id,
        `Inventory dipped to ${product.currentStock} units after sale of ${quantitySold} units. Below safety threshold of ${product.reorderThreshold}.`,
        urgency,
        'REAL_TIME_INVENTORY'
      );
      autoFlagged = true;
    }

    return { product, autoFlagged };
  }

  confirmStockRestock(
    productId: string,
    quantityReceived: number = 20,
    notes?: string,
    source: 'SUPPLIER_INGEST' | 'HUMAN_OVERRIDE' = 'SUPPLIER_INGEST'
  ): { success: boolean; product?: Product; message: string } {
    const product = this.getProductById(productId);
    if (!product) {
      return { success: false, message: `Product ${productId} not found.` };
    }

    product.currentStock += quantityReceived;
    product.lastPoDispatchedAt = undefined;
    db.recalculateProductMetrics(product.id);

    db.addAudit({
      actionType: 'RESTOCK_CONFIRMED',
      summary: `[Supplier Warehouse Ingest] Confirmed delivery arrival of ${quantityReceived} units for SKU ${product.sku} (${product.name}). Catalog stock replenished to ${product.currentStock} units.`,
      details: {
        productId: product.id,
        sku: product.sku,
        quantityReceived,
        newStock: product.currentStock,
        vendor: product.vendorName,
        notes: notes || 'Automated factory supplier batch check-in.',
      },
      source: 'MULTI_AGENT_DAG',
    });

    return {
      success: true,
      product,
      message: `Stock replenished! Received ${quantityReceived} units for ${product.sku}. Current stock: ${product.currentStock}.`,
    };
  }
}

export const inventoryService = new InventoryService();
