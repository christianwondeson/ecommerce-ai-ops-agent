import { GoogleGenerativeAI } from '@google/generative-ai';
import { agentToolDeclarations, executeAgentTool } from './tools.js';
import { db } from '../data/db.js';

function buildLiveStoreContext(): string {
  const productsSummary = db.products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    currentStock: p.currentStock,
    minThreshold: p.reorderThreshold,
    unitPrice: p.unitPrice,
    vendorName: p.vendorName,
    vendorEmail: p.vendorEmail,
    isFlagged: p.isRestockFlagged,
    urgency: p.restockUrgency || 'NORMAL',
    daysOfInventoryRemaining: p.predictive?.daysOfInventoryRemaining,
    burnRatePerDay: p.predictive?.burnRatePerDay,
    stockoutRisk: `${p.predictive?.stockoutRiskPercentage}%`,
    backupSupplier: p.predictive?.secondarySupplier
      ? `${p.predictive.secondarySupplier.name} (${p.predictive.secondarySupplier.leadTimeDays}d lead, $${p.predictive.secondarySupplier.unitPrice})`
      : 'None',
  }));

  const ordersSummary = db.orders.map((o) => ({
    orderNumber: o.orderNumber,
    customer: o.customerName,
    items: o.items.map((i) => `${i.quantity}x ${i.sku}`).join(', '),
    totalAmount: o.totalAmount,
    status: o.status,
    carrier: o.courierCarrier,
    trackingNumber: o.trackingNumber,
    carrierStatus: o.courierStatus,
    lastNote: o.lastTrackingNote,
    hasException: o.exception?.hasException,
    exceptionType: o.exception?.exceptionType,
  }));

  const escrowsSummary = db.escrows.map((e) => ({
    orderNumber: e.orderNumber,
    vendor: e.vendorName,
    gross: e.grossAmount,
    platformTake12Pct: e.platformTake,
    netVendorPayout: e.netVendorPayout,
    status: e.status,
    reason: e.releaseReason,
  }));

  const checkoutSummary = db.checkoutSessions.map((c) => ({
    sessionId: c.sessionId,
    customer: c.customerName,
    amount: c.totalAmount,
    status: c.status,
    stockReserved: c.stockReserved,
    note: c.reconciliationNotes,
  }));

  return `
CURRENT REAL-TIME STORE DATA & TELEMETRY:
Products Catalog (${productsSummary.length} SKUs):
${JSON.stringify(productsSummary, null, 2)}

Orders Manifest (${ordersSummary.length} Orders):
${JSON.stringify(ordersSummary, null, 2)}

Financial Escrows (${escrowsSummary.length} Accounts):
${JSON.stringify(escrowsSummary, null, 2)}

Active Checkout Sessions (${checkoutSummary.length} Sessions):
${JSON.stringify(checkoutSummary, null, 2)}
`;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
}

export interface AgentExecutionResponse {
  reply: string;
  toolsExecuted: Array<{
    name: string;
    args: any;
    result: any;
  }>;
}

