// SW (RealHome) — content-hash bundle auto-invalidation. Copied from the family
// canonical (WebPaint service-worker.js, v121 rewrite). Cache name =
// realhome-<bundleHash>, derived at install from the ./dist/realhome-<hash>.mjs
// in index.html → a new build = new bundle name = new cache; activate clears the
// old. No manual CACHE_VERSION bump anymore (the content hash IS the version).
//
// The SAME file is deployed to / (prod) and /dev/ (dev); each picks its strategy
// by its own scope — see docs/20260704-pwa-offline-dev-sw.md (ported from WebPaint
// v365). SCOPE_IS_DEV → network-first (online always fresh = 改完即见, offline falls
// back to cache so a crash can reopen offline); prod → cache-first + revalidate.
//
// RealHome-specific rules layered on the canonical:
//   - .glb / .gltf are PASSTHROUGH (never SW-cached, BOTH scopes): the app's
//     IndexedDB sync owns world freshness via Graph If-None-Match. SW caching would
//     fight that — see docs/20260524-sync-constraints.md. NEVER let worlds in.
//   - prod SW (scope /) skips /dev/ requests — the /dev/-scoped dev SW owns those.
//     (Was: unconditional /dev/ passthrough + deploy stripped the dev SW = /dev/ had
//      zero SW → crash-reopen offline failed. Fixed to match WebPaint canonical.)
//   - three.js ES modules ARE precached — they load at first render via the
//     importmap and must work offline. msal is lazy (sign-in only) → runtime-cached.

const STATIC_PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./src/styles.css",
  // three.js + bvh ES modules — needed at first render, resolved via importmap.
  "./src/vendor/three/build/three.module.js",
  "./src/vendor/three/build/three.core.js",
  "./src/vendor/three/addons/loaders/GLTFLoader.js",
  "./src/vendor/three/addons/controls/PointerLockControls.js",
  "./src/vendor/three/addons/utils/BufferGeometryUtils.js",
  "./src/vendor/three-mesh-bvh/build/index.module.js",
  // msal NOT precached: lazy-loaded only on OneDrive sign-in → runtime-cached.
];

let CACHE_NAME = "realhome-boot";   // install replaces with realhome-<bundleHash>
const SCOPE_IS_DEV = self.location.pathname.includes("/dev/");   // this SW's own URL

async function getCurrentBundleUrl() {
  const res = await fetch("./index.html", { cache: "no-store" });
  if (!res.ok) throw new Error("install: index.html fetch failed " + res.status);
  const html = await res.text();
  // <script type="module" src="./dist/realhome-<hash>.mjs"></script>
  const m = html.match(/src="(\.\/dist\/realhome-[a-z0-9-]+\.mjs)"/i);
  if (!m) throw new Error("install: 找不到 ./dist/realhome-*.mjs 入口 in index.html");
  return { html, bundleUrl: m[1] };
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const { bundleUrl } = await getCurrentBundleUrl();
    const bundleHash = bundleUrl.match(/realhome-([a-z0-9-]+)\.mjs/i)?.[1] || "boot";
    CACHE_NAME = `realhome-${bundleHash}`;
    const cache = await caches.open(CACHE_NAME);
    const urls = [...STATIC_PRECACHE, bundleUrl, bundleUrl + ".map"];
    await Promise.all(urls.map((u) =>
      fetch(u, { cache: "no-store" })
        .then((r) => r.ok ? cache.put(u, r) : null)
        .catch((err) => console.warn("[SW] precache miss", u, err.message))
    ));
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

let updateAnnounced = false;
async function notifyUpdate(url) {
  if (updateAnnounced) return;
  updateAnnounced = true;
  const list = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of list) c.postMessage({ type: "asset-updated", url });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // Graph / MS login → passthrough
  // .glb/.gltf passthrough (BOTH scopes) — worlds are owned by the app's IndexedDB
  // sync, not the SW cache. Letting them in would double-cache + fight If-None-Match.
  if (/\.(glb|gltf)$/i.test(url.pathname)) return;
  // prod SW (scope /) doesn't touch /dev/ — the /dev/-scoped dev SW owns those.
  // dev SW's scope is already limited to /dev/, so only prod needs this skip.
  if (!SCOPE_IS_DEV && url.pathname.includes("/dev/")) return;
  event.respondWith(SCOPE_IS_DEV ? networkFirst(req) : cacheFirst(req));
});

// prod: cache-first + background revalidate (ETag/length change → toast the page).
async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req).then((response) => {
    if (response && response.ok) {
      if (cached) {
        const cE = cached.headers.get("etag"), fE = response.headers.get("etag");
        const cL = cached.headers.get("content-length"), fL = response.headers.get("content-length");
        const changed = (cE && fE && cE !== fE) || (!cE && cL && fL && cL !== fL);
        if (changed) notifyUpdate(req.url).catch(() => {});
      }
      // hash-named bundle can't change content; other files may update — put once.
      cache.put(req, response.clone()).catch(() => {});
    }
    return response;
  }).catch(() => null);
  if (cached) { network.catch(() => {}); return cached; }
  const response = await network;
  if (response) return response;
  return navFallback(req, cache);
}

// dev: network-first — online always fresh (改完即见 / 强制更新 unchanged), offline
// falls back to cache (so a crash-killed PWA can reopen offline).
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(req);
    if (response && response.ok) cache.put(req, response.clone()).catch(() => {});   // seed cache for offline
    return response;
  } catch {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    return navFallback(req, cache);
  }
}

// navigation offline + not cached → serve the cached index.html (PWA shell); else 503.
async function navFallback(req, cache) {
  if (req.mode === "navigate") {
    const fallback = await cache.match("./index.html");
    if (fallback) return fallback;
  }
  return new Response("offline & not cached", { status: 503 });
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "skip-waiting") self.skipWaiting();
});
