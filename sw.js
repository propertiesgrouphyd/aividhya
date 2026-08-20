const CACHE_NAME = "vidhwaan-aividhya-v12";

const APP_SHELL = [
  "./",
  "./index.html",
  "./main.css",
  "./app.js",
  "./manifest.json",
  "./favicon.ico",
  "./icon/logo.png",
  "./icon/icon-192.png",
  "./icon/icon-512.png"
];


/*
 * INSTALL
 *
 * Cache only the static application shell.
 * Daily lesson JSON files are intentionally NOT cached.
 */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});


/*
 * ACTIVATE
 *
 * Remove caches belonging to older versions.
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
 * FETCH
 *
 * Lesson JSON:
 * ALWAYS use the network.
 *
 * This is critical because GitHub Actions generates
 * a new lesson every midnight.
 */
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
   * Never service daily lesson files from the PWA cache.
   */
  if (
    url.pathname.includes("/data/") &&
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(
      fetch(request, {
        cache: "no-store"
      })
    );
    return;
  }


  /*
   * HTML navigation:
   *
   * Network first, cached app shell as fallback.
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
   * Static application resources:
   *
   * Cache first for fast startup.
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
