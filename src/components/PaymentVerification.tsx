import { useMemo, useRef, useState } from "react";
import { Copy, Phone, Upload, X, CheckCircle2, FileText, Loader2 } from "lucide-react";
import {
  mtnUssdCode,
  mtnUssdTelHref,
  uploadPaymentProof,
  submitPaymentVerification,
} from "@/lib/payment-verification";

type Props = {
  amount: number;
  orderId?: string | null;
  resolveOrderId?: () => Promise<string | null>;
  defaultName?: string;
  defaultPhone?: string;
  defaultOrderNumber?: string;
  onDone?: () => void;
};

export function PaymentVerification({
  amount,
  orderId,
  resolveOrderId,
  defaultName = "",
  defaultPhone = "",
  defaultOrderNumber = "",
  onDone,
}: Props) {
  const [stage, setStage] = useState<"pay" | "upload" | "done">("pay");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const ussd = useMemo(() => mtnUssdCode(amount), [amount]);
  const telHref = useMemo(() => mtnUssdTelHref(amount), [amount]);

  const pickFile = (f: File | null) => {
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
    });
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(ussd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no-op */
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Please upload a screenshot of the payment confirmation.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    if (!name || !phone) {
      setError("Full name and phone number are required.");
      return;
    }
    setSubmitting(true);
    try {
      const path = await uploadPaymentProof(file);
      await submitPaymentVerification({
        customer_name: name,
        phone,
        amount,
        order_number: String(fd.get("order_number") || "") || undefined,
        note: String(fd.get("note") || "") || undefined,
        order_id: orderId ?? null,
        screenshot_url: path,
      });
      setStage("done");
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === "done") {
    return (
      <div className="rounded-2xl border border-success/40 bg-success/5 p-6 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
        <h3 className="mt-3 text-lg font-black">Payment proof submitted</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your payment proof has been submitted successfully. We will verify it shortly.
        </p>
      </div>
    );
  }

  if (stage === "pay") {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div>
          <h3 className="text-lg font-black">Pay with MTN Mobile Money</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Dial the code below on the SIM you'll pay from, or tap "Dial now" on mobile.
          </p>
        </div>

        <div className="rounded-xl border-2 border-accent bg-accent/5 p-4">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Amount: FRW {Math.max(0, Math.floor(amount || 0)).toLocaleString()}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-background px-3 py-2 font-mono text-base font-bold tracking-wider">
              {ussd}
            </code>
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
            >
              <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <a
            href={telHref}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFCC00] py-3 text-sm font-black text-black hover:brightness-105"
          >
            <Phone className="h-4 w-4" /> Dial now
          </a>
        </div>

        <button
          type="button"
          onClick={() => setStage("upload")}
          className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-accent-foreground hover:brightness-110"
        >
          Payment Completed?
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div>
        <h3 className="text-lg font-black">Upload Payment Proof</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the MTN Mobile Money confirmation SMS screenshot. JPG, PNG, or PDF.
        </p>
      </div>

      {!file ? (
        <div className="grid gap-2">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background p-8 text-center hover:border-accent hover:bg-accent/5">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-semibold">Upload from gallery</span>
            <span className="text-xs text-muted-foreground">JPG · PNG · PDF (max 10MB)</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,application/pdf"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-secondary py-3 text-sm font-semibold hover:bg-secondary/80 sm:hidden">
            <Phone className="h-4 w-4" /> Take a photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-border">
          {preview ? (
            <img src={preview} alt="Payment proof preview" className="max-h-72 w-full object-contain bg-black/5" />
          ) : (
            <div className="flex items-center gap-2 p-4 text-sm">
              <FileText className="h-5 w-5" /> {file.name}
            </div>
          )}
          <button
            type="button"
            onClick={() => pickFile(null)}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white"
          >
            <X className="h-3.5 w-3.5" /> Replace
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="name" label="Full Name" required defaultValue={defaultName} />
        <Field name="phone" label="Phone Number used for payment" required defaultValue={defaultPhone} type="tel" />
        <Field name="order_number" label="Order Number (if available)" defaultValue={defaultOrderNumber} />
        <Field name="note" label="Note (optional)" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setStage("pay")}
          className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-secondary"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Submitting…" : "Submit Payment for Verification"}
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  defaultValue = "",
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus:border-accent"
      />
    </label>
  );
}
