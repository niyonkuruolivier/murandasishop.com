import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  ShoppingBag,
  LayoutGrid,
  BarChart3,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  X,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Wallet,
  ShieldCheck,
  Users,
  Settings,
} from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { asArray, asOrderItems } from "@/lib/api-helpers";
import { ShippedAttachmentModal } from "@/components/admin/ShippedAttachmentModal";
import { useAuth } from "@/lib/auth";
import {
  canSeeTab,
  firstAllowedTab,
  hasPermission,
  useAdminAccess,
  type PermissionKey,
} from "@/lib/admin-access";
import { useCategories } from "@/lib/products";
import { uploadProductImage } from "@/lib/upload";
import { PRODUCT_IMAGE_ACCEPT, PRODUCT_IMAGE_HINT } from "@/lib/image-formats";
import { AdminOrderDetails, type AdminOrderDetailsOrder } from "@/components/admin/AdminOrderDetails";
import { CashbackTab } from "@/components/admin/CashbackTab";
import { PaymentsTab } from "@/components/admin/PaymentsTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { useAdminProducts } from "@/lib/admin-products";
import type { HeroSlide } from "@/components/Hero";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

type Tab =
  | "products"
  | "orders"
  | "payments"
  | "users"
  | "categories"
  | "hero"
  | "cashback"
  | "analytics"
  | "settings";

function AdminDashboard() {
  const { user, signOut } = useAuth();
  const { data: access } = useAdminAccess();
  const [tab, setTab] = useState<Tab>("products");

  useEffect(() => {
    if (!access) return;
    setTab((current) =>
      canSeeTab(access, current) ? current : (firstAllowedTab(access) as Tab),
    );
  }, [access]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user?.email}. Changes go live instantly.
          </p>
        </div>
        <button
          onClick={() => signOut()}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      <AdminTabs tab={tab} setTab={setTab} access={access} />

      {tab === "products" && hasPermission(access, "products") && <ProductsTab />}
      {tab === "orders" && hasPermission(access, "orders") && <OrdersTab />}
      {tab === "payments" && hasPermission(access, "payments") && <PaymentsTab />}
      {tab === "users" && canSeeTab(access, "users") && <UsersTab />}
      {tab === "categories" && hasPermission(access, "categories") && <CategoriesTab />}
      {tab === "hero" && hasPermission(access, "hero") && <HeroTab />}
      {tab === "cashback" && hasPermission(access, "cashback") && <CashbackTab />}
      {tab === "analytics" && hasPermission(access, "analytics") && <AnalyticsTab />}
      {tab === "settings" && access?.isAdmin && <SettingsTab />}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Link to="/" className="underline">View storefront →</Link>
      </p>
    </main>
  );
}
// ============= TABS =============
function useAdminBadges() {
  return useQuery({
    queryKey: ["admin-badges"],
    refetchInterval: 15_000,
    queryFn: () =>
      apiGet<{ orders: number; payments: number; whatsapp: number; users: number }>(
        "/admin/badges",
      ),
  });
}

