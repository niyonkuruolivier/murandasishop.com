import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { useCategories } from "@/lib/products";
import { uploadProductImage, uploadProductImages } from "@/lib/upload";
import { PRODUCT_IMAGE_ACCEPT, PRODUCT_IMAGE_HINT } from "@/lib/image-formats";
import {
  type AdminProduct,
  type SpecRow,
  rowsToSpecs,
  specsToRows,
} from "@/lib/admin-products";
import { SpecsEditor } from "@/components/admin/SpecsEditor";
import { ProductVariationsEditor } from "@/components/admin/ProductVariationsEditor";
import { parseVariations, type ProductVariations } from "@/lib/variations";
import { slugify } from "@/lib/slug";
import { logClientError } from "@/lib/debug";

function imageLinesFromProduct(images: unknown): string {
  if (Array.isArray(images)) {
    return images.filter((u): u is string => typeof u === "string" && u.trim().length > 0).join("\n");
  }
  if (typeof images === "string" && images.trim()) return images.trim();
  return "";
}

type ProductFormProps = {
  product?: AdminProduct | null;
  onSaved: () => void;
  onCancel: () => void;
};

export function ProductForm({ product, onSaved, onCancel }: ProductFormProps) {
  const { data: categories = [] } = useCategories();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    slug: product?.slug ?? "",
    name: product?.name ?? "",
    category_slug: product?.category_slug ?? categories[0]?.slug ?? "phones",
    price: product?.price ?? 0,
    shipping_price: product?.shipping_price ?? 0,
    stock: product?.stock ?? 0,
    rating: product?.rating ?? 4.5,
    reviews: product?.reviews ?? 0,
    image: product?.image ?? "",
    images: imageLinesFromProduct(product?.images),
    warranty: product?.warranty ?? "1 Year Warranty",
    delivery: product?.delivery ?? "2-3 days",
    cashback_percent: product?.cashback_percent ?? 0,
  });
  const [specRows, setSpecRows] = useState<SpecRow[]>(() =>
    specsToRows(product?.specs),
  );
  const initialVariations = parseVariations(product?.variations);
  const [pricingMode, setPricingMode] = useState<"single" | "variation">(
    initialVariations.mode === "variation" ? "variation" : "single",
  );
  const [variationGroups, setVariationGroups] = useState(initialVariations.groups);
  const [slugManual, setSlugManual] = useState(Boolean(product?.slug));
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
      logClientError("ProductForm main image upload", e, { fileName: file.name, fileSize: file.size });
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
      logClientError("ProductForm gallery upload", e, { fileCount: files.length });
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const galleryUrls = String(form.images ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const mainImage = String(form.image ?? "").trim();
      const images = galleryUrls.filter(
        (url) => typeof url === "string" && (url.startsWith("http") || url.startsWith("/")),
      );
      const variations: ProductVariations =
        pricingMode === "variation"
          ? { mode: "variation", groups: variationGroups }
          : { mode: "single", groups: [] };

      if (pricingMode === "variation") {
        if (!variationGroups.length) {
          throw new Error("Add at least one variation (e.g. Color) with options and prices.");
        }
        for (const g of variationGroups) {
          if (!g.options.length) {
            throw new Error(`Add at least one option for "${g.name}".`);
          }
        }
      }

      const payload = {
        slug: slugify(form.slug.trim() || form.name.trim()),
        name: form.name.trim(),
        category_slug: form.category_slug,
        price: Number(form.price),
        variations,
        shipping_price: Number(form.shipping_price) || 0,
        stock: Number(form.stock),
        in_stock: Number(form.stock) > 0,
        rating: Number(form.rating),
        reviews: Number(form.reviews),
        image: mainImage || images[0] || "",
        images: images.length ? images : mainImage ? [mainImage] : [],
        warranty: form.warranty,
        delivery: form.delivery,
        cashback_percent: Number(form.cashback_percent) || 0,
        specs: rowsToSpecs(specRows),
      };

      if (!payload.name || !payload.slug) {
        throw new Error("Name and slug are required.");
      }
      if (!payload.image) {
        throw new Error("A main product image is required.");
      }

      if (product) {
        await apiPatch(`/products/${product.id}`, payload);
      } else {
        await apiPost("/products", payload);
      }

      await qc.invalidateQueries({ queryKey: ["admin-products"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      onSaved();
    } catch (err) {
      logClientError("ProductForm save", err, { productId: product?.id, slug: form.slug });
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async () => {
    if (!product) return;
    if (!confirm(`Delete "${product.name}"?`)) return;
    setSaving(true);
    try {
      await apiDelete(`/products/${product.id}`);
      await qc.invalidateQueries({ queryKey: ["admin-products"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Name"
          value={form.name}
          onChange={(v) =>
            setForm((f) => ({
              ...f,
              name: v,
              slug: slugManual ? f.slug : slugify(v),
            }))
          }
        />
        <div>
          <TextField
            label="Slug (URL)"
            value={form.slug}
            onChange={(v) => {
              setSlugManual(true);
              setForm({ ...form, slug: slugify(v) });
            }}
          />
          {form.slug && (
            <p className="mt-1 text-xs text-muted-foreground">
              Link: /product/{form.slug}
            </p>
          )}
        </div>
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
        <div className="sm:col-span-2 rounded-xl border border-border bg-background/50 p-4">
          <span className="text-sm font-medium">Price (FRW)</span>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="radio"
                name="pricing_mode"
                checked={pricingMode === "single"}
                onChange={() => setPricingMode("single")}
                className="h-4 w-4 accent-[oklch(0.7_0.2_45)]"
              />
              One price for this product
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="radio"
                name="pricing_mode"
                checked={pricingMode === "variation"}
                onChange={() => setPricingMode("variation")}
                className="h-4 w-4 accent-[oklch(0.7_0.2_45)]"
              />
              Price depends on variation
            </label>
          </div>
          {pricingMode === "single" ? (
            <div className="mt-3 max-w-xs">
              <TextField
                label="Amount (FRW)"
                type="number"
                value={String(form.price)}
                onChange={(v) => setForm({ ...form, price: Number(v) })}
              />
            </div>
          ) : (
            <div className="mt-3">
              <ProductVariationsEditor groups={variationGroups} onChange={setVariationGroups} />
            </div>
          )}
        </div>
        <TextField
          label="Shipping price (FRW)"
          type="number"
          min="0"
          value={String(form.shipping_price)}
          onChange={(v) => setForm({ ...form, shipping_price: Number(v) })}
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
        <TextField
          label="Cashback %"
          type="number"
          value={String(form.cashback_percent)}
          onChange={(v) => setForm({ ...form, cashback_percent: Number(v) })}
        />

        <div className="sm:col-span-2 space-y-2">
          <span className="text-sm font-medium">Main image</span>
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-semibold hover:bg-secondary/70">
              <Plus className="h-4 w-4" />
              Upload main image
              <input
                type="file"
                accept={PRODUCT_IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => handleMainUpload(e.target.files?.[0])}
              />
            </label>
            <span className="text-xs text-muted-foreground">{PRODUCT_IMAGE_HINT}</span>
            {form.image && (
              <img src={form.image} alt="preview" className="h-16 w-16 rounded-lg object-cover" />
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
                accept={PRODUCT_IMAGE_ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => {
                  handleGalleryUpload(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
            <span className="text-xs text-muted-foreground">{galleryUrls.length} photo(s)</span>
          </div>
          {galleryUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {galleryUrls.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border"
                >
                  <img src={url} alt={`Photo ${idx + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      const list = [...galleryUrls];
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

        <div className="sm:col-span-2 rounded-xl border border-border bg-background p-4">
          <SpecsEditor rows={specRows} onChange={setSpecRows} />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex flex-wrap justify-between gap-2">
        <div>
          {product && (
            <button
              type="button"
              onClick={() => void removeProduct()}
              disabled={saving}
              className="rounded-xl border border-destructive px-5 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              Delete product
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border px-5 py-2.5 font-semibold hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || uploading}
            className="rounded-xl bg-accent px-6 py-2.5 font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Saving…" : product ? "Save changes" : "Create product"}
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
