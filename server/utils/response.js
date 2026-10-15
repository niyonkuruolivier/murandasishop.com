export function ok(res, data, status = 200) {
  return res.status(status).json(data);
}

export function fail(res, error, status = 400) {
  const message = error instanceof Error ? error.message : String(error ?? "Request failed.");
  return res.status(status).json({ error: message });
}

import { parseVariations, catalogUnitPrice } from "./variations.js";

export function rowToProduct(row) {
  const variations = parseVariations(row.variations);
  const listPrice = catalogUnitPrice(row);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category_slug,
    price: listPrice,
    basePrice: Number(row.price),
    shippingPrice: Number(row.shipping_price ?? 0),
    stock: row.stock ?? 0,
    inStock: row.in_stock && (row.stock ?? 0) > 0,
    rating: Number(row.rating ?? 4.5),
    reviews: row.reviews ?? 0,
    image: row.image,
    images: row.images && row.images.length > 0 ? row.images : [row.image],
    warranty: row.warranty,
    delivery: row.delivery,
    specs: row.specs ?? {},
    variations,
    cashbackPercent: Number(row.cashback_percent ?? 0),
  };
}
