// MoneTrip offline cache (service worker).
//
// - The page itself (index.html) comes from the cache right away and is refreshed in
//   the background. When the refreshed copy differs (a new deploy), open pages get a
//   message and offer a reload.
// - Files with a ?v= number (app.js, style.css, the modules) never change under the
//   same URL, so they come straight from the cache. tools/bump-version.py gives every
//   deploy new numbers; old copies are removed as new ones arrive.
// - Fonts, icons and the Firebase SDK (fixed version in its URL) also come from the
//   cache. Data requests (Firestore, sign-in, exchange rates) are never touched here.

const CACHE = "monetrip-v1";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add("./")).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("monetrip-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const ROOT = new URL("./", location).pathname; // "/monetrip/"
const APP_PAGES = new Set([ROOT, ROOT + "index.html"]);
const FIREBASE_SDK = /^https:\/\/www\.gstatic\.com\/firebasejs\/\d/;
const STATIC_EXT = /\.(js|css|woff2|png|svg|ico|webmanifest)$/;

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Only the app's own page; other pages on this site (e.g. the /preview/ try-out copy) load as usual.
  if (req.mode === "navigate") { if (url.origin === location.origin && APP_PAGES.has(url.pathname)) e.respondWith(pageCachedThenRefresh(e)); return; }
  if (url.pathname.startsWith(ROOT + "preview/")) return; // the try-out copy is never cached
  if (FIREBASE_SDK.test(req.url)) { e.respondWith(cacheFirst(req)); return; }
  if (url.origin !== location.origin || !STATIC_EXT.test(url.pathname)) return; // data, APIs: browser as usual
  if (url.searchParams.has("v") || url.pathname.includes("/fonts/")) e.respondWith(cacheFirst(req, true));
  else e.respondWith(staleWhileRevalidate(req));
});

async function pageCachedThenRefresh(e) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match("./");
  const hitCopy = hit?.clone(); // read later, after the browser has consumed hit
  const refresh = fetch(e.request).then(async res => {
    if (!res.ok) return res;
    const fresh = res.clone(), text = await res.clone().text();
    const old = hitCopy ? await hitCopy.text() : null;
    await cache.put("./", fresh);
    if (old !== null && old !== text) {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      list.forEach(c => c.postMessage({ type: "monetrip-updated" }));
    }
    return res;
  });
  if (hit) { e.waitUntil(refresh.catch(() => {})); return hit; }
  return refresh; // first visit: nothing cached yet
}

async function cacheFirst(req, pruneOldVersions = false) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") {
    await cache.put(req, res.clone());
    if (pruneOldVersions) {
      const path = new URL(req.url).pathname;
      for (const k of await cache.keys()) {
        const u = new URL(k.url);
        if (u.pathname === path && u.href !== req.url) cache.delete(k);
      }
    }
  }
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const update = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || update;
}
