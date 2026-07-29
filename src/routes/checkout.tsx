import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";
import { useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { whatsappUrl, cartMessage } from "@/lib/whatsapp";
import { createOrder } from "@/lib/orders";
import { RewardsProgress } from "@/components/RewardsProgress";


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

function CheckoutPage() {
  const { detailed, items, total, clear } = useCart();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [payment, setPayment] = useState("mtn");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-20 w-20 text-success" />
        <h1 className="mt-6 text-3xl font-black">Order placed!</h1>
        <p className="mt-2 text-muted-foreground">
          Thank you. We've received your order and will deliver soon.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-xl bg-accent px-6 py-3 font-semibold text-accent-foreground hover:brightness-110"
        >
          Continue Shopping
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
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      await createOrder({
        customer_name: String(fd.get("name") || ""),
        phone: String(fd.get("phone") || ""),
        address: String(fd.get("address") || ""),
        city: String(fd.get("city") || ""),
        country: String(fd.get("country") || "Rwanda"),
        payment_method: payment,
        items,
        total,
        notes: `Pay from: ${String(fd.get("pay_number") || "")}`,
      });
      clear();
      setDone(true);
      setTimeout(() => navigate({ to: "/" }), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place order. Try again.");
    } finally {
      setSubmitting(false);
    }
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
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-32">
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
          <div className="mt-4 flex justify-between border-t border-border pt-4">
            <span className="font-bold">Total</span>
            <span className="text-xl font-black">FRW {total.toLocaleString()}</span>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-xl bg-accent py-4 text-base font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? "Placing…" : "Place Order"}
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
        </aside>
      </form>
    </main>
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
