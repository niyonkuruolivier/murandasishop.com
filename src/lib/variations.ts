export type VariationOption = { label: string; price: number };
export type VariationGroup = { name: string; options: VariationOption[] };
export type ProductVariations = {
  mode: "single" | "variation";
  groups: VariationGroup[];
};

export const EMPTY_VARIATIONS: ProductVariations = { mode: "single", groups: [] };

export function parseVariations(raw: unknown): ProductVariations {
  if (!raw || typeof raw !== "object") return { mode: "single", groups: [] };
  const data = raw as Record<string, unknown>;
  const mode = data.mode === "variation" ? "variation" : "single";
  const groups = Array.isArray(data.groups)
    ? data.groups
        .map((g) => {
          const row = g as Record<string, unknown>;
          const name = String(row.name ?? "").trim();
          const options = Array.isArray(row.options)
            ? row.options
                .map((o) => {
                  const opt = o as Record<string, unknown>;
                  return {
                    label: String(opt.label ?? "").trim(),
                    price: Math.max(0, Number(opt.price) || 0),
                  };
                })
                .filter((o) => o.label)
            : [];
          return { name, options };
        })
        .filter((g) => g.name && g.options.length)
    : [];
  return { mode, groups };
}

export function usesVariationPricing(variations: ProductVariations | undefined | null): boolean {
  return variations?.mode === "variation" && (variations.groups?.length ?? 0) > 0;
}

export function minVariationUnitPrice(groups: VariationGroup[]): number {
  if (!groups.length) return 0;
  return groups.reduce((sum, group) => {
    const prices = group.options.map((o) => o.price);
    return sum + (prices.length ? Math.min(...prices) : 0);
  }, 0);
}

export function unitPriceForSelection(
  groups: VariationGroup[],
  selections: Record<string, string>,
): number {
  let total = 0;
  for (const group of groups) {
    const picked = String(selections[group.name] ?? "").trim();
    const option = group.options.find((o) => o.label === picked);
    if (!option) {
      throw new Error(`Choose ${group.name}.`);
    }
    total += option.price;
  }
  return total;
}

export function catalogUnitPrice(product: {
  price: number;
  variations?: ProductVariations | null;
}): number {
  const variations = product.variations ?? EMPTY_VARIATIONS;
  if (usesVariationPricing(variations)) {
    return minVariationUnitPrice(variations.groups);
  }
  return Math.max(0, Number(product.price) || 0);
}

export function variationCartKey(slug: string, selections: Record<string, string>): string {
  const parts = Object.keys(selections)
    .sort()
    .map((k) => `${k}:${selections[k]}`);
  return parts.length ? `${slug}::${parts.join("|")}` : slug;
}

export function formatVariationSummary(selections: Record<string, string>): string {
  return Object.values(selections)
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" · ");
}

export function defaultSelections(groups: VariationGroup[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of groups) {
    if (g.options[0]) out[g.name] = g.options[0].label;
  }
  return out;
}

export function allGroupsSelected(
  groups: VariationGroup[],
  selections: Record<string, string>,
): boolean {
  return groups.every((g) => String(selections[g.name] ?? "").trim());
}
