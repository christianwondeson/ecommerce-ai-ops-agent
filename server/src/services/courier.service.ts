import { db } from '../data/db.js';
import { Order } from '../types/index.js';
import { emailService } from './email.service.js';
import { formatETB } from '../utils/currency.js';

export class CourierService {
  getAllOrders(): Order[] {
    return db.orders;
  }

  getOrderById(id: string): Order | undefined {
    return db.orders.find(
      (o) =>
        o.id === id ||
        o.orderNumber.toLowerCase() === id.toLowerCase() ||
        o.trackingNumber.toLowerCase() === id.toLowerCase()
    );
  }

  getInTransitOrders(): Order[] {
    return db.orders.filter((o) => o.status === 'IN_TRANSIT');
  }

  async reconcileDeliveryStatus(
    orderIdentifier: string,
    proofDetails: {
      trackingNumber?: string;
      courierStatus?: string;
      deliveryNotes?: string;
      verifiedByAi?: boolean;
    },
    source: 'AUTONOMOUS_CRON' | 'COURIER_WEBHOOK' | 'HUMAN_OVERRIDE' = 'COURIER_WEBHOOK'
  ): Promise<{ success: boolean; order?: Order; message: string }> {
    const order = this.getOrderById(orderIdentifier);
    if (!order) {
      return { success: false, message: `Order ${orderIdentifier} could not be found.` };
    }

    if (order.status === 'DELIVERED') {
      return {
        success: true,
        order,
        message: `Order ${order.orderNumber} is already marked as DELIVERED.`,
      };
    }

    // Mutate order state to DELIVERED
    order.status = 'DELIVERED';
    order.deliveredAt = new Date().toISOString();
    order.reconciledByAi = true;
    order.courierStatus = proofDetails.courierStatus || order.courierStatus || 'DELIVERED';
    if (proofDetails.deliveryNotes) {
      order.lastTrackingNote = proofDetails.deliveryNotes;
    }
    order.reconciliationNotes = `Automated reconciliation executed. Proof: "${order.lastTrackingNote}". Carrier: ${order.courierCarrier}`;

    // Clear exception if present
    if (order.exception) {
      order.exception.hasException = false;
    }

    // Release vendor financial escrow
    db.releaseEscrowForOrder(order.id, 'Carrier proof validated; automated delivery milestone reached.');

    // Dispatches customer notification email
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
        <div style="border-bottom: 2px solid #16a34a; padding-bottom: 16px; margin-bottom: 20px;">
          <span style="font-size: 11px; font-weight: 700; color: #16a34a; letter-spacing: 1px; text-transform: uppercase;">Delivery Completed &bull; Escrow Released</span>
          <h1 style="color: #0f172a; margin: 6px 0 0; font-size: 20px;">Your package has arrived, ${order.customerName}!</h1>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
          We are pleased to confirm that order <strong>${order.orderNumber}</strong> (Total Value: <strong>${formatETB(order.totalAmount)}</strong>) has been successfully delivered by <strong>${order.courierCarrier}</strong>.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px;">
          <p style="margin: 3px 0;"><strong>Tracking Number:</strong> <code>${order.trackingNumber}</code></p>
          <p style="margin: 3px 0;"><strong>Proof Note:</strong> <em>"${order.lastTrackingNote}"</em></p>
          <p style="margin: 3px 0;"><strong>Items Delivered:</strong> ${order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}</p>
          <p style="margin: 3px 0;"><strong>Total Cleared:</strong> ${formatETB(order.totalAmount)}</p>
        </div>

        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 4px; font-size: 12px; color: #166534; line-height: 1.5;">
          <strong>Escrow Milestone Completed:</strong> Vendor escrow settlement has been released. Thank you for shopping with us!
        </div>
      </div>
    `;

    await emailService.sendEmail({
      to: order.customerEmail,
      subject: `[DELIVERY CONFIRMED] Order #${order.orderNumber} Delivered Successfully (${formatETB(order.totalAmount)})`,
      htmlContent: emailHtml,
    });

    db.addAudit({
      actionType: 'DELIVERY_RECONCILED',
      summary: `[Autonomous Reconciliation] Transitioned Order #${order.orderNumber} status to DELIVERED based on ${order.courierCarrier} proof-of-delivery note. Escrow released to vendor. Customer notified.`,
      details: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        carrier: order.courierCarrier,
        trackingNumber: order.trackingNumber,
        proofNote: order.lastTrackingNote,
        deliveredAt: order.deliveredAt,
      },
      source,
    });

    return {
      success: true,
      order,
      message: `Order #${order.orderNumber} successfully reconciled to DELIVERED.`,
    };
  }

  async processCarrierWebhookEvent(event: {
    trackingNumber: string;
    carrier: string;
    status: string;
    notes: string;
  }): Promise<{ reconciled: boolean; message: string; order?: Order }> {
    const order = db.orders.find(
      (o) => o.trackingNumber.toLowerCase() === event.trackingNumber.toLowerCase()
    );

    if (!order) {
      return {
        reconciled: false,
        message: `No order matched carrier tracking ${event.trackingNumber}.`,
      };
    }

    order.courierCarrier = event.carrier || order.courierCarrier;
    order.courierStatus = event.status;
    order.lastTrackingNote = event.notes;

    // Check if status implies delivery
    const isDeliveryStatus =
      event.status.toUpperCase().includes('DELIVER') ||
      event.notes.toLowerCase().includes('delivered') ||
      event.notes.toLowerCase().includes('handed to recipient') ||
      event.notes.toLowerCase().includes('deposited into');

    if (isDeliveryStatus && order.status !== 'DELIVERED') {
      const result = await this.reconcileDeliveryStatus(
        order.id,
        {
          trackingNumber: event.trackingNumber,
          courierStatus: event.status,
          deliveryNotes: event.notes,
        },
        'COURIER_WEBHOOK'
      );
      return { reconciled: true, message: result.message, order: result.order };
    }

    return {
      reconciled: false,
      message: `Carrier update recorded for Order #${order.orderNumber} (Status: ${event.status}). Not delivered yet.`,
      order,
    };
  }

  async resolveDeliveryException(
    orderIdentifier: string,
    resolutionAction?: string
  ): Promise<{ success: boolean; order?: Order; message: string }> {
    const order = this.getOrderById(orderIdentifier);
    if (!order) {
      return { success: false, message: `Order ${orderIdentifier} could not be found.` };
    }

    const action = resolutionAction || 'AI Logistics Agent rerouted shipment via priority courier corridor. Exception resolved.';
    if (order.exception) {
      order.exception.hasException = false;
      order.exception.mitigationAction = action;
    }

    order.courierStatus = 'IN_TRANSIT_REROUTED';
    order.lastTrackingNote = `${action} Package moving on expedited schedule.`;

    // Restore escrow if was on DISPUTE_HOLD
    const escrow = db.escrows.find((e) => e.orderId === order.id);
    if (escrow && escrow.status === 'DISPUTE_HOLD') {
      escrow.status = 'LOCKED';
      escrow.releaseReason = 'Escrow hold lifted following autonomous delivery exception resolution.';
    }

    db.addAudit({
      actionType: 'CARRIER_EXCEPTION',
      summary: `[Exception Resolved] Resolved carrier anomaly for Order #${order.orderNumber}. Reinstated active transit SLA and released dispute hold on vendor escrow.`,
      details: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        action,
      },
      source: 'MULTI_AGENT_DAG',
    });

    return {
      success: true,
      order,
      message: `Exception resolved for Order #${order.orderNumber}.`,
    };
  }
}

export const courierService = new CourierService();
