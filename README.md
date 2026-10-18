# ⚡ Autonomous Multi-Agent E-Commerce Operations Specialist

[![Live Frontend](https://img.shields.io/badge/Live_UI-Vercel-black?logo=vercel)](https://ecommerce-ai-ops-agent-red.vercel.app/)
[![Live Backend API](https://img.shields.io/badge/API-Render-46E3B7?logo=render)](https://ecommerce-ai-ops-server.onrender.com/)
[![CI Pipeline](https://github.com/christianwondeson/ecommerce-ai-ops-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/christianwondeson/ecommerce-ai-ops-agent/actions/workflows/ci.yml)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](server/Dockerfile)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](package.json)

> **Level 1 Assessment Project – Full Stack AI Web Developer (Advanced Enterprise Revision)**  
> **Candidate:** Christian Wondeson  
> **Reviewer:** Kidus (`brain3`)  
> **Target Role:** E-Commerce Store & Vendor Operations Specialist  
> **Target Industry:** Multi-Vendor E-Commerce & Retail Marketplaces  
> **Live Web Application:** [https://ecommerce-ai-ops-agent-red.vercel.app/](https://ecommerce-ai-ops-agent-red.vercel.app/)  
> **Live Backend Endpoint:** [https://ecommerce-ai-ops-server.onrender.com/](https://ecommerce-ai-ops-server.onrender.com/)  
> **Solution Design Specification:** [docs/SOLUTION_DESIGN.md](docs/SOLUTION_DESIGN.md)

---

## 🚀 What Makes This System Advanced & Unique?

In response to reviewer feedback to elevate the system beyond basic CRUD-and-chat capabilities, this platform has been deepened with **real-world domain engineering, multi-agent DAG orchestration, predictive telemetry, and an interactive operational stress-test harness**:

1. **⚡ Interactive Stress-Test Scenario Simulator (Top Bar):**
   - **Flash Sale Surge:** Injects sudden 250% demand spikes across catalog SKUs, burns down stock, and auto-issues emergency double-batch purchase orders.
   - **Carrier Corridor Breakdown:** Simulates transit vehicle failure, places $110+ vendor escrow on `DISPUTE_HOLD`, and automatically reroutes parcel via secondary priority logistics.
   - **Supplier Stockout Failover:** Detects primary vendor supply chain disruption and automatically engages verified secondary backup suppliers with faster air freight lead times.

2. **📊 Station 01: Predictive Inventory & Stockout Risk Intelligence:**
   - **Days of Inventory Remaining (DIR):** Computes $\text{DIR} = \text{CurrentStock} / \text{BurnRatePerDay}$.
   - **Stockout Risk Percentage:** Real-time probability estimation based on vendor lead times.
   - **Autonomous Restock Requisition POs:** HTML purchase orders formulated and dispatched via Resend transactional email API.

3. **🚛 Station 02: Courier Manifest & Exception Corridor:**
   - **Universal Courier Webhooks:** Ingests tracking events from DHL Express, FedEx Freight, and local courier networks.
   - **Automated Delivery Reconciliation:** Validates doorstep proof-of-delivery notes and transitions order to `DELIVERED`.
   - **AI Exception Rerouting:** Automatically catches transit anomalies (`HUB_DELAY`, `WEATHER_HOLD`) and reroutes shipments to protect delivery SLAs.

4. **💰 Station 05: Financial Escrow & Multi-Vendor Settlement Ledger:**
   - **Zero-Trust Marketplace Escrow:** Customer payments held safely in escrow upon order creation.
   - **12% Marketplace Commission Retention:** Platform automatically retains a 12% take rate on all marketplace orders.
   - **Milestone Settlement:** Unlocks net payouts to vendors the instant delivery proof is confirmed, or holds funds if an exception occurs.

5. **⚡ Station 06: Checkout Callback & Payment Reconciliation Gateway:**
   - **Race Condition Resolution:** Handles situations where customer browser redirects back to callback page (`status=success` or `status=pending`) *before* the payment gateway webhook arrives.
   - **Autonomous Payment Healer:** Queries gateway reference asynchronously, prevents double-charging, and converts session into a confirmed fulfillment order.
   - **Orphan Inventory Hold Reaper:** If a customer abandons checkout, the agent auto-expires the hold and releases the reserved units back to the catalog, preventing false stockouts.

6. **🤖 Station 03 & 04: Black Box Audit Trail & Gemini Dispatch Radio:**
   - **Immutable Audit Feed:** Tracks every action with source attribution (`MULTI_AGENT_DAG`, `AUTONOMOUS_CRON`, `COURIER_WEBHOOK`, `HUMAN_OVERRIDE`).
   - **Natural Language Operator Radio:** Gemini 3.5 Flash Lite with live real-time store context injection and deterministic fallback answering any product, vendor, or operational question.

---

## 🏗️ Multi-Agent Architecture

```mermaid
flowchart TD
    subgraph UI["Cybernetic Operations Console (React 18 + Vite)"]
        S_BAR["⚡ Stress-Test Simulator (Flash Sale | Carrier Delay | Supplier Failover)"]
        ST_01["Station 01: Stock & DIR Predictive Ledger"]
        ST_02["Station 02: Courier Manifest & Exception Corridor"]
        ST_03["Station 03: Black Box Autonomous Audit Stream"]
        ST_04["Station 04: Gemini Dispatch Radio (Natural Language Override)"]
        ST_05["Station 05: Financial Escrow & Multi-Vendor Ledger (12% Fee)"]
        ST_06["Station 06: Checkout & Callback Reconciliation Gateway"]
    end

    subgraph DAG["Multi-Agent Autonomous Orchestrator"]
        ORCH["Gemini 3.5 Flash Lite Orchestration Engine"]
        INV_AGENT["Inventory Guard Agent (DIR & Safety Margin Monitor)"]
        PROC_AGENT["Procurement & Failover Agent (Auto PO & Secondary Supplier)"]
        LOG_AGENT["Logistics & Exception Agent (Webhook Sync & Rerouting)"]
        ESCROW_AGENT["Financial Settlement Agent (12% Take & Zero-Trust Escrow)"]
        PAYMENT_AGENT["Payment Reconciliation & Orphan Reaper Agent"]
    end

    subgraph Core["Backend Runtime (Node.js + Express + TypeScript)"]
        API["REST Endpoints & Courier Webhook Pipeline"]
        SCHED["Proactive Scheduler Engine (node-cron Audit Sweeps)"]
        DB["Real-Time State Store & Event Log"]
        EMAIL["Transactional Dispatcher (Resend API)"]
    end

    subgraph External["External Integrations"]
        GEMINI["Google Gemini 3.5 Flash Lite API"]
        RESEND["Resend Transactional Email Gateway"]
        CARRIERS["3PL Courier Tracking Network"]
    end

    UI <-->|REST & Polling Telemetry| API
    S_BAR -->|Inject Stress| API
    API --> ORCH
    SCHED -->|Unattended Sweeps| ORCH
    ORCH --> INV_AGENT
    ORCH --> PROC_AGENT
    ORCH --> LOG_AGENT
    ORCH --> ESCROW_AGENT

    INV_AGENT -->|DIR Telemetry & Flags| DB
    PROC_AGENT -->|Purchase Orders| EMAIL
    LOG_AGENT -->|Courier Reconciliation & Reroute| DB
    ESCROW_AGENT -->|Disburse Payouts & Take 12%| DB

    EMAIL --> RESEND
    ORCH <--> GEMINI
    CARRIERS -->|Tracking Webhooks| API
```

---

## 🛠️ The 10 Registered Agent Tools

1. `check_inventory_levels`: Retrieves SKU balances, stock counts, and safety thresholds.
2. `forecast_inventory_depletion`: Calculates Days of Inventory Remaining (DIR), burn rates, and stockout percentages.
3. `flag_product_for_restock`: Mutates database flag to `RESTOCK_NEEDED` with `LOW`/`MEDIUM`/`CRITICAL` urgency.
4. `dispatch_vendor_restock_email`: Formulates formal HTML purchase orders and dispatches them via Resend API.
5. `execute_supplier_failover`: Automatically redirects purchase contracts to secondary backup suppliers.
6. `reconcile_delivery_status`: Transitions order to `DELIVERED`, dispatches receipt email, and triggers escrow release.
7. `resolve_delivery_exception`: Intervenes in stalled shipments, reroutes packages, and lifts dispute holds.
8. `audit_escrow_settlement_ledger`: Audits marketplace gross GMV, platform 12% commission, and net vendor payouts.
9. `trigger_proactive_audit_sweep`: Background cron sweep of low stock and in-transit orders.
10. `simulate_stress_test`: Triggers one of the 3 real-world shock scenarios.

---

## 🚀 Quickstart Guide

### 1. Clone & Install
```bash
git clone https://github.com/christianwondeson/ecommerce-ai-ops-agent.git
cd ecommerce-ai-ops-agent
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `server/.env`:
```bash
cp .env.example server/.env
```

### 3. Run Locally
```bash
npm run dev
```
- **Operations Console (Frontend):** `http://localhost:3000`
- **Backend API Server:** `http://localhost:5001`

---

## 🌐 Production Deployments
- **Live Frontend App:** [https://ecommerce-ai-ops-agent-red.vercel.app/](https://ecommerce-ai-ops-agent-red.vercel.app/)
- **Live Backend API:** [https://ecommerce-ai-ops-server.onrender.com/](https://ecommerce-ai-ops-server.onrender.com/)
