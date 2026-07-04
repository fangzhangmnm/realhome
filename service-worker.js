// SW v121 重写：bundle 后整个站只剩 1 个 hash-named bundle，缓存失效**自动**
// 通过文件名差异解决。manifest hash / import URL rewrite / version.js 合成 这些老花招全删。
//
// 设计：
//   - install：fetch index.html → 抠出当前 bundle 文件名 → precache 入口 + bundle + statics
//   - cache name = "realhome-<bundleHash>"。新 bundle = 新 cache name；activate 时清老的。
//   - fetch：cache-first(prod) / network-first(dev) + 后台 revalidate；ETag 变了通知 page。
//
// 抄自 sibling canonical `../../20260524 WebPaint/service-worker.js`，**与它逐字对齐**——
// 只差三处硬约束：① realhome- 名（vs webpaint-）② STATIC_PRECACHE 列表 ③ .glb/.gltf passthrough
// 红线。改 canonical 时把新逻辑照拷回来即可（diff 应仍只剩这三处 + 本头注）。
//
// RealHome 硬约束（无法与 WebPaint 逐字同）：
//   - .glb/.gltf passthrough（两 scope）：世界归 app 的 IndexedDB sync via Graph If-None-Match，
//     SW 永不缓存世界。见 docs/20260524-sync-constraints.md。NEVER let worlds in。
//   - STATIC_PRECACHE = three.js / bvh ES 模块（首帧经 importmap 加载，须离线可用）；
//     msal 惰性（登录才下）→ runtime-cache，不预缓存。

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

let CACHE_NAME = "realhome-boot";   // install 时会被替换为 realhome-<bundleHash>

// 同一个 SW 文件部署到 /(prod) 和 /dev/ 两处；按**自己的作用域**选策略（owner: docs + src/app.js SW 注册块）：
//   - prod(scope=/)      → cache-first：秒开 + 离线稳，更新靠 asset-updated toast。
//   - dev(scope 含 /dev/) → network-first：在线永远先抓网（「改完即见」/强制更新不变），离线才回退缓存
//     （崩溃后能离线重开——修「/dev/ 按设计无 SW → 闪退离线打不开」的坑，见 docs/20260704-pwa-offline-dev-sw.md）。
const SCOPE_IS_DEV = self.location.pathname.includes("/dev/");

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
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clients) c.postMessage({ type: "asset-updated", url });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // .glb/.gltf passthrough（两 scope）：世界归 app 的 IDB sync via If-None-Match，SW 永不缓存。见 docs/20260524-sync-constraints.md。
  if (/\.(glb|gltf)$/i.test(url.pathname)) return;
  // prod 根 SW(scope=/)不碰 /dev/——留给 /dev/ 作用域的 dev SW 自己处理（dev SW 的 scope 已限在 /dev/，故只 prod 需此跳）。
  if (!SCOPE_IS_DEV && url.pathname.includes("/dev/")) return;
  event.respondWith(SCOPE_IS_DEV ? networkFirst(req) : cacheFirst(req));
});

// prod：cache-first + 后台 revalidate（ETag/长度变 → 通知 page 弹更新 toast）。
async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req, { ignoreSearch: true });
  const networkPromise = fetch(req).then((resp) => {
    if (resp && resp.ok) {
      if (cached) {
        const cE = cached.headers.get("etag"), fE = resp.headers.get("etag");
        const cL = cached.headers.get("content-length"), fL = resp.headers.get("content-length");
        const changed = (cE && fE && cE !== fE) || (!cE && cL && fL && cL !== fL);
        if (changed) notifyUpdate(req.url).catch(() => {});
      }
      cache.put(req, resp.clone()).catch(() => {});   // hash-named bundle 内容不变；其它文件更新则刷一次
    }
    return resp;
  }).catch(() => null);
  if (cached) { networkPromise.catch(() => {}); return cached; }
  const resp = await networkPromise;
  if (resp) return resp;
  return navFallback(req, cache);
}

// dev：network-first——在线永远拿最新（「改完即见」/强制更新不变），离线才回退缓存（崩溃后能离线重开）。
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) cache.put(req, resp.clone()).catch(() => {});   // 顺手刷缓存，供下次离线回退
    return resp;
  } catch {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    return navFallback(req, cache);
  }
}

// 导航请求离线且未命中 → 回退缓存的 index.html（PWA 壳）；否则 503。
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
