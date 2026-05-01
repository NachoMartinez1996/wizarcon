const CACHE_NAME = "wizarcon-v3";
const FIREBASE_CDN_PREFIX = "https://www.gstatic.com/firebasejs/10.7.1/";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./Favicon/favicon.ico",
  "./Favicon/favicon-16x16.png",
  "./Favicon/favicon-32x32.png",
  "./Favicon/favicon-96x96.png",
  "./Favicon/apple-icon.png",
  "./Favicon/android-icon-192x192.png",
];

function shouldCache(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin || url.href.startsWith(FIREBASE_CDN_PREFIX);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.ok && shouldCache(event.request)) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }

          return networkResponse;
        })
        .catch(() => cachedResponse);
    }),
  );
});
