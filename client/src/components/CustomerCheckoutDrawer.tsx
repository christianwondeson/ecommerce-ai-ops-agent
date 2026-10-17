import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type Product, type CheckoutSession } from "@/lib/api";
import { cn } from "@/lib/utils";

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

  const [selectedProductId, setSelectedProductId] = useState<string>(
    products[0]?.id || ""
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>("Abebech Tadesse");
  const [customerPhone, setCustomerPhone] = useState<string>("+251 911 458920");
  const [shippingAddress, setShippingAddress] = useState<string>("Bole Medhanialem, Addis Ababa");
  const [paymentProvider, setPaymentProvider] = useState<"ARIFPAY_TELEBIRR" | "ARIFPAY_CBE" | "CARD">("ARIFPAY_TELEBIRR");

  // Flow State
  const [activeSession, setActiveSession] = useState<CheckoutSession | null>(null);
  const [flowStep, setFlowStep] = useState<"FORM" | "USSD_SIM" | "CONFIRMED">("FORM");
  const [simMode, setSimMode] = useState<"CLEAN" | "RACE" | "ABANDON" | null>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const isOutOfStock = selectedProduct ? selectedProduct.currentStock < quantity : false;

  // Emergency PO Mutation
  const emergencyPoMutation = useMutation({
    mutationFn: () =>
      api.po(selectedProduct.id, selectedProduct.suggestedReorderQuantity),
    onSuccess: (data: any) => {
      refresh();
      toast.success(
        `Emergency PO dispatched to ${selectedProduct.vendorName}! Factory batch is now in-transit.`
      );
    },
    onError: (e: Error) => toast.error(`PO dispatch failed: ${e.message}`),
  });

  // Create Checkout Session Mutation
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
        toast.error(data.message || "Checkout failed: Stock unavailable.");
        return;
      }

      const session: CheckoutSession = data.session;
      setActiveSession(session);
      setSimMode(mode);
      refresh();

      if (mode === "CLEAN") {
        // Instant clean callback
        toast.info("Payment confirmed via Arifpay gateway. Reconciling order...");
        try {
          await api.handleCheckoutCallback(session.sessionId, "success");
          refresh();
          setFlowStep("CONFIRMED");
          toast.success("Order confirmed & escrow locked!");
        } catch (err: any) {
          toast.error(err.message);
        }
      } else if (mode === "RACE") {
        // Show USSD lag screen, then heal
        setFlowStep("USSD_SIM");
        toast.warning("Simulating USSD race condition: buyer redirected while webhook in-transit.");
        setTimeout(async () => {
          try {
            await api.handleCheckoutCallback(session.sessionId, "success");
            refresh();
            setFlowStep("CONFIRMED");
            toast.success("Autonomous Healer detected clearance & confirmed payment!");
          } catch (err: any) {
            toast.error(err.message);
          }
        }, 3200);
      } else if (mode === "ABANDON") {
        // Customer abandons window
        setFlowStep("USSD_SIM");
        toast.error("Customer closed checkout window. Item is reserved on hold...");
        setTimeout(async () => {
          try {
            await api.simulateOrphanTimeout();
            refresh();
            toast.info("Orphan Hold Reaper swept abandoned hold & restored item stock.");
            onClose();
            resetFlow();
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

  const itemTotal = selectedProduct ? selectedProduct.unitPrice * quantity : 0;
  const deliveryFee = 3.5;
  const orderTotal = itemTotal + deliveryFee;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fadein">
      <div className="flex h-full w-full max-w-xl flex-col border-l border-line bg-card shadow-2xl overflow-y-auto">
        {/* HEADER */}
        <header className="flex items-center justify-between border-b border-line px-6 py-4 bg-secondary/40">
          <div className="flex items-center gap-3">
            <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-xs font-bold text-primary">
              STOREFRONT SIMULATOR
            </span>
            <h2 className="font-display text-base font-bold uppercase tracking-wider text-foreground">
              Customer Express Checkout
            </h2>
          </div>
          <button
            onClick={() => {
              resetFlow();
              onClose();
            }}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </header>

        {/* CONTENT BODY */}
        <div className="flex-1 p-6 space-y-6">
          {flowStep === "FORM" && (
            <>
              {/* PRODUCT SELECTOR */}
              <div className="space-y-3">
                <label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  1. Select Item from Catalog
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {products.map((p) => {
                    const isSelected = p.id === selectedProductId;
                    const isDepleted = p.currentStock === 0;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setQuantity(1);
                        }}
                        className={cn(
                          "flex flex-col text-left p-3 rounded border transition-all",
                          isSelected
                            ? "border-primary bg-primary/10 ring-1 ring-primary"
                            : "border-line bg-secondary/30 hover:border-line/80",
                          isDepleted && "opacity-85 border-destructive/40 bg-destructive/5"
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-mono text-[10px] text-muted-foreground">{p.sku}</span>
                          <span
                            className={cn(
                              "font-mono text-[9px] px-1.5 py-0.2 rounded font-bold",
                              isDepleted
                                ? "bg-destructive text-destructive-foreground animate-blink"
                                : p.currentStock <= p.reorderThreshold
                                ? "bg-caution text-background"
                                : "bg-ok/20 text-ok"
                            )}
                          >
                            {isDepleted ? "OUT OF STOCK" : `${p.currentStock} in stock`}
                          </span>
                        </div>
                        <h4 className="mt-1 text-xs font-medium line-clamp-1">{p.name}</h4>
                        <div className="mt-2 flex items-baseline justify-between font-mono">
                          <span className="text-xs font-bold text-foreground">${p.unitPrice.toFixed(2)}</span>
                          <span className="text-[10px] text-muted-foreground">{p.vendorName}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* QUANTITY PICKER */}
              {selectedProduct && (
                <div className="flex items-center justify-between border-y border-line py-3">
                  <div>
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Quantity:
                    </span>
                    <span className="ml-2 font-mono text-xs text-foreground">
                      (Available: {selectedProduct.currentStock})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="h-7 w-7 rounded border border-line bg-secondary font-mono text-xs font-bold hover:bg-line/40 disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-mono text-sm font-bold text-foreground">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="h-7 w-7 rounded border border-line bg-secondary font-mono text-xs font-bold hover:bg-line/40"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* OUT OF STOCK GUARD ALERT */}
              {isOutOfStock && selectedProduct && (
                <div className="rounded border border-destructive/60 bg-destructive/15 p-4 space-y-3 animate-slidein">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-destructive">
                        Autonomous Out-of-Stock Guard Active
                      </h4>
                      <p className="mt-1 text-xs text-foreground/90 leading-relaxed">
                        SKU <strong>{selectedProduct.sku}</strong> only has {selectedProduct.currentStock} unit(s) remaining (requested: {quantity}).
                        Checkout is <strong>blocked</strong> to prevent inventory starvation & customer dispute.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => emergencyPoMutation.mutate()}
                      disabled={emergencyPoMutation.isPending || !!selectedProduct.lastPoDispatchedAt}
                      className="btn-signal text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-none"
                    >
                      {emergencyPoMutation.isPending
                        ? "Dispatching PO…"
                        : selectedProduct.lastPoDispatchedAt
                        ? "🚚 Restock PO Already In-Transit"
                        : "⚡ Dispatch Emergency Supplier Restock PO"}
                    </button>
                  </div>
                </div>
              )}

              {/* BUYER INFORMATION FORM */}
              <div className="space-y-3">
                <label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2. Buyer Shipping Information
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="block font-mono text-[10px] text-muted-foreground mb-1">Customer Full Name</span>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded border border-line bg-secondary/50 px-3 py-2 font-mono text-xs outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <span className="block font-mono text-[10px] text-muted-foreground mb-1">Phone (USSD Prompt Target)</span>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full rounded border border-line bg-secondary/50 px-3 py-2 font-mono text-xs outline-none focus:border-primary"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block font-mono text-[10px] text-muted-foreground mb-1">Delivery Destination</span>
                    <input
                      type="text"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="w-full rounded border border-line bg-secondary/50 px-3 py-2 font-mono text-xs outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* PAYMENT PROVIDER SELECTION */}
              <div className="space-y-3">
                <label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  3. Payment Gateway Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentProvider("ARIFPAY_TELEBIRR")}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded border text-center transition-all",
                      paymentProvider === "ARIFPAY_TELEBIRR"
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-line bg-secondary/30 text-muted-foreground hover:border-line/80"
                    )}
                  >
                    <span className="text-base mb-1">📱</span>
                    <span className="font-mono text-[11px]">Telebirr USSD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentProvider("ARIFPAY_CBE")}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded border text-center transition-all",
                      paymentProvider === "ARIFPAY_CBE"
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-line bg-secondary/30 text-muted-foreground hover:border-line/80"
                    )}
                  >
                    <span className="text-base mb-1">🏦</span>
                    <span className="font-mono text-[11px]">CBE Birr</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentProvider("CARD")}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded border text-center transition-all",
                      paymentProvider === "CARD"
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-line bg-secondary/30 text-muted-foreground hover:border-line/80"
                    )}
                  >
                    <span className="text-base mb-1">💳</span>
                    <span className="font-mono text-[11px]">Debit Card</span>
                  </button>
                </div>
              </div>

              {/* ORDER SUMMARY */}
              <div className="rounded border border-line bg-secondary/20 p-4 font-mono text-xs space-y-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({quantity}x {selectedProduct?.sku}):</span>
                  <span>${itemTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Courier Delivery (Addis Express):</span>
                  <span>${deliveryFee.toFixed(2)}</span>
                </div>
                <div className="h-px bg-line my-1" />
                <div className="flex justify-between text-foreground font-bold text-sm">
                  <span>Total Due:</span>
                  <span className="text-primary">${orderTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* 3 SIMULATION BUTTONS */}
              <div className="space-y-2 pt-2">
                <span className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Simulate Real E-Commerce Scenarios:
                </span>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => checkoutMutation.mutate("CLEAN")}
                    disabled={isOutOfStock || checkoutMutation.isPending}
                    className="btn-op py-2.5 border-ok/50 text-ok hover:bg-ok/10 disabled:opacity-40"
                    title="Simulate seamless checkout callback & immediate order confirmation"
                  >
                    🟢 Clean Checkout
                  </button>

                  <button
                    type="button"
                    onClick={() => checkoutMutation.mutate("RACE")}
                    disabled={isOutOfStock || checkoutMutation.isPending}
                    className="btn-op py-2.5 border-primary/50 text-primary hover:bg-primary/10 disabled:opacity-40"
                    title="Simulate USSD pending redirect with autonomous background payment healer"
                  >
                    🟡 USSD Race Lag
                  </button>

                  <button
                    type="button"
                    onClick={() => checkoutMutation.mutate("ABANDON")}
                    disabled={isOutOfStock || checkoutMutation.isPending}
                    className="btn-op py-2.5 border-caution/50 text-caution hover:bg-caution/10 disabled:opacity-40"
                    title="Simulate customer closing browser; Orphan Reaper restores stock"
                  >
                    🔴 Abandon Checkout
                  </button>
                </div>
              </div>
            </>
          )}

          {/* USSD PUSH SIMULATION SCREEN */}
          {flowStep === "USSD_SIM" && activeSession && (
            <div className="rounded border border-line bg-secondary/30 p-6 text-center space-y-4 animate-slidein">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-2xl animate-pulse">
                📱
              </div>
              <h3 className="font-display text-base font-bold uppercase tracking-wider text-foreground">
                Arifpay USSD Push In-Flight
              </h3>
              <p className="font-mono text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Prompt dispatched to <strong className="text-foreground">{customerPhone}</strong>. Waiting for PIN entry via {paymentProvider}...
              </p>

              <div className="rounded border border-primary/40 bg-primary/10 p-3 font-mono text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session ID:</span>
                  <span className="text-foreground font-bold">{activeSession.sessionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gateway State:</span>
                  <span className="text-primary font-bold animate-pulse">CALLBACK_PENDING</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Autonomous Action:</span>
                  <span className="text-ok">Payment Healer polling gateway...</span>
                </div>
              </div>

              <p className="font-mono text-[11px] text-muted-foreground">
                {simMode === "ABANDON"
                  ? "Simulating customer timeout... Orphan Reaper will restore locked inventory."
                  : "Resolving clearance lag between browser redirect and payment gateway..."}
              </p>
            </div>
          )}

          {/* ORDER CONFIRMED SCREEN */}
          {flowStep === "CONFIRMED" && activeSession && (
            <div className="rounded border border-ok/40 bg-ok/10 p-6 text-center space-y-5 animate-slidein">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok/20 text-2xl text-ok">
                ✓
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ok">
                  PAYMENT RECONCILED & ESCROW LOCKED
                </span>
                <h3 className="font-display text-lg font-bold uppercase tracking-wider text-foreground mt-1">
                  Order Successfully Placed!
                </h3>
              </div>

              <div className="rounded border border-line bg-card p-4 font-mono text-xs text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="text-foreground font-bold">{customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session Ref:</span>
                  <span className="text-foreground">{activeSession.sessionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Item:</span>
                  <span className="text-foreground">{quantity}x {selectedProduct.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid:</span>
                  <span className="text-primary font-bold">${orderTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destination:</span>
                  <span className="text-foreground">{shippingAddress}</span>
                </div>
                <div className="h-px bg-line my-1" />
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Escrow Status:</span>
                  <span className="text-ok font-bold">LOCKED_IN_ESCROW (Station 05)</span>
                </div>
              </div>

              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={resetFlow}
                  className="btn-signal text-xs"
                >
                  Place Another Order
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetFlow();
                    onClose();
                  }}
                  className="btn-op text-xs"
                >
                  View in Ops Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
