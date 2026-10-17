import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type Product, type CheckoutSession } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatETB } from "@/lib/currency";

interface CartItem {
  productId: string;
  quantity: number;
}

interface CustomerCheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

type CheckoutStep = "CART" | "PAYMENT_METHOD" | "USSD_SIM" | "CONFIRMED";
type SimMode = "CLEAN" | "RACE" | "ABANDON";

const ADDIS_SUBCITIES = [
  "Bole (Medhanialem / Atlas)",
  "Kirkos (Kazanchis / Meskel Sq)",
  "Yeka (CMC / Megenagna)",
  "Arada (Piassa / 4 Kilo)",
  "Nifas Silk (Sarbet / Gotera)",
];

const DELIVERY_OPTIONS = [
  {
    id: "STANDARD",
    name: "Standard Addis Delivery",
    eta: "1 – 2 Business Days",
    feeUSD: 2.0,
    icon: "🚚",
  },
  {
    id: "EXPRESS_MOTO",
    name: "⚡ Express Moto Courier",
    eta: "Under 2 Hours (Rush)",
    feeUSD: 4.5,
    icon: "🛵",
  },
  {
    id: "PICKUP",
    name: "Hub Pickup (Bole Station)",
    eta: "Ready in 1 Hour",
    feeUSD: 0.0,
    icon: "🏬",
  },
];