function AdminTabs({
  tab,
  setTab,
  access,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  access: ReturnType<typeof useAdminAccess>["data"];
}) {
  const { data: badges } = useAdminBadges();
  const items = [
    { id: "products" as const, label: "Products", icon: Package, badge: 0, perm: "products" as PermissionKey },
    { id: "orders" as const, label: "Orders", icon: ShoppingBag, badge: badges?.orders ?? 0, perm: "orders" as PermissionKey },
    { id: "payments" as const, label: "Payments", icon: ShieldCheck, badge: badges?.payments ?? 0, perm: "payments" as PermissionKey },
    {
      id: "users" as const,
      label: "Users",
      icon: Users,
      badge: badges?.users ?? 0,
      perm: null,
    },
    { id: "categories" as const, label: "Categories", icon: LayoutGrid, badge: 0, perm: "categories" as PermissionKey },
    { id: "hero" as const, label: "Hero", icon: ImageIcon, badge: 0, perm: "hero" as PermissionKey },
    { id: "cashback" as const, label: "Cashback", icon: Wallet, badge: 0, perm: "cashback" as PermissionKey },
    { id: "analytics" as const, label: "Analytics", icon: BarChart3, badge: 0, perm: "analytics" as PermissionKey },
    { id: "settings" as const, label: "Settings", icon: Settings, badge: 0, perm: null },
  ].filter((t) => {
    if (t.id === "users") return canSeeTab(access, "users");
    if (t.id === "settings") return Boolean(access?.isAdmin);
    return hasPermission(access, t.perm!);
  });

  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-border">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`relative inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            tab === t.id
              ? "border-accent text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <t.icon className="h-4 w-4" /> {t.label}
          {t.badge > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}


// ============= PRODUCTS =============
function ProductsTab() {
  const { data: products = [], isLoading, refetch } = useAdminProducts();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{products.length} products</h2>
        <Link
          to="/admin/products/new"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> New product
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Cashback</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-muted-foreground">/{p.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize">{p.category_slug}</td>
                  <td className="px-4 py-3 font-semibold">FRW {Number(p.price).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={p.stock > 0 ? "text-success" : "text-destructive"}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-accent">
                    {Number(p.cashback_percent ?? 0)}%
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link
                        to="/admin/products/$productId/edit"
                        params={{ productId: p.id }}
                        className="rounded-lg p-2 hover:bg-secondary"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete "${p.name}"?`)) return;
                          await apiDelete(`/products/${p.id}`);
                          refetch();
                        }}
                        className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 outline-none focus:border-accent"
      />
    </label>
  );
}

// ============= ORDERS =============
type OrderRow = AdminOrderDetailsOrder;

const PAYMENT_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const DELIVERY_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
] as const;

function OrdersTab() {
  const qc = useQueryClient();
  const [shipModal, setShipModal] = useState<{
    orderId: string;
    customerName: string;
    payment_status: string;
    delivery_status: string;
  } | null>(null);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const rows = asArray<OrderRow>(await apiGet<unknown>("/orders"));
      return rows.map((o) => ({
        ...o,
        items: asOrderItems(o.items) as OrderRow["items"],
      }));
    },
  });

  const updateStatuses = async (
    id: string,
    payment_status: string,
    delivery_status: string,
    shipping_attachment_url?: string,
  ) => {
    try {
      await apiPatch(`/orders/${id}/status`, {
        payment_status,
        delivery_status,
        ...(shipping_attachment_url ? { shipping_attachment_url } : {}),
      });
      await Promise.all([
        refetch(),
        qc.invalidateQueries({ queryKey: ["admin-payments"] }),
      ]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update order status.");
      throw error;
    }
  };

  const onDeliveryChange = (o: OrderRow, next: string) => {
    if (next === "shipped" && o.delivery_status !== "shipped") {
      setShipModal({
        orderId: o.id,
        customerName: o.customer_name,
        payment_status: o.payment_status,
        delivery_status: o.delivery_status,
      });
      return;
    }
    void updateStatuses(o.id, o.payment_status, next);
  };

  const deliverySelectValue = (o: OrderRow) =>
    shipModal?.orderId === o.id ? shipModal.delivery_status : o.delivery_status;

  if (isLoading)
    return <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">Loading…</div>;

  if (orders.length === 0)
    return (
      <div className="rounded-2xl border border-border p-12 text-center text-muted-foreground">
        No orders yet. Once customers checkout, they show up here.
      </div>
    );

  return (
    <div className="space-y-3">
      <ShippedAttachmentModal
        open={shipModal != null}
        customerName={shipModal?.customerName ?? ""}
        onCancel={() => setShipModal(null)}
        onConfirm={async (attachmentPath) => {
          if (!shipModal) return;
          await updateStatuses(
            shipModal.orderId,
            shipModal.payment_status,
            "shipped",
            attachmentPath,
          );
          setShipModal(null);
        }}
      />
      {orders.map((o) => (
        <details key={o.id} className="rounded-2xl border border-border bg-card">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-bold">{o.customer_name}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(o.created_at).toLocaleString()} · {o.phone} · {o.city}, {o.country}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="font-black">FRW {Number(o.total).toLocaleString()}</span>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Payment</span>
                <select
                  value={o.payment_status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateStatuses(o.id, e.target.value, o.delivery_status)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${paymentStatusColor(o.payment_status)}`}
                >
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Delivery</span>
                <select
                  value={deliverySelectValue(o)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onDeliveryChange(o, e.target.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${deliveryStatusColor(o.delivery_status)}`}
                >
                  {DELIVERY_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </summary>
          <div className="border-t border-border p-4">
            <AdminOrderDetails order={o} />
          </div>
        </details>
      ))}
    </div>
  );
}

function paymentStatusColor(s: string) {
  switch (s) {
    case "paid":
      return "border-success bg-success/10 text-success";
    case "cancelled":
      return "border-destructive text-destructive";
    default:
      return "border-border text-muted-foreground";
  }
}

function deliveryStatusColor(s: string) {
  switch (s) {
    case "delivered":
      return "border-success bg-success/10 text-success";
    case "shipped":
      return "border-accent text-accent";
    case "processing":
      return "border-foreground text-foreground";
    case "cancelled":
      return "border-destructive text-destructive";
    default:
      return "border-border text-muted-foreground";
  }
}

// ============= CATEGORIES =============
function CategoriesTab() {
  const { data: categories = [], refetch } = useCategories();
  const [form, setForm] = useState({ name: "", slug: "", emoji: "📦" });

  const add = async () => {
    if (!form.name || !form.slug) return;
    await apiPost("/categories", {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      emoji: form.emoji || "📦",
      sort_order: categories.length + 1,
    });
    setForm({ name: "", slug: "", emoji: "📦" });
    refetch();
  };

  const remove = async (slug: string) => {
    if (!confirm("Delete this category? Products in it must be moved first.")) return;
    await apiDelete(`/categories/${encodeURIComponent(slug)}`);
    refetch();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= categories.length) return;
    const a = categories[idx];
    const b = categories[target];
    await Promise.all([
      apiPatch(`/categories/${encodeURIComponent(a.slug)}`, { sort_order: b.sort_order ?? target + 1 }),
      apiPatch(`/categories/${encodeURIComponent(b.slug)}`, { sort_order: a.sort_order ?? idx + 1 }),
    ]);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Add category</h3>
        <div className="grid gap-3 sm:grid-cols-[80px_1fr_1fr_auto]">
          <input
            value={form.emoji}
            onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            placeholder="📦"
            className="h-11 rounded-lg border border-border bg-background px-3 text-center"
          />
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name (e.g. Cameras)"
            className="h-11 rounded-lg border border-border bg-background px-3"
          />
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="slug (e.g. cameras)"
            className="h-11 rounded-lg border border-border bg-background px-3"
          />
          <button
            onClick={add}
            className="rounded-xl bg-accent px-5 font-bold text-accent-foreground hover:brightness-110"
          >
            Add
          </button>
        </div>
      </div>

      <ul className="divide-y divide-border rounded-2xl border border-border">
        {categories.map((c, idx) => (
          <li key={c.slug} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-2xl">{c.emoji}</span>
              <div className="min-w-0">
                <div className="truncate font-semibold">{c.name}</div>
                <div className="truncate text-xs text-muted-foreground">/{c.slug}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                aria-label="Move up"
                className="rounded-lg p-2 hover:bg-muted disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => move(idx, 1)}
                disabled={idx === categories.length - 1}
                aria-label="Move down"
                className="rounded-lg p-2 hover:bg-muted disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => remove(c.slug)}
                aria-label="Delete"
                className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============= ANALYTICS =============
function AnalyticsTab() {
  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => asArray<OrderRow>(await apiGet<unknown>("/orders")),
  });
  const { data: products = [] } = useAdminProducts();

  const stats = useMemo(() => {
    const revenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + Number(o.total), 0);
    const pending = orders.filter((o) => o.status === "pending").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const outOfStock = products.filter((p) => p.stock === 0).length;
    return { revenue, pending, delivered, outOfStock, orders: orders.length, products: products.length };
  }, [orders, products]);

  const cards = [
    { label: "Total revenue", value: `FRW ${stats.revenue.toLocaleString()}` },
    { label: "Total orders", value: stats.orders },
    { label: "Pending", value: stats.pending },
    { label: "Delivered", value: stats.delivered },
    { label: "Products", value: stats.products },
    { label: "Out of stock", value: stats.outOfStock },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border bg-card p-6">
          <div className="text-xs font-semibold uppercase text-muted-foreground">{c.label}</div>
          <div className="mt-2 text-3xl font-black">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ============= HERO SLIDES =============
function useHeroSlidesAdmin() {
  return useQuery({
    queryKey: ["admin-hero-slides"],
    queryFn: () => apiGet<HeroSlide[]>("/hero-slides/all"),
  });
}

function HeroTab() {
  const { data: slides = [], isLoading, refetch } = useHeroSlidesAdmin();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<HeroSlide | "new" | null>(null);

  const invalidatePublic = () => qc.invalidateQueries({ queryKey: ["hero-slides"] });

  const move = async (slide: HeroSlide, dir: -1 | 1) => {
    const sorted = [...slides].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((s) => s.id === slide.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      apiPatch(`/hero-slides/${slide.id}`, { sort_order: swap.sort_order }),
      apiPatch(`/hero-slides/${swap.id}`, { sort_order: slide.sort_order }),
    ]);
    refetch();
    invalidatePublic();
  };

  const toggleActive = async (slide: HeroSlide) => {
    await apiPatch(`/hero-slides/${slide.id}`, { active: !slide.active });
    refetch();
    invalidatePublic();
  };

  const remove = async (slide: HeroSlide) => {
    if (!confirm(`Delete slide "${slide.title || "Untitled"}"?`)) return;
    await apiDelete(`/hero-slides/${slide.id}`);
    refetch();
    invalidatePublic();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{slides.length} hero slides</h2>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> New slide
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">Loading…</div>
      ) : slides.length === 0 ? (
        <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
          No slides yet. Add one to customize the homepage banner.
        </div>
      ) : (
        <ul className="space-y-3">
          {slides.map((s, i) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <img src={s.image} alt="" className="h-16 w-28 flex-shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {s.title} <span className="text-accent">{s.highlight}</span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {s.cta_label} → {s.cta_href}
                </div>
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  s.active ? "border-success text-success" : "border-border text-muted-foreground"
                }`}
              >
                {s.active ? "Live" : "Hidden"}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => move(s, -1)}
                  disabled={i === 0}
                  className="rounded-lg p-2 hover:bg-secondary disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => move(s, 1)}
                  disabled={i === slides.length - 1}
                  className="rounded-lg p-2 hover:bg-secondary disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleActive(s)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-secondary"
                >
                  {s.active ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => setEditing(s)}
                  className="rounded-lg p-2 hover:bg-secondary"
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(s)}
                  className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <HeroSlideEditor
          slide={editing === "new" ? null : editing}
          nextSortOrder={(slides[slides.length - 1]?.sort_order ?? 0) + 1}
          onClose={() => {
            setEditing(null);
            refetch();
            invalidatePublic();
          }}
        />
      )}
    </div>
  );
}