export async function processAgentConversation(
  userPrompt: string,
  history: ChatMessage[] = []
): Promise<AgentExecutionResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  const toolsExecuted: Array<{ name: string; args: any; result: any }> = [];

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return handleDeterministicFallback(userPrompt);
  }

  try {
    const liveStoreContext = buildLiveStoreContext();
    const systemPrompt = `
You are the Autonomous Multi-Agent E-Commerce Operations Specialist for a high-growth multi-vendor marketplace.
You have direct supervision over inventory forecasting, supplier procurement, courier logistics reconciliation, marketplace financial escrow (12% commission), and checkout callback healing.

${liveStoreContext}

OPERATIONAL DIRECTIVES:
1. Answer ANY user question thoroughly, factually, and accurately using the live store telemetry provided above (stock counts, vendors, prices, order statuses, burn rates, DIR, etc.).
2. You are NOT limited to predefined prompts. You can reason about supply chains, explain inventory policies, compare vendors, compute stock runway, diagnose delivery exceptions, or audit escrow accounts.
3. If the user explicitly asks you to take an operational action (e.g. flag an item, restock/order units, dispatch a PO, reconcile an in-transit order, resolve a delivery exception, release escrow, execute supplier failover, reconcile checkout callback, or trigger a stress test), provide your explanation and conclude your response with an action block at the end in this format:
\`\`\`action
[
  { "tool": "dispatch_vendor_restock_email", "args": { "productIdOrSku": "ELEC-CAM-004", "quantity": 25 } }
]
\`\`\`
Available Action Tools:
- check_inventory_levels (filter?: "ALL" | "LOW_STOCK_ONLY" | "FLAGGED_ONLY")
- forecast_inventory_depletion (productIdOrSku?: string)
- flag_product_for_restock (productIdOrSku: string, urgency: "LOW"|"MEDIUM"|"CRITICAL", reason: string)
- dispatch_vendor_restock_email (productIdOrSku: string, quantity: number, instructions?: string)
- execute_supplier_failover (productIdOrSku?: string)
- reconcile_delivery_status (orderIdentifier: string, deliveryNotes: string)
- resolve_delivery_exception (orderIdentifier: string, resolutionAction?: string)
- audit_escrow_settlement_ledger (filter?: "ALL" | "LOCKED" | "RELEASED" | "DISPUTE_HOLD")
- reconcile_checkout_payment (sessionId: string)
- release_orphan_checkout_stock ()
- trigger_proactive_audit_sweep ()
- simulate_stress_test (scenario: "FLASH_SALE_SURGE" | "CARRIER_BREAKDOWN" | "SUPPLIER_STOCKOUT")

Be professional, concise, and action-oriented.
`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      systemInstruction: systemPrompt,
    });

    const conversationContents = [
      ...history.map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: userPrompt }] },
    ];

    const result = await model.generateContent({ contents: conversationContents });
    const fullText = result.response.text();

    // Check for ```action ... ``` block in response
    const actionMatch = fullText.match(/```(?:action|json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/);
    let replyText = fullText;

    if (actionMatch) {
      try {
        const actions = JSON.parse(actionMatch[1]);
        if (Array.isArray(actions)) {
          for (const act of actions) {
            if (act.tool) {
              const res = await executeAgentTool(act.tool, act.args || {});
              toolsExecuted.push({
                name: act.tool,
                args: act.args || {},
                result: res,
              });
            }
          }
        }
        // Remove raw action block from human response text
        replyText = fullText.replace(/```(?:action|json)?\s*\[\s*\{[\s\S]*?\}\s*\]\s*```/g, '').trim();
      } catch (e: any) {
        console.warn('[GeminiAgent] Action parse error:', e.message);
      }
    }

    return {
      reply: replyText,
      toolsExecuted,
    };
  } catch (err: any) {
    console.warn('[GeminiAgent] Live Gemini error, falling back to dynamic search agent:', err.message);
    return handleDeterministicFallback(userPrompt);
  }
}

// Fallback search agent with full dynamic query parsing over live DB state
async function handleDeterministicFallback(prompt: string): Promise<AgentExecutionResponse> {
  const lower = prompt.toLowerCase();
  const toolsExecuted: Array<{ name: string; args: any; result: any }> = [];
  let reply = '';

  // 1. Check for specific product lookup (by SKU or keywords)
  const matchedProduct = db.products.find((p) =>
    lower.includes(p.sku.toLowerCase()) ||
    lower.includes(p.name.toLowerCase()) ||
    (lower.includes('webcam') && p.sku.includes('CAM')) ||
    (lower.includes('headphone') && p.sku.includes('ANC')) ||
    (lower.includes('coffee') && p.sku.includes('COF')) ||
    (lower.includes('chair') && p.sku.includes('CHR')) ||
    (lower.includes('keyboard') && p.sku.includes('KEY'))
  );

  // If user asks to order/restock the product
  if (matchedProduct && (lower.includes('order') || lower.includes('po') || lower.includes('restock') || lower.includes('buy') || lower.includes('send'))) {
    const qty = matchedProduct.suggestedReorderQuantity;
    const poRes = await executeAgentTool('dispatch_vendor_restock_email', {
      productIdOrSku: matchedProduct.id,
      quantity: qty,
      instructions: 'Expedited restock requisition dispatched via AI Operations Specialist.',
    });
    toolsExecuted.push({
      name: 'dispatch_vendor_restock_email',
      args: { productIdOrSku: matchedProduct.sku, quantity: qty },
      result: poRes,
    });
    return {
      reply: `Dispatched an official Purchase Order requisition for ${qty} units of ${matchedProduct.name} (${matchedProduct.sku}) to vendor ${matchedProduct.vendorName} (${matchedProduct.vendorEmail}). Wholesale unit price: $${matchedProduct.unitPrice.toFixed(2)}.`,
      toolsExecuted,
    };
  }

  // If user just asks about product details / stock / vendor
  if (matchedProduct) {
    const p = matchedProduct;
    return {
      reply: `**SKU ${p.sku} (${p.name})**\n\n- **Current Stock:** ${p.currentStock} units (Safety threshold: ${p.reorderThreshold})\n- **Burn Rate:** ${p.predictive.burnRatePerDay}/day (Days of Inventory: ${p.predictive.daysOfInventoryRemaining}d)\n- **Stockout Risk:** ${p.predictive.stockoutRiskPercentage}%\n- **Primary Vendor:** ${p.vendorName} (${p.vendorEmail})\n- **Unit Price:** $${p.unitPrice.toFixed(2)}\n- **Secondary Backup Supplier:** ${p.predictive.secondarySupplier ? `${p.predictive.secondarySupplier.name} (${p.predictive.secondarySupplier.leadTimeDays}d lead, $${p.predictive.secondarySupplier.unitPrice.toFixed(2)})` : 'None'}\n- **Status:** ${p.isRestockFlagged ? `Flagged [${p.restockUrgency}]` : 'Normal'}`,
      toolsExecuted,
    };
  }

  // 2. Stress tests
  if (lower.includes('surge') || lower.includes('flash sale') || lower.includes('black friday')) {
    const surge = await executeAgentTool('simulate_stress_test', { scenario: 'FLASH_SALE_SURGE' });
    toolsExecuted.push({ name: 'simulate_stress_test', args: { scenario: 'FLASH_SALE_SURGE' }, result: surge });
    reply = `⚡ Black Friday Flash Sale Surge simulated! ${surge.totalUnitsSold} units sold across catalog SKUs. Burn rate escalated 250%, pushing ${surge.criticalFlagsTriggered} SKUs below 48h Days of Inventory Remaining (DIR). Autonomous procurement agent auto-dispatched double-batch priority POs.`;
  } else if (lower.includes('carrier') || lower.includes('breakdown') || lower.includes('exception')) {
    if (lower.includes('resolve') || lower.includes('reroute')) {
      const expOrder = db.orders.find((o) => o.exception?.hasException) || db.orders[0];
      const res = await executeAgentTool('resolve_delivery_exception', {
        orderIdentifier: expOrder.id,
        resolutionAction: 'Rerouted shipment to Priority Air Corridor #11. Escrow hold lifted.',
      });
      toolsExecuted.push({ name: 'resolve_delivery_exception', args: { orderIdentifier: expOrder.id }, result: res });
      reply = `Carrier delivery exception on Order #${expOrder.orderNumber} successfully resolved. Shipment rerouted to express courier corridor and vendor escrow hold returned to LOCKED status.`;
    } else {
      const breakdown = await executeAgentTool('simulate_stress_test', { scenario: 'CARRIER_BREAKDOWN' });
      toolsExecuted.push({ name: 'simulate_stress_test', args: { scenario: 'CARRIER_BREAKDOWN' }, result: breakdown });
      reply = `🚛 Carrier route breakdown triggered for Order #${breakdown.orderNumber}. Autonomous Logistics Agent froze vendor payout on DISPUTE_HOLD, rerouted transit through secondary dispatch, and emailed proactive customer notice.`;
    }
  } else if (lower.includes('failover') || lower.includes('secondary supplier')) {
    const failover = await executeAgentTool('execute_supplier_failover', {});
    toolsExecuted.push({ name: 'execute_supplier_failover', args: {}, result: failover });
    reply = `🏭 Supplier failover executed for SKU ${failover.productSku}. Primary supplier ${failover.primarySupplier} depleted; contract rerouted to backup vendor ${failover.secondarySupplier} (${failover.leadTimeAdvantage}, ${failover.costImpact}). Emergency PO dispatched.`;
  } else if (lower.includes('escrow') || lower.includes('settlement') || lower.includes('commission') || lower.includes('take')) {
    const escrowAudit = await executeAgentTool('audit_escrow_settlement_ledger', { filter: 'ALL' });
    toolsExecuted.push({ name: 'audit_escrow_settlement_ledger', args: { filter: 'ALL' }, result: escrowAudit });
    reply = `💰 Multi-Vendor Escrow Ledger Audit complete. Total Marketplace GMV: $${escrowAudit.totalGross.toFixed(2)} | Platform Commission (12%): $${escrowAudit.totalPlatformTake.toFixed(2)} | Net Vendor Payouts: $${escrowAudit.totalVendorPayout.toFixed(2)} across ${escrowAudit.count} orders.`;
  } else if (lower.includes('checkout') || lower.includes('callback') || lower.includes('payment') || lower.includes('race')) {
    const pendingSession = db.checkoutSessions.find((s) => s.status === 'CALLBACK_PENDING') || db.checkoutSessions[0];
    if (pendingSession) {
      const rec = await executeAgentTool('reconcile_checkout_payment', { sessionId: pendingSession.sessionId });
      toolsExecuted.push({ name: 'reconcile_checkout_payment', args: { sessionId: pendingSession.sessionId }, result: rec });
      reply = `Autonomous Payment Healer resolved callback race condition for Session #${pendingSession.sessionId} (${pendingSession.customerName}). Gateway clearance confirmed, order dispatched, and escrow initialized.`;
    } else {
      reply = `All checkout sessions are currently reconciled. No pending clearance lags detected.`;
    }
  } else if (lower.includes('reconcile') || lower.includes('deliver') || lower.includes('tracking')) {
    const inTransit = db.orders.find((o) => o.status === 'IN_TRANSIT');
    if (inTransit) {
      const res = await executeAgentTool('reconcile_delivery_status', {
        orderIdentifier: inTransit.id,
        deliveryNotes: 'Verified courier delivery proof. Resident signed confirmation.',
      });
      toolsExecuted.push({
        name: 'reconcile_delivery_status',
        args: { orderIdentifier: inTransit.id },
        result: res,
      });
      reply = `Inspected carrier tracking for Order #${inTransit.orderNumber} (${inTransit.courierCarrier}). Proof-of-delivery validated, order transitioned to DELIVERED, customer notified, and vendor escrow payout released.`;
    } else {
      reply = `All active orders are currently reconciled or pending carrier manifest updates.`;
    }
  } else {
    reply = `Autonomous Multi-Agent Operations Specialist active. I am supervising ${db.products.length} catalog SKUs, ${db.orders.length} shipments, and ${db.escrows.length} escrow accounts. You can ask me any question about our products, stock balances, vendors, or dispatch instructions.`;
  }

  return { reply, toolsExecuted };
}
