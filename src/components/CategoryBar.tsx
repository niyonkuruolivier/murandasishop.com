import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { useCategories } from "@/lib/products";

export function CategoryBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: categories = [] } = useCategories();

  return (
    <div className="sticky top-[4.5rem] z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          to="/"
          className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
            pathname === "/"
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:border-foreground"
          }`}
        >
          <LayoutGrid className="h-4 w-4" /> All
        </Link>
        {categories.map((c) => {
          const active = pathname === `/category/${c.slug}`;
          return (
            <Link
              key={c.slug}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background hover:border-foreground"
              }`}
            >
              <span className="text-base">{c.emoji}</span> {c.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
