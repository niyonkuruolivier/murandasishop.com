/** Turn a product name into a URL-safe slug: lowercase, hyphens, no special chars. */
export function slugify(input) {
  return (
    String(input || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "product"
  );
}

export async function uniqueProductSlug(queryFn, base, excludeId = null) {
  let slug = slugify(base);
  let attempt = slug;
  let n = 2;

  while (true) {
    const rows = excludeId
      ? await queryFn("SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1", [
          attempt,
          excludeId,
        ])
      : await queryFn("SELECT id FROM products WHERE slug = ? LIMIT 1", [attempt]);
    if (!rows.length) return attempt;
    attempt = `${slug}-${n++}`;
  }
}
