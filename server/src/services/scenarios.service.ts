import { db } from '../data/db.js';
import { emailService } from './email.service.js';
import { inventoryService } from './inventory.service.js';
import { formatETB } from '../utils/currency.js';

export class ScenariosService {
  async triggerFlashSaleSurge(): Promise<{
    scenario: string;
    totalUnitsSold: number;
    affectedSkus: string[];
    criticalFlagsTriggered: number;
    summary: string;
  }> {
    let totalUnitsSold = 0;
    const affectedSkus: string[] = [];
    let criticalFlagsTriggered = 0;

    // Simulate surge across all catalog products
    for (const prod of db.products) {
      const surgeQuantity = Math.floor(Math.random() * 8) + 4; // sell 4 to 12 units
      prod.currentStock = Math.max(0, prod.currentStock - surgeQuantity);
      prod.predictive.burnRatePerDay = Number((prod.predictive.burnRatePerDay * 2.5).toFixed(1)); // burn rate spikes
      totalUnitsSold += surgeQuantity;
      affectedSkus.push(prod.sku);

      // Recalculate metrics
      db.recalculateProductMetrics(prod.id);

      if (prod.restockUrgency === 'CRITICAL') {
        criticalFlagsTriggered += 1;
        // Auto-dispatch emergency restock PO
        await inventoryService.dispatchVendorRestockPO(
          prod.id,
          prod.suggestedReorderQuantity * 2,
          'EXPEDITED FLASH SALE REORDER: Factory priority requested due to sudden demand spike.',
          'AUTONOMOUS_CRON'
        );
      }
    }

    const summary = `Flash Sale Surge simulated: ${totalUnitsSold} units sold in seconds across ${affectedSkus.length} SKUs. Burn rate spiked 250%. ${criticalFlagsTriggered} SKUs entered CRITICAL stockout risk (<48h DIR). Autonomous procurement agent auto-issued emergency double-batch POs.`;

    db.addAudit({
      actionType: 'SCENARIO_SIMULATION',
      summary: `[Scenario Simulator: Black Friday Surge] ${summary}`,
      details: {
        totalUnitsSold,
        affectedSkus,
        criticalFlagsTriggered,
      },
      source: 'MULTI_AGENT_DAG',
    });

    return {
      scenario: 'FLASH_SALE_SURGE',
      totalUnitsSold,
      affectedSkus,
      criticalFlagsTriggered,
      summary,
    };
  }

