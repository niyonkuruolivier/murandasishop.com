import { createFileRoute } from "@tanstack/react-router";
import { ProductCard } from "@/components/ProductCard";
import { Hero } from "@/components/Hero";
import { useProducts } from "@/lib/products";

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
      { property: "og:description", content: "Browse phones, laptops, headphones, TVs and more. Simple prices, fast delivery." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: products = [], isLoading } = useProducts();
  return (
    <>
      <Hero />
      {/* <section className="mx-auto max-w-7xl px-4 pt-8" aria-labelledby="about-murandasi">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 id="about-murandasi" className="text-xl font-black">
            Shop electronics online in Rwanda
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Murandasi Shop is an online marketplace for phones, laptops,
            headphones, TVs, and other electronics. Browse products and prices,
            place an order, select a delivery location, and pay securely using
            Mobile Money. You can shop without an account; signing in adds
            access to order history, cashback, and referral rewards.
          </p>
        </div>
      </section> */}
      <main className="mx-auto max-w-7xl px-4 py-10" id="categories">
        <h1 className="sr-only">Murandasi Shop</h1>
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
            Featured products
          </h2>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 min-w-0 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square min-w-0 animate-pulse rounded-2xl bg-secondary" />
            ))}
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
    </>
  );
}
