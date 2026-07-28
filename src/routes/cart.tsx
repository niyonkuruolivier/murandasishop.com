import { createFileRoute, Link } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart — Murandasi Shop" },
      { name: "description", content: "Review items in your cart and checkout." },
      { property: "og:title", content: "Your Cart — Murandasi Shop" },
      { property: "og:description", content: "Review items and checkout." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { detailed, setQty, remove, total } = useCart();

  if (detailed.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <ShoppingBag className="mx-auto h-16 w-16 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Browse products to get started.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-xl bg-accent px-6 py-3 font-semibold text-accent-foreground hover:brightness-110"
        >
          Start Shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-black">Your Cart</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="space-y-4">
          {detailed.map((item) => (
            <li
              key={item.id}
              className="flex gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <Link to="/product/$id" params={{ id: item.id }} className="shrink-0">
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="h-24 w-24 rounded-xl object-cover"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                  <Link
                    to="/product/$id"
                    params={{ id: item.id }}
                    className="line-clamp-2 font-semibold hover:text-accent"
                  >
                    {item.product.name}
                  </Link>
                  <div className="mt-1 text-lg font-bold">
                    ${(item.product.price * item.qty).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 rounded-full border border-border">
                    <button
                      onClick={() => setQty(item.id, item.qty - 1)}
                      className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
                      aria-label="Decrease"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center font-semibold">{item.qty}</span>
                    <button
                      onClick={() => setQty(item.id, item.qty + 1)}
                      className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
                      aria-label="Increase"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => remove(item.id)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-32">
          <h2 className="text-lg font-bold">Order Summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-medium">${total.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="font-medium text-success">Free</dd>
            </div>
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-base">
              <dt className="font-bold">Total</dt>
              <dd className="text-xl font-black">${total.toLocaleString()}</dd>
            </div>
          </dl>
          <Link
            to="/checkout"
            className="mt-6 flex items-center justify-center rounded-xl bg-accent py-4 text-base font-bold text-accent-foreground hover:brightness-110"
          >
            Checkout
          </Link>
        </aside>
      </div>
    </main>
  );
}
