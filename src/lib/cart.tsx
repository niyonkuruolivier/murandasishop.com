import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { products, type Product } from "./products";

export type CartItem = { id: string; qty: number };

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  add: (id: string, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  detailed: (CartItem & { product: Product })[];
};

const CartContext = createContext<CartContextValue | null>(null);
const KEY = "murandasi_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

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

  const add = (id: string, qty = 1) =>
    setItems((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) return prev.map((i) => (i.id === id ? { ...i, qty: i.qty + qty } : i));
      return [...prev, { id, qty }];
    });
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const setQty = (id: string, qty: number) =>
    setItems((prev) =>
      qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, qty } : i)),
    );
  const clear = () => setItems([]);

  const detailed = items
    .map((i) => {
      const product = products.find((p) => p.id === i.id);
      return product ? { ...i, product } : null;
    })
    .filter(Boolean) as (CartItem & { product: Product })[];

  const count = items.reduce((a, b) => a + b.qty, 0);
  const total = detailed.reduce((a, b) => a + b.product.price * b.qty, 0);

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
