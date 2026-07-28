import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, ShoppingCart, Home, LayoutGrid, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useCategories } from "@/lib/products";
import { useIsAdmin } from "@/lib/auth";
import logo from "@/assets/murandasi-logo.png.asset.json";

export function Header() {
  const { count } = useCart();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: categories = [] } = useCategories();
  const { data: isAdmin } = useIsAdmin();

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/search", search: { q } });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to="/" className="shrink-0 text-xl font-black tracking-tight">
          Murandasi<span className="text-accent">.</span>
        </Link>
        <form onSubmit={submitSearch} className="relative flex-1 max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => q && navigate({ to: "/search", search: { q } })}
            placeholder="What are you looking for?"
            className="h-12 w-full rounded-full border border-border bg-secondary pl-12 pr-4 text-base outline-none transition focus:border-accent focus:bg-background"
          />
        </form>
        <nav className="flex items-center gap-1">
          <Link to="/" className="hidden rounded-full p-3 hover:bg-secondary sm:block" aria-label="Home">
            <Home className="h-5 w-5" />
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="hidden rounded-full p-3 hover:bg-secondary sm:block"
              aria-label="Admin"
              title="Admin dashboard"
            >
              <LayoutDashboard className="h-5 w-5" />
            </Link>
          )}
          <Link
            to="/cart"
            className="relative rounded-full p-3 hover:bg-secondary"
            aria-label="Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-accent-foreground">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>

      {/* Categories */}
      <div className="border-t border-border">
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
    </header>
  );
}
