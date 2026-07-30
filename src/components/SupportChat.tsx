import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  ShoppingCart,
  Zap,
  Package,
  CheckCircle2,
  Truck,
  ShieldCheck,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useServerFn } from "@tanstack/react-start";
import { createCheckoutOrder } from "@/lib/orders.functions";
import { initiateMomoPayment, getPaymentState } from "@/lib/payments.functions";
import { useAuth } from "@/lib/auth";

type ChatProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  inStock: boolean;
  rating: number;
  image: string;
  images: string[];
  warranty: string;
  delivery: string;
  specs: Record<string, string>;
};

type Widget =
  | { kind: "product" | "products"; products: ChatProduct[] }
  | { kind: "checkout"; product: ChatProduct; qty: number }
  | {
      kind: "confirmed";
      orderId: string;
      items: { name: string; qty: number; price: number }[];
      total: number;
      customer: { name: string; phone: string; address: string; city: string; payment: string };
    };

type Message = {
  role: "user" | "assistant";
  content: string;
  widgets?: Widget[];
};

const STORAGE_KEY = "murandasi-support-chat-v2";
const WELCOME: Message = {
  role: "assistant",
  content:
    "Hi! 👋 I'm your Murandasi shopping assistant. Ask me anything — I can show you products, take your order, and process payment right here. What are you looking for today?",
};




/* ---------------- Product Card (in chat) ---------------- */

