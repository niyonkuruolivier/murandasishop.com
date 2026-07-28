import { Link, useNavigate } from "@tanstack/react-router";
import { Package, ShoppingCart, Zap } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/lib/products";
import { useCart } from "@/lib/cart";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const navigate = useNavigate();
  const [bump, setBump] = useState(false);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    add(product);
    setBump(true);
    setTimeout(() => setBump(false), 350);
  };

  const handleBuy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    add(product);
    navigate({ to: "/checkout" });
  };

  return (
    <Link
      to="/product/$id"
      params={{ id: product.slug }}
      className="group block rounded-2xl border border-border bg-card p-4 transition hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className="aspect-square overflow-hidden rounded-xl bg-secondary">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      <div className="mt-4 space-y-2">
        <h3 className="line-clamp-2 min-h-[3rem] text-base font-semibold">{product.name}</h3>
        <div className="text-2xl font-bold">${product.price.toLocaleString()}</div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5 text-sm leading-none">
            <span className="flex items-center gap-1 font-medium text-muted-foreground">
              <Package className="h-3.5 w-3.5 text-accent" />
              {product.stock} remaining
            </span>
            <span
              className={`flex items-center gap-1 font-medium ${
                product.inStock ? "text-success" : "text-destructive"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  product.inStock ? "bg-success" : "bg-destructive"
                }`}
              />
              {product.inStock ? "In Stock" : "Out of Stock"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={!product.inStock}
              aria-label="Add to cart"
              className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background transition hover:bg-secondary disabled:opacity-40 ${
                bump ? "animate-cart-bump" : ""
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
            <button
              onClick={handleBuy}
              disabled={!product.inStock}
              className="flex h-9 items-center justify-center gap-1 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-foreground transition hover:brightness-110 disabled:opacity-40"
            >
              <Zap className="h-4 w-4" /> Buy
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
