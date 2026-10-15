/** Safe list for API responses (avoids `.map is not a function` when shape differs). */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

/** Order line items are JSON — ensure an array in the UI. */
export function asOrderItems(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
    } catch {
      return [];
    }
  }
  return [];
}