export function CustomerCheckoutDrawer({
  isOpen,
  onClose,
  products,
}: CustomerCheckoutDrawerProps) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries();

  // Multi-item cart: default to first in-stock product
  const defaultProduct = products.find((p) => p.currentStock > 0) || products[0];
  const [cart, setCart] = useState<CartItem[]>([
    { productId: defaultProduct?.id || "", quantity: 1 },
  ]);

  // Delivery & Recipient state
  const [customerName, setCustomerName] = useState("Abebech Tadesse");
  const [customerPhone, setCustomerPhone] = useState("+251 911 458920");
  const [selectedSubcity, setSelectedSubcity] = useState(ADDIS_SUBCITIES[0]);
  const [streetAddress, setStreetAddress] = useState("Near Medhanialem Cathedral, Bole");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("EXPRESS_MOTO");

  // Promo code
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);

  // Payment provider
  const [paymentProvider, setPaymentProvider] = useState<"TELEBIRR" | "CBE" | "CARD">("TELEBIRR");
  const [simMode, setSimMode] = useState<SimMode>("CLEAN");

  // Flow & interactive smartphone state
  const [flowStep, setFlowStep] = useState<CheckoutStep>("CART");
  const [activeSession, setActiveSession] = useState<CheckoutSession | null>(null);
  const [ussdPin, setUssdPin] = useState("");
  const [countdownSeconds, setCountdownSeconds] = useState(30);

  // Calculate cart items with live product lookup
  const cartDetails = cart.map((item) => {
    const prod = products.find((p) => p.id === item.productId);
    return {
      ...item,
      product: prod,
      isOutOfStock: prod ? prod.currentStock < item.quantity : false,
      lineTotalUSD: prod ? prod.unitPrice * item.quantity : 0,
    };
  });

  const hasAnyOutOfStock = cartDetails.some((i) => i.isOutOfStock);

  // Financial calculations
  const subtotalUSD = cartDetails.reduce((sum, i) => sum + i.lineTotalUSD, 0);
  const selectedDelivery = DELIVERY_OPTIONS.find((d) => d.id === selectedDeliveryId) || DELIVERY_OPTIONS[0];
  const deliveryFeeUSD = selectedDelivery.feeUSD;
  const discountUSD = appliedPromo === "ADDIS2026" ? subtotalUSD * 0.1 : 0;
  const finalTotalUSD = Math.max(0, subtotalUSD + deliveryFeeUSD - discountUSD);

  // USSD Countdown timer
  useEffect(() => {
    if (flowStep !== "USSD_SIM") return;
    setCountdownSeconds(30);
    const interval = setInterval(() => {
      setCountdownSeconds((sec) => (sec > 0 ? sec - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [flowStep]);

  // Interactive Keypad Input Handler
  const handleKeypadPress = (val: string) => {
    if (val === "CLEAR") {
      setUssdPin("");
    } else if (val === "BACK") {
      setUssdPin((prev) => prev.slice(0, -1));
    } else if (ussdPin.length < 4) {
      setUssdPin((prev) => prev + val);
    }
  };

  // Emergency PO mutation for out-of-stock items
  const emergencyPoMutation = useMutation({
    mutationFn: (productId: string) => {
      const prod = products.find((p) => p.id === productId);
      return api.po(productId, prod?.suggestedReorderQuantity || 20);
    },
    onSuccess: (_, productId) => {
      refresh();
      const prod = products.find((p) => p.id === productId);
      toast.success(
        `Emergency PO dispatched to ${prod?.vendorName || "supplier"}! In-transit batch will arrive shortly.`
      );
    },
    onError: (e: Error) => toast.error(`PO dispatch failed: ${e.message}`),
  });

  // Create Checkout Session Mutation
  const checkoutMutation = useMutation({
    mutationFn: () =>
      api.createCheckout({
        customerName,
        customerEmail: `${customerName.toLowerCase().replace(/\s+/g, ".")}@customer.et`,
        items: cartDetails
          .filter((i) => i.product)
          .map((i) => ({ sku: i.product!.sku, quantity: i.quantity })),
      }),
    onSuccess: (data: any) => {
      if (!data.success) {
        refresh();
        toast.error(data.message || "Checkout blocked: stock depleted.");
        return;
      }
      const session: CheckoutSession = data.session;
      setActiveSession(session);
      setFlowStep("USSD_SIM");
      setUssdPin("");
      refresh();
      toast.info(`USSD payment prompt dispatched to ${customerPhone}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Execute payment authorization based on simulation mode
  const executePaymentAuth = async (overrideMode?: SimMode) => {
    if (!activeSession) return;
    const mode = overrideMode || simMode;

    if (mode === "CLEAN") {
      toast.info("Authorizing PIN and verifying gateway clearance...");
      try {
        await api.handleCheckoutCallback(activeSession.sessionId, "success");
        refresh();
        setFlowStep("CONFIRMED");
        toast.success("Payment verified & funds locked in Escrow!");
      } catch (err: any) {
        toast.error(err.message);
      }
    } else if (mode === "RACE") {
      toast.warning("Simulating USSD race condition: browser returned before gateway webhook clearance!");
      setTimeout(async () => {
        try {
          await api.handleCheckoutCallback(activeSession.sessionId, "success");
          refresh();
          setFlowStep("CONFIRMED");
          toast.success("Autonomous Payment Healer reconciled the transaction!");
        } catch (err: any) {
          toast.error(err.message);
        }
      }, 3000);
    } else if (mode === "ABANDON") {
      toast.error("Customer abandoned the payment prompt. Stock held on reservation...");
      setTimeout(async () => {
        try {
          await api.simulateOrphanTimeout();
          refresh();
          toast.info("Orphan Reaper swept abandoned hold and returned stock to catalog.");
          onClose();
          resetFlow();
        } catch (err: any) {
          toast.error(err.message);
        }
      }, 2500);
    }
  };

  const resetFlow = () => {
    setFlowStep("CART");
    setActiveSession(null);
    setUssdPin("");
  };

  const handleApplyPromo = () => {
    if (promoInput.trim().toUpperCase() === "ADDIS2026") {
      setAppliedPromo("ADDIS2026");
      toast.success("Promo ADDIS2026 applied! 10% discount subtracted.");
    } else {
      toast.error("Invalid promo code. Try 'ADDIS2026'");
    }
  };

  // Cart helper functions
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQ = item.quantity + delta;
            return newQ > 0 ? { ...item, quantity: newQ } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const addProductToCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
    toast.success("Item added to cart!");
  };

  const removeCartItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fadein">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          resetFlow();
          onClose();
        }}
      />

      {/* Drawer Container */}
      <div className="checkout-drawer relative flex h-full w-full max-w-[520px] flex-col overflow-hidden animate-slideup">
        {/* ── TOP HEADER ── */}
        <header className="checkout-header flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary text-xl">
              🛍️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                  Express Checkout
                </h2>
                <span className="rounded bg-ok/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-ok">
                  LIVE ETB
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                Addis Ababa Marketplace · Mobile Payment Gateway
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetFlow();
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-line hover:text-foreground transition-all text-sm"
          >
            ✕
          </button>
        </header>

        {/* ── BREADCRUMB PROGRESS BAR ── */}
        <div className="border-b border-line bg-secondary/30 px-6 py-3">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
            {[
              { id: "CART", label: "1. Cart & Shipping", num: "1" },
              { id: "PAYMENT_METHOD", label: "2. Payment Provider", num: "2" },
              { id: "USSD_SIM", label: "3. Mobile USSD PIN", num: "3" },
              { id: "CONFIRMED", label: "4. Confirmation", num: "4" },
            ].map((step, idx) => {
              const isActive = flowStep === step.id;
              const isPast =
                (flowStep === "PAYMENT_METHOD" && idx < 1) ||
                (flowStep === "USSD_SIM" && idx < 2) ||
                (flowStep === "CONFIRMED" && idx < 3);

              return (
                <div key={step.id} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground animate-pulse-ring"
                        : isPast
                        ? "bg-ok text-card"
                        : "bg-secondary text-muted-foreground border border-line"
                    )}
                  >
                    {isPast ? "✓" : step.num}
                  </span>
                  <span
                    className={cn(
                      "hidden sm:inline",
                      isActive
                        ? "text-primary font-bold"
                        : isPast
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.label.split(". ")[1]}
                  </span>
                  {idx < 3 && <span className="text-muted-foreground/40 mx-1">›</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── DRAWER SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ═════════════════════════════════════════════════════════ */}
          {/* STEP 1: CART, DESTINATION & SHIPPING                    */}
          {/* ═════════════════════════════════════════════════════════ */}
          {flowStep === "CART" && (
            <>
              {/* 1. SHOPPING BAG ITEMS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-[10px] font-bold">
                      1
                    </span>
                    <h3 className="font-semibold text-sm text-foreground">
                      Shopping Bag ({cart.reduce((a, b) => a + b.quantity, 0)} Items)
                    </h3>
                  </div>
                  <span className="font-mono text-xs font-bold text-primary">
                    {formatETB(subtotalUSD)}
                  </span>
                </div>

                {/* Items in cart */}
                <div className="space-y-2.5">
                  {cartDetails.map((item) => {
                    const p = item.product;
                    if (!p) return null;

                    return (
                      <div
                        key={item.productId}
                        className={cn(
                          "rounded-xl border p-3.5 transition-all bg-secondary/30",
                          item.isOutOfStock
                            ? "border-destructive/60 bg-destructive/5"
                            : "border-line hover:border-line/80"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-muted-foreground">{p.sku}</span>
                              {p.currentStock === 0 ? (
                                <span className="rounded-full bg-destructive px-2 py-0.5 font-mono text-[9px] font-bold text-destructive-foreground animate-blink">
                                  0 IN STOCK
                                </span>
                              ) : p.currentStock <= p.reorderThreshold ? (
                                <span className="rounded-full bg-caution px-2 py-0.5 font-mono text-[9px] font-bold text-background">
                                  {p.currentStock} left
                                </span>
                              ) : (
                                <span className="rounded-full bg-ok/20 px-2 py-0.5 font-mono text-[9px] font-bold text-ok">
                                  In Stock ({p.currentStock})
                                </span>
                              )}
                            </div>
                            <h4 className="font-semibold text-xs text-foreground mt-1 truncate">
                              {p.name}
                            </h4>
                            <p className="font-mono text-[11px] font-bold text-primary mt-0.5">
                              {formatETB(p.unitPrice)} each
                            </p>
                          </div>

                          {/* Line total & remove */}
                          <div className="text-right">
                            <span className="font-mono text-xs font-bold text-foreground block">
                              {formatETB(item.lineTotalUSD)}
                            </span>
                            {cart.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCartItem(p.id)}
                                className="mt-1 font-mono text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Quantity controls */}
                        <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
                          <span className="font-mono text-[11px] text-muted-foreground">Quantity</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuantity(p.id, -1)}
                              disabled={item.quantity <= 1}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-card font-mono text-xs font-bold hover:bg-secondary disabled:opacity-40"
                            >
                              −
                            </button>
                            <span className="w-8 text-center font-mono text-xs font-bold text-foreground">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(p.id, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-card font-mono text-xs font-bold hover:bg-secondary"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Out of stock alert banner per item */}
                        {item.isOutOfStock && (
                          <div className="mt-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 flex items-center justify-between gap-2">
                            <div className="text-[11px] text-destructive leading-tight">
                              <strong>Stockout Warning:</strong> Only {p.currentStock} units available.
                            </div>
                            <button
                              type="button"
                              onClick={() => emergencyPoMutation.mutate(p.id)}
                              disabled={emergencyPoMutation.isPending || !!p.lastPoDispatchedAt}
                              className="rounded bg-destructive px-2 py-1 font-mono text-[10px] font-bold text-destructive-foreground hover:bg-destructive/90 transition-all shrink-0"
                            >
                              {emergencyPoMutation.isPending
                                ? "Dispatching…"
                                : p.lastPoDispatchedAt
                                ? "PO In-Transit 🚚"
                                : "⚡ Send PO"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Quick Add other catalog items */}
                {products.length > cart.length && (
                  <div className="rounded-xl border border-dashed border-line p-3 bg-secondary/10">
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                      + Add other catalog item to cart:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {products
                        .filter((p) => !cart.some((c) => c.productId === p.id))
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addProductToCart(p.id)}
                            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1 text-xs hover:border-primary transition-all"
                          >
                            <span className="font-medium text-foreground truncate max-w-[120px]">
                              {p.name.split(" ")[0]}
                            </span>
                            <span className="font-mono text-primary font-bold">
                              {formatETB(p.unitPrice, { compact: true })}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. RECIPIENT & DESTINATION */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-[10px] font-bold">
                    2
                  </span>
                  <h3 className="font-semibold text-sm text-foreground">Delivery Destination</h3>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recipient Full Name
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="checkout-input w-full rounded-xl px-3 py-2 text-xs"
                      placeholder="e.g. Abebech Tadesse"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Mobile Phone (USSD Target)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs">🇪🇹</span>
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="checkout-input w-full rounded-xl pl-8 pr-3 py-2 text-xs font-mono"
                        placeholder="+251 9xx xxx xxx"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Subcity / District (Addis Ababa)
                    </label>
                    <select
                      value={selectedSubcity}
                      onChange={(e) => setSelectedSubcity(e.target.value)}
                      className="checkout-input w-full rounded-xl px-3 py-2 text-xs bg-card"
                    >
                      {ADDIS_SUBCITIES.map((sub) => (
                        <option key={sub} value={sub}>
                          📍 {sub}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Street / Specific Landmark
                    </label>
                    <input
                      type="text"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      className="checkout-input w-full rounded-xl px-3 py-2 text-xs"
                      placeholder="House / Building No, Landmark"
                    />
                  </div>
                </div>
              </div>

              {/* 3. DELIVERY SPEED TIER */}
              <div className="space-y-2.5">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Courier Delivery Speed:
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {DELIVERY_OPTIONS.map((tier) => {
                    const isSelected = selectedDeliveryId === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSelectedDeliveryId(tier.id)}
                        className={cn(
                          "rounded-xl border p-2.5 text-left transition-all",
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-line bg-secondary/20 hover:border-line/80"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base">{tier.icon}</span>
                          <span className="font-mono text-[10px] font-bold text-primary">
                            {tier.feeUSD === 0 ? "FREE" : formatETB(tier.feeUSD)}
                          </span>
                        </div>
                        <p className="font-semibold text-xs mt-1 text-foreground">{tier.name}</p>
                        <p className="font-mono text-[9px] text-muted-foreground mt-0.5">{tier.eta}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. PROMO CODE BOX */}
              <div className="rounded-xl border border-line bg-secondary/20 p-3 flex items-center gap-2">
                <span className="text-base">🎟️</span>
                <input
                  type="text"
                  placeholder="Promo Code (try ADDIS2026)"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  className="checkout-input flex-1 rounded-lg px-2.5 py-1.5 font-mono text-xs uppercase"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="rounded-lg bg-secondary px-3 py-1.5 font-mono text-xs font-bold text-foreground hover:bg-line transition-colors"
                >
                  Apply
                </button>
              </div>

              {/* 5. ORDER SUMMARY BILL */}
              <div className="rounded-xl border border-line bg-secondary/30 p-4 font-mono text-xs space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Cart Items Subtotal:</span>
                  <span className="text-foreground">{formatETB(subtotalUSD)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Courier Delivery ({selectedDelivery.name}):</span>
                  <span className="text-foreground">
                    {deliveryFeeUSD === 0 ? "FREE" : formatETB(deliveryFeeUSD)}
                  </span>
                </div>
                {discountUSD > 0 && (
                  <div className="flex justify-between text-ok">
                    <span>Promo Discount (ADDIS2026 -10%):</span>
                    <span>−{formatETB(discountUSD)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] text-ok border-t border-dashed border-line pt-2">
                  <span>Escrow Protection (Station 05):</span>
                  <span>100% Guaranteed</span>
                </div>
                <div className="flex justify-between items-baseline border-t border-line pt-2 text-sm font-bold text-foreground">
                  <span>Total Due:</span>
                  <span className="text-primary text-base font-display">{formatETB(finalTotalUSD)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground pt-0.5">
                  ≈ USD ${finalTotalUSD.toFixed(2)} (Fixed settlement: 1 USD = 127.50 ETB)
                </p>
              </div>

              {/* ACTION: CONTINUE TO PAYMENT */}
              <button
                type="button"
                onClick={() => setFlowStep("PAYMENT_METHOD")}
                disabled={hasAnyOutOfStock || cart.length === 0}
                className={cn(
                  "w-full rounded-xl py-3 font-mono text-xs font-bold uppercase tracking-wider transition-all",
                  hasAnyOutOfStock
                    ? "bg-destructive/20 text-destructive border border-destructive/40 cursor-not-allowed"
                    : "btn-signal"
                )}
              >
                {hasAnyOutOfStock
                  ? "⚠️ Out-of-Stock Items in Cart — Resolve to Proceed"
                  : "Proceed to Payment Method →"}
              </button>
            </>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* STEP 2: PAYMENT METHOD & SIMULATION SCENARIO SELECTOR    */}
          {/* ═════════════════════════════════════════════════════════ */}
          {flowStep === "PAYMENT_METHOD" && (
            <div className="space-y-6 animate-slidein">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-[10px] font-bold">
                    3
                  </span>
                  <h3 className="font-semibold text-sm text-foreground">Choose Payment Gateway</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setFlowStep("CART")}
                  className="font-mono text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Back to Bag
                </button>
              </div>

              {/* Payment Methods */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: "TELEBIRR" as const, name: "Telebirr", sub: "USSD Push", icon: "📱" },
                  { id: "CBE" as const, name: "CBE Birr", sub: "Mobile Bank", icon: "🏦" },
                  { id: "CARD" as const, name: "Debit Card", sub: "Visa / MC", icon: "💳" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentProvider(opt.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all",
                      paymentProvider === opt.id
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-md"
                        : "border-line bg-secondary/30 text-muted-foreground hover:border-line/80"
                    )}
                  >
                    <span className="text-2xl mb-1">{opt.icon}</span>
                    <span className="text-xs font-semibold">{opt.name}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">{opt.sub}</span>
                  </button>
                ))}
              </div>

              {/* Charge Summary Box */}
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 font-mono text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Charge Destination:</span>
                  <strong className="text-foreground">{customerPhone}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Authorized Amount:</span>
                  <strong className="text-primary text-sm font-bold">{formatETB(finalTotalUSD)}</strong>
                </div>
              </div>

              {/* Simulation Mode Choice */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Select Test Scenario for Interviewer Demo:
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      id: "CLEAN" as const,
                      badge: "🟢 Clean In-Sync",
                      title: "Standard Clean Checkout",
                      desc: "Instant payment authorization where webhook and customer return arrive seamlessly.",
                    },
                    {
                      id: "RACE" as const,
                      badge: "🟡 Race Lag Healer",
                      title: "Simulate Webhook vs Callback Lag",
                      desc: "Customer redirects before gateway webhook arrives (CALLBACK_PENDING). Autonomous background healer resolves within 3s.",
                    },
                    {
                      id: "ABANDON" as const,
                      badge: "🔴 Abandon Hold",
                      title: "Simulate Abandoned Window",
                      desc: "Customer closes tab after reservation. Tests the Orphan Hold Reaper sweeping held stock back to inventory.",
                    },
                  ].map((s) => (
                    <label
                      key={s.id}
                      onClick={() => setSimMode(s.id)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all",
                        simMode === s.id
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-line bg-secondary/20 hover:border-line/60"
                      )}
                    >
                      <input
                        type="radio"
                        name="simMode"
                        checked={simMode === s.id}
                        onChange={() => setSimMode(s.id)}
                        className="mt-1 accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">{s.title}</span>
                          <span className="font-mono text-[9px] font-bold">{s.badge}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          {s.desc}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* ACTION: DISPATCH USSD PROMPT */}
              <button
                type="button"
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="w-full btn-signal py-3 text-xs"
              >
                {checkoutMutation.isPending
                  ? "Dispatching USSD Prompt…"
                  : `Launch ${paymentProvider} USSD Prompt (${formatETB(finalTotalUSD)}) →`}
              </button>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* STEP 3: INTERACTIVE SMARTPHONE USSD SIMULATOR            */}
          {/* ═════════════════════════════════════════════════════════ */}
          {flowStep === "USSD_SIM" && activeSession && (
            <div className="space-y-5 animate-slidein">
              <div className="text-center space-y-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
                  Interactive Mobile Phone Simulator
                </span>
                <h3 className="font-display text-base font-bold text-foreground">
                  Authorize Payment on Handset
                </h3>
              </div>

              {/* SMARTPHONE FRAME MOCKUP */}
              <div className="mx-auto w-full max-w-[320px] rounded-[32px] border-4 border-foreground/30 bg-card p-4 shadow-2xl space-y-4">
                {/* Phone Speaker & Notch */}
                <div className="flex justify-between items-center px-2">
                  <span className="font-mono text-[9px] text-muted-foreground">09:41</span>
                  <div className="h-3 w-16 rounded-full bg-secondary" />
                  <span className="font-mono text-[9px] text-muted-foreground">4G 🔋</span>
                </div>

                {/* USSD Prompt Screen */}
                <div className="rounded-2xl border border-primary/40 bg-secondary/50 p-4 text-center space-y-3">
                  <div className="flex items-center justify-center gap-1.5 text-primary font-mono text-[10px] font-bold">
                    <span className="animate-pulse">●</span>
                    <span>{paymentProvider} USSD PROMPT</span>
                  </div>

                  <div className="font-mono text-xs leading-relaxed">
                    <p className="text-muted-foreground">Payment Request for</p>
                    <p className="font-bold text-base text-foreground mt-0.5">
                      {formatETB(finalTotalUSD)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">Ref: {activeSession.sessionId}</p>
                  </div>

                  {/* 4 PIN Circles */}
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] text-muted-foreground">Enter 4-Digit Security PIN:</span>
                    <div className="flex justify-center gap-2 pt-1">
                      {[0, 1, 2, 3].map((idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-sm font-bold transition-all",
                            ussdPin.length > idx
                              ? "border-primary bg-primary text-primary-foreground scale-105"
                              : "border-line bg-card text-muted-foreground"
                          )}
                        >
                          {ussdPin.length > idx ? "•" : ""}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Countdown Timer */}
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Expires in: <strong className="text-primary">{countdownSeconds}s</strong>
                  </p>
                </div>

                {/* Interactive Numeric Keypad */}
                <div className="grid grid-cols-3 gap-2 font-mono">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLEAR", "0", "BACK"].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleKeypadPress(k)}
                      className={cn(
                        "h-10 rounded-xl border border-line bg-secondary/40 text-xs font-bold transition-all hover:bg-secondary active:scale-95",
                        k === "CLEAR" && "text-destructive text-[10px]",
                        k === "BACK" && "text-muted-foreground text-[10px]"
                      )}
                    >
                      {k === "BACK" ? "⌫" : k}
                    </button>
                  ))}
                </div>

                {/* 1-Click Quick Fill Button */}
                <button
                  type="button"
                  onClick={() => setUssdPin("1234")}
                  className="w-full rounded-lg border border-dashed border-primary/50 py-1.5 font-mono text-[10px] text-primary hover:bg-primary/10 transition-colors"
                >
                  ⚡ Autofill Test PIN (1234)
                </button>
              </div>

              {/* ACTION BUTTONS BASED ON SCENARIOS */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => executePaymentAuth()}
                  disabled={ussdPin.length < 4}
                  className={cn(
                    "w-full rounded-xl py-3 font-mono text-xs font-bold uppercase tracking-wider transition-all",
                    ussdPin.length >= 4 ? "btn-signal" : "bg-secondary text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {simMode === "RACE"
                    ? "🟡 Authorize with Callback Lag (Test Healer)"
                    : simMode === "ABANDON"
                    ? "🔴 Abandon & Close Tab (Test Reaper)"
                    : "🟢 Authorize PIN & Confirm Order"}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => executePaymentAuth("RACE")}
                    className="flex-1 rounded-xl border border-primary/40 bg-primary/10 py-2 font-mono text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors"
                  >
                    Force Race Condition
                  </button>
                  <button
                    type="button"
                    onClick={() => executePaymentAuth("ABANDON")}
                    className="flex-1 rounded-xl border border-caution/40 bg-caution/10 py-2 font-mono text-[10px] font-bold text-caution hover:bg-caution/20 transition-colors"
                  >
                    Simulate Abandon
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* STEP 4: DIGITAL RECEIPT & MULTI-AGENT TELEMETRY          */}
          {/* ═════════════════════════════════════════════════════════ */}
          {flowStep === "CONFIRMED" && activeSession && (
            <div className="space-y-6 text-center animate-slidein">
              {/* Confirmed Header */}
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ok/20 text-3xl text-ok border-2 border-ok/40">
                ✓
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ok">
                  Payment Reconciled & Escrow Locked
                </span>
                <h3 className="font-display text-xl font-bold text-foreground mt-1">
                  Order Successfully Placed!
                </h3>
                <p className="font-mono text-xs text-muted-foreground mt-0.5">
                  Order #{activeSession.confirmedOrderId || "ORD-2026-LIVE"}
                </p>
              </div>

              {/* 4-STAGE AUTONOMOUS FULFILLMENT PIPELINE TRACKER */}
              <div className="rounded-xl border border-line bg-secondary/30 p-4 text-left space-y-3 font-mono text-xs">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Autonomous Multi-Agent Lifecycle:
                </span>
                <div className="grid grid-cols-4 gap-1 text-center">
                  {[
                    { step: "1. Verified", state: "DONE" },
                    { step: "2. Escrow", state: "ACTIVE" },
                    { step: "3. Courier", state: "WAIT" },
                    { step: "4. Delivered", state: "WAIT" },
                  ].map((s) => (
                    <div key={s.step} className="rounded-lg border border-line bg-card p-2">
                      <div
                        className={cn(
                          "h-1.5 w-full rounded-full mb-1.5",
                          s.state === "DONE"
                            ? "bg-ok"
                            : s.state === "ACTIVE"
                            ? "bg-primary animate-pulse"
                            : "bg-secondary"
                        )}
                      />
                      <span className="text-[10px] font-bold text-foreground block">{s.step}</span>
                      <span className="text-[8px] text-muted-foreground uppercase">{s.state}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* DIGITAL INVOICE RECEIPT CARD */}
              <div className="rounded-xl border border-line bg-card text-left font-mono text-xs overflow-hidden shadow-lg">
                <div className="bg-secondary/40 px-4 py-2.5 border-b border-line flex justify-between items-center">
                  <span className="font-bold text-foreground text-xs">DIGITAL INVOICE RECEIPT</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date().toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recipient:</span>
                    <strong className="text-foreground">{customerName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone Target:</span>
                    <span className="text-foreground">{customerPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery District:</span>
                    <span className="text-foreground">{selectedSubcity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Courier Service:</span>
                    <span className="text-foreground">{selectedDelivery.name}</span>
                  </div>
                  <div className="border-t border-dashed border-line my-2" />
                  <div className="space-y-1">
                    {cartDetails.map((it) => (
                      <div key={it.productId} className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground truncate max-w-[240px]">
                          {it.quantity}x {it.product?.name}
                        </span>
                        <span className="font-bold text-foreground">{formatETB(it.lineTotalUSD)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-line my-2" />
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-foreground">Total Paid:</span>
                    <span className="text-primary text-base font-display">{formatETB(finalTotalUSD)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-ok pt-1">
                    <span>Station 05 Settlement:</span>
                    <span>Funds Locked in Escrow</span>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Order #${activeSession.sessionId} | ${customerName} | ${formatETB(finalTotalUSD)}`
                    );
                    toast.success("Receipt summary copied to clipboard!");
                  }}
                  className="flex-1 rounded-xl border border-line bg-secondary py-3 font-mono text-xs font-bold uppercase text-foreground hover:bg-line transition-colors"
                >
                  📋 Copy Receipt
                </button>
                <button
                  type="button"
                  onClick={resetFlow}
                  className="flex-1 btn-signal py-3 text-xs"
                >
                  🛒 New Order
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
