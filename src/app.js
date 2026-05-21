import * as THREE from "three";
import { createScene } from "./scene.js";
import { createPlayer } from "./player.js";
import { createFlatControls } from "./controls.js";
import { createXrControls } from "./xrControls.js";
import { createCollision } from "./collision.js";
import { createVignette } from "./vignette.js";
import { optimizeGlb } from "./optimizer.js";
import { loadGlbFromFile, loadGlbFromBlob, bindRenderer as bindWorldLoaderRenderer } from "./worldLoader.js";
import {
  addWorld, getWorld, listWorlds, touchWorld, deleteWorld,
  findByRemoteId, updateRemoteSync, requestPersist,
  migrateLegacyTombstones,
  clearAllWorlds, clearAllSettings,
} from "./worldStore.js";
import { providers } from "./providers.js";

// Detected at boot: is this user agent capable of immersive-vr sessions?
// Resolves async — by the time the user clicks a world card on Quest, set.
let xrSupported = false;
if (navigator.xr) {
  navigator.xr.isSessionSupported("immersive-vr").then((v) => { xrSupported = v; }).catch(() => {});
}

// DOM
const canvas = document.getElementById("canvas");
const overlay = document.getElementById("startOverlay");
const dropOverlay = document.getElementById("dropOverlay");
const fileInput = document.getElementById("fileInput");
const pickButton = document.getElementById("pickButton");
const worldsListEl = document.getElementById("worldsList");
const cleanCacheButton = document.getElementById("cleanCacheButton");
const refreshButton = document.getElementById("refreshButton");
const hudName = document.getElementById("hudName");
const hudStatus = document.getElementById("hudStatus");
const updateToast = document.getElementById("updateToast");
const updateReload = document.getElementById("updateReload");
const worldUpdateToast = document.getElementById("worldUpdateToast");
const worldUpdateText = document.getElementById("worldUpdateText");

const { renderer, scene, camera, playerRig, setWorld } = createScene(canvas);
bindWorldLoaderRenderer(renderer);   // KTX2Loader needs renderer to pick ASTC/BC7

// Currently loaded world. id is null when streaming (not in IDB) — match by
// source+remoteId in that case. `collision` is rebuilt on each installWorld.
const current = {
  id: null, source: null, remoteId: null,
  root: null, skyboxes: [], colliders: [], collision: null,
};
let loading = false;

const player = createPlayer(playerRig, camera, () => current.collision);
const flat = createFlatControls(camera, player, canvas);
const xr = createXrControls(renderer, player);
const vignette = createVignette(camera);

// --- Pointer lock (flat desktop) / VR session (Quest) ---
function tryLock() {
  if (renderer.xr.isPresenting) return;
  if (!flat.isLocked()) {
    try { flat.controls.lock(); } catch (_) { /* not supported on this browser */ }
  }
}
// Fire requestSession synchronously inside the user gesture. World swap (if any)
// happens in parallel; VR enters showing the current scene, new scene cuts in
// once parsed.
function enterVR() {
  navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] })
    .then((session) => renderer.xr.setSession(session))
    .catch((err) => console.error("VR session failed:", err));
}

canvas.addEventListener("click", () => {
  if (xrSupported && !renderer.xr.isPresenting) enterVR();
  else tryLock();
});
overlay.addEventListener("click", (e) => {
  if (e.target !== overlay) return;
  if (xrSupported && !renderer.xr.isPresenting) enterVR();
  else tryLock();
});
flat.controls.addEventListener("lock", () => overlay.classList.add("hidden"));
flat.controls.addEventListener("unlock", () => {
  overlay.classList.remove("hidden");
  checkRemoteUpdates();           // re-poll sources every time the menu reappears
});
// Esc closes the menu too (just like clicking outside): when the overlay is
// visible and we're not in XR, hitting Esc re-locks pointer + hides the menu.
// The browser-native Esc-unlocks-pointer behaviour during gameplay is preserved.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (renderer.xr.isPresenting) return;
  if (flat.isLocked()) return;
  if (overlay.classList.contains("hidden")) return;
  tryLock();
});
// Match overlay visibility to XR presenting state too.
renderer.xr.addEventListener("sessionstart", () => overlay.classList.add("hidden"));
renderer.xr.addEventListener("sessionend", () => {
  overlay.classList.remove("hidden");
  checkRemoteUpdates();
});

