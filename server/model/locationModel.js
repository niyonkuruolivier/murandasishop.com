import { query } from "../utils/db.js";
import { uuid } from "../utils/ids.js";

function mapLocation(row) {
  return {
    ...row,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    is_default: Boolean(row.is_default),
  };
}

export async function list(userId) {
  const rows = await query(
    `SELECT * FROM saved_locations
     WHERE user_id = ?
     ORDER BY is_default DESC, created_at DESC`,
    [userId],
  );
  return rows.map(mapLocation);
}

export async function create(userId, input) {
  const id = uuid();
  const [existing] = await Promise.all([
    query("SELECT id FROM saved_locations WHERE user_id = ? LIMIT 1", [userId]),
  ]);
  const isDefault = Boolean(input.is_default) || existing.length === 0;
  if (isDefault) {
    await query("UPDATE saved_locations SET is_default = 0 WHERE user_id = ?", [userId]);
  }
  await query(
    `INSERT INTO saved_locations
      (id, user_id, label, address, city, country, latitude, longitude, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      input.label,
      input.address,
      input.city,
      input.country,
      input.latitude,
      input.longitude,
      isDefault ? 1 : 0,
    ],
  );
  const rows = await query("SELECT * FROM saved_locations WHERE id = ?", [id]);
  return mapLocation(rows[0]);
}

export async function remove(userId, id) {
  const result = await query("DELETE FROM saved_locations WHERE id = ? AND user_id = ?", [id, userId]);
  if (!result?.affectedRows) throw new Error("Delivery location not found.");
  return { ok: true };
}

export async function makeDefault(userId, id) {
  const rows = await query("SELECT id FROM saved_locations WHERE id = ? AND user_id = ?", [id, userId]);
  if (!rows.length) throw new Error("Delivery location not found.");
  await query("UPDATE saved_locations SET is_default = 0 WHERE user_id = ?", [userId]);
  await query("UPDATE saved_locations SET is_default = 1 WHERE id = ? AND user_id = ?", [id, userId]);
  return { ok: true };
}
