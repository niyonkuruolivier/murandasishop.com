import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ProductCard } from "@/components/ProductCard";
import { categories, getByCategory } from "@/lib/products";

export const Route = createFileRoute("/category/$slug")({
  loader: ({ params }) => {
    const cat = categories.find((c) => c.slug === params.slug);
    if (!cat) throw notFound();
    return { cat, products: getByCategory(params.slug) };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.cat.name ?? "Category";
    return {
      meta: [
        { title: `${name} — Murandasi Shop` },
        { name: "description", content: `Shop ${name} at Murandasi. Simple, fast, honest.` },
        { property: "og:title", content: `${name} — Murandasi Shop` },
        { property: "og:description", content: `Shop ${name} at Murandasi.` },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { cat, products } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-3xl">{cat.emoji}</span>
        <h1 className="text-3xl font-black">{cat.name}</h1>
      </div>
      {products.length === 0 ? (
        <div className="rounded-2xl border border-border p-12 text-center text-muted-foreground">
          No products yet. <Link to="/" className="text-accent underline">Browse all</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {products.map((p: import("@/lib/products").Product) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}
