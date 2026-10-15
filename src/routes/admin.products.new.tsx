import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProductForm } from "@/components/admin/ProductForm";

export const Route = createFileRoute("/admin/products/new")({
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();

  return (
    <AdminShell title="New product" requirePermission="products">
      <ProductForm
        onSaved={() => navigate({ to: "/admin" })}
        onCancel={() => navigate({ to: "/admin" })}
      />
    </AdminShell>
  );
}