// --- Clean cache (OneDrive-style "remove local copies") ---
cleanCacheButton.addEventListener("click", async (e) => {
  e.stopPropagation();
  const ok = confirm(
    "Clean cache?\n\n" +
    "All cached worlds will be removed.\n" +
    "Bundled / synced worlds will reappear in the list as available.\n" +
    "Local uploads will be lost."
  );
  if (!ok) return;
  await clearAllWorlds();
  await clearAllSettings();
  location.reload();
});

// --- Manual refresh (re-poll sources for updates) ---
refreshButton.addEventListener("click", async (e) => {
  e.stopPropagation();
  await renderWorldsList();       // also re-pulls provider.list() in case of new bundled entries
  checkRemoteUpdates();
});

// --- File picker ---
pickButton.addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) loadFile(f);
  fileInput.value = "";  // allow re-picking the same file
});

// --- Drag-and-drop anywhere on window ---
window.addEventListener("dragover", (e) => { e.preventDefault(); dropOverlay.classList.remove("hidden"); });
window.addEventListener("dragleave", (e) => {
  if (!e.relatedTarget) dropOverlay.classList.add("hidden");
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dropOverlay.classList.add("hidden");
  const f = e.dataTransfer?.files?.[0];
  if (f) loadFile(f);
});

// --- Worlds list (event delegation, list re-renders on changes) ---
worldsListEl.addEventListener("click", async (e) => {
  e.stopPropagation();
  const cacheBtn = e.target.closest(".world-cache");
  if (cacheBtn) {
    await handleCache(cacheBtn.dataset.source, cacheBtn.dataset.remoteId, cacheBtn.dataset.worldName);
    return;
  }
  const deleteBtn = e.target.closest(".world-delete");
  if (deleteBtn) { await handleDelete(deleteBtn.dataset.id); return; }
  const item = e.target.closest(".world-item");
  if (item) await handleEnter(item);
});

// Tap on world body = enter. Doesn't imply persistence:
//   - cached entry → load from IDB blob and enter
//   - uncached entry → stream fresh bytes from provider, parse, enter (no IDB write)
// VR session is requested synchronously up-front so the user gesture isn't
// lost across awaits.
async function handleEnter(item) {
  if (xrSupported && !renderer.xr.isPresenting) enterVR();

  const id = item.dataset.id;
  const source = item.dataset.source;
  const remoteId = item.dataset.remoteId;
  const isCurrent =
    (id && id === current.id) ||
    (remoteId && source === current.source && remoteId === current.remoteId);

  if (!isCurrent) {
    if (id) await switchToWorld(id);
    else await streamOpenWorld(source, remoteId, item.dataset.worldName || remoteId);
  }

  if (!xrSupported) tryLock();
}

// ↓ button on uncached entries. Persists the blob to IDB and runs the
// optimizer — but does NOT enter the world. User can tap the body afterwards
// (or right now to enter and re-render from IDB on next session).
async function handleCache(source, remoteId, name) {
  await cacheWorld(source, remoteId, name);
  await renderWorldsList();
}

async function handleDelete(id) {
  if (id === current.id) return;  // can't delete the currently-loaded world
  const record = await getWorld(id);
  if (!record) return;
  // Local uploads have no remote source — deleting is permanent. Bundled /
  // onedrive worlds simply uncache; they'll reappear in the list as available.
  const msg = record.source === "local"
    ? `Delete "${record.name}"?\n\nLocal uploads have no remote copy — this can't be undone.`
    : `Remove "${record.name}" from cache?\n\nIt will reappear in the list as available, and can be re-cached anytime.`;
  if (!confirm(msg)) return;
  await deleteWorld(id);
  await renderWorldsList();
}

