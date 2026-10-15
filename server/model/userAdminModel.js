import { query } from "../utils/db.js";
import { getConnection } from "../utils/db.js";
import { hashPassword, hasRole } from "../utils/auth.js";
import { uuid } from "../utils/ids.js";
import { generateReferralCode } from "../utils/referralCode.js";
import { ensureWallet } from "../utils/wallet.js";
import {
  getStoredPermissions,
  normalizePermissions,
  setUserPermissions,
  isSuperAdmin,
} from "../utils/permissions.js";

async function permissionsForUsers(userIds) {
  if (!userIds.length) return new Map();
  const placeholders = userIds.map(() => "?").join(",");
  const rows = await query(
    `SELECT user_id, permission FROM user_permissions WHERE user_id IN (${placeholders})`,
    userIds,
  );
  const map = new Map();
  for (const row of rows) {
    const list = map.get(row.user_id) || [];
    list.push(row.permission);
    map.set(row.user_id, list);
  }
  return map;
}

function mapUser(row, permissions = []) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name || null,
    phone: row.phone || null,
    role: row.role || "user",
    permissions,
    blocked: Boolean(row.blocked),
    google: Boolean(row.google_id),
    has_password: Boolean(row.password_hash),
    approved_purchases: Number(row.approved_purchases || 0),
    total_spent: Number(row.total_spent || 0),
    created_at: row.created_at,
  };
}

const USER_ROLE_SQL = `(SELECT ur.role FROM user_roles ur WHERE ur.user_id = u.id
  ORDER BY FIELD(ur.role, 'admin', 'staff', 'user') LIMIT 1)`;

async function fetchUserRows({ q = "", limit = 500, staffOnly = false } = {}) {
  const term = String(q || "").trim();
  const cap = Math.min(Math.max(Number(limit) || 500, 1), 2000);
  const staffClause = staffOnly
    ? ` AND EXISTS (SELECT 1 FROM user_roles ur2 WHERE ur2.user_id = u.id AND ur2.role = 'staff')`
    : "";
  const roleSelect = `COALESCE(${USER_ROLE_SQL}, 'user') AS role`;

  if (term) {
    const like = `%${term}%`;
    return query(
      `SELECT u.id, u.email, u.google_id, u.password_hash, u.blocked, u.created_at,
              p.full_name, p.phone, p.approved_purchases, p.total_spent,
              ${roleSelect}
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       WHERE (u.email LIKE ? OR p.full_name LIKE ? OR p.phone LIKE ?)${staffClause}
       ORDER BY u.created_at DESC
       LIMIT ?`,
      [like, like, like, cap],
    );
  }
  return query(
    `SELECT u.id, u.email, u.google_id, u.password_hash, u.blocked, u.created_at,
            p.full_name, p.phone, p.approved_purchases, p.total_spent,
            ${roleSelect}
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     WHERE 1=1${staffClause}
     ORDER BY u.created_at DESC
     LIMIT ?`,
    [cap],
  );
}

export async function countUsers({ staffOnly = false } = {}) {
  if (staffOnly) {
    const rows = await query(
      `SELECT COUNT(DISTINCT u.id) AS total
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'staff'`,
    );
    return { total: Number(rows[0]?.total || 0), googleTotal: 0 };
  }
  const [allRows, googleRows] = await Promise.all([
    query("SELECT COUNT(*) AS total FROM users"),
    query(
      "SELECT COUNT(*) AS total FROM users WHERE google_id IS NOT NULL AND google_id <> ''",
    ),
  ]);
  return {
    total: Number(allRows[0]?.total || 0),
    googleTotal: Number(googleRows[0]?.total || 0),
  };
}

export async function listUsers({ q = "", limit = 500, staffOnly = false } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 500, 1), 2000);
  const [{ total, googleTotal }, rows] = await Promise.all([
    countUsers({ staffOnly }),
    fetchUserRows({ q, limit: cap, staffOnly }),
  ]);
  const permMap = await permissionsForUsers(rows.map((r) => r.id));
  const users = rows.map((row) => mapUser(row, permMap.get(row.id) || []));
  return {
    users,
    total,
    googleTotal,
    limit: cap,
    staffOnly,
    truncated: !q.trim() && users.length < total,
  };
}

