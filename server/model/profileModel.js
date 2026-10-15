import { query } from "../utils/db.js";
import { hasRole } from "../utils/auth.js";

export async function findMine(userId) {
  const rows = await query("SELECT * FROM profiles WHERE id = ? LIMIT 1", [userId]);
  return rows[0] || null;
}

export async function listProfiles() {
  return query("SELECT id, full_name, email FROM profiles");
}

export async function checkRole(userId, role = "admin") {
  return hasRole(userId, role);
}

export async function getNotifications(userId) {
  const rows = await query(
    `SELECT * FROM notifications WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 30`,
    [userId],
  );
  return rows.map((n) => ({ ...n, read: Boolean(n.read) }));
}

export async function markNotificationsRead(ids) {
  if (!ids.length) return { ok: true };
  const placeholders = ids.map(() => "?").join(",");
  await query(`UPDATE notifications SET \`read\` = 1 WHERE id IN (${placeholders})`, ids);
  return { ok: true };
}

export async function getWhatsappPurchases(userId) {
  return query(
    `SELECT * FROM whatsapp_purchases WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId],
  );
}
