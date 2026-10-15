import { query } from "../utils/db.js";
import { rowToProduct } from "../utils/response.js";
import { uuid, parseJson } from "../utils/ids.js";
import { slugify, uniqueProductSlug } from "../utils/slug.js";
import {
  parseVariations,
  normalizeVariationsForSave,
  minVariationUnitPrice,
  usesVariationPricing,
} from "../utils/variations.js";

const runQuery = (sql, params) => query(sql, params);

function mapRow(row) {
  return rowToProduct({
    ...row,
    images: parseJson(row.images, row.image ? [row.image] : []),
    specs: parseJson(row.specs, {}),
    in_stock: Boolean(row.in_stock),
  });
}

export async function findAll() {
  const rows = await query("SELECT * FROM products ORDER BY created_at DESC");
  return rows.map(mapRow);
}

export async function findAllRaw() {
  const rows = await query("SELECT * FROM products ORDER BY created_at DESC");
  return rows.map((r) => ({
    ...r,
    images: parseJson(r.images, []),
    specs: parseJson(r.specs, {}),
    variations: parseVariations(r.variations),
    in_stock: Boolean(r.in_stock),
    price: Number(r.price),
    shipping_price: Number(r.shipping_price ?? 0),
    cashback_percent: Number(r.cashback_percent),
  }));
}

export async function findBySlug(slug) {
  const raw = decodeURIComponent(String(slug || "").trim());
  if (!raw) return null;

  let rows = await query("SELECT * FROM products WHERE slug = ? LIMIT 1", [raw]);
  if (rows[0]) return mapRow(rows[0]);

  const normalized = slugify(raw);
  if (normalized && normalized !== raw) {
    rows = await query("SELECT * FROM products WHERE slug = ? LIMIT 1", [normalized]);
    if (rows[0]) return mapRow(rows[0]);
  }

  return null;
}

export async function findRawBySlugs(slugs) {
  if (!slugs.length) return [];
  const placeholders = slugs.map(() => "?").join(",");
  return query(
    `SELECT slug, name, price, shipping_price, image, cashback_percent, variations
     FROM products WHERE slug IN (${placeholders})`,
    slugs,
  );
}

function resolveStoredPrice(payload) {
  const variations = normalizeVariationsForSave(
    payload.variations?.mode ?? "single",
    payload.variations?.groups ?? [],
  );
  if (usesVariationPricing(variations)) {
    return minVariationUnitPrice(variations.groups);
  }
  return Math.max(0, Number(payload.price) || 0);
}

export async function create(payload) {
  const id = uuid();
  const slug = await uniqueProductSlug(
    runQuery,
    payload.slug || payload.name,
  );
  const variations = normalizeVariationsForSave(
    payload.variations?.mode ?? "single",
    payload.variations?.groups ?? [],
  );
  const price = resolveStoredPrice({ ...payload, variations });
  await query(
    `INSERT INTO products
      (id, slug, name, category_slug, price, shipping_price, stock, in_stock, rating, reviews,
       image, images, warranty, delivery, specs, variations, cashback_percent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      slug,
      payload.name,
      payload.category_slug,
      price,
      payload.shipping_price ?? 0,
      payload.stock ?? 0,
      payload.in_stock ? 1 : 0,
      payload.rating ?? 4.5,
      payload.reviews ?? 0,
      payload.image,
      JSON.stringify(payload.images ?? [payload.image]),
      payload.warranty || "",
      payload.delivery || "",
      JSON.stringify(payload.specs ?? {}),
      JSON.stringify(variations),
      payload.cashback_percent ?? 0,
    ],
  );
  const rows = await query("SELECT * FROM products WHERE id = ?", [id]);
  return mapRow(rows[0]);
}

export async function update(id, payload) {
  const fields = [];
  const values = {};
  const allowed = [
    "slug",
    "name",
    "category_slug",
    "price",
    "shipping_price",
    "stock",
    "in_stock",
    "rating",
    "reviews",
    "image",
    "images",
    "warranty",
    "delivery",
    "specs",
    "variations",
    "cashback_percent",
  ];
  if (payload.variations !== undefined) {
    payload.variations = normalizeVariationsForSave(
      payload.variations?.mode ?? "single",
      payload.variations?.groups ?? [],
    );
    payload.price = resolveStoredPrice(payload);
    fields.push("price = :price");
    values.price = payload.price;
  } else if (payload.price !== undefined) {
    const rows = await query("SELECT variations FROM products WHERE id = ? LIMIT 1", [id]);
    const existing = parseVariations(rows[0]?.variations);
    if (!usesVariationPricing(existing)) {
      fields.push("price = :price");
      values.price = Math.max(0, Number(payload.price) || 0);
    }
  }
  for (const key of allowed) {
    if (payload[key] === undefined) continue;
    if (key === "price" && values.price !== undefined) continue;
    fields.push(`${key} = :${key}`);
    if (key === "images" || key === "specs" || key === "variations") {
      values[key] = JSON.stringify(payload[key]);
    } else if (key === "in_stock") values[key] = payload[key] ? 1 : 0;
    else if (key === "slug") {
      values[key] = await uniqueProductSlug(runQuery, payload.slug || payload.name, id);
    } else values[key] = payload[key];
  }
  if (!fields.length) return findByIdMapped(id);
  values.id = id;
  await query(`UPDATE products SET ${fields.join(", ")} WHERE id = :id`, values);
  return findByIdMapped(id);
}

async function findByIdMapped(id) {
  const rows = await query("SELECT * FROM products WHERE id = ?", [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function remove(id) {
  await query("DELETE FROM products WHERE id = ?", [id]);
  return { ok: true };
}
