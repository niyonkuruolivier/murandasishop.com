import { useState } from "react";
import { Layers, Plus, X } from "lucide-react";
import type { VariationGroup } from "@/lib/variations";

type ProductVariationsEditorProps = {
  groups: VariationGroup[];
  onChange: (groups: VariationGroup[]) => void;
};

export function ProductVariationsEditor({ groups, onChange }: ProductVariationsEditorProps) {
  const [newGroupName, setNewGroupName] = useState("");
  const [draftOptions, setDraftOptions] = useState<Record<number, string>>({});

  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      alert("That variation name already exists.");
      return;
    }
    onChange([...groups, { name, options: [] }]);
    setNewGroupName("");
  };

  const removeGroup = (index: number) => {
    onChange(groups.filter((_, i) => i !== index));
  };

  const addOption = (groupIndex: number) => {
    const label = String(draftOptions[groupIndex] ?? "").trim();
    if (!label) return;
    onChange(
      groups.map((g, i) => {
        if (i !== groupIndex) return g;
        if (g.options.some((o) => o.label.toLowerCase() === label.toLowerCase())) return g;
        return { ...g, options: [...g.options, { label, price: 0 }] };
      }),
    );
    setDraftOptions((d) => ({ ...d, [groupIndex]: "" }));
  };

  const updateOptionPrice = (groupIndex: number, optionIndex: number, price: number) => {
    onChange(
      groups.map((g, i) =>
        i !== groupIndex
          ? g
          : {
              ...g,
              options: g.options.map((o, j) =>
                j === optionIndex ? { ...o, price: Math.max(0, price) } : o,
              ),
            },
      ),
    );
  };

  const removeOption = (groupIndex: number, optionIndex: number) => {
    onChange(
      groups.map((g, i) =>
        i !== groupIndex
          ? g
          : { ...g, options: g.options.filter((_, j) => j !== optionIndex) },
      ),
    );
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-4">
      <div>
        <h3 className="inline-flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
          <Layers className="h-4 w-4" /> Product variations
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Add variations like Size, Color — each option can have its own price (FRW). Customer
          picks one option per variation; prices add together.
        </p>
      </div>

      {groups.map((group, groupIndex) => (
        <div key={group.name} className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="font-semibold capitalize">{group.name}</span>
            <button
              type="button"
              onClick={() => removeGroup(groupIndex)}
              className="rounded-lg p-1 text-destructive hover:bg-destructive/10"
              aria-label={`Remove ${group.name}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {group.options.map((opt, optionIndex) => (
              <div key={opt.label} className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
                  {opt.label}
                </span>
                <span className="text-sm font-medium text-muted-foreground">FRW</span>
                <input
                  type="number"
                  min={0}
                  value={opt.price}
                  onChange={(e) =>
                    updateOptionPrice(groupIndex, optionIndex, Number(e.target.value))
                  }
                  className="h-10 w-28 rounded-lg border border-border bg-background px-3"
                />
                <button
                  type="button"
                  onClick={() => removeOption(groupIndex, optionIndex)}
                  className="rounded-lg p-1 text-destructive hover:bg-destructive/10"
                  aria-label={`Remove ${opt.label}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={draftOptions[groupIndex] ?? ""}
              onChange={(e) => setDraftOptions((d) => ({ ...d, [groupIndex]: e.target.value }))}
              placeholder="Add option (e.g. Red, XL)"
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOption(groupIndex);
                }
              }}
            />
            <button
              type="button"
              onClick={() => addOption(groupIndex)}
              className="shrink-0 rounded-lg border border-accent px-4 text-sm font-semibold text-accent hover:bg-accent/10"
            >
              Add
            </button>
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="Variation name (e.g. Color, Size)"
          className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addGroup();
            }
          }}
        />
        <button
          type="button"
          onClick={addGroup}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent px-4 font-semibold text-accent hover:bg-accent/10"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
    </div>
  );
}
