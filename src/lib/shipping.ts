import type { Product } from "@/lib/products";
import { catalogUnitPrice, usesVariationPricing } from "@/lib/variations";

export function hasPurchasedBefore(slug: string, purchasedSlugs: Set<string> | string[]) {
  const set = purchasedSlugs instanceof Set ? purchasedSlugs : new Set(purchasedSlugs);
  return set.has(slug);
}

/** Shipping charged only on first purchase of a product (per logged-in user). */
export function effectiveShippingPrice(
  shippingPrice: number,
  slug: string,
  purchasedSlugs: Set<string> | string[],
) {
  return hasPurchasedBefore(slug, purchasedSlugs) ? 0 : Math.max(0, shippingPrice || 0);
}

/** Price shown to customer — includes shipping on first buy, product price only on repeat. */
export function productDisplayPrice(
  product: Pick<Product, "price" | "shippingPrice" | "slug" | "variations">,
  purchasedSlugs: Set<string> | string[],
) {
  const ship = effectiveShippingPrice(product.shippingPrice, product.slug, purchasedSlugs);
  return catalogUnitPrice(product) + ship;
}

export function productPricePrefix(product: Pick<Product, "variations">): string {
  return usesVariationPricing(product.variations) ? "From " : "";
}

export function cartLineTotal(
  line: { price: number; shippingPrice: number; slug: string; qty: number },
  purchasedSlugs: Set<string> | string[],
) {
  const ship = effectiveShippingPrice(line.shippingPrice, line.slug, purchasedSlugs);
  return (line.price + ship) * line.qty;
}
