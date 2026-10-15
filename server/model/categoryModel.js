import { query } from "../utils/db.js";
import { uuid } from "../utils/ids.js";

export async function findAll() {
  return query("SELECT * FROM categories ORDER BY sort_order ASC");
}

export async function create(payload) {
  const id = uuid();
  await query(
    `INSERT INTO categories (id, slug, name, emoji, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [id, payload.slug, payload.name, payload.emoji || "📦", payload.sort_order ?? 0],
  );
  const rows = await query("SELECT * FROM categories WHERE id = ?", [id]);
  return rows[0];
}

export async function updateBySlug(slug, payload) {
  const fields = [];
  const values = { slug };
  for (const key of ["name", "emoji", "sort_order", "slug"]) {
    if (payload[key] === undefined) continue;
    if (key === "slug") {
      fields.push("slug = :newSlug");
      values.newSlug = payload.slug;
    } else {
      fields.push(`${key} = :${key}`);
      values[key] = payload[key];
    }
  }
  if (fields.length) {
    await query(`UPDATE categories SET ${fields.join(", ")} WHERE slug = :slug`, values);
  }
  const rows = await query("SELECT * FROM categories WHERE slug = ?", [payload.slug || slug]);
  return rows[0];
}

export async function removeBySlug(slug) {
  await query("DELETE FROM categories WHERE slug = ?", [slug]);
  return { ok: true };
}
