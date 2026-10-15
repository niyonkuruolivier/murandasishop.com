import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import type { Product } from "@/lib/products";

type Props = {
  product: Product;
};

export function ProductShareButton({ product }: Props) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/product/${product.slug}`
      : `/product/${product.slug}`;

  const shareText = `${product.name} — FRW ${product.price.toLocaleString()} at Murandasi Shop`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: product.name,
          text: shareText,
          url: shareUrl,
        });
        return;
      }
      await copyLink();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      await copyLink();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-secondary disabled:opacity-60"
      >
        <Share2 className="h-4 w-4" />
        {busy ? "Sharing…" : "Share product"}
      </button>
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-secondary"
        title="Copy link"
      >
        {copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
