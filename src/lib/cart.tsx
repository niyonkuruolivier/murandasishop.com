import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "./products";

export type CartLine = {
  slug: string; // primary key in cart
  name: string;
  price: number;
  image: string;
  qty: number;
  cashbackPercent?: number;
};

type CartContextValue = {
  items: CartLine[];
  count: number;
  total: number;
  add: (
    product: Pick<Product, "slug" | "name" | "price" | "image"> & { cashbackPercent?: number },
    qty?: number,
  ) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  detailed: (CartLine & { product: { name: string; price: number; image: string } })[];
};


const CartContext = createContext<CartContextValue | null>(null);
const KEY = "murandasi_cart_v2";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const add: CartContextValue["add"] = (product, qty = 1) =>
    setItems((prev) => {
      const found = prev.find((i) => i.slug === product.slug);
      if (found)
        return prev.map((i) =>
          i.slug === product.slug
            ? { ...i, qty: i.qty + qty, cashbackPercent: product.cashbackPercent ?? i.cashbackPercent ?? 0 }
            : i,
        );
      return [
        ...prev,
        {
          slug: product.slug,
          name: product.name,
          price: product.price,
          image: product.image,
          qty,
          cashbackPercent: product.cashbackPercent ?? 0,
        },
      ];

    });

  const remove = (slug: string) => setItems((prev) => prev.filter((i) => i.slug !== slug));
  const setQty = (slug: string, qty: number) =>
    setItems((prev) =>
      qty <= 0 ? prev.filter((i) => i.slug !== slug) : prev.map((i) => (i.slug === slug ? { ...i, qty } : i)),
    );
  const clear = () => setItems([]);

  const detailed = items.map((i) => ({
    ...i,
    product: { name: i.name, price: i.price, image: i.image },
  }));

  const count = items.reduce((a, b) => a + b.qty, 0);
  const total = items.reduce((a, b) => a + b.price * b.qty, 0);

  return (
    <CartContext.Provider value={{ items, count, total, add, remove, setQty, clear, detailed }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
