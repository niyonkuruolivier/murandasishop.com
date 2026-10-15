import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type PwaInstallStatus = "idle" | "prompting" | "accepted" | "dismissed" | "ios-help" | "android-help";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(window.navigator.userAgent);
}

function isMobile() {
  return isIos() || isAndroid();
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandalone);
  const [status, setStatus] = useState<PwaInstallStatus>("idle");

  useEffect(() => {
    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setStatus("idle");
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setStatus("accepted");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const canInstall = Boolean(deferredPrompt);
  const canShowIosHint = isIos() && !isInstalled;
  const canShowAndroidHint = isAndroid() && !isInstalled && !deferredPrompt;

  const install = useCallback(async () => {
    if (deferredPrompt) {
      setStatus("prompting");
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        if (choice.outcome === "accepted") {
          setStatus("accepted");
        } else {
          setStatus("dismissed");
        }
      } catch {
        setStatus("android-help");
      }
      return;
    }

    if (canShowIosHint) {
      setStatus("ios-help");
      return;
    }

    if (canShowAndroidHint) {
      setStatus("android-help");
    }
  }, [canShowAndroidHint, canShowIosHint, deferredPrompt]);

  const dismissHelp = useCallback(() => {
    if (status !== "accepted") setStatus("idle");
  }, [status]);

  return {
    canInstall,
    canShowIosHint,
    canShowAndroidHint,
    status,
    isInstalled,
    install,
    dismissHelp,
    showButton: !isInstalled && (isMobile() || canInstall),
  };
}
