// --- Service worker registration + PWA update detection (canonical 4-path) ---
// Copied from the family pitfall doc (WebPaint docs/20260526-pwa-update-detection.md →
// our docs/20260625-pwa-updates.md). Two hard lessons baked in:
//   (#0) register at MODULE TOP-LEVEL, NOT inside window.load — with a
//        type=module entry the `load` event may have already fired by the time
//        this runs, so the listener never fires and the SW never registers
//        (iOS PWA then can't go offline / can't update). app.js calls
//        installSwUpdates() at import time = top level, so this runs at top
//        level too. Do NOT move the call inside an event listener.
//   (4 paths) waiting / updatefound / asset-updated message / foreground+poll.
//        iOS standalone PWAs don't poll for SW updates on their own — path 4
//        (visibility/focus/interval → reg.update()) is the unstick.
//
// This is the whole app-side SW lifecycle behind ONE call. app.js owns the DOM
// handles + status line and injects them; this module owns all the SW wiring:
// register timing, the 4 detection paths, skip-waiting reload, force-reset, and
// the version watermark.

const isLocal = ["localhost", "127.0.0.1", "::1", ""].includes(location.hostname);

/**
 * Wire up service-worker registration + PWA update detection.
 * Call ONCE, at module top level (see pitfall #0 above).
 *
 * @param {object}      deps
 * @param {HTMLElement} deps.updateToast        - "new version available" toast (starts .hidden)
 * @param {HTMLElement} deps.updateReload       - "reload" button inside the toast
 * @param {HTMLElement} [deps.forceUpdateButton]- "清缓存重启" escape-hatch button (optional)
 * @param {HTMLElement} [deps.drawerVersion]    - version watermark element (optional)
 * @param {(s: string) => void} deps.setStatus  - status-line callback (used by force-reset)
 */
export function installSwUpdates({ updateToast, updateReload, forceUpdateButton, drawerVersion, setStatus }) {
  let swRegistration = null;
  const showUpdateToast = () => updateToast.classList.remove("hidden");

  if ("serviceWorker" in navigator && !isLocal) {
    // Path 3: SW posts asset-updated when a precached asset's ETag changed.
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "asset-updated") showUpdateToast();
    });
    navigator.serviceWorker.register("./service-worker.js").then((reg) => {
      swRegistration = reg;
      // Path 1: a new SW installed-and-waiting from a prior session (controller
      // present = not a first install).
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast();
      // Path 2: a new SW installs during this session.
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) showUpdateToast();
        });
      });
      // Path 4: poke update() on foreground + every 10 min (iOS PWA won't self-check).
      const poke = () => reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => { if (!document.hidden) poke(); });
      window.addEventListener("focus", poke);
      setInterval(poke, 10 * 60 * 1000);
    }).catch((err) => console.warn("SW register failed:", err));
  }

  // "Reload" on the update toast: hand skip-waiting to the WAITING worker, then
  // reload once it takes control (controllerchange). Reloading before activation
  // would just re-serve the old cache. 5s fallback if there's no waiting worker.
  updateReload.addEventListener("click", () => {
    const reg = swRegistration;
    if (!reg || !reg.waiting) { location.reload(); return; }
    reg.waiting.postMessage({ type: "skip-waiting" });
    let done = false;
    const reload = () => { if (done) return; done = true; location.reload(); };
    navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
    setTimeout(reload, 5000);
  });

  // Force update (清缓存重启) — the canonical "PWA stuck on an old version" escape
  // hatch. Unregister all SWs + wipe Cache Storage + reload. Worlds live in
  // IndexedDB and are NOT touched. Guarded on being online: clearing the cache
  // while offline would leave nothing to reload from. See docs/20260625-pwa-updates.md.
  async function forcePwaReset() {
    if (!navigator.onLine) { setStatus("离线，先联网再强制更新"); return; }
    setStatus("清缓存重启中…");
    try {
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister().catch(() => {});
      }
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        for (const k of keys) await caches.delete(k).catch(() => {});
      }
    } catch (_) { /* best-effort — reload anyway */ }
    setTimeout(() => location.reload(), 150);
  }
  forceUpdateButton?.addEventListener("click", (e) => { e.stopPropagation(); forcePwaReset(); });

  // Version watermark (#4 of the four-piece set): after a force-update / reload
  // the user needs a visual "did the new code actually load?". Show the running
  // bundle's content hash (the build artifact name IS the version).
  if (drawerVersion) {
    const m = document.querySelector('script[type="module"][src*="/dist/realhome-"]')
      ?.getAttribute("src")?.match(/realhome-([a-z0-9]+)\.mjs/i);
    drawerVersion.textContent = m ? `RealHome · build ${m[1]}` : "RealHome · PWA";
  }
}