function ChatProductCard({
  product,
  onBuy,
  onAddToCart,
}: {
  product: ChatProduct;
  onBuy: (p: ChatProduct, qty: number) => void;
  onAddToCart: (p: ChatProduct, qty: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const images = product.images.length ? product.images : [product.image];
  const touchStart = useRef<number | null>(null);

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  const specEntries = Object.entries(product.specs || {}).slice(0, 4);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      {/* Gallery */}
      <div
        className="relative aspect-square w-full overflow-hidden bg-secondary"
        onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchStart.current == null) return;
          const dx = e.changedTouches[0].clientX - touchStart.current;
          if (dx > 40) prev();
          else if (dx < -40) next();
          touchStart.current = null;
        }}
      >
        <img
          src={images[idx]}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white backdrop-blur hover:bg-black/60"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white backdrop-blur hover:bg-black/60"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-1">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${
                    i === idx ? "bg-white" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Body */}
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-tight">{product.name}</h4>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            ★ {product.rating.toFixed(1)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-base font-black">FRW {product.price.toLocaleString()}</div>
          <span
            className={`flex items-center gap-1 text-[11px] font-medium ${
              product.inStock ? "text-success" : "text-destructive"
            }`}
          >
            <Package className="h-3 w-3" />
            {product.inStock ? `${product.stock} in stock` : "Out of stock"}
          </span>
        </div>

        {specEntries.length > 0 && (
          <ul className="space-y-0.5 rounded-lg bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
            {specEntries.map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2">
                <span className="capitalize">{k}</span>
                <span className="font-medium text-foreground">{v}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Truck className="h-3 w-3" /> {product.delivery}
          <span className="mx-1">•</span>
          <ShieldCheck className="h-3 w-3" /> {product.warranty}
        </div>

        {/* Qty selector */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center rounded-lg border border-border">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={!product.inStock}
              aria-label="Decrease"
              className="p-1.5 disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[2ch] text-center text-sm font-semibold">{qty}</span>
            <button
              onClick={() => setQty((q) => Math.min(product.stock || 99, q + 1))}
              disabled={!product.inStock}
              aria-label="Increase"
              className="p-1.5 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-xs font-semibold text-foreground">
            = FRW {(product.price * qty).toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onAddToCart(product, qty)}
            disabled={!product.inStock}
            className="flex items-center justify-center gap-1 rounded-lg border border-border bg-background px-2 py-2 text-xs font-semibold transition hover:bg-secondary disabled:opacity-40"
          >
            <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
          </button>
          <button
            onClick={() => onBuy(product, qty)}
            disabled={!product.inStock}
            className="flex items-center justify-center gap-1 rounded-lg bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
          >
            <Zap className="h-3.5 w-3.5" /> Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Inline Checkout ---------------- */

type CheckoutStep = "form" | "payment" | "processing" | "done";

function InlineCheckout({
  product,
  qty,
  onDone,
}: {
  product: ChatProduct;
  qty: number;
  onDone: (m: Message) => void;
}) {
  const [step, setStep] = useState<CheckoutStep>("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Kigali");
  const [payment, setPayment] = useState<"MTN Mobile Money" | "Airtel Money">(
    "MTN Mobile Money",
  );
  const [payPhone, setPayPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const total = product.price * qty;
  const { user } = useAuth();
  const createOrderFn = useServerFn(createCheckoutOrder);
  const payFn = useServerFn(initiateMomoPayment);
  const stateFn = useServerFn(getPaymentState);

  async function placeOrder() {
    setStep("processing");
    setError(null);
    try {
      const order = await createOrderFn({
        data: {
          customer_name: name,
          phone,
          address,
          city,
          country: "Rwanda",
          payment_method: payment === "Airtel Money" ? "airtel" : "mtn",
          userId: user?.id ?? null,
          notes: "Placed via AI chat assistant",
          items: [{ slug: product.slug, qty }],
        },
      });

      let state = await payFn({ data: { orderId: order.id, phone: payPhone } });
      const started = Date.now();
      while (state.status === "pending" && state.paymentId && Date.now() - started < 3 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 4000));
        state = await stateFn({ data: { paymentId: state.paymentId } });
      }

      if (state.status !== "success") {
        throw new Error(
          state.message ??
            (state.status === "not_configured"
              ? "Mobile Money is not configured yet."
              : "The payment was not approved."),
        );
      }

      const orderId = order.id.slice(0, 8).toUpperCase();
      setStep("done");
      onDone({
        role: "assistant",
        content:
          `✅ Payment received! Your order **${orderId}** is marked as paid and is being prepared.` +
          (state.cashback > 0
            ? `\n\n🎉 Congratulations! You earned FRW ${state.cashback.toLocaleString()} cashback. It has been added to your Murandasi Cashback Wallet and is now available for your next purchase.`
            : ""),
        widgets: [
          {
            kind: "confirmed",
            orderId,
            items: [{ name: product.name, qty, price: product.price }],
            total,
            customer: { name, phone, address, city, payment },
          },
        ],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment could not be completed. Please try again.");
      setStep("payment");
    }
  }

  if (step === "form") {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-background p-3 text-sm">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="font-semibold">Checkout · {qty} × {product.name}</span>
          <span className="text-xs font-bold">FRW {total.toLocaleString()}</span>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (e.g. 0788...)"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Delivery address"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          onClick={() => {
            if (!name.trim() || !phone.trim() || !address.trim() || !city.trim()) {
              setError("Please fill all fields.");
              return;
            }
            setError(null);
            setStep("payment");
          }}
          className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          Continue to Payment →
        </button>
        {error && <div className="text-xs text-destructive">{error}</div>}
      </div>
    );
  }

  if (step === "payment" || step === "processing") {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-background p-3 text-sm">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="font-semibold">Payment</span>
          <span className="text-xs font-bold">FRW {total.toLocaleString()}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["MTN Mobile Money", "Airtel Money"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setPayment(m)}
              disabled={step === "processing"}
              className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                payment === m
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-secondary"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <input
          value={payPhone}
          onChange={(e) => setPayPhone(e.target.value)}
          disabled={step === "processing"}
          placeholder={`${payment} phone number`}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
        />

        {step === "processing" ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending {payment} prompt to {payPhone || "your phone"}… Approve on your device.
          </div>
        ) : (
          <button
            onClick={() => {
              if (!payPhone.trim()) {
                setError("Enter the phone number to charge.");
                return;
              }
              setError(null);
              placeOrder();
            }}
            className="w-full rounded-lg bg-accent py-2 text-sm font-semibold text-accent-foreground hover:brightness-110"
          >
            Pay FRW {total.toLocaleString()}
          </button>
        )}
        {error && <div className="text-xs text-destructive">{error}</div>}
      </div>
    );
  }

  return null;
}

/* ---------------- Confirmed Card ---------------- */

function ConfirmedCard({
  orderId,
  items,
  total,
  customer,
}: {
  orderId: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  customer: { name: string; phone: string; address: string; city: string; payment: string };
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-success/40 bg-success/5 p-3 text-sm">
      <div className="flex items-center gap-2 border-b border-success/30 pb-2">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <div>
          <div className="font-semibold">Order Confirmed</div>
          <div className="text-[11px] text-muted-foreground">Tracking ID: {orderId}</div>
        </div>
      </div>
      <ul className="space-y-1 text-xs">
        {items.map((i, k) => (
          <li key={k} className="flex justify-between">
            <span>
              {i.qty} × {i.name}
            </span>
            <span className="font-medium">FRW {(i.qty * i.price).toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-success/30 pt-1 text-sm font-bold">
        <span>Total</span>
        <span>FRW {total.toLocaleString()}</span>
      </div>
      <div className="space-y-0.5 rounded-lg bg-background/70 p-2 text-[11px] text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">Deliver to:</span> {customer.name},{" "}
          {customer.address}, {customer.city}
        </div>
        <div>
          <span className="font-medium text-foreground">Phone:</span> {customer.phone}
        </div>
        <div>
          <span className="font-medium text-foreground">Payment:</span> {customer.payment}
        </div>
        <div className="flex items-center gap-1 pt-1 text-success">
          <Truck className="h-3 w-3" /> Estimated delivery: 2–3 days across Rwanda.
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main Chat ---------------- */

export function SupportChat() {
  const { add } = useCart();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [checkout, setCheckout] = useState<{ product: ChatProduct; qty: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
    } catch {}
  }, []);

  // Persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Autoscroll + focus
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading, checkout]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const historyForApi = useMemo(
    () =>
      messages
        .filter((m, i) => !(i === 0 && m === WELCOME))
        .map((m) => ({ role: m.role, content: m.content })),
    [messages],
  );

  async function send(text?: string) {
    const value = (text ?? input).trim();
    if (!value || loading) return;
    const nextHistory = [
      ...historyForApi,
      { role: "user" as const, content: value },
    ];
    setMessages((m) => [...m, { role: "user", content: value }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextHistory }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data?.error || "Sorry, something went wrong." },
        ]);
      } else {
        const widgets: Widget[] = Array.isArray(data.widgets) ? data.widgets : [];
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.reply || "", widgets },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function clearChat() {
    setMessages([WELCOME]);
    setCheckout(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  function handleAddToCart(p: ChatProduct, qty: number) {
    add({ slug: p.slug, name: p.name, price: p.price, image: p.image }, qty);
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: `Added ${qty} × ${p.name} to your cart. Want to keep browsing or check out here?`,
      },
    ]);
  }

  function handleBuyNow(p: ChatProduct, qty: number) {
    setCheckout({ product: p, qty });
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: `Great choice! Let's complete your purchase right here. Please fill in your delivery details below 👇`,
      },
    ]);
  }

  function onCheckoutDone(finalMessage: Message) {
    setCheckout(null);
    setMessages((m) => [...m, finalMessage]);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open shopping assistant"
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-x-2 bottom-2 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[640px] sm:w-[400px] animate-in fade-in slide-in-from-bottom-4 duration-200"
          style={{ height: "min(85vh, 640px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <div className="text-sm font-semibold">Murandasi AI Shopping</div>
              <div className="text-xs opacity-80">Browse, order & pay right here</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="rounded px-2 py-1 text-xs opacity-80 hover:opacity-100"
                aria-label="Clear conversation"
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 opacity-80 hover:opacity-100"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-3">
            {messages.map((m, i) => (
              <div key={i} className="space-y-2">
                {m.content && (
                  <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-accent text-accent-foreground rounded-br-sm"
                          : "bg-background text-foreground border border-border rounded-bl-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                )}
                {m.widgets?.map((w, k) => {
                  if (w.kind === "product" || w.kind === "products") {
                    return (
                      <div key={k} className="grid grid-cols-1 gap-2">
                        {w.products.map((p) => (
                          <ChatProductCard
                            key={p.id}
                            product={p}
                            onBuy={handleBuyNow}
                            onAddToCart={handleAddToCart}
                          />
                        ))}
                      </div>
                    );
                  }
                  if (w.kind === "confirmed") {
                    return (
                      <ConfirmedCard
                        key={k}
                        orderId={w.orderId}
                        items={w.items}
                        total={w.total}
                        customer={w.customer}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            ))}

            {checkout && (
              <InlineCheckout
                product={checkout.product}
                qty={checkout.qty}
                onDone={onCheckoutDone}
              />
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </div>
              </div>
            )}

            {/* Quick suggestions */}
            {messages.length <= 1 && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {["Show me phones", "Best laptops", "Headphones under 50,000", "How does delivery work?"].map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-secondary"
                    >
                      {s}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-border bg-background p-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={checkout ? "Complete checkout above…" : "Ask or search products…"}
              className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
