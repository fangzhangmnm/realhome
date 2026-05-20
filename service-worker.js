// Cache-first + background revalidate → notify page "new version".
// User has to confirm reload (never auto-reload — they may be inside a world).
//
// 3 origin classes:
//   1. same origin (app shell): precache + cache-first + revalidate + diff → "asset-updated"
//   2. known CDN (jsdelivr/unpkg, three.js + decoders): precache hot files + cache-first lazy populate
//      → offline-first on Quest after first visit
//   3. other cross-origin (future: Graph): passthrough, no cache (SSOT)
//
// Bump CACHE_VERSION when any precache file changes.

const CACHE_VERSION = "v4-2026-05-20";
const CACHE_NAME = `realhome-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./src/styles.css",
  "./src/app.js",
  "./src/config.js",
  "./src/scene.js",
  "./src/controls.js",
  "./src/worldLoader.js",
  "./src/worldStore.js",
];

// Files SW does NOT intercept — let the app's own sync logic handle freshness
// via HTTP conditional GET (If-None-Match). Otherwise SW cache + version bumps
// would fight with our IndexedDB sync, and updating a world would require
// bumping the SW version to refresh.
function isPassthroughURL(url) {
  return url.origin === self.location.origin && /\.(glb|gltf)$/i.test(url.pathname);
}

// three.js + minimum addons we always load. Decoders (Draco/KTX2/Basis wasm) are
// lazy-populated by the runtime fetch handler.
const THREE_VERSION = "0.180.0";
const CDN_PRECACHE_URLS = [
  `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`,
  `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/loaders/GLTFLoader.js`,
  `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/utils/BufferGeometryUtils.js`,
  `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/controls/PointerLockControls.js`,
];

const CDN_DOMAINS = new Set(["cdn.jsdelivr.net", "unpkg.com"]);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    for (const url of CDN_PRECACHE_URLS) {
      try {
        await cache.add(new Request(url, { mode: "cors" }));
      } catch (_) {}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith("realhome-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

let updateAnnouncedThisLoad = false;
async function notifyUpdate(url) {
  if (updateAnnouncedThisLoad) return;
  updateAnnouncedThisLoad = true;
  const list = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of list) c.postMessage({ type: "asset-updated", url });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Worlds: passthrough. App does its own conditional GET; SW staying out of
  // the way means an updated glb on GitHub Pages is picked up next boot without
  // requiring a SW version bump.
  if (isPassthroughURL(url)) return;

  if (url.origin !== self.location.origin) {
    if (CDN_DOMAINS.has(url.hostname)) {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const resp = await fetch(req);
          if (resp && resp.ok) cache.put(req, resp.clone()).catch(() => {});
          return resp;
        } catch {
          return new Response("offline cdn miss", { status: 503 });
        }
      })());
    }
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const network = fetch(req).then((response) => {
      if (response && response.ok) {
        if (cached) {
          const cE = cached.headers.get("etag"), fE = response.headers.get("etag");
          const cL = cached.headers.get("content-length"), fL = response.headers.get("content-length");
          const changed = (cE && fE && cE !== fE) || (!cE && cL && fL && cL !== fL);
          if (changed) notifyUpdate(req.url).catch(() => {});
        }
        cache.put(req, response.clone()).catch(() => {});
      }
      return response;
    }).catch(() => null);

    if (cached) { network.catch(() => {}); return cached; }
    const response = await network;
    if (response) return response;
    if (req.mode === "navigate") {
      const fallback = await cache.match("./index.html");
      if (fallback) return fallback;
    }
    return new Response("offline & not cached", { status: 503 });
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "skip-waiting") self.skipWaiting();
});
