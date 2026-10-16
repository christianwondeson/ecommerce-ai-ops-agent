import cron, { ScheduledTask } from 'node-cron';
import { db } from '../data/db.js';
import { inventoryService } from './inventory.service.js';
import { courierService } from './courier.service.js';
import { SchedulerState } from '../types/index.js';

class SchedulerService {
  private cronJob: ScheduledTask | null = null;
  private cronExpression: string = process.env.CRON_SCHEDULE || '*/15 * * * *';
  private totalRuns: number = 0;
  private lastRunTimestamp?: string;
  private isRunning: boolean = false;
  private lastFindings: SchedulerState['lastFindings'] = {
    lowStockFound: 0,
    reconciledCount: 0,
    delayedOrdersFound: 0,
  };

  init() {
    console.log(`[SchedulerService] Initializing Proactive Cron with expression "${this.cronExpression}"`);
    try {
      this.cronJob = cron.schedule(this.cronExpression, () => {
        this.runAuditSweep('AUTONOMOUS_CRON');
      });
      this.isRunning = true;
    } catch (err) {
      console.error('[SchedulerService] Failed to schedule cron job:', err);
    }
  }

  async runAuditSweep(source: 'AUTONOMOUS_CRON' | 'HUMAN_OVERRIDE' = 'AUTONOMOUS_CRON'): Promise<{
    timestamp: string;
    findings: {
      lowStockFound: number;
      reconciledCount: number;
      delayedOrdersFound: number;
    };
    summary: string;
  }> {
    this.totalRuns += 1;
    this.lastRunTimestamp = new Date().toISOString();
    console.log(`[SchedulerService] Executing proactive audit sweep #${this.totalRuns} (Source: ${source})...`);

    let lowStockFound = 0;
    let reconciledCount = 0;
    let delayedOrdersFound = 0;

    // 1. Audit Inventory
    const allProducts = inventoryService.getAllProducts();
    for (const prod of allProducts) {
      if (prod.currentStock <= prod.reorderThreshold && !prod.isRestockFlagged) {
        inventoryService.flagProductForRestock(
          prod.id,
          `Proactive cron audit detected stock (${prod.currentStock}) at or below threshold (${prod.reorderThreshold}).`,
          prod.currentStock === 0 ? 'CRITICAL' : 'HIGH' as any,
          source
        );
        lowStockFound += 1;
      }
    }

    // 2. Audit In-Transit Orders & Auto-Reconcile if Delivered
    const inTransitOrders = courierService.getInTransitOrders();
    const now = Date.now();

    for (const order of inTransitOrders) {
      const isCarrierMarkedDelivered =
        order.courierStatus.toUpperCase().includes('DELIVER') ||
        order.lastTrackingNote.toLowerCase().includes('delivered') ||
        order.lastTrackingNote.toLowerCase().includes('deposited');

      if (isCarrierMarkedDelivered) {
        await courierService.reconcileDeliveryStatus(
          order.id,
          {
            trackingNumber: order.trackingNumber,
            courierStatus: order.courierStatus,
            deliveryNotes: order.lastTrackingNote,
          },
          source
        );
        reconciledCount += 1;
      } else {
        // Check if delayed (> 24 hours in transit)
        const shippedTime = new Date(order.shippedAt).getTime();
        const hoursInTransit = (now - shippedTime) / (1000 * 60 * 60);
        if (hoursInTransit > 24) {
          delayedOrdersFound += 1;
        }
      }
    }

    this.lastFindings = {
      lowStockFound,
      reconciledCount,
      delayedOrdersFound,
    };

    const summary = `Proactive sweep completed: ${lowStockFound} stockout risks auto-flagged, ${reconciledCount} orders auto-reconciled to DELIVERED, ${delayedOrdersFound} shipments flagged as in-transit delay.`;

    db.addAudit({
      actionType: 'PROACTIVE_SWEEP',
      summary: `[Proactive Scheduled Audit #${this.totalRuns}] ${summary}`,
      details: {
        sweepNumber: this.totalRuns,
        findings: this.lastFindings,
        source,
      },
      source,
    });

    console.log(`[SchedulerService] ${summary}`);
    return {
      timestamp: this.lastRunTimestamp,
      findings: this.lastFindings,
      summary,
    };
  }

  getState(): SchedulerState {
    return {
      isRunning: this.isRunning,
      cronExpression: this.cronExpression,
      lastRunTimestamp: this.lastRunTimestamp,
      totalRuns: this.totalRuns,
      lastFindings: this.lastFindings,
    };
  }
}

export const schedulerService = new SchedulerService();
