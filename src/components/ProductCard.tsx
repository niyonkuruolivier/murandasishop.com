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
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Star className="h-4 w-4 fill-accent text-accent" />
            <span className="font-medium text-foreground">{product.rating}</span>
            <span>({product.reviews})</span>
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
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={handleAdd}
            disabled={!product.inStock}
            className={`flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold transition hover:bg-secondary disabled:opacity-40 ${
              bump ? "animate-cart-bump" : ""
            }`}
          >
            <ShoppingCart className="h-4 w-4" /> Add
          </button>
          <button
            onClick={handleBuy}
            disabled={!product.inStock}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-110 disabled:opacity-40"
          >
            <Zap className="h-4 w-4" /> Buy Now
          </button>
        </div>
      </div>
    </Link>
  );
}
