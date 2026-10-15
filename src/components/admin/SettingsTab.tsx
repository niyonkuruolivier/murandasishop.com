import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import {
  useAdminContactSettings,
  useContactSettingsActions,
} from "@/lib/site-contact";
import { DEFAULT_WHATSAPP_DISPLAY } from "@/lib/whatsapp";

export function SettingsTab() {
  const { data: contact, isLoading } = useAdminContactSettings();
  const { save } = useContactSettingsActions();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contact?.whatsapp_display) {
      setPhone(contact.whatsapp_display);
    }
  }, [contact?.whatsapp_display, contact?.whatsapp_e164]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await save(phone.trim());
      setMessage(`Saved. Customers will see ${updated.whatsapp_display} on WhatsApp.`);
      setPhone(updated.whatsapp_display);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="inline-flex items-center gap-2 text-lg font-black">
          <MessageCircle className="h-5 w-5 text-[#25D366]" /> Shop settings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Contact details shown on the storefront and used by the support assistant.
        </p>
      </div>

      <form
        onSubmit={(e) => void submit(e)}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <label className="block">
          <span className="text-sm font-medium">WhatsApp number</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={DEFAULT_WHATSAPP_DISPLAY}
            disabled={isLoading || busy}
            className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 outline-none focus:border-accent disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Rwanda examples: <strong>0784254890</strong>, <strong>+250 784 254 890</strong>, or{" "}
            <strong>250784254890</strong>. This updates the green WhatsApp button on every page.
          </p>
        </label>

        {contact?.whatsapp_display && !isLoading && (
          <p className="mt-4 text-sm text-muted-foreground">
            Current live number:{" "}
            <strong className="text-foreground">{contact.whatsapp_display}</strong>
          </p>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {message && (
          <p className="mt-3 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || isLoading || !phone.trim()}
          className="mt-5 rounded-xl bg-accent px-6 py-2.5 font-bold text-accent-foreground hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save WhatsApp number"}
        </button>
      </form>
    </div>
  );
}
