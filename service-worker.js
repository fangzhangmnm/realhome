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

const CACHE_VERSION = "v20-2026-05-22";
const CACHE_NAME = `realhome-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./src/styles.css",
  "./src/app.js",
  "./src/config.js",
  "./src/scene.js",
  "./src/controls.js",
  "./src/worldLoader.js",
  "./src/worldStore.js",
  "./src/providers.js",
  "./src/player.js",
  "./src/xrControls.js",
  "./src/collision.js",
  "./src/vignette.js",
  "./src/onedriveAuth.js",
  "./src/onedriveGraph.js",
  // All deps vendored — no CDN runtime dependency. PWA is fully offline once
  // installed. No KTX2 / Draco / Meshopt decoder wasm — we don't ship compressed
  // glb support; artist-side tooling does compression-to-PNG before upload.
  "./src/vendor/three/build/three.module.js",
  "./src/vendor/three/build/three.core.js",
  "./src/vendor/three/addons/loaders/GLTFLoader.js",
  "./src/vendor/three/addons/controls/PointerLockControls.js",
  "./src/vendor/three/addons/utils/BufferGeometryUtils.js",
  "./src/vendor/three-mesh-bvh/build/index.module.js",
  "./src/vendor/msal/index.js",
];

// Files SW does NOT intercept — let the app's own sync logic handle freshness
// via HTTP conditional GET (If-None-Match). Otherwise SW cache + version bumps
// would fight with our IndexedDB sync, and updating a world would require
// bumping the SW version to refresh.
function isPassthroughURL(url) {
  return url.origin === self.location.origin && /\.(glb|gltf)$/i.test(url.pathname);
}

// CDN paths intentionally removed — all deps vendored under src/vendor/*.
// (Old reasoning: precache + cache-first served from CDN, no precache files
// here means no fetches to outside origins after this build.)

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
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

  // Cross-origin (OneDrive Graph, login.microsoftonline, etc.) → passthrough.
  // We don't run any runtime libraries from CDN anymore; everything is vendored.
  if (url.origin !== self.location.origin) return;

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
