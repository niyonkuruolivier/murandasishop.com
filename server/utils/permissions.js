import { query } from "./db.js";

export const PERMISSION_DEFS = [
  { key: "products", label: "Products", description: "Create, edit, and delete products & images" },
  { key: "orders", label: "Orders", description: "View and update order & delivery status" },
  { key: "payments", label: "Payments", description: "Manage MoMo collections and payouts" },
  { key: "users", label: "Customers", description: "Block or delete customer accounts" },
  { key: "categories", label: "Categories", description: "Manage product categories" },
  { key: "hero", label: "Hero slides", description: "Manage homepage hero banners" },
  { key: "cashback", label: "Cashback", description: "Wallets, cashback settings, and adjustments" },
  { key: "analytics", label: "Analytics", description: "View sales dashboard" },
  { key: "staff", label: "Staff accounts", description: "Create staff and assign permissions" },
];

export const PERMISSION_KEYS = PERMISSION_DEFS.map((p) => p.key);

const KEY_SET = new Set(PERMISSION_KEYS);

export function normalizePermissions(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((p) => String(p || "").trim()).filter((p) => KEY_SET.has(p)))];
}

async function hasRole(userId, role = "admin") {
  const rows = await query(
    "SELECT id FROM user_roles WHERE user_id = ? AND role = ? LIMIT 1",
    [userId, role],
  );
  return rows.length > 0;
}

export async function isSuperAdmin(userId) {
  return hasRole(userId, "admin");
}

export async function getStoredPermissions(userId) {
  const rows = await query(
    "SELECT permission FROM user_permissions WHERE user_id = ? ORDER BY permission",
    [userId],
  );
  return rows.map((r) => r.permission);
}

export async function getEffectivePermissions(userId) {
  if (await hasRole(userId, "admin")) return [...PERMISSION_KEYS];
  return getStoredPermissions(userId);
}

export async function canAccessAdminPanel(userId) {
  if (await hasRole(userId, "admin")) return true;
  const perms = await getStoredPermissions(userId);
  return perms.length > 0;
}

export async function userHasPermission(userId, permission) {
  if (await hasRole(userId, "admin")) return true;
  if (!KEY_SET.has(permission)) return false;
  const rows = await query(
    "SELECT 1 FROM user_permissions WHERE user_id = ? AND permission = ? LIMIT 1",
    [userId, permission],
  );
  return rows.length > 0;
}

export async function setUserPermissions(userId, permissions) {
  const normalized = normalizePermissions(permissions);
  await query("DELETE FROM user_permissions WHERE user_id = ?", [userId]);
  for (const permission of normalized) {
    await query("INSERT INTO user_permissions (user_id, permission) VALUES (?, ?)", [
      userId,
      permission,
    ]);
  }
  return normalized;
}
