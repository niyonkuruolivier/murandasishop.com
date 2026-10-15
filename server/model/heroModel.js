import { query } from "../utils/db.js";
import { uuid } from "../utils/ids.js";

function map(row) {
  return { ...row, active: Boolean(row.active) };
}

export async function findActive() {
  const rows = await query(
    "SELECT * FROM hero_slides WHERE active = 1 ORDER BY sort_order ASC",
  );
  return rows.map(map);
}

export async function findAll() {
  const rows = await query("SELECT * FROM hero_slides ORDER BY sort_order ASC");
  return rows.map(map);
}

export async function create(payload) {
  const id = uuid();
  await query(
    `INSERT INTO hero_slides
      (id, image, title, highlight, cta_label, cta_href, sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.image,
      payload.title || "",
      payload.highlight || "",
      payload.cta_label || "Shop Now",
      payload.cta_href || "/search",
      payload.sort_order ?? 0,
      payload.active === false ? 0 : 1,
    ],
  );
  const rows = await query("SELECT * FROM hero_slides WHERE id = ?", [id]);
  return map(rows[0]);
}

export async function update(id, payload) {
  const fields = [];
  const values = { id };
  for (const key of ["image", "title", "highlight", "cta_label", "cta_href", "sort_order", "active"]) {
    if (payload[key] === undefined) continue;
    fields.push(`${key} = :${key}`);
    values[key] = key === "active" ? (payload[key] ? 1 : 0) : payload[key];
  }
  if (fields.length) {
    await query(`UPDATE hero_slides SET ${fields.join(", ")} WHERE id = :id`, values);
  }
  const rows = await query("SELECT * FROM hero_slides WHERE id = ?", [id]);
  return rows[0] ? map(rows[0]) : null;
}

export async function remove(id) {
  await query("DELETE FROM hero_slides WHERE id = ?", [id]);
  return { ok: true };
}
