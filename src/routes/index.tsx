import { createFileRoute } from "@tanstack/react-router";
import { ProductCard } from "@/components/ProductCard";
import { Hero } from "@/components/Hero";
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
    <>
      <Hero />
      <main className="mx-auto max-w-7xl px-4 py-10" id="categories">
        <h1 className="sr-only">Murandasi Shop</h1>
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
            Featured products
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </main>
    </>
  );
}