// --- World loading paths ---
async function loadFile(file) {
  if (loading) return;
  if (!/\.(glb|gltf)$/i.test(file.name)) { setStatus("not a .glb/.gltf"); return; }
  loading = true;
  hudName.textContent = file.name;
  try {
    // Optimize before persisting. Failure = upload failure — no half-cached
    // raw record in IDB. (Optimizer also validates the glb in the process.)
    const finalBlob = await runOptimizer(file);
    const result = await loadGlbFromBlob(finalBlob, file.name);
    const record = await addWorld(finalBlob, file.name, {
      source: "local",
      optimized: true,
    });
    current.id = record.id;
    current.source = "local";
    current.remoteId = null;
    installWorld(result, file.name);
    setStatus("");
    await renderWorldsList();
  } catch (err) {
    console.error(err);
    setStatus("upload failed: " + (err.message || err));
  } finally {
    loading = false;
  }
}

// Run optimizer over a source blob. Returns the optimized blob if the result
// is smaller, else the original. Throws if the optimizer module fails to load
// or chokes on the glb — caller is responsible for propagating to the user.
async function runOptimizer(sourceBlob, { quiet = false } = {}) {
  if (!quiet) setStatus("optimizing…");
  const optimized = await optimizeGlb(sourceBlob);
  if (optimized.byteLength < sourceBlob.size * 0.97) {
    if (!quiet) setStatus(`optimized: ${formatBytes(sourceBlob.size)} → ${formatBytes(optimized.byteLength)}`);
    return new Blob([optimized], { type: "model/gltf-binary" });
  }
  return sourceBlob;
}

async function switchToWorld(id) {
  if (loading || id === current.id) return;
  loading = true;
  setStatus("loading…");
  try {
    const record = await getWorld(id);
    if (!record || !record.blob) throw new Error("world not found");
    const result = await loadGlbFromBlob(record.blob, record.name);
    await touchWorld(id);
    current.id = id;
    current.source = record.source;
    current.remoteId = record.remoteId;
    installWorld(result, record.name);
    setStatus("");
    await renderWorldsList();
  } catch (err) {
    console.error(err);
    setStatus("load failed: " + (err.message || err));
  } finally {
    loading = false;
  }
}

// Open an uncached (provider-available) world without persisting. Fresh bytes
// every time — slower than a cached open, but doesn't fill IDB for one-shot
// previews. User can tap ↓ separately to persist.
async function streamOpenWorld(source, remoteId, name) {
  if (loading) return;
  loading = true;
  setStatus("loading…");
  hudName.textContent = name;
  try {
    const p = providers.find((p) => p.source === source);
    if (!p) throw new Error(`no provider for ${source}`);
    const result = await p.fetch(remoteId);   // unconditional fetch
    if (!result) throw new Error("source unavailable");
    const parsed = await loadGlbFromBlob(result.blob, name);
    current.id = null;
    current.source = source;
    current.remoteId = remoteId;
    installWorld(parsed, name);
    setStatus("");
    await renderWorldsList();
  } catch (err) {
    console.error(err);
    setStatus("load failed: " + (err.message || err));
  } finally {
    loading = false;
  }
}

function installWorld(result, name) {
  // Tear down the old collision system before the geometry it referenced is
  // disposed by setWorld. We cloned the geometry into the BVH so this is
  // strictly for releasing the BVH and the clones.
  if (current.collision) {
    current.collision.dispose();
    current.collision = null;
  }

  current.root = result.root;
  current.skyboxes = result.skyboxes;
  current.colliders = result.colliders;
  setWorld(result.root);

  // Build collision from the world's `_collider` meshes. updateMatrixWorld
  // ensures the BVH bakes correct world transforms (the freshly-added root may
  // not have current matrixWorld yet).
  if (result.colliders.length) {
    result.root.updateMatrixWorld(true);
    current.collision = createCollision(result.colliders);
  }

  // Reset player to spawn (origin, 0 velocity, identity rotation). Otherwise the
  // new world inherits the previous's exit pose / accumulated snap-turn angle.
  player.reset();
  hudName.textContent = name;
  const note = [];
  if (result.skyboxes.length) note.push(`skybox×${result.skyboxes.length}`);
  if (result.colliders.length) note.push(`collider×${result.colliders.length}`);
  setStatus(note.join(" · "));
}

