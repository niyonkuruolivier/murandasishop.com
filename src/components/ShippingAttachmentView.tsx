import { FileText, Truck } from "lucide-react";
import { publicUploadUrl } from "@/lib/api";

type ShippingAttachmentViewProps = {
  url: string | null | undefined;
  /** Shown on the customer account pages */
  forCustomer?: boolean;
};

export function ShippingAttachmentView({ url, forCustomer = false }: ShippingAttachmentViewProps) {
  const href = publicUploadUrl(url);
  if (!href || !url) return null;

  const isPdf = /\.pdf$/i.test(url);
  const title = forCustomer ? "Your delivery proof" : "Shipping attachment";
  const pdfLabel = forCustomer ? "Open delivery proof (PDF)" : "View PDF";

  return (
    <div className="mt-3 rounded-xl border border-border bg-background/50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        {forCustomer && <Truck className="h-3.5 w-3.5" />}
        {title}
      </div>
      {isPdf ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-accent hover:underline"
        >
          <FileText className="h-4 w-4" /> {pdfLabel}
        </a>
      ) : (
        <a href={href} target="_blank" rel="noreferrer" className="mt-2 block" title="Open full size">
          <img
            src={href}
            alt={forCustomer ? "Delivery proof from Murandasi Shop" : "Shipping proof"}
            className="max-h-56 w-full rounded-lg object-contain"
            loading="lazy"
          />
        </a>
      )}
      {forCustomer && (
        <p className="mt-2 text-xs text-muted-foreground">
          Tap the {isPdf ? "link" : "image"} to open it in a new tab.
        </p>
      )}
    </div>
  );
}
