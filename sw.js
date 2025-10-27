const CACHE = "pwa-messenger-v14";
const ASSETS = [
  "./",
  "./index.html",
  "./main.js",
  "./config.js",
  "./manifest.json",
  "./icons/icon.png",
  "https://cdn.tailwindcss.com"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.action === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});