function HeroSlideEditor({
  slide,
  nextSortOrder,
  onClose,
}: {
  slide: HeroSlide | null;
  nextSortOrder: number;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    image: slide?.image ?? "",
    title: slide?.title ?? "",
    highlight: slide?.highlight ?? "",
    cta_label: slide?.cta_label ?? "Shop Now",
    cta_href: slide?.cta_href ?? "/search",
    active: slide?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError(null);
    if (!form.image.trim()) {
      setError("An image is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        image: form.image.trim(),
        title: form.title.trim(),
        highlight: form.highlight.trim(),
        cta_label: form.cta_label.trim() || "Shop Now",
        cta_href: form.cta_href.trim() || "/search",
        active: form.active,
      };
      if (slide) {
        await apiPatch(`/hero-slides/${slide.id}`, payload);
      } else {
        await apiPost("/hero-slides", { ...payload, sort_order: nextSortOrder });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-black">{slide ? "Edit slide" : "New slide"}</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <span className="text-sm font-medium">Background image</span>
            <div className="mt-2 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-semibold hover:bg-secondary/70">
                <Plus className="h-4 w-4" />
                {form.image ? "Replace image" : "Upload image"}
                <input
                  type="file"
                  accept={PRODUCT_IMAGE_ACCEPT}
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files?.[0])}
                />
              </label>
              <span className="text-xs text-muted-foreground">{PRODUCT_IMAGE_HINT}</span>
              {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
            </div>
            {form.image && (
              <div className="mt-3 aspect-[21/9] overflow-hidden rounded-xl border border-border">
                <img src={form.image} alt="preview" className="h-full w-full object-cover" />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Title (first line)"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
            />
            <TextField
              label="Highlight (accent line)"
              value={form.highlight}
              onChange={(v) => setForm({ ...form, highlight: v })}
            />
            <TextField
              label="Button label"
              value={form.cta_label}
              onChange={(v) => setForm({ ...form, cta_label: v })}
            />
            <TextField
              label="Button link (e.g. /category/phones)"
              value={form.cta_href}
              onChange={(v) => setForm({ ...form, cta_href: v })}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4"
            />
            Show this slide on the homepage
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-5 py-2.5 font-semibold hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || uploading}
            className="rounded-xl bg-accent px-6 py-2.5 font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
