import { Router } from 'express';
import { db } from '../data/db.js';
import { inventoryService } from '../services/inventory.service.js';
import { courierService } from '../services/courier.service.js';
import { schedulerService } from '../services/scheduler.service.js';
import { scenariosService } from '../services/scenarios.service.js';
import { checkoutService } from '../services/checkout.service.js';
import { emailService } from '../services/email.service.js';
import { processAgentConversation } from '../agent/gemini.js';

export const apiRouter = Router();

// ==========================================
// INVENTORY ENDPOINTS
// ==========================================
apiRouter.get('/inventory', (req, res) => {
  const products = inventoryService.getAllProducts();
  res.json({ success: true, products });
});

apiRouter.post('/inventory/flag', (req, res) => {
  const { productId, reason, urgency } = req.body;
  const result = inventoryService.flagProductForRestock(productId, reason, urgency, 'HUMAN_OVERRIDE');
  res.json(result);
});

apiRouter.post('/inventory/po', async (req, res) => {
  const { productId, quantity, customNotes } = req.body;
  const result = await inventoryService.dispatchVendorRestockPO(productId, quantity, customNotes, 'HUMAN_OVERRIDE');
  res.json(result);
});

apiRouter.post('/inventory/simulate-sale', (req, res) => {
  const { productId, quantity = 1 } = req.body;
  try {
    const result = inventoryService.simulateStockSale(productId, Number(quantity));
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ==========================================
// ORDER & COURIER ENDPOINTS
// ==========================================
apiRouter.get('/orders', (req, res) => {
  const orders = courierService.getAllOrders();
  res.json({ success: true, orders });
});

apiRouter.post('/orders/reconcile', async (req, res) => {
  const { orderId, deliveryNotes } = req.body;
  const result = await courierService.reconcileDeliveryStatus(
    orderId,
    { deliveryNotes },
    'HUMAN_OVERRIDE'
  );
  res.json(result);
});

apiRouter.post('/courier/webhook', async (req, res) => {
  const { trackingNumber, carrier, status, notes } = req.body;
  if (!trackingNumber) {
    return res.status(400).json({ success: false, message: 'Missing trackingNumber' });
  }
  const result = await courierService.processCarrierWebhookEvent({
    trackingNumber,
    carrier: carrier || 'Third-Party Courier',
    status: status || 'DELIVERED',
    notes: notes || 'Delivery completed at recipient destination.',
  });
  res.json({ success: true, ...result });
});

apiRouter.post('/orders/resolve-exception', async (req, res) => {
  const { orderId, resolutionAction } = req.body;
  if (!orderId) {
    return res.status(400).json({ success: false, message: 'Missing orderId' });
  }
  const result = await courierService.resolveDeliveryException(orderId, resolutionAction);
  res.json(result);
});

// ==========================================
// FINANCIAL ESCROW LEDGER ENDPOINTS
// ==========================================
apiRouter.get('/escrows', (req, res) => {
  res.json({ success: true, escrows: db.escrows });
});

apiRouter.post('/escrows/release', (req, res) => {
  const { orderId, reason } = req.body;
  const escrow = db.releaseEscrowForOrder(orderId, reason || 'Manual operator disbursement override.');
  if (!escrow) {
    return res.status(404).json({ success: false, message: 'Escrow not found or already released.' });
  }
  res.json({ success: true, escrow });
});

// ==========================================
// STRESS-TEST SCENARIOS SIMULATOR ENDPOINTS
// ==========================================
apiRouter.post('/scenarios/flash-sale', async (req, res) => {
  try {
    const result = await scenariosService.triggerFlashSaleSurge();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/scenarios/carrier-delay', async (req, res) => {
  try {
    const { orderId } = req.body;
    const result = await scenariosService.triggerCarrierDisruption(orderId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/scenarios/supplier-failover', async (req, res) => {
  try {
    const { productId } = req.body;
    const result = await scenariosService.triggerSupplierFailover(productId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// CHECKOUT SESSIONS & PAYMENT RECONCILIATION
// ==========================================
apiRouter.get('/checkout/sessions', (req, res) => {
  res.json({ success: true, sessions: checkoutService.getAllSessions() });
});

apiRouter.post('/checkout/create', (req, res) => {
  const { customerName, customerEmail, items } = req.body;
  if (!customerName || !items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: 'Invalid checkout parameters.' });
  }
  const result = checkoutService.createCheckoutSession({
    customerName,
    customerEmail: customerEmail || 'guest@customer.com',
    items,
  });
  res.json(result);
});

apiRouter.post('/checkout/callback', async (req, res) => {
  const { sessionId, status } = req.body;
  try {
    const result = await checkoutService.handleClientCallback(sessionId, status || 'success');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/checkout/simulate/clean', async (req, res) => {
  try {
    const result = await checkoutService.simulateCleanCheckout();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/checkout/simulate/race-condition', async (req, res) => {
  try {
    const result = await checkoutService.simulateCallbackRaceCondition();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/checkout/simulate/orphan-timeout', (req, res) => {
  try {
    const result = checkoutService.simulateOrphanTimeout();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/emails/sent', (req, res) => {
  res.json({ success: true, emails: emailService.sentEmails });
});

// ==========================================
// AUDIT LOGS ENDPOINTS
// ==========================================
apiRouter.get('/audit-logs', (req, res) => {
  res.json({ success: true, auditLogs: db.auditLogs });
});

// ==========================================
// PROACTIVE SCHEDULER ENDPOINTS
// ==========================================
apiRouter.get('/scheduler', (req, res) => {
  res.json({ success: true, state: schedulerService.getState() });
});

apiRouter.post('/scheduler/trigger', async (req, res) => {
  const result = await schedulerService.runAuditSweep('HUMAN_OVERRIDE');
  res.json({ success: true, result });
});

// ==========================================
// AGENT CONVERSATION ENDPOINT
// ==========================================
apiRouter.post('/agent/chat', async (req, res) => {
  const { prompt, history } = req.body;
  if (!prompt) {
    return res.status(400).json({ success: false, message: 'Prompt is required' });
  }

  try {
    const agentResponse = await processAgentConversation(prompt, history || []);
    res.json({ success: true, ...agentResponse });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
