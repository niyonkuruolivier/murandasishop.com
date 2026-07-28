import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/lib/auth";
import { useCategories } from "@/lib/products";
import { uploadProductImage, uploadProductImages } from "@/lib/upload";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Murandasi Shop" },
      { name: "description", content: "Manage products, orders, and categories." },
      { property: "og:title", content: "Admin — Murandasi Shop" },
      { property: "og:description", content: "Admin dashboard." },
    ],
  }),
  component: AdminPage,
});

type Tab = "products" | "orders" | "categories" | "analytics";

function AdminPage() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("products");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || roleLoading) {
    return <main className="mx-auto max-w-6xl px-4 py-20 text-center text-muted-foreground">Loading…</main>;
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-black">Not authorized</h1>
        <p className="mt-2 text-muted-foreground">
          Your account doesn't have admin access. Ask an existing admin to grant it.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user.email}. Changes go live instantly.
          </p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-border">
        {(
          [
            { id: "products", label: "Products", icon: Package },
            { id: "orders", label: "Orders", icon: ShoppingBag },
            { id: "categories", label: "Categories", icon: LayoutGrid },
            { id: "analytics", label: "Analytics", icon: BarChart3 },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              tab === t.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsTab />}
      {tab === "orders" && <OrdersTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "analytics" && <AnalyticsTab />}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Link to="/" className="underline">View storefront →</Link>
      </p>
    </main>
  );
}

// ============= PRODUCTS =============
type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category_slug: string;
  price: number;
  stock: number;
  in_stock: boolean;
  rating: number;
  reviews: number;
  image: string;
  images: string[] | null;
  warranty: string;
  delivery: string;
  specs: unknown;
};

function useAdminProducts() {
  return useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProductRow[];
    },
  });
}

function ProductsTab() {
  const { data: products = [], isLoading, refetch } = useAdminProducts();
  const [editing, setEditing] = useState<ProductRow | "new" | null>(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{products.length} products</h2>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> New product
        </button>
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
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(p)}
                        className="rounded-lg p-2 hover:bg-secondary"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete "${p.name}"?`)) return;
                          await supabase.from("products").delete().eq("id", p.id);
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

      {editing && (
        <ProductEditor
          product={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function ProductEditor({ product, onClose }: { product: ProductRow | null; onClose: () => void }) {
  const { data: categories = [] } = useCategories();
  const [form, setForm] = useState({
    slug: product?.slug ?? "",
    name: product?.name ?? "",
    category_slug: product?.category_slug ?? categories[0]?.slug ?? "phones",
    price: product?.price ?? 0,
    stock: product?.stock ?? 0,
    rating: product?.rating ?? 4.5,
    reviews: product?.reviews ?? 0,
    image: product?.image ?? "",
    images: (product?.images ?? []).join("\n"),
    warranty: product?.warranty ?? "1 Year Warranty",
    delivery: product?.delivery ?? "2-3 days",
    specs: product?.specs ? JSON.stringify(product.specs, null, 2) : "{}",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMainUpload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      setForm((f) => ({ ...f, image: url, images: f.images ? f.images : url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setError(null);
    setUploading(true);
    try {
      const urls = await uploadProductImages(files);
      setForm((f) => {
        const existing = f.images.split("\n").map((s) => s.trim()).filter(Boolean);
        const merged = [...existing, ...urls];
        return { ...f, images: merged.join("\n"), image: f.image || urls[0] };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      let specs: unknown = {};
      try {
        specs = JSON.parse(form.specs || "{}");
      } catch {
        throw new Error("Specs must be valid JSON");
      }
      const images = form.images
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        category_slug: form.category_slug,
        price: Number(form.price),
        stock: Number(form.stock),
        in_stock: Number(form.stock) > 0,
        rating: Number(form.rating),
        reviews: Number(form.reviews),
        image: form.image.trim() || images[0] || "",
        images: images.length ? images : [form.image.trim()],
        warranty: form.warranty,
        delivery: form.delivery,
        specs: specs as never,
      };
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
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
      <div className="w-full max-w-2xl rounded-2xl bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-black">{product ? "Edit product" : "New product"}</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <TextField label="Slug (URL)" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
          <label className="block">
            <span className="text-sm font-medium">Category</span>
            <select
              value={form.category_slug}
              onChange={(e) => setForm({ ...form, category_slug: e.target.value })}
              className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3"
            >
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Price (USD)"
            type="number"
            value={String(form.price)}
            onChange={(v) => setForm({ ...form, price: Number(v) })}
          />
          <TextField
            label="Stock"
            type="number"
            value={String(form.stock)}
            onChange={(v) => setForm({ ...form, stock: Number(v) })}
          />
          <TextField
            label="Rating"
            type="number"
            value={String(form.rating)}
            onChange={(v) => setForm({ ...form, rating: Number(v) })}
          />
          <TextField
            label="Reviews count"
            type="number"
            value={String(form.reviews)}
            onChange={(v) => setForm({ ...form, reviews: Number(v) })}
          />
          <TextField
            label="Warranty"
            value={form.warranty}
            onChange={(v) => setForm({ ...form, warranty: v })}
          />
          <TextField
            label="Delivery"
            value={form.delivery}
            onChange={(v) => setForm({ ...form, delivery: v })}
          />
          <div className="sm:col-span-2 space-y-2">
            <span className="text-sm font-medium">Main image</span>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-semibold hover:bg-secondary/70">
                <Plus className="h-4 w-4" />
                Upload main image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleMainUpload(e.target.files?.[0])}
                />
              </label>
              {form.image && (
                <img src={form.image} alt="preview" className="h-12 w-12 rounded-lg object-cover" />
              )}
            </div>
          </div>
          <div className="block sm:col-span-2">
            <span className="text-sm font-medium">Gallery images</span>
            <div className="mt-2 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-semibold hover:bg-secondary/70">
                <Plus className="h-4 w-4" />
                Add more photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleGalleryUpload(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
              <span className="text-xs text-muted-foreground">
                {form.images.split("\n").map((s) => s.trim()).filter(Boolean).length} photo(s)
              </span>
            </div>
            {form.images.split("\n").map((s) => s.trim()).filter(Boolean).length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {form.images
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((url, idx) => (
                    <div key={`${url}-${idx}`} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                      <img src={url} alt={`Photo ${idx + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          const list = form.images.split("\n").map((s) => s.trim()).filter(Boolean);
                          list.splice(idx, 1);
                          setForm({ ...form, images: list.join("\n") });
                        }}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
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
            disabled={saving}
            className="rounded-xl bg-accent px-6 py-2.5 font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
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
type OrderRow = {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  payment_method: string;
  items: Array<{ name: string; qty: number; price: number }>;
  total: number;
  status: string;
  created_at: string;
};

