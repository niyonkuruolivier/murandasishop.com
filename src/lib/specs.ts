export type SpecType = "text" | "color";

export type StoredSpecValue = string | { type?: SpecType; value: string };

export type ProductSpecs = Record<string, StoredSpecValue>;

export type SpecRow = {
  key: string;
  type: SpecType;
  value: string;
};

const DEFAULT_COLOR = "#000000";

export function normalizeSpec(raw: unknown): { type: SpecType; value: string } {
  if (raw && typeof raw === "object" && "value" in (raw as object)) {
    const obj = raw as { type?: string; value?: unknown };
    const type: SpecType = obj.type === "color" ? "color" : "text";
    return { type, value: String(obj.value ?? "") };
  }
  return { type: "text", value: String(raw ?? "") };
}

export function specsToRows(specs: ProductSpecs | null | undefined): SpecRow[] {
  const entries = Object.entries(specs ?? {});
  return entries.length
    ? entries.map(([key, raw]) => {
        const { type, value } = normalizeSpec(raw);
        return {
          key,
          type,
          value: type === "color" ? toPickerHex(value) : value,
        };
      })
    : [{ key: "", type: "text", value: "" }];
}

export function rowsToSpecs(rows: SpecRow[]): ProductSpecs {
  return Object.fromEntries(
    rows
      .filter((row) => row.key.trim())
      .map((row) => {
        const key = row.key.trim();
        if (row.type === "color") {
          return [key, { type: "color" as const, value: toPickerHex(row.value) }];
        }
        return [key, row.value.trim()];
      }),
  );
}

/** Normalize to #RRGGBB for the native color input and swatch rendering. */
export function toPickerHex(value: string): string {
  const v = value.trim();
  if (!v) return DEFAULT_COLOR;
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v;
  if (/^[0-9A-Fa-f]{6}$/.test(v)) return `#${v}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const h = v.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return DEFAULT_COLOR;
}

/** Swatch color for color-type specs (hex stored internally, never shown as text). */
export function cssColorForSpec(raw: StoredSpecValue): string | null {
  const { type, value } = normalizeSpec(raw);
  if (type !== "color" || !value.trim()) return null;
  return toPickerHex(value);
}