  async triggerCarrierDisruption(orderId?: string): Promise<{
    scenario: string;
    orderNumber: string;
    carrier: string;
    exceptionType: string;
    mitigationAction: string;
    summary: string;
  }> {
    const order = orderId
      ? db.orders.find((o) => o.id === orderId || o.orderNumber === orderId)
      : db.orders.find((o) => o.status === 'IN_TRANSIT') || db.orders[0];

    if (!order) {
      throw new Error('No active order found for carrier disruption.');
    }

    order.courierStatus = 'EXCEPTION_DELIVERY_STRANDED';
    order.lastTrackingNote = 'Logistics vehicle breakdown on highway corridor. Package delivery SLA breached (+48h delay estimated).';
    order.exception = {
      hasException: true,
      exceptionType: 'HUB_DELAY',
      severity: 'HIGH',
      mitigationAction: 'AI rerouted package to RapidDispatch Rider #14. Automated delay compensation coupon emailed to customer. Vendor payout escrow placed on DISPUTE_HOLD.',
    };

    // Hold Escrow
    const escrow = db.escrows.find((e) => e.orderId === order.id);
    if (escrow) {
      escrow.status = 'DISPUTE_HOLD';
      escrow.releaseReason = 'Escrow frozen on DISPUTE_HOLD due to severe carrier route breakdown.';
    }

    // Send proactive customer alert email
    await emailService.sendEmail({
      to: order.customerEmail,
      subject: `[PROACTIVE UPDATE: #${order.orderNumber}] Delivery Exception Detected & Rerouted (${formatETB(order.totalAmount)})`,
      htmlContent: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
          <div style="border-bottom: 2px solid #ef4444; padding-bottom: 16px; margin-bottom: 20px;">
            <span style="font-size: 11px; font-weight: 700; color: #ef4444; letter-spacing: 1px; text-transform: uppercase;">Delivery Corridor Delay Detected &bull; Autonomous Mitigation</span>
            <h1 style="color: #0f172a; margin: 6px 0 0; font-size: 20px;">Urgent Update Regarding Order #${order.orderNumber}</h1>
          </div>

          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
            Dear ${order.customerName}, our autonomous logistics monitoring system detected an unexpected vehicle breakdown with <strong>${order.courierCarrier}</strong> for your order (Total Value: <strong>${formatETB(order.totalAmount)}</strong>).
          </p>

          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; color: #991b1b; line-height: 1.5;">
            <strong>Autonomous Mitigation Executed:</strong><br/>
            Your parcel was immediately rerouted to our secondary priority logistics partner. Revised delivery window: Tomorrow by 1:00 PM.
          </div>

          <p style="font-size: 13px; color: #64748b;">
            We sincerely apologize for this slight delay and have credited your account with free expedited shipping for your next order.
          </p>
        </div>
      `,
    });

    const escrowHeldETB = formatETB(escrow?.netVendorPayout || 0);
    const summary = `Carrier breakdown simulated for Order #${order.orderNumber} (${order.courierCarrier}). AI Logistics Agent caught delay, held ${escrowHeldETB} vendor escrow on DISPUTE_HOLD, rerouted shipment to secondary dispatch, and emailed proactive customer notice.`;

    db.addAudit({
      actionType: 'CARRIER_EXCEPTION',
      summary: `[Carrier Disruption Engine] ${summary}`,
      details: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        carrier: order.courierCarrier,
        escrowHeldETB,
      },
      source: 'MULTI_AGENT_DAG',
    });

    return {
      scenario: 'CARRIER_BREAKDOWN',
      orderNumber: order.orderNumber,
      carrier: order.courierCarrier,
      exceptionType: 'HUB_DELAY',
      mitigationAction: order.exception.mitigationAction || '',
      summary,
    };
  }

  async triggerSupplierFailover(productId?: string): Promise<{
    scenario: string;
    productSku: string;
    primarySupplier: string;
    secondarySupplier: string;
    costImpact: string;
    leadTimeAdvantage: string;
    summary: string;
  }> {
    const prod = productId
      ? db.products.find((p) => p.id === productId || p.sku === productId)
      : db.products.find((p) => p.predictive.secondarySupplier) || db.products[0];

    if (!prod || !prod.predictive.secondarySupplier) {
      throw new Error('Product or secondary supplier not available.');
    }

    const sec = prod.predictive.secondarySupplier;
    const oldVendor = prod.vendorName;

    // Execute failover
    prod.vendorName = sec.name;
    prod.vendorEmail = sec.email;
    const costDiff = (sec.unitPrice - prod.unitPrice).toFixed(2);
    const leadTimeDiff = prod.predictive.leadTimeDays - sec.leadTimeDays;

    prod.predictive.leadTimeDays = sec.leadTimeDays;
    prod.unitPrice = sec.unitPrice;

    // Recalculate metrics
    db.recalculateProductMetrics(prod.id);

    // Dispatch PO to secondary supplier
    const poResult = await inventoryService.dispatchVendorRestockPO(
      prod.id,
      prod.suggestedReorderQuantity,
      `SUPPLIER FAILOVER CONTRACT: Routed to ${sec.name} due to primary factory supply chain depletion. Expedited ${sec.leadTimeDays}-day delivery agreed.`,
      'AUTONOMOUS_CRON'
    );

    const summary = `Primary vendor ${oldVendor} out-of-stock. Autonomous Procurement Agent engaged secondary supplier ${sec.name} (${sec.email}). Accelerated lead time by ${leadTimeDiff} days (new lead time: ${sec.leadTimeDays}d) with minimal unit cost variance (+$${costDiff}). Emergency PO dispatched.`;

    db.addAudit({
      actionType: 'SUPPLIER_FAILOVER',
      summary: `[Supplier Failover Protocol] ${summary}`,
      details: {
        sku: prod.sku,
        previousVendor: oldVendor,
        newVendor: sec.name,
        newLeadTime: sec.leadTimeDays,
        poDispatched: poResult.success,
      },
      source: 'MULTI_AGENT_DAG',
    });

    return {
      scenario: 'SUPPLIER_STOCKOUT',
      productSku: prod.sku,
      primarySupplier: oldVendor,
      secondarySupplier: sec.name,
      costImpact: `+$${costDiff}/unit`,
      leadTimeAdvantage: `${leadTimeDiff} days faster`,
      summary,
    };
  }
}

export const scenariosService = new ScenariosService();
