import { Link, useNavigate } from "@tanstack/react-router";
import { Search, ShoppingCart, Home, LayoutDashboard, User } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useAdminAccess } from "@/lib/admin-access";
import logoUrl from "@/assets/murandasi-logo.webp";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header() {
  const { count } = useCart();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { user } = useAuth();
  const { data: access } = useAdminAccess();

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/search", search: { q } });
  };

  return (
    <header className="fixed top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2 text-xl font-black tracking-tight">
          <img src={logoUrl} alt="Murandasi Shop logo" className="h-9 w-9 object-contain" />
          <span className="hidden sm:inline">Murandasi</span>
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
          <ThemeToggle />
          <Link to="/" className="rounded-full p-2.5 hover:bg-secondary sm:p-3" aria-label="Home">
            <Home className="h-5 w-5" />
          </Link>
          {access?.isAdmin && (
            <Link
              to="/admin"
              className="rounded-full p-2.5 hover:bg-secondary sm:p-3"
              aria-label="Admin"
              title="Admin dashboard"
            >
              <LayoutDashboard className="h-5 w-5" />
            </Link>
          )}
          <Link
            to={user ? "/account" : "/auth"}
            className="rounded-full p-2.5 hover:bg-secondary sm:p-3"
            aria-label={user ? "My account" : "Sign in"}
            title={user ? "My account & cashback" : "Sign in"}
          >
            <User className="h-5 w-5" />
          </Link>
          <Link
            to="/cart"
            className="relative rounded-full p-2.5 hover:bg-secondary sm:p-3"
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
    </header>
  );
}
