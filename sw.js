const CACHE_NAME = "vidhwaan-aividhya-v16";

const APP_SHELL = [
  "./",
  "./index.html",
  "./main.css",
  "./app.js",
  "./manifest.json",
  "./favicon.ico",
  "./icons/logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];


/*
 * ==========================================
 * INSTALL
 * ==========================================
 *
 * Cache only the static application shell.
 *
 * IMPORTANT:
 * cache: "reload" forces the browser to obtain
 * the latest deployed version instead of using
 * an older HTTP/browser cache entry.
 *
 * Lesson .dat files are intentionally NOT
 * cached by the service worker.
 */

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        for (const url of APP_SHELL) {
          const request = new Request(url, {
            cache: "reload"
          });

          const response = await fetch(request);

          if (!response.ok) {
            throw new Error(
              `Failed to cache app shell: ${url} (${response.status})`
            );
          }

          await cache.put(request, response);
        }
      })
      .then(() => self.skipWaiting())
  );
});


/*
 * ==========================================
 * ACTIVATE
 * ==========================================
 *
 * Remove every older service-worker cache.
 *
 * clients.claim() makes the new service worker
 * control already-open application pages
 * immediately.
 */

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});


/*
 * ==========================================
 * FETCH
 * ==========================================
 *
 * Lesson .dat files:
 *   NEVER cache in the PWA.
 *   Always request from the network.
 *
 * HTML navigation:
 *   Network first.
 *   Cached index.html as offline fallback.
 *
 * Static application resources:
 *   Cache first.
 */

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);


  /*
   * ========================================
   * LESSON DATA
   * ========================================
   *
   * Protected lesson files are encrypted
   * and compressed .dat files.
   *
   * They are intentionally excluded from
   * the service-worker cache.
   *
   * Cloudflare CDN caching is independent
   * of this service-worker behavior.
   */

  if (
    url.pathname.includes("/data/") &&
    url.pathname.endsWith(".dat")
  ) {
    event.respondWith(
      fetch(request, {
        cache: "no-store"
      })
    );

    return;
  }


  /*
   * ========================================
   * HTML NAVIGATION
   * ========================================
   *
   * Network first so updated index.html
   * can be received immediately.
   *
   * If the network is unavailable, use
   * the cached application shell.
   */

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, {
        cache: "no-store"
      })
        .then(response => {
          return response;
        })
        .catch(() => {
          return caches.match("./index.html");
        })
    );

    return;
  }


  /*
   * ========================================
   * STATIC APPLICATION RESOURCES
   * ========================================
   *
   * Cache first for fast application
   * startup and offline functionality.
   */

  event.respondWith(
    caches.match(request)
      .then(cached => {

        if (cached) {
          return cached;
        }

        return fetch(request)
          .then(response => {

            if (
              !response ||
              response.status !== 200 ||
              response.type === "opaque"
            ) {
              return response;
            }

            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, copy);
              });

            return response;
          });

      })
  );
});