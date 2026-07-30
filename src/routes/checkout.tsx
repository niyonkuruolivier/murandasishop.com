import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";
import { useState } from "react";
import { CheckCircle2, MessageCircle, Wallet } from "lucide-react";
import { whatsappUrl, cartMessage } from "@/lib/whatsapp";
import { createOrder } from "@/lib/orders";
import { PaymentVerification } from "@/components/PaymentVerification";
import { useAuth } from "@/lib/auth";
import { useMyWallet, redeemWalletForOrder, cashbackForOrder } from "@/lib/wallet";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Murandasi Shop" },
      { name: "description", content: "Complete your order in one simple step." },
      { property: "og:title", content: "Checkout — Murandasi Shop" },
      { property: "og:description", content: "One-page checkout." },
    ],
  }),
  component: CheckoutPage,
});

const frw = (n: number) => `FRW ${Math.round(Math.max(0, n)).toLocaleString()}`;

function CheckoutPage() {
  const { detailed, items, total, clear } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: walletBalance = 0 } = useMyWallet();

  const [done, setDone] = useState(false);
  const [payment, setPayment] = useState("mtn");
  const [useWallet, setUseWallet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<
    | null
    | {
        name: string;
        phone: string;
        address: string;
        city: string;
        country: string;
        payFrom: string;
        walletUse: number;
        momoDue: number;
      }
  >(null);

  const maxWallet = Math.min(walletBalance, total);
  const walletUse = user && useWallet ? maxWallet : 0;
  const momoDue = Math.max(0, total - walletUse);
  const expectedCashback = cashbackForOrder(items, momoDue);

  const placeOrder = async (p: {
    name: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    payFrom: string;
    walletUse: number;
    momoDue: number;
  }) => {
    const method = p.momoDue <= 0 ? "wallet" : p.walletUse > 0 ? `${payment}+wallet` : payment;
    const res = await createOrder({
      customer_name: p.name,
      phone: p.phone,
      address: p.address,
      city: p.city,
      country: p.country,
      payment_method: method,
      items,
      total,
      notes: p.payFrom ? `Pay from: ${p.payFrom}` : undefined,
    });
    if (res.id && p.walletUse > 0) {
      await redeemWalletForOrder(res.id, p.walletUse);
    }
    clear();
    return res.id;
  };

  if (pending) {
    const createOrderNow = async (): Promise<string | null> => placeOrder(pending);

    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 text-center">
          <h1 className="mt-3 text-2xl font-black">Complete your payment</h1>
          <p className="text-sm text-muted-foreground">
            Pay with MTN Mobile Money and upload your confirmation. Your order is only submitted
            after you send the payment proof.
          </p>
        </div>
        {pending.walletUse > 0 && (
          <div className="mb-4 rounded-xl border border-accent bg-accent/5 p-4 text-sm">
            <strong>{frw(pending.walletUse)}</strong> is being paid from your Cashback Wallet. Pay
            the remaining <strong>{frw(pending.momoDue)}</strong> with Mobile Money below.
          </div>
        )}
        <PaymentVerification
          amount={pending.momoDue}
          defaultName={pending.name}
          defaultPhone={pending.payFrom || pending.phone}
          resolveOrderId={createOrderNow}
          onDone={() => setTimeout(() => setDone(true), 800)}
        />
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setPending(null)}
            className="text-xs font-semibold text-muted-foreground underline"
          >
            Back to checkout
          </button>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-20 w-20 text-success" />
        <h1 className="mt-6 text-3xl font-black">Order submitted!</h1>
        <p className="mt-2 text-muted-foreground">
          Thank you. We've received your order and will confirm it shortly.
        </p>
        <Link
          to="/account"
          className="mt-8 inline-flex rounded-xl bg-accent px-6 py-3 font-semibold text-accent-foreground hover:brightness-110"
        >
          View my orders
        </Link>
      </main>
    );
  }

  if (detailed.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <Link to="/" className="mt-4 inline-block text-accent underline">
          Browse products
        </Link>
      </main>
    );
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "");
    const phone = String(fd.get("phone") || "");
    const address = String(fd.get("address") || "");
    const city = String(fd.get("city") || "");
    const country = String(fd.get("country") || "Rwanda");
    const payFrom = String(fd.get("pay_number") || "");
    const p = { name, phone, address, city, country, payFrom, walletUse, momoDue };

    // Fully paid with cashback — no Mobile Money step needed.
    if (momoDue <= 0) {
      setSubmitting(true);
      try {
        await placeOrder(p);
        setDone(true);
        setTimeout(() => navigate({ to: "/account" }), 4000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not place order. Try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Defer order creation until payment proof is submitted.
    setPending(p);
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-black">Checkout</h1>
      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-bold">Shipping Address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" name="name" required />
              <Field label="Phone" name="phone" type="tel" required />
              <Field label="Address" name="address" required className="sm:col-span-2" placeholder="e.g. Kacyiru, KG 123 St" />
              <Field label="City" name="city" required placeholder="e.g. Kigali" />
              <Field label="Country" name="country" defaultValue="Rwanda" required />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-bold">Payment Method</h2>

            {user && (
              <label
                className={`mb-4 flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
                  useWallet ? "border-accent bg-accent/5" : "border-border"
                } ${maxWallet <= 0 ? "opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={useWallet}
                  disabled={maxWallet <= 0}
                  onChange={(e) => setUseWallet(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[oklch(0.7_0.2_45)]"
                />
                <span>
                  <span className="flex items-center gap-2 font-semibold">
                    <Wallet className="h-4 w-4 text-accent" /> Use my Cashback Wallet
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    Balance: <strong className="text-foreground">{frw(walletBalance)}</strong>
                    {maxWallet > 0 ? ` — ${frw(maxWallet)} will be applied to this order.` : " — nothing to use yet."}
                  </span>
                </span>
              </label>
            )}

            {momoDue > 0 ? (
              <>
                <div className="space-y-3">
                  {[
                    { id: "mtn", label: "MTN Mobile Money" },
                    { id: "airtel", label: "Airtel Money" },
                  ].map((m) => (
                    <label
                      key={m.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition ${
                        payment === m.id ? "border-accent bg-accent/5" : "border-border"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value={m.id}
                        checked={payment === m.id}
                        onChange={() => setPayment(m.id)}
                        className="h-4 w-4 accent-[oklch(0.7_0.2_45)]"
                      />
                      <span className="font-medium">{m.label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-4">
                  <Field
                    label={`${payment === "airtel" ? "Airtel Money" : "MTN MoMo"} number you'll pay from`}
                    name="pay_number"
                    type="tel"
                    required
                    placeholder="07XXXXXXXX"
                  />
                </div>
              </>
            ) : (
              <p className="rounded-xl border border-success bg-success/10 p-4 text-sm font-semibold text-success">
                This order is fully covered by your Cashback Wallet — no Mobile Money payment needed.
              </p>
            )}
          </section>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-32">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold">Order</h2>

            <ul className="mt-4 space-y-3 text-sm">
              {detailed.map((i) => (
                <li key={i.slug} className="flex items-center gap-3">
                  <img src={i.product.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="line-clamp-1 font-medium">{i.product.name}</div>
                    <div className="text-muted-foreground">Qty {i.qty}</div>
                  </div>
                  <div className="font-semibold">
                    FRW {(i.product.price * i.qty).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <Row label="Subtotal" value={frw(total)} />
              {walletUse > 0 && (
                <Row label="Paid with cashback" value={`− ${frw(walletUse)}`} tone="text-accent" />
              )}
              <div className="flex justify-between border-t border-border pt-3">
                <span className="font-bold">
                  {walletUse > 0 ? "Pay with Mobile Money" : "Total"}
                </span>
                <span className="text-xl font-black">{frw(momoDue)}</span>
              </div>
            </div>

            {expectedCashback > 0 && (
              <p className="mt-3 rounded-xl bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">
                💰 You'll earn {frw(expectedCashback)} cashback once this order is completed.
              </p>
            )}
            {!user && (
              <p className="mt-3 text-xs text-muted-foreground">
                <Link to="/auth" className="font-semibold text-accent underline">
                  Sign in
                </Link>{" "}
                to earn and spend cashback on your orders.
              </p>
            )}

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-accent py-4 text-base font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? "Placing…" : momoDue > 0 ? "Continue to Payment" : "Place Order"}
            </button>
            <a
              href={whatsappUrl(
                cartMessage(
                  detailed.map((i) => ({
                    name: i.product.name,
                    qty: i.qty,
                    price: i.product.price,
                  })),
                  total,
                ),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-4 text-base font-bold text-white hover:brightness-110"
            >
              <MessageCircle className="h-5 w-5" /> Place Order via WhatsApp
            </a>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Chat directly with us to confirm your order
            </p>
          </div>
        </aside>
      </form>
    </main>
  );
}

function Row({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  className = "",
  defaultValue = "",
  placeholder = "",
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  className?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 outline-none transition focus:border-accent"
      />
    </label>
  );
}
