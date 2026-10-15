/** Shipping is charged once per product per user — waived on repeat purchases. */
export function shippingForLine(shippingPrice, slug, purchasedSlugs) {
  const base = Math.max(0, Number(shippingPrice) || 0);
  if (!slug || !purchasedSlugs?.has(slug)) return base;
  return 0;
}

export function lineTotal(price, shippingPrice, qty, slug, purchasedSlugs) {
  const ship = shippingForLine(shippingPrice, slug, purchasedSlugs);
  return (Math.max(0, Number(price) || 0) + ship) * Math.max(1, Number(qty) || 1);
}
