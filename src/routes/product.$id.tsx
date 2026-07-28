import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useProductBySlug } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { useState } from "react";
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
  MessageCircle,
} from "lucide-react";
import { whatsappUrl, productMessage } from "@/lib/whatsapp";

export const Route = createFileRoute("/product/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} — Murandasi Shop` },
      { name: "description", content: `Product details at Murandasi Shop.` },
      { property: "og:title", content: `Murandasi Shop` },
      { property: "og:description", content: `Product details.` },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id: slug } = Route.useParams();
  const { data: product, isLoading, isError } = useProductBySlug(slug);
  const { add } = useCart();
  const navigate = useNavigate();
  const [showSpecs, setShowSpecs] = useState(false);

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

  const handleAdd = () => add(product);
  const handleBuy = () => {
    add(product);
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

          <div className="mt-6 text-5xl font-black">${product.price.toLocaleString()}</div>

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
              disabled={!product.inStock}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-background py-4 font-semibold transition hover:bg-secondary disabled:opacity-40"
            >
              <ShoppingCart className="h-5 w-5" /> Add to Cart
            </button>
            <button
              onClick={handleBuy}
              disabled={!product.inStock}
              className="flex items-center justify-center gap-2 rounded-xl bg-accent py-4 font-semibold text-accent-foreground transition hover:brightness-110 disabled:opacity-40"
            >
              <Zap className="h-5 w-5" /> Buy Now
            </button>
          </div>

          <a
            href={whatsappUrl(productMessage(product))}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!product.inStock}
            className={`mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-4 font-semibold text-white transition hover:brightness-110 ${
              !product.inStock ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <MessageCircle className="h-5 w-5" /> Order via WhatsApp
          </a>

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
                  <div key={k} className="flex justify-between border-b border-border pb-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{String(v)}</dd>
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
