import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product } from "./products";
import { useAuth } from "./auth";
import { usePurchasedSlugs } from "./purchased-products";
import { cartLineTotal, effectiveShippingPrice } from "./shipping";
import { variationCartKey } from "./variations";

export type CartLine = {
  lineId: string;
  slug: string;
  name: string;
  price: number;
  shippingPrice: number;
  image: string;
  qty: number;
  cashbackPercent?: number;
  variationSelections?: Record<string, string>;
  variationSummary?: string;
};

export type AddToCartOptions = {
  qty?: number;
  price?: number;
  variationSelections?: Record<string, string>;
  variationSummary?: string;
};

type CartContextValue = {
  items: CartLine[];
  count: number;
  subtotal: number;
  shippingTotal: number;
  total: number;
  purchasedSlugs: Set<string>;
  add: (
    product: Pick<Product, "slug" | "name" | "price" | "shippingPrice" | "image"> & {
      cashbackPercent?: number;
    },
    options?: AddToCartOptions,
  ) => void;
  remove: (lineId: string) => void;
  setQty: (lineId: string, qty: number) => void;
  clear: () => void;
  lineTotal: (line: CartLine) => number;
  detailed: (CartLine & { product: { name: string; price: number; image: string } })[];
};

const CartContext = createContext<CartContextValue | null>(null);
const KEY = "murandasi_cart_v3";

function normalizeStoredLine(raw: Partial<CartLine> & { slug: string }): CartLine {
  const selections = raw.variationSelections;
  const lineId =
    raw.lineId ||
    (selections ? variationCartKey(raw.slug, selections) : raw.slug);
  return {
    lineId,
    slug: raw.slug,
    name: raw.name ?? raw.slug,
    price: Number(raw.price) || 0,
    shippingPrice: Number(raw.shippingPrice) || 0,
    image: raw.image ?? "",
    qty: Math.max(1, Number(raw.qty) || 1),
    cashbackPercent: raw.cashbackPercent,
    variationSelections: selections,
    variationSummary: raw.variationSummary,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: purchasedList = [] } = usePurchasedSlugs();
  const purchasedSlugs = useMemo(
    () => new Set(user ? purchasedList : []),
    [user, purchasedList],
  );
  const [items, setItems] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
      if (!raw) {
        const legacy = localStorage.getItem("murandasi_cart_v2");
        if (legacy) {
          const parsed = JSON.parse(legacy) as Partial<CartLine>[];
          if (Array.isArray(parsed)) {
            setItems(parsed.map((i) => normalizeStoredLine(i as CartLine)));
          }
        }
        return;
      }
      const parsed = JSON.parse(raw) as Partial<CartLine>[];
      if (Array.isArray(parsed)) {
        setItems(parsed.map((i) => normalizeStoredLine(i as CartLine)));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const add: CartContextValue["add"] = (product, options) => {
    const qty = options?.qty ?? 1;
    const selections = options?.variationSelections;
    const lineId = selections
      ? variationCartKey(product.slug, selections)
      : product.slug;
    const unitPrice = options?.price ?? product.price;
    const variationSummary = options?.variationSummary;

    setItems((prev) => {
      const found = prev.find((i) => i.lineId === lineId);
      if (found) {
        return prev.map((i) =>
          i.lineId === lineId
            ? {
                ...i,
                qty: i.qty + qty,
                price: unitPrice,
                shippingPrice: product.shippingPrice ?? i.shippingPrice ?? 0,
                cashbackPercent: product.cashbackPercent ?? i.cashbackPercent ?? 0,
              }
            : i,
        );
      }
      const displayName = variationSummary
        ? `${product.name} (${variationSummary})`
        : product.name;
      return [
        ...prev,
        {
          lineId,
          slug: product.slug,
          name: displayName,
          price: unitPrice,
          shippingPrice: product.shippingPrice ?? 0,
          image: product.image,
          qty,
          cashbackPercent: product.cashbackPercent ?? 0,
          variationSelections: selections,
          variationSummary,
        },
      ];
    });
  };

  const remove = (lineId: string) => setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  const setQty = (lineId: string, qty: number) =>
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.lineId !== lineId)
        : prev.map((i) => (i.lineId === lineId ? { ...i, qty } : i)),
    );
  const clear = () => setItems([]);

  const lineTotalFn = (line: CartLine) => cartLineTotal(line, purchasedSlugs);

  const detailed = items.map((i) => ({
    ...i,
    product: { name: i.name, price: i.price, image: i.image },
  }));

  const count = items.reduce((a, b) => a + b.qty, 0);
  const subtotal = items.reduce((a, b) => a + b.price * b.qty, 0);
  const shippingTotal = items.reduce(
    (a, b) => a + effectiveShippingPrice(b.shippingPrice, b.slug, purchasedSlugs) * b.qty,
    0,
  );
  const total = items.reduce((a, b) => a + lineTotalFn(b), 0);

  return (
    <CartContext.Provider
      value={{
        items,
        count,
        subtotal,
        shippingTotal,
        total,
        purchasedSlugs,
        add,
        remove,
        setQty,
        clear,
        lineTotal: lineTotalFn,
        detailed,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
