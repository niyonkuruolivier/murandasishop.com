import { useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { uploadOrderShippingAttachment } from "@/lib/upload";

type ShippedAttachmentModalProps = {
  open: boolean;
  customerName: string;
  onCancel: () => void;
  onConfirm: (attachmentPath: string) => Promise<void>;
};

export function ShippedAttachmentModal({
  open,
  customerName,
  onCancel,
  onConfirm,
}: ShippedAttachmentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const resetFile = () => {
    setFile(null);
    setPreview(null);
    setError(null);
  };

  const handleClose = () => {
    if (busy) return;
    resetFile();
    onCancel();
  };

  const onPickFile = (picked: File | undefined) => {
    if (!picked) return;
    setError(null);
    setFile(picked);
    if (picked.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(picked));
    } else {
      setPreview(null);
    }
  };

  const submit = async () => {
    if (!file) {
      setError("Choose a photo or PDF to attach.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = await uploadOrderShippingAttachment(file);
      await onConfirm(path);
      resetFile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ship-attachment-title"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="ship-attachment-title" className="text-lg font-bold">
              Mark as shipped
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Attach delivery proof for <strong className="text-foreground">{customerName}</strong>{" "}
              (photo or PDF).
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-lg p-1 hover:bg-secondary disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-background px-4 py-8 transition hover:border-accent">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <span className="mt-2 text-sm font-semibold">
            {file ? file.name : "Choose image or PDF"}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP, GIF, or PDF · max 12 MB</span>
          <input
            type="file"
            accept="image/*,.pdf,application/pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              onPickFile(e.target.files?.[0]);
              e.currentTarget.value = "";
            }}
          />
        </label>

        {preview && (
          <img src={preview} alt="Preview" className="mt-3 max-h-40 w-full rounded-lg object-contain" />
        )}
        {file && !preview && file.type === "application/pdf" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
            <FileText className="h-5 w-5 shrink-0" />
            PDF ready to upload
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !file}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-sm font-bold text-accent-foreground hover:brightness-110 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save & mark shipped
          </button>
        </div>
      </div>
    </div>
  );
}
