# PWA 离线 / dev SW 策略（RealHome）

> as-of 2026-07-04。owner：`service-worker.js`（worker 侧）+ `src/app.js` SW 注册块（app 侧）。
> **为什么这么设计**见 canonical：`../../20260524 WebPaint/ai-docs/20260630-pwa-offline-dev-sw.md`。
> 本文只记 RealHome 的落地 + 差异。how 类，会腐烂——动 SW/部署前以代码现状为准。

## 背景：清理 dev/prod split 的一处 drift（2026-07-04）

RealHome 2026-06-25 上家族 dev/prod split 时，抄的是 WebPaint **当时**的做法——`/dev/` 整个砍掉 SW
（三处合谋）。WebPaint 后来（v365 / 2026-06-30）修了这个坑，RealHome 一直没跟上 → drift。本次补齐。

砍掉 dev 离线的三处合谋（**已全部改掉**）：

1. `.github/workflows/deploy.yml`：compose 时 `rm -f site/dev/service-worker.js`（删 dev SW 文件）→ **已删除该行**，dev 现在保留自己的 SW。
2. `service-worker.js` fetch：`if (url.pathname.includes("/dev/")) return;`（无条件绕过 /dev/）→ **改成** `if (!SCOPE_IS_DEV && ...)`：只有 prod 根 SW 跳 /dev/，dev SW 自己处理自己 scope。
3. `src/app.js` SW 注册：条件是 `!isLocal`（只跳 localhost），**本来就没跳 /dev/** → 无需改。（之前因为 deploy 删了 SW 文件，注册在 /dev/ 静默 404 而已。）

## 修法：dev 也装 SW，但走 network-first（不是 cache-first）

同一个 `service-worker.js` 部署到 `/` 和 `/dev/`，按**自己的 scope** 分流：

| scope | 策略 | 在线 | 离线 |
|---|---|---|---|
| `/`（prod） | cache-first + 后台 revalidate | 秒开缓存，ETag/长度变弹更新 toast | 服缓存壳 |
| `/dev/`（dev） | network-first | 永远抓网（改完即见 / 强制更新不变） | 回退缓存（崩溃可离线重开） |

关键洞察（同 canonical）：当初砍 dev SW 是怕 cache-first stale。但 **network-first 不会 stale**——在线永远先抓网，
只有离线才回退缓存。同时满足「改完即见」+「崩溃后离线可重开」，没有取舍。

- scope 检测：`const SCOPE_IS_DEV = self.location.pathname.includes("/dev/");`（SW 脚本自己的 URL）。
- 三个小函数：`cacheFirst` / `networkFirst` / `navFallback`（导航离线未命中 → 回退缓存的 index.html 壳）。
- **prod 的 cache-first 行为逐字未变**（秒开 + asset-updated toast 是成熟的，别动）。

## RealHome 特有红线（不随本次改动）

- **`.glb / .gltf` 两个 scope 都 passthrough**——世界新鲜度归 app 的 IndexedDB sync（Graph If-None-Match），
  SW 永不缓存世界。见 `20260524-sync-constraints.md`。本次 fetch 重写把这条 passthrough 提到 /dev/ 跳过之前，
  两个 scope 都生效。
- 跨源（Graph / MS login）passthrough 不变。

## 验证

- node mock 测：`test/sw-strategy.test.mjs`（vm 载入 SW + mock caches/fetch/Response → 驱动 fetch 事件）。
  `node test/run.mjs` → 10 passed：prod cache-first（在线/离线/导航回退）、prod 跳 /dev/、dev network-first
  （在线抓网/离线回退/导航回退/写穿缓存）、**.glb/.gltf 两 scope passthrough**。
- 真机待验（无法静态验）：iPad/Quest `/dev/` PWA 断网重开能出 shell；在线改 dev 仍即见；prod `/` 行为不变。

## 不变量（别再退化）

- dev 的离线**不许**用 cache-first（会 stale，破「改完即见」）。要离线就 network-first。
- prod 的 cache-first 路径**别动**（秒开 + toast 是成熟的）。
- 别再在 deploy 里删 dev SW、或在注册处跳过 dev——那就是把这个坑种回来。
- **`.glb/.gltf` 永不进 SW 缓存**（红线）。
