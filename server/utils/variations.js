export const DEFAULT_VARIATIONS = { mode: "single", groups: [] };

export function parseVariations(raw) {
  if (!raw) return { ...DEFAULT_VARIATIONS, groups: [] };
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_VARIATIONS, groups: [] };
    }
  }
  if (!data || typeof data !== "object") return { ...DEFAULT_VARIATIONS, groups: [] };
  const mode = data.mode === "variation" ? "variation" : "single";
  const groups = Array.isArray(data.groups)
    ? data.groups
        .map((g) => ({
          name: String(g?.name || "").trim(),
          options: Array.isArray(g?.options)
            ? g.options
                .map((o) => ({
                  label: String(o?.label || "").trim(),
                  price: Math.max(0, Number(o?.price) || 0),
                }))
                .filter((o) => o.label)
            : [],
        }))
        .filter((g) => g.name && g.options.length)
    : [];
  return { mode, groups };
}

export function usesVariationPricing(variations) {
  const v = parseVariations(variations);
  return v.mode === "variation" && v.groups.length > 0;
}

export function minVariationUnitPrice(groups) {
  if (!groups?.length) return 0;
  return groups.reduce((sum, group) => {
    const prices = group.options.map((o) => o.price);
    return sum + (prices.length ? Math.min(...prices) : 0);
  }, 0);
}

export function unitPriceForSelection(groups, selections) {
  if (!groups?.length) return 0;
  let total = 0;
  for (const group of groups) {
    const picked = String(selections?.[group.name] || "").trim();
    const option = group.options.find((o) => o.label === picked);
    if (!option) {
      throw new Error(`Choose ${group.name} for this product.`);
    }
    total += option.price;
  }
  return total;
}

export function catalogUnitPrice(row) {
  const price = Math.max(0, Number(row?.price) || 0);
  const variations = parseVariations(row?.variations);
  if (usesVariationPricing(variations)) {
    return minVariationUnitPrice(variations.groups);
  }
  return price;
}

export function normalizeVariationsForSave(mode, groups) {
  const parsed = parseVariations({ mode, groups });
  if (parsed.mode === "variation" && !parsed.groups.length) {
    throw new Error("Add at least one variation with options and prices.");
  }
  for (const group of parsed.groups) {
    if (!group.options.length) {
      throw new Error(`Variation "${group.name}" needs at least one option.`);
    }
  }
  return parsed;
}
