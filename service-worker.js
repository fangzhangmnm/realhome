// SW (RealHome) — content-hash bundle auto-invalidation. Copied from the family
// canonical (WebPaint service-worker.js, v121 rewrite). Cache name =
// realhome-<bundleHash>, derived at install from the ./dist/realhome-<hash>.mjs
// in index.html → a new build = new bundle name = new cache; activate clears the
// old. No manual CACHE_VERSION bump anymore (the content hash IS the version).
//
// RealHome-specific rules layered on the canonical:
//   - .glb / .gltf are PASSTHROUGH (never SW-cached): the app's IndexedDB sync
//     owns world freshness via Graph If-None-Match. SW caching would fight that
//     — see docs/20260524-sync-constraints.md. NEVER let worlds into the SW cache.
//   - /dev/ is passthrough (the prod SW's scope covers /realhome/dev/, but dev
//     must always hit network; the deploy workflow also strips the SW there).
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
  // /dev/ never goes through the SW cache layer (dev changes show immediately).
  if (url.pathname.includes("/dev/")) return;
  // .glb/.gltf passthrough — worlds are owned by the app's IndexedDB sync, not
  // the SW cache. Letting them in here would double-cache + fight If-None-Match.
  if (/\.(glb|gltf)$/i.test(url.pathname)) return;

  event.respondWith((async () => {
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