function setStatus(s) { hudStatus.textContent = s; }

let worldToastTimer = 0;
function showWorldUpdateToast(name, isCurrent) {
  worldUpdateText.textContent = isCurrent
    ? `"${name}" was updated upstream. Re-enter to see the new version.`
    : `"${name}" was updated upstream.`;
  worldUpdateToast.classList.remove("hidden");
  clearTimeout(worldToastTimer);
  worldToastTimer = setTimeout(() => worldUpdateToast.classList.add("hidden"), 6000);
}

// --- Provider-based cache (unifies bundled / future onedrive) ---
// Fetches the latest bytes via the provider, runs the optimizer, and only
// writes to IDB if the optimizer succeeds. No "raw" half-state: cache is
// atomic — either the world is in IDB optimized, or it isn't.
//
// `quiet`: suppresses the HUD chatter for background invalidation checks.
async function cacheWorld(source, remoteId, name, opts = {}) {
  const { quiet = false } = opts;
  const p = providers.find((p) => p.source === source);
  if (!p) throw new Error(`no provider for source=${source}`);
  const existing = await findByRemoteId(source, remoteId);
  if (!quiet) setStatus("caching…");
  let result;
  try {
    result = await p.fetch(remoteId, existing?.remoteEtag);
  } catch (err) {
    if (!quiet) setStatus(`fetch failed: ${err.message || err}`);
    return existing || null;
  }
  if (!result) {
    // 304 / offline / unchanged. If we have a previous record, it's already
    // optimized (otherwise it wouldn't be in IDB).
    if (!quiet) setStatus("");
    return existing;
  }

  // Optimize before any IDB write. Failure = cache failure: nothing is
  // persisted, the user sees the error and can retry.
  let finalBlob;
  try {
    finalBlob = await runOptimizer(result.blob, { quiet });
  } catch (err) {
    if (!quiet) setStatus(`cache failed: ${err.message || err}`);
    console.warn("cache failed during optimize:", err);
    return null;
  }

  let rec;
  if (existing) {
    await updateRemoteSync(existing.id, finalBlob, result.etag, { optimized: true });
    rec = await getWorld(existing.id);
  } else {
    rec = await addWorld(finalBlob, name, {
      source, remoteId, remoteEtag: result.etag, optimized: true,
    });
  }
  if (!quiet) setStatus("");
  return rec;
}

// Background cache invalidation. For each cached remote-sourced world, ask
// the provider whether the source has changed (cheap conditional GET). New
// content lands in IDB; the currently-rendered scene is NOT swapped (user's
// in it), but next world-switch / reload picks up the update.
async function checkRemoteUpdates() {
  const cached = await listWorlds();
  for (const w of cached) {
    if (!w.remoteId) continue;
    if (w.source !== "bundled" && w.source !== "onedrive") continue;
    cacheWorld(w.source, w.remoteId, w.name, { quiet: true })
      .then((rec) => {
        if (rec && rec.remoteEtag !== w.remoteEtag) {
          console.log(`updated ${w.source}:${w.remoteId} (${w.remoteEtag} → ${rec.remoteEtag})`);
          const isCurrent =
            (current.id && current.id === rec.id) ||
            (current.remoteId && current.source === rec.source && current.remoteId === rec.remoteId);
          showWorldUpdateToast(rec.name, isCurrent);
          renderWorldsList().catch(() => {});
        }
      })
      .catch((err) => {
        console.warn(`background sync ${w.source}:${w.remoteId} failed:`, err);
      });
  }
}


// --- Boot ---
// Menu-first: don't auto-load any world. Entering a world (cached or
// available) always requires the user to tap it — which they have to do
// anyway because WebXR session entry / pointer-lock both need a user gesture.
// Pre-loading the previous world just to render it behind the menu wastes a
// parse and gives the wrong impression that we'll auto-enter on Quest.
//
// Background cache invalidation still fires (silently) so the list shows
// fresh upstream changes for cached bundled / onedrive worlds.
async function bootstrap() {
  await migrateLegacyTombstones();          // one-shot from previous localStorage build
  await renderWorldsList();
  checkRemoteUpdates();
}

