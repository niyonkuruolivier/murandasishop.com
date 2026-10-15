import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProductForm } from "@/components/admin/ProductForm";
import { useAdminProduct } from "@/lib/admin-products";

export const Route = createFileRoute("/admin/products/$productId/edit")({
  component: EditProductPage,
});

function EditProductPage() {
  const { productId } = Route.useParams();
  const navigate = useNavigate();
  const { data: product, isLoading, isError, error } = useAdminProduct(productId);

  if (isLoading) {
    return (
      <AdminShell title="Edit product" requirePermission="products">
        <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
          Loading product…
        </div>
      </AdminShell>
    );
  }

  if (isError || !product) {
    return (
      <AdminShell title="Edit product" requirePermission="products">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="font-semibold text-destructive">
            {error instanceof Error ? error.message : "Product not found."}
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/admin" })}
            className="mt-4 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Back to dashboard
          </button>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={`Edit: ${product.name}`} requirePermission="products">
      <ProductForm
        product={product}
        onSaved={() => navigate({ to: "/admin" })}
        onCancel={() => navigate({ to: "/admin" })}
      />
    </AdminShell>
  );
}
