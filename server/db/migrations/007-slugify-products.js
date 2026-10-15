import { slugify } from "../../utils/slug.js";

export const name = "007_slugify_products";

export async function up(conn) {
  const [rows] = await conn.query("SELECT id, name, slug FROM products ORDER BY created_at ASC");
  const used = new Set();

  for (const row of rows) {
    const base = slugify(row.slug) || slugify(row.name) || "product";
    let attempt = base;
    let n = 2;
    while (used.has(attempt)) {
      attempt = `${base}-${n++}`;
    }
    used.add(attempt);

    if (attempt !== row.slug) {
      await conn.query("UPDATE products SET slug = ? WHERE id = ?", [attempt, row.id]);
      console.log(`[Migrate] Slug: ${row.slug} → ${attempt}`);
    }
  }
}
