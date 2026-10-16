import { API_BASE } from "../config";
export * from "../types";
import type { Product, Order, AuditLog, SchedulerState, FinancialEscrow, CheckoutSession } from "../types";

export const api = {
  async getInventory(): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/api/inventory`);
    const data = await res.json();
    return data.products || [];
  },

  async getOrders(): Promise<Order[]> {
    const res = await fetch(`${API_BASE}/api/orders`);
    const data = await res.json();
    return data.orders || [];
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/api/audit-logs`);
    const data = await res.json();
    return data.auditLogs || [];
  },

  async getScheduler(): Promise<SchedulerState> {
    const res = await fetch(`${API_BASE}/api/scheduler`);
    const data = await res.json();
    return data.state;
  },

  async getEscrows(): Promise<FinancialEscrow[]> {
    const res = await fetch(`${API_BASE}/api/escrows`);
    const data = await res.json();
    return data.escrows || [];
  },

  async releaseEscrow(orderId: string, reason?: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/escrows/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, reason }),
    });
    return await res.json();
  },

  async triggerSweep(): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/scheduler/trigger`, { method: 'POST' });
    return await res.json();
  },

  async simulateSale(productId: string, quantity: number = 1): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/inventory/simulate-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity }),
    });
    return await res.json();
  },

  async flag(productId: string, urgency: string = 'MEDIUM'): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/inventory/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        urgency,
        reason: 'Flagged via operator dashboard controls.',
      }),
    });
    return await res.json();
  },

  async po(productId: string, quantity?: number): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/inventory/po`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity }),
    });
    return await res.json();
  },

  async reconcile(orderId: string, deliveryNotes?: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/orders/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        deliveryNotes: deliveryNotes || 'Verified via courier manifest reconciliation.',
      }),
    });
    return await res.json();
  },

  async webhook(trackingNumber: string, carrier: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/courier/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingNumber,
        carrier,
        status: 'DELIVERED_HANDED_TO_RECIPIENT',
        notes: 'Package safely delivered and signed by customer at recipient address.',
      }),
    });
    return await res.json();
  },

  async resolveException(orderId: string, resolutionAction?: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/orders/resolve-exception`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, resolutionAction }),
    });
    return await res.json();
  },

  // Scenarios
  async triggerFlashSale(): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/scenarios/flash-sale`, { method: 'POST' });
    return await res.json();
  },

  async triggerCarrierDisruption(orderId?: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/scenarios/carrier-delay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    return await res.json();
  },

  async triggerSupplierFailover(productId?: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/scenarios/supplier-failover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    return await res.json();
  },

  async getCheckoutSessions(): Promise<CheckoutSession[]> {
    const res = await fetch(`${API_BASE}/api/checkout/sessions`);
    const data = await res.json();
    return data.sessions || [];
  },

  async handleCheckoutCallback(sessionId: string, status: 'success' | 'pending' | 'failed' = 'success'): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/checkout/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, status }),
    });
    return await res.json();
  },

  async simulateCleanCheckout(): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/checkout/simulate/clean`, { method: 'POST' });
    return await res.json();
  },

  async simulateCallbackRaceCondition(): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/checkout/simulate/race-condition`, { method: 'POST' });
    return await res.json();
  },

  async simulateOrphanTimeout(): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/checkout/simulate/orphan-timeout`, { method: 'POST' });
    return await res.json();
  },

  async getSentEmails(): Promise<unknown[]> {
    const res = await fetch(`${API_BASE}/api/emails/sent`);
    const data = await res.json();
    return data.emails || [];
  },

  async chat(
    prompt: string,
    history: Array<{ role: string; text?: string; content?: string }>
  ): Promise<{
    reply: string;
    toolsExecuted?: Array<{ name: string; args: any; result: any }>;
  }> {
    const res = await fetch(`${API_BASE}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        history: history.map((h) => ({
          role: h.role === 'model' ? 'model' : 'user',
          content: h.text || h.content || '',
        })),
      }),
    });
    const data = await res.json();
    return {
      reply: data.reply,
      toolsExecuted: data.toolsExecuted,
    };
  },
};
