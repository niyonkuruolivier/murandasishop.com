import { Plus, Trash2 } from "lucide-react";
import type { SpecRow, SpecType } from "@/lib/specs";
import { toPickerHex } from "@/lib/specs";

export function SpecsEditor({
  rows,
  onChange,
}: {
  rows: SpecRow[];
  onChange: (rows: SpecRow[]) => void;
}) {
  const update = (index: number, field: keyof SpecRow, value: string) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const updateType = (index: number, type: SpecType) => {
    onChange(
      rows.map((row, i) =>
        i === index
          ? { ...row, type, value: type === "color" ? toPickerHex(row.value) : row.value }
          : row,
      ),
    );
  };

  const addRow = () => onChange([...rows, { key: "", type: "text", value: "" }]);

  const removeRow = (index: number) => {
    if (rows.length === 1) {
      onChange([{ key: "", type: "text", value: "" }]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase text-muted-foreground">Specifications</h3>
          <p className="text-xs text-muted-foreground">
            Add key/value pairs — use <strong className="text-foreground">Text</strong> for details like
            Storage or RAM, or <strong className="text-foreground">Color</strong> to pick a color visually
            (customers see the color, not a code).
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" /> Add spec
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-xl border border-border bg-background/50 p-3 sm:grid-cols-[1fr_auto_1fr_auto]"
          >
            <input
              value={row.key}
              onChange={(e) => update(index, "key", e.target.value)}
              placeholder="Key (e.g. Storage, Color)"
              className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus:border-accent"
            />

            <select
              value={row.type}
              onChange={(e) => updateType(index, e.target.value as SpecType)}
              className="h-11 rounded-lg border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-accent"
              aria-label="Value type"
            >
              <option value="text">Text</option>
              <option value="color">Color</option>
            </select>

            {row.type === "color" ? (
              <div className="flex h-11 items-center gap-3">
                <input
                  type="color"
                  value={toPickerHex(row.value)}
                  onChange={(e) => update(index, "value", e.target.value)}
                  className="h-11 w-full min-w-0 cursor-pointer rounded-lg border border-border bg-background p-1"
                  aria-label={`Pick color for ${row.key || "specification"}`}
                />
              </div>
            ) : (
              <input
                value={row.value}
                onChange={(e) => update(index, "value", e.target.value)}
                placeholder="Value (e.g. 256GB)"
                className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus:border-accent"
              />
            )}

            <button
              type="button"
              onClick={() => removeRow(index)}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-3 text-destructive hover:bg-destructive/10"
              aria-label="Remove specification"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
