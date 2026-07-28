import { createFileRoute, Link } from "@tanstack/react-router";
import { ProductCard } from "@/components/ProductCard";
import { useCategories, useProducts } from "@/lib/products";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Murandasi Shop` },
      { name: "description", content: `Shop ${params.slug} at Murandasi. Simple, fast, honest.` },
      { property: "og:title", content: `${params.slug} — Murandasi Shop` },
      { property: "og:description", content: `Shop ${params.slug} at Murandasi.` },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data: categories = [] } = useCategories();
  const { data: allProducts = [], isLoading } = useProducts();
  const cat = categories.find((c) => c.slug === slug);
  const products = allProducts.filter((p) => p.category === slug);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-3xl">{cat?.emoji ?? "📦"}</span>
        <h1 className="text-3xl font-black">{cat?.name ?? slug}</h1>
      </div>
      {isLoading ? (
        <div className="rounded-2xl border border-border p-12 text-center text-muted-foreground">
          Loading…
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-border p-12 text-center text-muted-foreground">
          No products yet. <Link to="/" className="text-accent underline">Browse all</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 min-w-0 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {products.map((p) => (
            <div key={p.id} className="min-w-0 h-full">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
