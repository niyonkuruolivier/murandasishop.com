/** Runs inside the service worker — clears stale caches when a new deploy activates. */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
  );
});