async function renderWorldsList() {
  const cached = await listWorlds();                            // sorted by lastVisitedAt
  const cachedKey = new Set();
  for (const w of cached) if (w.remoteId) cachedKey.add(`${w.source}:${w.remoteId}`);

  // Pull "available but not cached" from each provider — these show as a
  // "Tap to cache" entry in the menu.
  const available = [];
  for (const p of providers) {
    try {
      const items = await p.list();
      for (const it of items) {
        if (!cachedKey.has(`${p.source}:${it.remoteId}`)) {
          available.push({
            kind: "uncached",
            source: p.source,
            remoteId: it.remoteId,
            name: it.name,
          });
        }
      }
    } catch (err) {
      console.warn(`provider ${p.source} list failed:`, err.message || err);
    }
  }

  worldsListEl.innerHTML = "";
  for (const w of [...cached, ...available]) {
    const uncached = w.kind === "uncached";
    const isCurrent =
      (w.id && w.id === current.id) ||
      (w.remoteId && w.source === current.source && w.remoteId === current.remoteId);
    const li = document.createElement("li");
    li.className =
      "world-item" + (isCurrent ? " current" : "") + (uncached ? " uncached" : "");
    if (w.id) li.dataset.id = w.id;
    else {
      li.dataset.source = w.source;
      li.dataset.remoteId = w.remoteId;
      li.dataset.worldName = w.name;
    }

    const info = document.createElement("div");
    info.className = "world-info";
    const nameSpan = document.createElement("span");
    nameSpan.className = "world-name";
    nameSpan.textContent = w.name;
    if (w.source === "bundled") {
      const badge = document.createElement("span");
      badge.className = "world-badge";
      badge.textContent = "default";
      nameSpan.appendChild(badge);
    }
    info.appendChild(nameSpan);

    const metaSpan = document.createElement("span");
    metaSpan.className = "world-meta";
    if (uncached) {
      metaSpan.textContent = "Not cached — tap to stream";
    } else {
      // Cached worlds are always optimized (cache + optimize is atomic).
      // When we add texture-compression options, the hint goes here.
      metaSpan.textContent =
        `${formatBytes(w.byteLength)} · ${formatRelativeTime(w.lastVisitedAt)}`;
    }
    info.appendChild(metaSpan);
    li.appendChild(info);

    // Right-side action button: ↓ for uncached (download to cache), × for
    // cached non-current (uncache / delete). Current world has no button.
    if (uncached) {
      const dl = document.createElement("button");
      dl.className = "world-cache";
      dl.type = "button";
      dl.dataset.source = w.source;
      dl.dataset.remoteId = w.remoteId;
      dl.dataset.worldName = w.name;
      dl.title = "Download for offline";
      dl.textContent = "↓";
      li.appendChild(dl);
    } else if (w.id && !isCurrent) {
      const del = document.createElement("button");
      del.className = "world-delete";
      del.type = "button";
      del.dataset.id = w.id;
      del.title = w.source === "local" ? "Delete world" : "Remove from cache";
      del.textContent = "×";
      li.appendChild(del);
    }
    worldsListEl.appendChild(li);
  }
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  const s = diff / 1000;
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)}d ago`;
  return new Date(ts).toLocaleDateString();
}

// --- Render loop ---
// setAnimationLoop drives both the regular RAF and the WebXR frame loop —
// three.js swaps the source automatically based on session state.
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  if (renderer.xr.isPresenting) {
    xr.update(dt);
    player.updateBodyTracking(vignette, dt);
  } else {
    flat.update(dt);
    vignette.update(0, dt);   // fade out if we just exited VR
  }
  renderer.render(scene, camera);
});

// --- Service worker (skip on localhost so dev reloads stay fresh) ---
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
if ("serviceWorker" in navigator && !isLocal) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "asset-updated") updateToast.classList.remove("hidden");
  });
}
updateReload.addEventListener("click", () => {
  navigator.serviceWorker.controller?.postMessage({ type: "skip-waiting" });
  location.reload();
});

// --- Init ---
requestPersist().then((granted) => {
  console.log("persistent storage:", granted ? "granted" : "best-effort");
});
bootstrap();
