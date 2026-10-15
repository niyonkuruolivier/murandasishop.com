import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export type PermissionKey =
  | "products"
  | "orders"
  | "payments"
  | "users"
  | "categories"
  | "hero"
  | "cashback"
  | "analytics"
  | "staff";

export type PermissionDef = {
  key: PermissionKey;
  label: string;
  description: string;
};

export type AdminAccess = {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  permissions: PermissionKey[];
  permissionCatalog: PermissionDef[];
};

export const TAB_PERMISSIONS: Record<string, PermissionKey> = {
  products: "products",
  orders: "orders",
  payments: "payments",
  users: "users",
  categories: "categories",
  hero: "hero",
  cashback: "cashback",
  analytics: "analytics",
};

export function useAdminAccess() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin-access", user?.id],
    enabled: !!user,
    queryFn: () => apiGet<AdminAccess>("/profile/is-admin"),
    staleTime: 30_000,
  });
}

export function hasPermission(access: AdminAccess | undefined, key: PermissionKey): boolean {
  if (!access?.isAdmin) return false;
  if (access.isSuperAdmin) return true;
  return access.permissions.includes(key);
}

export function canSeeTab(access: AdminAccess | undefined, tab: string): boolean {
  if (!access?.isAdmin) return false;
  if (tab === "users") return hasPermission(access, "users") || hasPermission(access, "staff");
  const perm = TAB_PERMISSIONS[tab];
  return perm ? hasPermission(access, perm) : false;
}

export function firstAllowedTab(access: AdminAccess | undefined): string {
  if (!access) return "products";
  if (access.isSuperAdmin) return "products";
  for (const [tab, perm] of Object.entries(TAB_PERMISSIONS)) {
    if (access.permissions.includes(perm)) return tab;
  }
  if (hasPermission(access, "staff")) return "users";
  return "products";
}
