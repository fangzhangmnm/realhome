# PWA 更新检测 + 强制更新（RealHome）

> as-of 2026-06-25。**为什么/完整论证**见 canonical：
> `../../20260524 WebPaint/docs/20260526-pwa-update-detection.md`（四件套，少一件都收 user 抱怨）。
> 本文只记 RealHome 怎么挂的 + 差异。

四件套（都在 `src/app.js` 末尾 SW 段）：

1. **SW 在模块顶层 register**（不在 `window.load` 里）。RealHome 旧版本就是 `window.load`
   里 register（v58 同款坑）——bundled module entry 跑起来时 `load` 常已 fire → SW 永不注册
   → iOS PWA 离线打不开 / 更新检测失灵。已改成 import 时直接 register。
2. **4 条更新检测路径**：
   - 路径 1 `reg.waiting`（register 完查，上次 session 装好没 activate 的）
   - 路径 2 `updatefound` + `statechange==="installed"`（本 session 装新 SW；须 controller 存在，
     否则是首装不弹）
   - 路径 3 SW `postMessage({type:"asset-updated"})`（precache asset ETag 变 → SW fetch handler 广播）
   - 路径 4 `visibilitychange`/`focus`/`setInterval(10min)` → `reg.update()`（**iOS standalone PWA
     不自己 poll，这条是解药**）
3. **强制更新（清缓存重启）** = 设置抽屉「强制更新」按钮 → `forcePwaReset()`：unregister 所有 SW +
   `caches.delete` 全清 + reload。**世界数据在 IndexedDB，不动**。**离线时不清**（怕拉不回来 →
   `navigator.onLine` 守门）。这是「卡老版本、点刷新还是老的」时的逃生门。
4. **版本水印** = 设置抽屉底 `#drawerVersion` 显示运行中 bundle 的 content hash（`realhome-<hash>.mjs`
   的 hash 就是版本号），运行时从 `<script>` 标签抠。force-update 后看 hash 变没变 = 视觉确认新码生效。

update toast 的「Reload」：把 `skip-waiting` 推给 **waiting** worker，等 `controllerchange` 再 reload
（activate 前 reload 只会再服旧 cache）；5s 兜底。

RealHome 差异：SW cache 名 = content-hash（`realhome-<bundleHash>`，见 service-worker.js），所以
**没有手动 CACHE_VERSION 要 bump**——build 出新 hash 自动新 cache。`.glb/.gltf` 在 SW passthrough
（store 红线，世界新鲜度归 IndexedDB sync）。physics 步率 toggle 也在 Debug 区（debug 用，settle 后删）。
