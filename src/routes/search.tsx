import { createFileRoute, Link } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ProductCard } from "@/components/ProductCard";
import { products } from "@/lib/products";

const schema = z.object({
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(schema),
  head: () => ({
    meta: [
      { title: "Search — Murandasi Shop" },
      { name: "description", content: "Search all products at Murandasi." },
      { property: "og:title", content: "Search — Murandasi Shop" },
      { property: "og:description", content: "Find any product instantly." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const query = q.trim().toLowerCase();
  const results = query
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query),
      )
    : products;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-black">
        {query ? (
          <>
            {results.length} result{results.length === 1 ? "" : "s"} for{" "}
            <span className="text-accent">"{q}"</span>
          </>
        ) : (
          "All Products"
        )}
      </h1>
      {results.length === 0 ? (
        <div className="rounded-2xl border border-border p-12 text-center text-muted-foreground">
          Nothing found. <Link to="/" className="text-accent underline">Browse all</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}
