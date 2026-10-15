import type { ReactNode } from "react";
import { MapPin, User } from "lucide-react";
import { OrderPaymentDetails } from "@/components/OrderPaymentDetails";
import { ShippingAttachmentView } from "@/components/ShippingAttachmentView";
import { formatOrderPaymentSummary, momoMethodLabel } from "@/lib/order-payment";
import { apiUrl } from "@/lib/api";
import { asOrderItems } from "@/lib/api-helpers";

export type AdminOrderLine = {
  slug?: string;
  name: string;
  image?: string;
  price: number;
  shippingPrice?: number;
  qty?: number;
  quantity?: number;
  cashbackPercent?: number;
};

export type AdminOrderDetailsOrder = {
  id: string;
  user_id?: string | null;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  payment_method: string;
  payment_reference?: string | null;
  momo_charge_phone?: string | null;
  wallet_applied: number;
  momo_amount: number | null;
  items: AdminOrderLine[];
  total: number;
  status: string;
  payment_status: string;
  delivery_status: string;
  notes?: string | null;
  paid_at: string | null;
  created_at: string;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_location_label: string | null;
  shipping_attachment_url?: string | null;
  cashback_status: string;
  cashback_awarded: number;
  delivery_confirmed_at?: string | null;
  delivered_at?: string | null;
};

const frw = (n: number) => `FRW ${Math.round(Number(n) || 0).toLocaleString()}`;

function productImageSrc(image: string | undefined): string {
  const value = String(image ?? "").trim();
  if (!value) return "";
  if (value.startsWith("http")) return value;
  try {
    return apiUrl(value.startsWith("/") ? value : `/${value}`);
  } catch {
    return value;
  }
}

function lineQty(item: AdminOrderLine) {
  return Math.max(1, Number(item.qty ?? item.quantity) || 1);
}

function adminCashbackSummary(order: AdminOrderDetailsOrder): string {
  const amount = Number(order.cashback_awarded) || 0;
  switch (order.cashback_status) {
    case "credited":
      return `Credited to wallet — ${frw(amount)}`;
    case "pending_delivery":
      return `Pending customer confirmation — ${frw(amount)}`;
    case "reversed":
      return "Reversed";
    case "cancelled":
      return "Expired / cancelled";
    default:
      return amount > 0 ? `Status: ${order.cashback_status} · ${frw(amount)}` : "None on this order";
  }
}

function lineTotal(item: AdminOrderLine) {
  const qty = lineQty(item);
  const price = Number(item.price) || 0;
  const ship = Number(item.shippingPrice) || 0;
  return (price + ship) * qty;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium text-foreground">{children}</div>
    </div>
  );
}

export function AdminOrderDetails({ order }: { order: AdminOrderDetailsOrder }) {
  const momoPhone = String(order.momo_charge_phone ?? "").trim();
  const contactPhone = String(order.phone ?? "").trim();
  const showMomoPhone = momoPhone && momoPhone.replace(/\D/g, "") !== contactPhone.replace(/\D/g, "");

  return (
    <div className="space-y-5 text-sm">
      <section className="rounded-xl border border-border bg-background/50 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Order</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Order ID">
            <span className="font-mono text-xs">{order.id}</span>
          </Detail>
          <Detail label="Placed">{new Date(order.created_at).toLocaleString()}</Detail>
          <Detail label="Account">
            {order.user_id ? (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Registered customer
              </span>
            ) : (
              "Guest checkout"
            )}
          </Detail>
          <Detail label="System status">{order.status}</Detail>
          {order.paid_at && <Detail label="Paid at">{new Date(order.paid_at).toLocaleString()}</Detail>}
          {order.payment_reference && (
            <Detail label="Payment reference">
              <span className="font-mono text-xs">{order.payment_reference}</span>
            </Detail>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background/50 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Customer & delivery
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Full name">{order.customer_name}</Detail>
          <Detail label="Contact phone">{contactPhone || "—"}</Detail>
          {showMomoPhone && <Detail label="MoMo number charged">{momoPhone}</Detail>}
          {order.delivery_location_label && (
            <Detail label="Location name">{order.delivery_location_label}</Detail>
          )}
          <div className="sm:col-span-2">
            <Detail label="Address">
              {order.address}
              <div className="mt-1 text-muted-foreground">
                {order.city}, {order.country}
              </div>
            </Detail>
          </div>
          {order.delivery_latitude != null && order.delivery_longitude != null && (
            <div className="sm:col-span-2">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${order.delivery_latitude},${order.delivery_longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-accent hover:underline"
              >
                <MapPin className="h-4 w-4" />
                Open GPS on Google Maps
                {order.delivery_latitude.toFixed(5)}, {order.delivery_longitude.toFixed(5)}
              </a>
            </div>
          )}
        </div>
      </section>

      <section>
        <OrderPaymentDetails order={order} />
        <p className="mt-2 text-xs text-muted-foreground">
          Method: <strong className="text-foreground">{momoMethodLabel(order.payment_method)}</strong>
          {" · "}
          {formatOrderPaymentSummary(order)}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-background/50 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Cashback</h3>
        <p>{adminCashbackSummary(order)}</p>
      </section>

      {order.notes?.trim() && (
        <section className="rounded-xl border border-border bg-background/50 p-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Order notes</h3>
          <p className="whitespace-pre-wrap text-muted-foreground">{order.notes.trim()}</p>
        </section>
      )}

      {order.shipping_attachment_url && <ShippingAttachmentView url={order.shipping_attachment_url} />}

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Items</h3>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {asOrderItems(order.items).map((raw, i) => {
            const it = raw as AdminOrderLine;
            const qty = lineQty(it);
            const price = Number(it.price) || 0;
            const ship = Number(it.shippingPrice) || 0;
            const img = productImageSrc(it.image);
            return (
              <li key={`${it.slug ?? it.name}-${i}`} className="flex gap-3 px-4 py-3">
                {img ? (
                  <img src={img} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-secondary" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{it.name}</div>
                  {it.slug && <div className="text-xs text-muted-foreground">{it.slug}</div>}
                  <div className="mt-1 text-xs text-muted-foreground">
                    Qty {qty} · Product {frw(price)}
                    {ship > 0 ? ` · Shipping ${frw(ship)}` : " · No shipping on this line"}
                    {it.cashbackPercent != null && Number(it.cashbackPercent) > 0 && (
                      <> · Cashback {it.cashbackPercent}%</>
                    )}
                  </div>
                </div>
                <div className="shrink-0 font-bold">{frw(lineTotal(it))}</div>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex justify-end gap-2 text-base font-black">
          <span>Total</span>
          <span>{frw(order.total)}</span>
        </div>
      </section>
    </div>
  );
}
