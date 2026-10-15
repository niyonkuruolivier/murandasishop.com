import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { hasPermission, useAdminAccess, type PermissionKey } from "@/lib/admin-access";

export function AdminShell({
  title,
  children,
  requirePermission,
}: {
  title: string;
  children: ReactNode;
  requirePermission?: PermissionKey;
}) {
  const { user, loading, signOut } = useAuth();
  const { data: access, isLoading: roleLoading } = useAdminAccess();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || roleLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-20 text-center text-muted-foreground">Loading…</main>
    );
  }

  if (!user) return null;

  if (!access?.isAdmin) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-black">Not authorized</h1>
        <p className="mt-2 text-muted-foreground">Your account doesn&apos;t have admin access.</p>
        <button
          onClick={() => signOut()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </main>
    );
  }

  if (requirePermission && !hasPermission(access, requirePermission)) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-black">Not authorized</h1>
        <p className="mt-2 text-muted-foreground">
          You don&apos;t have permission to manage this section.
        </p>
        <Link to="/admin" className="mt-6 inline-block text-sm font-semibold text-accent hover:underline">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link
          to="/admin"
          className="text-sm font-semibold text-accent hover:underline"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-black">{title}</h1>
        <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
      </div>
      {children}
    </main>
  );
}
