import type { ReactNode } from "react";
import { Check, Download, MoreVertical, Share, Smartphone, X } from "lucide-react";

import { usePwaInstall } from "@/hooks/usePwaInstall";

export function PwaInstallButton() {
  const {
    showButton,
    canInstall,
    status,
    install,
    dismissHelp,
    canShowIosHint,
    canShowAndroidHint,
  } = usePwaInstall();

  if (!showButton) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {canInstall ? <Download className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
        Install Murandasi app
      </button>

      {status === "accepted" && (
        <p className="max-w-sm text-xs text-success">
          App installed. Open Murandasi from your home screen.
        </p>
      )}

      {status === "dismissed" && (
        <p className="max-w-sm text-xs text-muted-foreground">
          Install was cancelled. Tap the button again, or use the steps below.
        </p>
      )}

      {status === "ios-help" && canShowIosHint && (
        <HelpCard title="Add to Home Screen (iPhone)" onClose={dismissHelp}>
          <ol className="mt-2 space-y-1.5 text-muted-foreground">
            <li className="flex items-start gap-2">
              <Share className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Tap Share in Safari (bottom bar)
            </li>
            <li>Scroll and tap &quot;Add to Home Screen&quot;</li>
            <li>Tap Add — the Murandasi icon will appear on your home screen</li>
          </ol>
        </HelpCard>
      )}

      {(status === "android-help" || (status === "dismissed" && canShowAndroidHint)) &&
        canShowAndroidHint && (
          <HelpCard title="Install on Android" onClose={dismissHelp}>
            <ol className="mt-2 space-y-1.5 text-muted-foreground">
              <li className="flex items-start gap-2">
                <MoreVertical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Tap the browser menu (3 dots, top right)
              </li>
              <li>Tap &quot;Install app&quot; or &quot;Add to Home screen&quot;</li>
              <li>Confirm Install — check your home screen for Murandasi</li>
            </ol>
          </HelpCard>
        )}

      {status === "accepted" && (
        <span className="inline-flex items-center gap-1 text-xs text-success">
          <Check className="h-3.5 w-3.5" /> Done
        </span>
      )}
    </div>
  );
}

function HelpCard({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative max-w-sm rounded-xl border border-border bg-card px-4 py-3 text-left text-xs text-card-foreground shadow-sm">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-secondary"
        aria-label="Close install instructions"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="pr-6 font-semibold">{title}</p>
      {children}
    </div>
  );
}
