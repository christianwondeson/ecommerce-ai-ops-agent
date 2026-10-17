import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type Product, type CheckoutSession } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatETB } from "@/lib/currency";

// ─── ETB Currency Formatter ──────────────────────────────────────────────────
function etb(usd: number): string {
  return formatETB(usd);
}

// ─── Step Progress Indicator ─────────────────────────────────────────────────
function StepProgress({ step }: { step: "FORM" | "USSD_SIM" | "CONFIRMED" }) {
  const steps = [
    { key: "FORM", label: "Cart" },
    { key: "USSD_SIM", label: "Payment" },
    { key: "CONFIRMED", label: "Confirmed" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                i < currentIdx
                  ? "bg-ok text-card"
                  : i === currentIdx
                  ? "bg-primary text-primary-foreground animate-pulse-ring"
                  : "bg-secondary text-muted-foreground border border-line"
              )}
            >
              {i < currentIdx ? "✓" : i + 1}
            </div>
            <span
              className={cn(
                "font-mono text-[9px] uppercase tracking-wider whitespace-nowrap",
                i === currentIdx ? "text-primary font-bold" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "mx-2 mb-4 h-0.5 w-10 transition-all",
                i < currentIdx ? "bg-ok" : "bg-line"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Stock Indicator Badge ───────────────────────────────────────────────────
function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock === 0)
    return (
      <span className="rounded-full bg-destructive px-2 py-0.5 font-mono text-[9px] font-bold text-destructive-foreground animate-blink">
        OUT OF STOCK
      </span>
    );
  if (stock <= threshold)
    return (
      <span className="rounded-full bg-caution px-2 py-0.5 font-mono text-[9px] font-bold text-background">
        LOW · {stock} left
      </span>
    );
  return (
    <span className="rounded-full border border-ok/40 bg-ok/10 px-2 py-0.5 font-mono text-[9px] font-bold text-ok">
      {stock} in stock
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
interface CustomerCheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export function CustomerCheckoutDrawer({
  isOpen,
  onClose,
  products,
}: CustomerCheckoutDrawerProps) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries();

  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || "");
  const [quantity, setQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState("Abebech Tadesse");
  const [customerPhone, setCustomerPhone] = useState("+251 911 458920");
  const [shippingAddress, setShippingAddress] = useState("Bole Medhanialem, Addis Ababa");
  const [paymentProvider, setPaymentProvider] = useState<"TELEBIRR" | "CBE" | "CARD">("TELEBIRR");

  const [activeSession, setActiveSession] = useState<CheckoutSession | null>(null);
  const [flowStep, setFlowStep] = useState<"FORM" | "USSD_SIM" | "CONFIRMED">("FORM");
  const [simMode, setSimMode] = useState<"CLEAN" | "RACE" | "ABANDON" | null>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const isOutOfStock = selectedProduct ? selectedProduct.currentStock < quantity : false;

  const itemTotalUSD = selectedProduct ? selectedProduct.unitPrice * quantity : 0;
  const deliveryFeeUSD = 3.5;
  const orderTotalUSD = itemTotalUSD + deliveryFeeUSD;

  const emergencyPoMutation = useMutation({
    mutationFn: () => api.po(selectedProduct.id, selectedProduct.suggestedReorderQuantity),
    onSuccess: () => {
      refresh();
      toast.success(`Emergency PO dispatched to ${selectedProduct.vendorName}! Factory batch in-transit.`);
    },
    onError: (e: Error) => toast.error(`PO dispatch failed: ${e.message}`),
  });

  const checkoutMutation = useMutation({
    mutationFn: (mode: "CLEAN" | "RACE" | "ABANDON") =>
      api.createCheckout({
        customerName,
        customerEmail: `${customerName.toLowerCase().replace(/\s+/g, ".")}@customer.et`,
        items: [{ sku: selectedProduct.sku, quantity }],
      }),
    onSuccess: async (data: any, mode) => {
      if (!data.success) {
        refresh();
        toast.error(data.message || "Checkout failed.");
        return;
      }
      const session: CheckoutSession = data.session;
      setActiveSession(session);
      setSimMode(mode);
      setFlowStep("USSD_SIM");
      refresh();

      if (mode === "CLEAN") {
        setTimeout(async () => {
          try {
            await api.handleCheckoutCallback(session.sessionId, "success");
            refresh();
            setFlowStep("CONFIRMED");
            toast.success("Payment confirmed and escrow locked!");
          } catch (err: any) {
            toast.error(err.message);
          }
        }, 800);
      } else if (mode === "RACE") {
        toast.warning("USSD race condition: buyer redirected while webhook in-transit…");
        setTimeout(async () => {
          try {
            await api.handleCheckoutCallback(session.sessionId, "success");
            refresh();
            setFlowStep("CONFIRMED");
            toast.success("Autonomous Healer caught the clearance lag!");
          } catch (err: any) {
            toast.error(err.message);
          }
        }, 3200);
      } else if (mode === "ABANDON") {
        toast.error("Customer closed checkout window. Item reserved on hold…");
        setTimeout(async () => {
          try {
            await api.simulateOrphanTimeout();
            refresh();
            toast.info("Orphan Reaper swept the abandoned hold and restored stock.");
            resetFlow();
            onClose();
          } catch (err: any) {
            toast.error(err.message);
          }
        }, 2800);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetFlow = () => {
    setActiveSession(null);
    setFlowStep("FORM");
    setSimMode(null);
  };

  if (!isOpen) return null;

  const PAYMENT_OPTIONS = [
    {
      id: "TELEBIRR" as const,
      icon: "📱",
      label: "Telebirr",
      sub: "USSD push",
      color: "oklch(0.7 0.19 45)",
    },
    {
      id: "CBE" as const,
      icon: "🏦",
      label: "CBE Birr",
      sub: "Mobile banking",
      color: "oklch(0.6 0.17 200)",
    },
    {
      id: "CARD" as const,
      icon: "💳",
      label: "Debit Card",
      sub: "Visa / Mastercard",
      color: "oklch(0.8 0.15 310)",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fadein">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => { resetFlow(); onClose(); }}
      />

      {/* Drawer Panel */}
      <div className="checkout-drawer relative flex h-full w-full max-w-[480px] flex-col overflow-hidden animate-slideup">

        {/* ── HEADER ── */}
        <header className="checkout-header flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-lg">
              🛒
            </div>
            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                Express Storefront Checkout
              </h2>
              <p className="text-[11px] text-muted-foreground font-mono">
                Instant Digital Commerce · Addis Ababa
              </p>
            </div>
          </div>
          <button
            onClick={() => { resetFlow(); onClose(); }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-line/60 hover:text-foreground transition-all text-sm"
          >
            ✕
          </button>
        </header>

        {/* ── STEP PROGRESS ── */}
        <div className="border-b border-line px-5 py-3 bg-secondary/20">
          <StepProgress step={flowStep} />
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* ══════════ FORM STEP ══════════ */}
          {flowStep === "FORM" && (
            <>

              {/* 1. PRODUCT SELECTOR */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-[10px] font-bold">1</span>
                  <span className="font-semibold text-sm text-foreground">Select Item</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedProductId(p.id); setQuantity(1); }}
                      className={cn(
                        "product-card-checkout",
                        p.id === selectedProductId && "selected",
                        p.currentStock === 0 && "depleted"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-mono text-[9px] text-muted-foreground truncate">{p.sku}</span>
                        <StockBadge stock={p.currentStock} threshold={p.reorderThreshold} />
                      </div>
                      <h4 className="text-xs font-semibold line-clamp-2 text-foreground">{p.name}</h4>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="font-mono text-xs font-bold text-primary">
                          {etb(p.unitPrice)}
                        </span>
                        <span className="text-[9px] text-muted-foreground truncate max-w-[80px]">{p.vendorName}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. QUANTITY */}
              {selectedProduct && (
                <div className="flex items-center justify-between rounded-xl border border-line bg-secondary/30 px-4 py-3">
                  <div>
                    <span className="text-sm font-semibold text-foreground">Quantity</span>
                    <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                      {selectedProduct.currentStock} units available
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card font-bold text-foreground hover:border-primary hover:text-primary transition-all disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-mono text-base font-bold text-foreground">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card font-bold text-foreground hover:border-primary hover:text-primary transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* ⚠️ OUT-OF-STOCK GUARD */}
              {isOutOfStock && selectedProduct && (
                <div className="rounded-xl border-2 border-destructive/50 bg-destructive/10 p-4 space-y-3 animate-slidein">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-destructive/15 text-xl">
                      🚫
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-destructive">Out-of-Stock Guard Active</h4>
                      <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
                        Only <strong>{selectedProduct.currentStock}</strong> unit(s) of{" "}
                        <strong>{selectedProduct.sku}</strong> remain. Checkout is blocked to prevent
                        inventory starvation and customer disputes.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => emergencyPoMutation.mutate()}
                    disabled={emergencyPoMutation.isPending || !!selectedProduct.lastPoDispatchedAt}
                    className="w-full rounded-xl bg-destructive py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-destructive-foreground hover:bg-destructive/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {emergencyPoMutation.isPending
                      ? "⏳ Dispatching Emergency PO…"
                      : selectedProduct.lastPoDispatchedAt
                      ? "🚚 Restock PO Already In-Transit"
                      : "⚡ Dispatch Emergency Supplier Restock PO"}
                  </button>
                </div>
              )}

              {/* 3. BUYER INFORMATION */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-[10px] font-bold">2</span>
                  <span className="font-semibold text-sm text-foreground">Delivery Information</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="checkout-input w-full rounded-xl px-3 py-2.5 text-sm"
                      placeholder="e.g. Abebech Tadesse"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Phone · USSD Target
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">🇪🇹</span>
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="checkout-input w-full rounded-xl pl-9 pr-3 py-2.5 text-sm"
                        placeholder="+251 9xx xxx xxx"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Delivery Address · Addis Ababa
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">📍</span>
                      <input
                        type="text"
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        className="checkout-input w-full rounded-xl pl-9 pr-3 py-2.5 text-sm"
                        placeholder="Kebele, Sub-city, Addis Ababa"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. PAYMENT METHOD */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-[10px] font-bold">3</span>
                  <span className="font-semibold text-sm text-foreground">Payment Method</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPaymentProvider(opt.id)}
                      className={cn("payment-pill", paymentProvider === opt.id && "selected")}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <span className="font-semibold text-xs">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. ORDER SUMMARY */}
              <div className="rounded-xl border border-line bg-secondary/20 overflow-hidden">
                <div className="bg-secondary/40 px-4 py-2.5 border-b border-line">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Order Summary
                  </span>
                </div>
                <div className="px-4 py-3 space-y-2 font-mono text-xs">
                  {selectedProduct && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{quantity}x {selectedProduct.sku}</span>
                      <span>{etb(itemTotalUSD)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Addis Express Delivery</span>
                    <span>{etb(deliveryFeeUSD)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-[10px]">
                    <span>Marketplace Platform Fee (12%)</span>
                    <span className="text-ok">Protected by Escrow</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-line text-base font-bold text-foreground">
                    <span>Total Due</span>
                    <span className="text-primary">{etb(orderTotalUSD)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-1">
                    ≈ USD ${orderTotalUSD.toFixed(2)} · Rate: 1 USD = 127.50 ETB
                  </p>
                </div>
              </div>

              {/* 6. SIMULATE SCENARIOS */}
              <div className="space-y-2.5 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary border border-line font-mono text-[10px]">⚡</span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Simulate Real-World E-Commerce Scenarios
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => checkoutMutation.mutate("CLEAN")}
                    disabled={isOutOfStock || checkoutMutation.isPending}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-ok/40 bg-ok/5 py-3 px-2 transition-all text-center",
                      "hover:border-ok hover:bg-ok/10 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                    title="Instant payment confirmation — webhook and callback in sync"
                  >
                    <span className="text-lg">🟢</span>
                    <span className="font-mono text-[11px] font-bold text-ok uppercase tracking-wide">Clean</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Instant confirm</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => checkoutMutation.mutate("RACE")}
                    disabled={isOutOfStock || checkoutMutation.isPending}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-primary/40 bg-primary/5 py-3 px-2 transition-all text-center",
                      "hover:border-primary hover:bg-primary/10 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                    title="Buyer returns to page before payment gateway webhook arrives — AI healer resolves"
                  >
                    <span className="text-lg">🟡</span>
                    <span className="font-mono text-[11px] font-bold text-primary uppercase tracking-wide">Race Lag</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">USSD webhook lag</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => checkoutMutation.mutate("ABANDON")}
                    disabled={isOutOfStock || checkoutMutation.isPending}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-caution/40 bg-caution/5 py-3 px-2 transition-all text-center",
                      "hover:border-caution hover:bg-caution/10 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                    title="Customer closes browser — Orphan Reaper returns reserved stock"
                  >
                    <span className="text-lg">🔴</span>
                    <span className="font-mono text-[11px] font-bold text-caution uppercase tracking-wide">Abandon</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Orphan reaper</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ══════════ USSD SIMULATION STEP ══════════ */}
          {flowStep === "USSD_SIM" && activeSession && (
            <div className="flex flex-col items-center gap-5 text-center py-6 animate-slideup">
              {/* Phone mockup */}
              <div className="relative">
                <div className="mx-auto w-32 rounded-2xl border-4 border-foreground/20 bg-secondary/40 p-3 shadow-2xl">
                  <div className="rounded-lg bg-primary/20 py-4 text-3xl animate-pulse">📱</div>
                  <div className="mt-2 space-y-1">
                    <div className="rounded bg-secondary py-1 font-mono text-[9px] text-muted-foreground">Mobile Gateway USSD</div>
                    <div className="rounded bg-primary/30 py-1 font-mono text-[9px] font-bold text-primary animate-blink">
                      *127*2*{String(Math.floor(Math.random() * 9999 + 1000)).padStart(4, "0")}#
                    </div>
                    <div className="rounded border border-line py-1.5 font-mono text-[8px] text-muted-foreground">
                      Enter PIN ••••
                    </div>
                  </div>
                </div>
                <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ok text-[10px] animate-pulse">
                  ✓
                </div>
              </div>

              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  {simMode === "ABANDON" ? "Checkout Abandoned" : "USSD Push Sent"}
                </h3>
                <p className="mt-1 font-mono text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  {simMode === "ABANDON"
                    ? "Customer closed their browser. Orphan Hold Reaper is sweeping the reserved inventory…"
                    : `USSD prompt dispatched to ${customerPhone}. Waiting for PIN authorization…`}
                </p>
              </div>

              {/* Live status panel */}
              <div className="w-full rounded-xl border border-primary/30 bg-primary/5 p-4 text-left space-y-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-blink" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
                    Live Gateway Status
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 font-mono text-[10px]">
                  <span className="text-muted-foreground">Session ID</span>
                  <span className="text-right text-foreground font-bold truncate">{activeSession.sessionId}</span>
                  <span className="text-muted-foreground">Gateway State</span>
                  <span className="text-right font-bold text-primary animate-pulse">CALLBACK_PENDING</span>
                  <span className="text-muted-foreground">Amount</span>
                  <span className="text-right font-bold text-foreground">{etb(orderTotalUSD)}</span>
                  <span className="text-muted-foreground">Autonomous Agent</span>
                  <span className="text-right text-ok">
                    {simMode === "ABANDON" ? "Orphan Reaper active" : "Payment Healer polling…"}
                  </span>
                </div>
              </div>

              {simMode === "RACE" && (
                <div className="w-full rounded-xl border border-caution/30 bg-caution/5 px-4 py-3 text-left">
                  <p className="font-mono text-[11px] text-caution font-semibold">
                    ⚠ Race Condition Detected
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Browser returned from payment redirect before the payment gateway webhook arrived.
                    Autonomous Payment Healer is polling the gateway and will resolve within 3s.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ══════════ CONFIRMED STEP ══════════ */}
          {flowStep === "CONFIRMED" && activeSession && (
            <div className="flex flex-col items-center gap-5 text-center py-4 animate-slideup">
              {/* Success icon */}
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ok/15 border-2 border-ok/40">
                <span className="text-4xl">✅</span>
                <div className="absolute inset-0 rounded-full animate-pulse-ring opacity-60" />
              </div>

              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ok">
                  Payment Confirmed · Escrow Locked
                </span>
                <h3 className="font-display text-xl font-bold text-foreground mt-1">
                  Order Placed!
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Your order has been confirmed and payment is secured in marketplace escrow.
                </p>
              </div>

              {/* Receipt card */}
              <div className="w-full rounded-xl border border-line bg-card overflow-hidden shadow-lg">
                {/* Receipt header stripe */}
                <div className="bg-primary/10 border-b border-line px-4 py-2.5 flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
                    Express Storefront · Digital Receipt
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date().toLocaleDateString("en-ET", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                <div className="px-4 py-4 space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-bold text-foreground">{customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="text-foreground">{customerPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Item</span>
                    <span className="text-foreground text-right max-w-[180px] line-clamp-1">{quantity}x {selectedProduct?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery To</span>
                    <span className="text-foreground text-right max-w-[180px] line-clamp-1">{shippingAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span className="text-foreground">{PAYMENT_OPTIONS.find(o => o.id === paymentProvider)?.label}</span>
                  </div>
                  <div className="border-t border-line pt-2 flex justify-between text-sm font-bold">
                    <span className="text-foreground">Total Paid</span>
                    <span className="text-primary text-base">{etb(orderTotalUSD)}</span>
                  </div>
                  <div className="border-t border-line pt-2 flex justify-between">
                    <span className="text-muted-foreground">Session Ref</span>
                    <span className="text-foreground text-[10px]">{activeSession.sessionId}</span>
                  </div>
                </div>
                {/* Station 05 badge */}
                <div className="bg-ok/10 border-t border-ok/30 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-ok" />
                    <span className="font-mono text-[10px] font-bold text-ok uppercase tracking-wider">
                      Station 05 · Escrow Active
                    </span>
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground">LOCKED_IN_ESCROW</span>
                </div>
              </div>

              <div className="flex w-full gap-2">
                <button
                  type="button"
                  onClick={resetFlow}
                  className="flex-1 rounded-xl bg-primary py-3 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-all"
                >
                  Place Another Order
                </button>
                <button
                  type="button"
                  onClick={() => { resetFlow(); onClose(); }}
                  className="flex-1 rounded-xl border-2 border-line bg-secondary py-3 font-mono text-xs font-bold uppercase tracking-wider text-foreground hover:border-primary hover:text-primary transition-all"
                >
                  View Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
