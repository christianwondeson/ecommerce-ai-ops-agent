# Solution Design Specification (SRS)
## Project: Autonomous E-Commerce Operations & Fulfillment Specialist

**Target Role Automated:** E-Commerce Store & Vendor Operations Specialist  
**Target Industry:** Multi-Vendor E-Commerce & Retail Marketplaces  
**Author:** Full Stack AI Web Developer Candidate  
**Reviewer:** Kidus (kidus@brain3.ai)  
**Submission Level:** Level 1 Project (1-Day Assessment)  

---

## 1. Executive Summary & Why This Role

In high-growth e-commerce and multi-vendor marketplace environments, operational overhead scales linearly with order volume. Operations teams spend over 65% of their daily bandwidth performing repetitive dashboard checks and manual data entry:

1. **Manual Inventory Auditing & Restock Flagging:** Store operators routinely comb through thousands of catalog SKUs. When stock is depleted or drops below safe thresholds, an operator must manually change the product flag to "RESTOCK NEEDED" on the merchant dashboard and draft emails to suppliers. Inevitably, manual delays cause stockouts, overselling, and lost sales.
2. **Manual Delivery Status Reconciliation:** When third-party 3PL couriers (e.g., local dispatch riders, DHL, FedEx) successfully deliver a package, the e-commerce dashboard remains in "Shipped" or "In Transit" until an operations associate manually cross-references courier dispatch reports and clicks "Mark as Delivered." This latency delays merchant escrow payouts, distorts customer return windows, and spikes customer support inquiries.

### The Value Proposition
The **Autonomous E-Commerce Operations Specialist** is a 24/7 AI-driven system that eliminates this human bottleneck by:
- Autonomously tracking inventory thresholds and mutating product restock flags on the merchant dashboard without human intervention.
- Formulating structured supplier purchase order drafts and dispatching them via transactional email.
- Listening to courier tracking status updates, reasoning through delivery proof notes with **Gemini 2.5 Flash**, and autonomously reconciling order lifecycles to `DELIVERED`.
- Running proactive hourly background cron audits to detect stalled shipments and critical low-stock items before they impact revenue.

---

## 2. Role Breakdown & Prioritization Matrix

### Sub-Functionality Breakdown
- **Inventory Telemetry & Velocity Analysis:** Monitor unit balances against minimum reorder points.
- **Merchant Dashboard Flag Mutation:** Update store product status to `RESTOCK_NEEDED` with priority ratings (LOW, MEDIUM, CRITICAL).
- **Supplier Reorder Formulation:** Generate formal purchase order requisitions with item SKUs, estimated replenishment quantities, and vendor contacts.
- **Courier Tracking Ingestion:** Ingest tracking numbers and delivery event streams from carrier APIs or dispatch webhooks.
- **Proof-of-Delivery Semantic Analysis:** Comprehend carrier tracking status notes (differentiating between attempted delivery, customer unavailable, and confirmed delivery).
- **Order Lifecycle Synchronization:** Mutate order statuses in the operational database from `IN_TRANSIT` to `DELIVERED` with timestamped audit proofs.
- **Proactive Health Sweeps:** Periodic cron sweeps identifying anomalies, delayed orders (>48h), and preparing operations summaries.

### Prioritization Matrix
| Workstream / Capability | Impact | Complexity | Priority | Included in Level 1 |
| :--- | :--- | :--- | :--- | :--- |
| **Autonomous Restock Flagging** | High | Medium | **P0 (Critical)** | Yes |
| **Courier Delivery Status Reconciliation** | High | Medium | **P0 (Critical)** | Yes |
| **Gemini 2.5 Flash Tool-Calling Engine** | High | Medium | **P0 (Critical)** | Yes |
| **Proactive Cron Background Scheduler** | High | Low | **P1 (Core)** | Yes |
| **Transactional Email Dispatch (SendGrid/Resend)** | Medium | Low | **P1 (Core)** | Yes |
| **Interactive Operations Dashboard & Audit Log** | High | Medium | **P1 (Core)** | Yes |
| **Natural Language Human-in-the-Loop Console** | Medium | Medium | **P1 (Core)** | Yes |
| **Multi-Carrier Route Optimization** | Low | High | **P3 (Deferred)**| Future Roadmap |

---

## 3. High-Level System Architecture

