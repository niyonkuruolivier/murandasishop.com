import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Wallet, Smartphone, Loader2, XCircle, MapPin, Save } from "lucide-react";
import {
  createCheckoutOrder,
  initiateMomoPayment,
  getPaymentState,
  type PaymentState,
} from "@/lib/checkout-api";
import { useAuth } from "@/lib/auth";
import { useMyWallet, cashbackForOrder } from "@/lib/wallet";
import {
  createSavedLocation,
  detectDeliveryLocation,
  googleMapsLink,
  useSavedLocations,
  type SavedLocation,
} from "@/lib/locations";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Murandasi Shop" },
      { name: "description", content: "Pay securely with Mobile Money or your Murandasi Cashback Wallet." },
      { property: "og:title", content: "Checkout — Murandasi Shop" },
      { property: "og:description", content: "One-page checkout with instant Mobile Money payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutPage,
});

const frw = (n: number) => `FRW ${Math.round(Math.max(0, n)).toLocaleString()}`;
type DeliveryDraft = Pick<SavedLocation, "label" | "address" | "city" | "country" | "latitude" | "longitude">;

type Stage = "form" | "waiting" | "success" | "failed";

function CheckoutPage() {
  const { items, lineTotal, total, clear } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: walletBalance = 0 } = useMyWallet();
  const { data: savedLocations = [] } = useSavedLocations();

  const [stage, setStage] = useState<Stage>("form");
  const [payment, setPayment] = useState("mtn");
  const [useWallet, setUseWallet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentState | null>(null);
  const [payPhone, setPayPhone] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<DeliveryDraft | null>(null);
  const [locationKey, setLocationKey] = useState("new");
  const [saveLocation, setSaveLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxWallet = Math.min(walletBalance, total);
  const walletUse = user && useWallet ? maxWallet : 0;
  const momoDue = Math.max(0, total - walletUse);
  const expectedCashback = cashbackForOrder(items, momoDue);

  useEffect(() => {
    if (!selectedLocation && savedLocations.length > 0) {
      const preferred = savedLocations.find((location) => location.is_default) || savedLocations[0];
      setSelectedLocation(preferred);
      setLocationKey(preferred.id);
    }
  }, [savedLocations, selectedLocation]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const finish = (state: PaymentState) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setResult(state);
    setStage(state.status === "success" ? "success" : "failed");
    if (state.status === "success") {
      clear();
      qc.invalidateQueries({ queryKey: ["my-wallet"] });
      qc.invalidateQueries({ queryKey: ["my-wallet-tx"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["purchased-slugs"] });
    }
  };

  const startPolling = (paymentId: string) => {
    const started = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const s = await getPaymentState({ paymentId });
        if (s.status !== "pending") finish(s);
        else if (Date.now() - started > 3 * 60 * 1000) {
          finish({ ...s, status: "failed", message: "Payment timed out. No PIN was entered." });
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const phoneToCharge = String(fd.get("pay_number") || "").trim();
    if (momoDue > 0 && phoneToCharge.replace(/\D/g, "").length < 9) {
      setError("Enter the Mobile Money number that will receive the payment prompt.");
      return;
    }

    setSubmitting(true);
    try {
      const method = momoDue <= 0 ? "wallet" : walletUse > 0 ? `${payment}+wallet` : payment;
      const address = String(fd.get("address") || "");
      const city = String(fd.get("city") || "");
      const country = String(fd.get("country") || "Rwanda");
      const order = await createCheckoutOrder({
        customer_name: String(fd.get("name") || ""),
        phone: String(fd.get("phone") || ""),
        address,
        city,
        country,
        payment_method: method,
        walletAmount: walletUse,
        delivery_latitude: selectedLocation?.latitude ?? null,
        delivery_longitude: selectedLocation?.longitude ?? null,
        delivery_location_label: selectedLocation?.label ?? null,
        items: items.map((i) => ({
          slug: i.slug,
          qty: i.qty,
          ...(i.variationSelections ? { variations: i.variationSelections } : {}),
        })),
      });

      if (saveLocation && user) {
        await createSavedLocation({
          label: String(fd.get("location_label") || "Delivery location"),
          address,
          city,
          country,
          latitude: selectedLocation?.latitude ?? null,
          longitude: selectedLocation?.longitude ?? null,
          is_default: savedLocations.length === 0,
        });
        qc.invalidateQueries({ queryKey: ["saved-locations", user.id] });
      }

      setPayPhone(phoneToCharge);
      setStage("waiting");
      if (order.momoAmount <= 0) {
        finish({
          paymentId: null,
          orderId: order.id,
          status: "success",
          message: null,
          cashback: 0,
          amount: 0,
        });
        return;
      }
      const state = await initiateMomoPayment({ orderId: order.id, phone: phoneToCharge || "0" });

      if (state.status === "pending" && state.paymentId) startPolling(state.paymentId);
      else finish(state);
    } catch (err) {
      setStage("form");
      setError(err instanceof Error ? err.message : "Could not start the payment. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === "waiting") {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <Smartphone className="mx-auto h-16 w-16 text-accent" />
        <h1 className="mt-6 text-2xl font-black">Check your phone</h1>
        <p className="mt-2 text-muted-foreground">
          We sent a Mobile Money payment request of <strong>{frw(momoDue)}</strong> to{" "}
          <strong>{payPhone}</strong>. Enter your Mobile Money PIN to approve it
          {import.meta.env.DEV ? " (sandbox may auto-approve in a few seconds for testing)" : ""}.
        </p>
        <p className="mt-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent-foreground">
          If you do not see the prompt, dial <strong>*182*7*1#</strong> on your phone and follow the
          Mobile Money instructions to approve the payment.
        </p>
        <div className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Waiting for confirmation…
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Keep this page open. Your order is confirmed automatically once the payment succeeds.
        </p>
      </main>
    );
  }

  if (stage === "failed") {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <XCircle className="mx-auto h-16 w-16 text-destructive" />
        <h1 className="mt-6 text-2xl font-black">Payment not completed</h1>
        <p className="mt-2 text-muted-foreground">
          {result?.message ??
            (result?.status === "not_configured"
              ? "Mobile Money is not configured yet."
              : "The payment was not approved. Nothing was charged.")}
        </p>
        <button
          onClick={() => {
            setResult(null);
            setStage("form");
          }}
          className="mt-8 rounded-xl bg-accent px-6 py-3 font-semibold text-accent-foreground hover:brightness-110"
        >
          Try again
        </button>
      </main>
    );
  }

  if (stage === "success") {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-20 w-20 text-success" />
        <h1 className="mt-6 text-3xl font-black">Payment successful</h1>
        <p className="mt-2 text-muted-foreground">
          Your order is now marked as <strong>Paid</strong> and is being prepared.
        </p>
        {(result?.cashback ?? 0) > 0 && (
          <div className="mt-6 rounded-2xl border-2 border-accent bg-accent/5 p-5 text-left">
            <div className="text-lg font-black">🎉 Congratulations!</div>
            <p className="mt-1 text-sm">
              You earned <strong>{frw(result!.cashback)}</strong> cashback from your purchase. It has
              been added to your Murandasi Cashback Wallet and is now available for your next
              purchase.
            </p>
          </div>
        )}
        <Link
          to="/account"
          className="mt-8 inline-flex rounded-xl bg-accent px-6 py-3 font-semibold text-accent-foreground hover:brightness-110"
        >
          View my wallet & orders
        </Link>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <Link to="/" className="mt-4 inline-block text-accent underline">
          Browse products
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-black">Checkout</h1>
      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-bold">Shipping Address</h2>
            {user && savedLocations.length > 0 && (
              <label className="mb-4 block">
                <span className="text-sm font-medium">Saved delivery location</span>
                <select
                  value={selectedLocation && "id" in selectedLocation ? selectedLocation.id : ""}
                  onChange={(event) => {
                    const next = savedLocations.find((location) => location.id === event.target.value);
                    if (next) {
                      setSelectedLocation(next);
                      setLocationKey(next.id);
                      setLocationMessage(null);
                    }
                  }}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3"
                >
                  <option value="">Create a new location</option>
                  {savedLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.label} — {location.address}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  setLocating(true);
                  setLocationMessage(null);
                  try {
                    const location = await detectDeliveryLocation();
                    setSelectedLocation(location);
                    setLocationKey(`detected-${Date.now()}`);
                    setLocationMessage("Your current location was detected and placed on the order.");
                  } catch (error) {
                    setLocationMessage(error instanceof Error ? error.message : "Could not detect your location.");
                  } finally {
                    setLocating(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
              >
                <MapPin className="h-4 w-4" /> {locating ? "Detecting…" : "Use my current location"}
              </button>
              {googleMapsLink(selectedLocation?.latitude ?? null, selectedLocation?.longitude ?? null) && (
                <a
                  href={googleMapsLink(selectedLocation?.latitude ?? null, selectedLocation?.longitude ?? null) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
                >
                  Open map
                </a>
              )}
            </div>
            {locationMessage && (
              <p className="mb-4 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">{locationMessage}</p>
            )}
            <div key={locationKey} className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" name="name" required />
              <Field label="Phone" name="phone" type="tel" required />
              {user && (
                <Field
                  label="Location name"
                  name="location_label"
                  defaultValue={selectedLocation?.label || ""}
                  placeholder="e.g. Home or Office"
                />
              )}
              <Field
                label="Address"
                name="address"
                required
                className="sm:col-span-2"
                defaultValue={selectedLocation?.address || ""}
                placeholder="e.g. Kacyiru, KG 123 St"
              />
              <Field
                label="City"
                name="city"
                required
                defaultValue={selectedLocation?.city || ""}
                placeholder="e.g. Kigali"
              />
              <Field
                label="Country"
                name="country"
                defaultValue={selectedLocation?.country || "Rwanda"}
                required
              />
              {user && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={saveLocation}
                    onChange={(event) => setSaveLocation(event.target.checked)}
                    className="h-4 w-4 accent-[oklch(0.7_0.2_45)]"
                  />
                  <Save className="h-4 w-4 text-accent" /> Save this delivery location for next time
                </label>
              )}
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
                    {maxWallet > 0
                      ? ` — ${frw(maxWallet)} will be applied, only ${frw(momoDue)} is charged on Mobile Money.`
                      : " — nothing to use yet."}
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
                    label={`${payment === "airtel" ? "Airtel Money" : "MTN MoMo"} number to charge`}
                    name="pay_number"
                    type="tel"
                    required
                    placeholder="07XXXXXXXX"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    You'll receive a payment prompt on this number for {frw(momoDue)}. Enter your PIN
                    to approve.
                  </p>
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
              {items.map((i) => (
                <li key={i.slug} className="flex items-center gap-3">
                  <img src={i.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="line-clamp-1 font-medium">{i.name}</div>
                    <div className="text-muted-foreground">Qty {i.qty}</div>
                  </div>
                  <div className="font-semibold">{frw(lineTotal(i))}</div>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
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
                💰 You'll earn {frw(expectedCashback)} cashback instantly once your payment succeeds.
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
              {submitting ? "Starting payment…" : momoDue > 0 ? `Pay Now ${frw(momoDue)}` : "Place Order"}
            </button>
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
