import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { useAuth, useAdminAccess } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading, signOut } = useAuth();
  const { data: access, isLoading: roleLoading } = useAdminAccess();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || roleLoading) {
    return <main className="mx-auto max-w-6xl px-4 py-20 text-center text-muted-foreground">Loading…</main>;
  }

  if (!user) return null;

  if (!access?.isAdmin) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-black">Not authorized</h1>
        <p className="mt-2 text-muted-foreground">
          Your account doesn&apos;t have admin access. Ask an existing admin to grant it.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </main>
    );
  }

  return <Outlet />;
}