The solution is architected as a cohesive **npm workspaces monorepo** featuring a modern reactive frontend and an event-driven, tool-calling Node.js backend.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OPERATIONS DASHBOARD (REACT)                       │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐  │
│  │ Inventory Live Table  │ │ Order Lifecycle Feed  │ │ AI Live Audit Log │  │
│  │ (Auto-Restock Badges) │ │ (Transit->Delivered)  │ │ (Real-Time Events)│  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │       Interactive Ops Console & Proactive Scheduler Status Bar        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST / Event Stream
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BACKEND SERVER (EXPRESS + TYPESCRIPT)                 │
│  ┌─────────────────────────┐                     ┌───────────────────────┐  │
│  │   REST & Webhook API    │                     │ Proactive Scheduler   │  │
│  │  - /api/inventory       │                     │ (node-cron engine:    │  │
│  │  - /api/orders          │                     │  periodic sweeps &    │  │
│  │  - /api/courier/webhook │                     │  anomaly detection)   │  │
│  └───────────┬─────────────┘                     └───────────┬───────────┘  │
│              │                                               │              │
│              └───────────────────────┬───────────────────────┘              │
│                                      ▼                                      │
│                      ┌───────────────────────────────┐                      │
│                      │   GEMINI 2.5 FLASH AGENT CORE │                      │
│                      │      (Tool Calling Engine)    │                      │
│                      └───────────────┬───────────────┘                      │
│                                      │                                      │
│       ┌──────────────────────────────┼──────────────────────────────┐       │
│       ▼                              ▼                              ▼       │
│ ┌───────────────┐           ┌──────────────────┐           ┌──────────────┐ │
│ │ Inventory Svc │           │ Courier Tracking │           │ Notification │ │
│ │ (Flag mutate) │           │ (Reconcile Svc)  │           │ (Email API)  │ │
│ └───────────────┘           └──────────────────┘           └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### A. Frontend Architecture (Client)
- **Framework:** React 18 with Vite and TypeScript.
- **Styling:** Tailwind CSS for a responsive, modern dark/light operations UI.
- **Key Modules:**
  - `LiveAuditFeed`: Chronological streaming feed of autonomous actions taken by the AI agent with execution timestamps and reasoning tokens.
  - `InventoryTable`: Live inventory grid highlighting automated `RESTOCK_NEEDED` badges, stock counts, and AI-drafted purchase order triggers.
  - `OrdersPipeline`: Visual Kanban/table tracking orders as they transition from `IN_TRANSIT` to `DELIVERED` upon courier reconciliation.
  - `AgentChatConsole`: Human-in-the-loop chat interface allowing operators to converse with the agent or issue natural-language operational directives.
  - `SchedulerControl`: Real-time indicator of the proactive cron scheduler with the ability to inspect scheduled jobs or trigger an immediate audit.

### B. Backend Architecture (Server)
- **Runtime:** Node.js with Express & TypeScript.
- **Agent Orchestrator:** Google Gemini 2.5 Flash utilizing native structured function calling (tools).
- **Core Agent Tools:**
  1. `check_inventory_levels()`: Scans all SKU balances and flags items below safety thresholds.
  2. `flag_product_for_restock(productId, reason, priority)`: Mutates database flag and attaches restock urgency level.
  3. `reconcile_delivery_status(orderId, trackingNumber, carrierStatus, deliveryNotes)`: Analyzes courier delivery proof and mutates order status to `DELIVERED`.
  4. `dispatch_vendor_restock_email(vendorEmail, sku, quantity, draftPoBody)`: Sends structured purchase orders via transactional email.
  5. `generate_ops_health_summary()`: Compiles cross-system telemetry into an executive daily briefing.

### C. Proactive Background Engine
- **Engine:** `node-cron` scheduler running autonomous sweeps.
- **Autonomous Behaviors:**
  - Proactively audits in-transit orders older than target delivery thresholds.
  - Automatically reconciles packages where courier carriers updated status to delivered.
  - Identifies emerging stockout risks and dispatches supplier restock alerts without requiring human prompts.

---

## 4. Third-Party Integrations & Free Tier Compliance

The architecture strictly adheres to zero-cost, no-credit-card constraints:

| Integration | Purpose | Provider & Free Tier Limits |
| :--- | :--- | :--- |
| **Google Gemini 2.5 Flash** | Core LLM reasoning, intent extraction, courier proof parsing, and structured tool calling. | **Google AI Studio Free Tier:** 15 requests/minute, 1,500 requests/day. Zero credit card required. |
| **SendGrid / Resend API** | Transactional email dispatch for automated vendor purchase orders and daily ops health reports. | **Free Tier:** Up to 100 emails/day. Zero credit card required. |
| **Courier Carrier Webhook & Tracking API** | Ingesting real-time tracking events and proof-of-delivery notes from logistics partners. | **Integrated Carrier Tracking Engine:** Zero cost, webhook-compatible API simulator adhering to universal logistics standards (17Track / DHL format). |

---

## 5. End-to-End Workflow Lifecycles

### Workflow 1: Autonomous Inventory Guard & Supplier Restocking
1. A sale occurs or scheduled sweep detects stock $\le \text{reorderThreshold}$.
2. The agent triggers `flag_product_for_restock`, updating the merchant dashboard in real-time.
3. Gemini 2.5 Flash generates a supplier purchase order specifying SKU, requested quantity, and delivery terms.
4. The agent invokes `dispatch_vendor_restock_email`, sending the purchase order to the vendor.
5. The action is logged to the Live Audit Feed with audit trace proof.

### Workflow 2: Courier Delivery Status Reconciliation
1. A courier carrier logs a delivery event with tracking details (e.g., *"Package left at front door with recipient signature"*).
2. The agent invokes `reconcile_delivery_status`.
3. Gemini analyzes the carrier note, confirms proof of delivery, and updates the order status to `DELIVERED`.
4. The order timestamp is sealed, releasing vendor escrow funds and updating customer tracking.

### Workflow 3: Proactive Ops Cron Auditor
1. Background cron fires periodically.
2. Evaluates all orders stuck in `IN_TRANSIT` $>48\text{h}$ and all SKUs nearing depletion.
3. Automatically triggers required restock alerts and generates an executive operations digest.

---

## 6. Implementation & Verification Plan

- **Phase 1: Project Scaffolding & Types:** Initialize npm workspaces monorepo, define shared TypeScript contracts for orders, products, and carrier events.
- **Phase 2: Backend Services & Gemini Tool Calling:** Implement core database models, Gemini 2.5 Flash tool calling pipeline, email dispatch service, and background cron scheduler.
- **Phase 3: Frontend Operations Dashboard:** Build responsive React UI with real-time audit feed, inventory restock table, order pipeline, and interactive AI console.
- **Phase 4: End-to-End Verification:** Validate autonomous triggers, webhook ingestion, email delivery, and test fallback modes.
- **Phase 5: Documentation & Video Demo:** Publish GitHub repository with comprehensive README and record the 3–5 minute walkthrough video.
