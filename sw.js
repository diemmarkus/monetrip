// MoneTrip offline cache (service worker).
//
// - The page itself (index.html) is always fetched from the network first, so a new
//   deploy shows up on the next visit; the cached copy is only used when offline or
//   when the network takes longer than a few seconds.
// - Files with a ?v= number (app.js, style.css, the modules) never change under the
//   same URL, so they come straight from the cache. tools/bump-version.py gives every
//   deploy new numbers; old copies are removed as new ones arrive.
// - Fonts, icons and the Firebase SDK (fixed version in its URL) also come from the
//   cache. Data requests (Firestore, sign-in, exchange rates) are never touched here.

const CACHE = "monetrip-v1";
const NETWORK_TIMEOUT = 3500;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add("./")).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("monetrip-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const FIREBASE_SDK = /^https:\/\/www\.gstatic\.com\/firebasejs\/\d/;
const STATIC_EXT = /\.(js|css|woff2|png|svg|ico|webmanifest)$/;

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate" && url.origin === location.origin) { e.respondWith(pageNetworkFirst(req)); return; }
  if (FIREBASE_SDK.test(req.url)) { e.respondWith(cacheFirst(req)); return; }
  if (url.origin !== location.origin || !STATIC_EXT.test(url.pathname)) return; // data, APIs: browser as usual
  if (url.searchParams.has("v") || url.pathname.includes("/fonts/")) e.respondWith(cacheFirst(req, true));
  else e.respondWith(staleWhileRevalidate(req));
});

async function pageNetworkFirst(req) {
  const cache = await caches.open(CACHE);
  const network = fetch(req).then(res => {
    if (res.ok) cache.put("./", res.clone());
    return res;
  });
  const timeout = new Promise(r => setTimeout(r, NETWORK_TIMEOUT));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch {}
  return (await cache.match("./")) || network; // offline or slow: last good copy
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
