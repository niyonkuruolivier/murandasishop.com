import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useProductBySlug } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { useEffect, useState } from "react";
import { ProductGallery } from "@/components/ProductGallery";
import {
  Package,
  ShoppingCart,
  Zap,
  ShieldCheck,
  Truck,
  RotateCcw,
  BadgeCheck,
  ChevronDown,
} from "lucide-react";
import { SpecValueDisplay } from "@/components/SpecValueDisplay";
import { ProductShareButton } from "@/components/ProductShareButton";
import { usePurchasedSlugs } from "@/lib/purchased-products";
import { useAuth } from "@/lib/auth";
import { effectiveShippingPrice, productPricePrefix } from "@/lib/shipping";
import {
  allGroupsSelected,
  defaultSelections,
  formatVariationSummary,
  parseVariations,
  unitPriceForSelection,
  usesVariationPricing,
} from "@/lib/variations";

export const Route = createFileRoute("/product/$slug")({
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: product, isLoading, isError } = useProductBySlug(slug);
  const { add } = useCart();
  const { user } = useAuth();
  const { data: purchasedList = [] } = usePurchasedSlugs();
  const navigate = useNavigate();
  const [showSpecs, setShowSpecs] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!product) return;
    const v = parseVariations(product.variations);
    if (usesVariationPricing(v)) {
      setSelections(defaultSelections(v.groups));
    } else {
      setSelections({});
    }
  }, [product?.id, product?.variations]);

  if (isLoading) {
    return <main className="mx-auto max-w-7xl px-4 py-20 text-center text-muted-foreground">Loading…</main>;
  }
  if (isError || !product) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <Link to="/" className="mt-4 inline-block text-accent underline">Back to shop</Link>
      </main>
    );
  }

  const variations = parseVariations(product.variations);
  const variationPricing = usesVariationPricing(variations);
  const purchased = user ? purchasedList : [];
  let unitPrice = product.price;
  if (variationPricing) {
    try {
      unitPrice = unitPriceForSelection(variations.groups, selections);
    } catch {
      unitPrice = product.price;
    }
  }

  const shipping = product
    ? effectiveShippingPrice(product.shippingPrice, product.slug, purchased)
    : 0;
  const displayTotal = unitPrice + shipping;
  const picksComplete =
    !variationPricing || !variations || allGroupsSelected(variations.groups, selections);

  const addWithSelection = () => {
    if (!product || !picksComplete) return;
    add(product, {
      price: unitPrice,
      variationSelections: variationPricing ? selections : undefined,
      variationSummary: variationPricing ? formatVariationSummary(selections) : undefined,
    });
  };

  const handleAdd = () => addWithSelection();
  const handleBuy = () => {
    addWithSelection();
    navigate({ to: "/checkout" });
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/category/$slug" params={{ slug: product.category }} className="hover:text-foreground capitalize">
          {product.category}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} alt={product.name} />

        <div className="min-w-0">
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">{product.name}</h1>

          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <Package className="h-4 w-4 text-accent" />
              {product.stock} remaining
            </span>
            <span
              className={`flex items-center gap-1.5 font-medium ${
                product.inStock ? "text-success" : "text-destructive"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  product.inStock ? "bg-success" : "bg-destructive"
                }`}
              />
              {product.inStock ? "In Stock" : "Out of Stock"}
            </span>
          </div>

          <div className="mt-6 text-5xl font-black">
            {productPricePrefix(product)}FRW {displayTotal.toLocaleString()}
          </div>

          {variationPricing && variations && (
            <div className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5">
              {variations.groups.map((group) => (
                <div key={group.name}>
                  <div className="mb-2 text-sm font-bold capitalize">{group.name}</div>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((opt) => {
                      const active = selections[group.name] === opt.label;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() =>
                            setSelections((prev) => ({ ...prev, [group.name]: opt.label }))
                          }
                          className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${
                            active
                              ? "border-accent bg-accent text-accent-foreground"
                              : "border-border hover:border-accent/50"
                          }`}
                        >
                          {opt.label} · FRW {opt.price.toLocaleString()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!picksComplete && (
                <p className="text-sm text-destructive">Choose all options before adding to cart.</p>
              )}
            </div>
          )}

          <ProductShareButton product={product} />

          {product.cashbackPercent > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border-2 border-accent bg-accent/5 px-4 py-3">
              <span className="text-lg">💰</span>
              <span className="font-bold text-accent">
                Earn {product.cashbackPercent}% Cashback
              </span>
              <span className="text-sm text-muted-foreground">
                — up to FRW{" "}
                {Math.round((unitPrice * product.cashbackPercent) / 100).toLocaleString()} back in
                your Murandasi Cashback Wallet
              </span>
            </div>
          )}


          <div className="mt-6 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <span className="text-muted-foreground">Warranty:</span>
              <span className="font-medium">{product.warranty}</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-accent" />
              <span className="text-muted-foreground">Delivery:</span>
              <span className="font-medium">{product.delivery}</span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <button
              onClick={handleAdd}
              disabled={!product.inStock || !picksComplete}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-background py-4 font-semibold transition hover:bg-secondary disabled:opacity-40"
            >
              <ShoppingCart className="h-5 w-5" /> Add to Cart
            </button>
            <button
              onClick={handleBuy}
              disabled={!product.inStock || !picksComplete}
              className="flex items-center justify-center gap-2 rounded-xl bg-accent py-4 font-semibold text-accent-foreground transition hover:brightness-110 disabled:opacity-40"
            >
              <Zap className="h-5 w-5" /> Buy Now
            </button>
          </div>

          <div className="mt-10 rounded-2xl border border-border p-6">
            <h2 className="mb-4 text-lg font-bold">Why Buy This?</h2>
            <ul className="space-y-3 text-sm">
              {[
                { icon: BadgeCheck, text: "Genuine Product" },
                { icon: Truck, text: "Fast Delivery" },
                { icon: ShieldCheck, text: "Manufacturer Warranty" },
                { icon: RotateCcw, text: "Easy Returns" },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-success" />
                  <span className="font-medium">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => setShowSpecs((s) => !s)}
            className="mt-6 flex w-full items-center justify-between rounded-xl border border-border bg-background px-5 py-4 text-left font-semibold transition hover:bg-secondary"
          >
            View Specifications
            <ChevronDown className={`h-5 w-5 transition ${showSpecs ? "rotate-180" : ""}`} />
          </button>
          {showSpecs && (
            <div className="mt-2 rounded-xl border border-border p-6">
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {Object.entries(product.specs).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-border pb-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd>
                      <SpecValueDisplay value={v} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
