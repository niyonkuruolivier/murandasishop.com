import { createFileRoute } from "@tanstack/react-router";
import { ProductCard } from "@/components/ProductCard";
import { products } from "@/lib/products";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Murandasi Shop — Electronics Made Simple" },
      {
        name: "description",
        content:
          "Browse phones, laptops, headphones, TVs and more. Simple prices, fast delivery.",
      },
      { property: "og:title", content: "Murandasi Shop — Electronics Made Simple" },
      { property: "og:description", content: "Shop electronics the simple way." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="sr-only">Murandasi Shop</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </main>
  );
}
