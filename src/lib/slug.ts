/** Turn a product name into a URL-safe slug: lowercase, hyphens, no special chars. */
export function slugify(input: string): string {
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
