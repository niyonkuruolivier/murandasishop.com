const VERSION_KEY = "murandasi_app_version";
const GEN_KEY = "murandasi_cache_gen";
/** Keep in sync with CACHE_GEN in index.html */
const CACHE_GEN = "1";
const CHECK_MS = 5 * 60 * 1000;

let reloading = false;

/** Remove ugly ?_=123 cache-bust param from the address bar (keeps other query params). */
export function stripCacheBustParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("_")) return;
    url.searchParams.delete("_");
    const next = url.pathname + url.search + url.hash;
    window.history.replaceState(window.history.state, "", next);
  } catch {
    /* ignore */
  }
}

async function purgeServiceWorkerAndCaches() {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

function reloadOnce(reason: string, purge = false) {
  if (reloading) return;
  reloading = true;
  console.info("[Murandasi] Reloading for update:", reason);

  const run = () => window.location.reload();

  if (purge) {
    void purgeServiceWorkerAndCaches().finally(run);
  } else {
    run();
  }
}

/** Compare /version.json with last seen build id; reload when deploy changes. */
export async function checkAppVersion() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return;

    const data = (await res.json()) as { version?: string };
    const next = String(data.version || "").trim();
    if (!next) return;

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(VERSION_KEY);
    } catch {
      /* ignore */
    }

    if (!stored) {
      try {
        localStorage.setItem(VERSION_KEY, next);
      } catch {
        /* ignore */
      }
      return;
    }

    if (stored !== next) {
      try {
        localStorage.setItem(VERSION_KEY, next);
      } catch {
        /* ignore */
      }
      reloadOnce("new deploy");
    }
  } catch {
    /* offline or missing file — ignore */
  }
}

/** Poll + check when user returns to the tab. */
export function startUpdateChecks() {
  if (typeof window === "undefined") return;

  stripCacheBustParam();
  void checkAppVersion();

  window.addEventListener("focus", () => void checkAppVersion());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkAppVersion();
  });

  window.setInterval(() => void checkAppVersion(), CHECK_MS);
}

/** Register PWA service worker — reload only when an existing worker is replaced. */
export function registerAppServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Skip first install; only reload when an old worker was replaced by an update.
    if (!hadController) return;
    reloadOnce("service worker updated");
  });

  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onRegisteredSW(_url, registration) {
          if (!registration) return;
          void registration.update();
          window.setInterval(() => {
            void registration.update();
          }, CHECK_MS);
        },
      });
    })
    .catch(() => {
      /* PWA not available in dev or build without plugin */
    });
}
