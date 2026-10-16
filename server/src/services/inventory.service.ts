import { db } from '../data/db.js';
import { Product, RestockUrgency } from '../types/index.js';
import { emailService } from './email.service.js';

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
    const estimatedCost = (reorderQuantity * product.unitPrice * 0.65).toFixed(2); // estimated wholesale cost

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-top: 0;">OFFICIAL PURCHASE ORDER REQUISITION</h2>
        <p><strong>PO Reference:</strong> ${poNumber}</p>
        <p><strong>Vendor:</strong> ${product.vendorName} (${product.vendorEmail})</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8fafc; text-align: left;">
              <th style="padding: 8px;">SKU</th>
              <th style="padding: 8px;">Item Description</th>
              <th style="padding: 8px;">Requested Units</th>
              <th style="padding: 8px;">Est. Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px; border-top: 1px solid #e2e8f0;">${product.sku}</td>
              <td style="padding: 8px; border-top: 1px solid #e2e8f0;">${product.name}</td>
              <td style="padding: 8px; border-top: 1px solid #e2e8f0;"><strong>${reorderQuantity}</strong></td>
              <td style="padding: 8px; border-top: 1px solid #e2e8f0;">$${estimatedCost}</td>
            </tr>
          </tbody>
        </table>
        ${customNotes ? `<p style="margin-top: 15px;"><strong>Special Instructions:</strong> ${customNotes}</p>` : ''}
        <p style="margin-top: 20px; font-size: 12px; color: #64748b;">
          Automated purchase order requisition dispatched by Autonomous E-Commerce Operations AI Specialist.
        </p>
      </div>
    `;

    const emailResult = await emailService.sendEmail({
      to: product.vendorEmail,
      subject: `[URGENT RESTOCK PO: ${poNumber}] Restock Requisition for SKU ${product.sku}`,
      htmlContent: emailHtml,
    });

    product.lastPoDispatchedAt = new Date().toISOString();

    db.addAudit({
      actionType: 'PO_DISPATCHED',
      summary: `[PO Dispatched] Auto-generated and emailed Restock Requisition ${poNumber} to vendor ${product.vendorName} (${product.vendorEmail}) for ${reorderQuantity} units.`,
      details: {
        poNumber,
        sku: product.sku,
        requestedQuantity: reorderQuantity,
        vendorEmail: product.vendorEmail,
        deliveryMode: emailResult.mode,
        messageId: emailResult.messageId,
      },
      source,
    });

    return {
      success: true,
      message: `Purchase order ${poNumber} dispatched to ${product.vendorEmail} (${emailResult.mode})`,
      poDetails: {
        poNumber,
        sku: product.sku,
        reorderQuantity,
        vendorEmail: product.vendorEmail,
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
}

export const inventoryService = new InventoryService();