export async function createStaffUser(
  { email, password, full_name, phone, permissions },
  actorId,
) {
  const cleanEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("A valid email is required.");
  if (!password || String(password).length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const normalizedPerms = normalizePermissions(permissions);
  if (!normalizedPerms.length) {
    throw new Error("Select at least one permission for this staff account.");
  }

  const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [cleanEmail]);
  if (existing.length) throw new Error("Email already registered.");

  const id = uuid();
  const password_hash = await hashPassword(password);
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
      [id, cleanEmail, password_hash],
    );
    await conn.query(
      `INSERT INTO profiles (id, email, full_name, phone, referral_code)
       VALUES (?, ?, ?, ?, ?)`,
      [id, cleanEmail, full_name || null, phone || null, generateReferralCode()],
    );
    await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'staff')", [
      uuid(),
      id,
    ]);
    await ensureWallet(conn, id);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  await setUserPermissions(id, normalizedPerms);
  const created = await listUsersByIds([id]);
  return created[0];
}

export async function updateStaffPermissions(userId, permissions, actorId) {
  if (userId === actorId && !(await isSuperAdmin(actorId))) {
    throw new Error("You cannot change your own permissions.");
  }
  if (await hasRole(userId, "admin")) {
    throw new Error("Full admin accounts always have all permissions.");
  }
  if (!(await hasRole(userId, "staff"))) {
    throw new Error("Permissions can only be set on staff accounts.");
  }

  const normalized = normalizePermissions(permissions);
  if (!normalized.length) throw new Error("Staff must keep at least one permission.");

  await setUserPermissions(userId, normalized);
  const updated = await listUsersByIds([userId]);
  return updated[0];
}

export async function setBlocked(id, blocked, actorId) {
  if (!id) throw new Error("Invalid user id.");
  if (id === actorId) throw new Error("You cannot block yourself.");

  const rows = await query("SELECT id, blocked FROM users WHERE id = ? LIMIT 1", [id]);
  if (!rows[0]) throw new Error("User not found.");

  if (blocked && (await hasRole(id, "admin"))) {
    const admins = await query("SELECT COUNT(*) AS c FROM user_roles WHERE role = 'admin'");
    if (Number(admins[0]?.c || 0) <= 1) {
      throw new Error("Cannot block the last admin.");
    }
  }

  await query("UPDATE users SET blocked = ? WHERE id = ?", [blocked ? 1 : 0, id]);
  const updated = await listUsersByIds([id]);
  return updated[0];
}

export async function removeUser(id, actorId) {
  if (!id) throw new Error("Invalid user id.");
  if (id === actorId) throw new Error("You cannot delete yourself.");

  const rows = await query("SELECT id FROM users WHERE id = ? LIMIT 1", [id]);
  if (!rows[0]) throw new Error("User not found.");

  if (await hasRole(id, "admin")) {
    const admins = await query("SELECT COUNT(*) AS c FROM user_roles WHERE role = 'admin'");
    if (Number(admins[0]?.c || 0) <= 1) {
      throw new Error("Cannot delete the last admin.");
    }
  }

  await query("DELETE FROM users WHERE id = ?", [id]);
  return { ok: true, id };
}

async function listUsersByIds(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = await query(
    `SELECT u.id, u.email, u.google_id, u.password_hash, u.blocked, u.created_at,
            p.full_name, p.phone, p.approved_purchases, p.total_spent,
            COALESCE(${USER_ROLE_SQL}, 'user') AS role
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     WHERE u.id IN (${placeholders})`,
    ids,
  );
  const permMap = await permissionsForUsers(ids);
  return rows.map((row) => mapUser(row, permMap.get(row.id) || []));
}

export async function getPermissionCatalog() {
  const { PERMISSION_DEFS } = await import("../utils/permissions.js");
  return PERMISSION_DEFS;
}