function OrdersTab() {
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as OrderRow[];
    },
  });

  const setStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    refetch();
  };

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
      {orders.map((o) => (
        <details key={o.id} className="rounded-2xl border border-border bg-card">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-bold">{o.customer_name}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(o.created_at).toLocaleString()} · {o.phone} · {o.city}, {o.country}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black">FRW {Number(o.total).toLocaleString()}</span>
              <select
                value={o.status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setStatus(o.id, e.target.value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusColor(o.status)}`}
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </summary>
          <div className="border-t border-border p-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Address:</span> {o.address}
              </div>
              <div>
                <span className="text-muted-foreground">Payment:</span>{" "}
                {o.payment_method === "mtn" ? "MTN Mobile Money" : o.payment_method === "airtel" ? "Airtel Money" : o.payment_method}
              </div>
            </div>
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
              {o.items?.map((it, i) => (
                <li key={i} className="flex justify-between px-4 py-2">
                  <span>
                    {it.name} × {it.qty}
                  </span>
                  <span className="font-semibold">FRW {(it.price * it.qty).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ))}
    </div>
  );
}

function statusColor(s: string) {
  switch (s) {
    case "delivered":
      return "border-success text-success";
    case "shipped":
      return "border-accent text-accent";
    case "cancelled":
      return "border-destructive text-destructive";
    case "confirmed":
      return "border-foreground text-foreground";
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
    await supabase.from("categories").insert({
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
    await supabase.from("categories").delete().eq("slug", slug);
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
        {categories.map((c) => (
          <li key={c.slug} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{c.emoji}</span>
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">/{c.slug}</div>
              </div>
            </div>
            <button
              onClick={() => remove(c.slug)}
              className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
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
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*");
      return (data ?? []) as unknown as OrderRow[];
    },
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
