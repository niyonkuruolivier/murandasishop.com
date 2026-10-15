import { apiGet } from "@/lib/api";
import type { PermissionKey } from "@/lib/admin-access";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  permissions: PermissionKey[];
  blocked: boolean;
  google: boolean;
  has_password: boolean;
  approved_purchases: number;
  total_spent: number;
  created_at: string;
};

export type AdminUsersResponse = {
  users: AdminUser[];
  total: number;
  googleTotal: number;
  limit: number;
  staffOnly: boolean;
  truncated: boolean;
};

const EMPTY: AdminUsersResponse = {
  users: [],
  total: 0,
  googleTotal: 0,
  limit: 0,
  staffOnly: false,
  truncated: false,
};

function normalizeAdminUser(raw: unknown): AdminUser | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const email = String(row.email ?? "").trim();
  if (!id || !email) return null;
  const permissions = Array.isArray(row.permissions)
    ? row.permissions.filter((p): p is PermissionKey => typeof p === "string")
    : [];
  return {
    id,
    email,
    full_name: row.full_name != null ? String(row.full_name) : null,
    phone: row.phone != null ? String(row.phone) : null,
    role: String(row.role ?? "user"),
    permissions,
    blocked: Boolean(row.blocked),
    google: Boolean(row.google),
    has_password: Boolean(row.has_password),
    approved_purchases: Number(row.approved_purchases) || 0,
    total_spent: Number(row.total_spent) || 0,
    created_at: String(row.created_at ?? ""),
  };
}

/** Accepts legacy array or `{ users, total, … }` from the API. */
export function parseAdminUsersResponse(data: unknown): AdminUsersResponse {
  if (Array.isArray(data)) {
    const users = data.map(normalizeAdminUser).filter((u): u is AdminUser => u != null);
    return {
      users,
      total: users.length,
      googleTotal: users.filter((u) => u.google).length,
      limit: users.length,
      staffOnly: false,
      truncated: false,
    };
  }
  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    if (Array.isArray(row.users)) {
      const users = row.users.map(normalizeAdminUser).filter((u): u is AdminUser => u != null);
      return {
        users,
        total: Number(row.total) || users.length,
        googleTotal: Number(row.googleTotal) || 0,
        limit: Number(row.limit) || users.length,
        staffOnly: Boolean(row.staffOnly),
        truncated: Boolean(row.truncated),
      };
    }
  }
  return EMPTY;
}

export async function fetchAdminUsers(): Promise<AdminUsersResponse> {
  const data = await apiGet<unknown>("/users");
  return parseAdminUsersResponse(data);
}
