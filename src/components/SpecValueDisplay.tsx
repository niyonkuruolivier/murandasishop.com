import type { StoredSpecValue } from "@/lib/specs";
import { cssColorForSpec, normalizeSpec } from "@/lib/specs";

export function SpecValueDisplay({ value }: { value: StoredSpecValue }) {
  const { type } = normalizeSpec(value);

  if (type === "color") {
    const swatch = cssColorForSpec(value);
    if (!swatch) return <span className="text-muted-foreground">—</span>;
    return (
      <span
        className="inline-block h-6 w-6 rounded-full border border-border shadow-sm"
        style={{ backgroundColor: swatch }}
        title="Product color"
        aria-label="Product color"
      />
    );
  }

  const { value: text } = normalizeSpec(value);
  return <span className="font-medium">{text}</span>;
}
