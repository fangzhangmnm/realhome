import * as THREE from "three";
import { createScene } from "./scene.js";
import { createPlayer } from "./player.js";
import { createFlatControls } from "./controls.js";
import { createXrControls } from "./xrControls.js";
import { createCollision } from "./collision.js";
import { createVignette } from "./vignette.js";
import { loadGlbFromFile, loadGlbFromBlob, bindRenderer as bindWorldLoaderRenderer } from "./worldLoader.js";
import {
  addWorld, getWorld, listWorlds, touchWorld, deleteWorld,
  findByRemoteId, updateRemoteSync, requestPersist,
  migrateLegacyTombstones,
  clearAllWorlds, clearAllSettings,
  setThumbnail,
  getSetting, setSetting,
  applySyncPatch,
  isTombstoned, insertTombstone, deleteTombstone,
  hasEverSignedIn, markSignedIn,
  getUsage, getEvictableBytes, evictUnpinnedLRU,
} from "./worldStore.js";
import { providers, getProvider } from "./providers.js";
import { isOneDriveConfigured, SEATED_BUMP_M } from "./config.js";

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
const seatedToggle = document.getElementById("seatedToggle");
const refreshButton = document.getElementById("refreshButton");
const menuToggle = document.getElementById("menuToggle");
const menuToggleBadge = document.getElementById("menuToggleBadge");
const menuDrawer = document.getElementById("menuDrawer");
const menuBackdrop = document.getElementById("menuBackdrop");
const menuClose = document.getElementById("menuClose");
const hudName = document.getElementById("hudName");
const hudStatus = document.getElementById("hudStatus");
const updateToast = document.getElementById("updateToast");
const updateReload = document.getElementById("updateReload");
const worldUpdateToast = document.getElementById("worldUpdateToast");
const worldUpdateText = document.getElementById("worldUpdateText");
const progressBar = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");
const errorLog = document.getElementById("errorLog");
const onedriveBar = document.getElementById("onedriveBar");
const onedriveStatus = document.getElementById("onedriveStatus");
const onedriveSignIn = document.getElementById("onedriveSignIn");
const onedriveSignOut = document.getElementById("onedriveSignOut");
const enterPrompt = document.getElementById("enterPrompt");
const enterPromptName = document.getElementById("enterPromptName");
const enterPromptButton = document.getElementById("enterPromptButton");
const enterPromptCancel = document.getElementById("enterPromptCancel");

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
  flushPendingUploads().catch(() => {});
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
// Track whether the current XR session granted dom-overlay. When granted,
// we keep #startOverlay visible (Quest's compositor draws it inside the
// XR view) so the user can pick a different world without leaving VR.
// When NOT granted, hide the overlay — the DOM is invisible in immersive
// anyway, and Quest's "running in background" panel takes over.
// In-VR menu is not supported on Quest browser today. See docs/user-flows.md.
// The menu DOM is hidden during XR; user exits via Meta button to switch.
renderer.xr.addEventListener("sessionstart", () => {
  document.body.classList.add("xr-active");
  overlay.classList.add("hidden");
});
renderer.xr.addEventListener("sessionend", () => {
  document.body.classList.remove("xr-active");
  overlay.classList.remove("hidden");
  checkRemoteUpdates();
  flushPendingUploads().catch(() => {});
});

// --- Settings drawer (right slide-in) ---
function openDrawer() {
  menuDrawer.classList.add("open");
  menuBackdrop.classList.add("show");
  menuDrawer.setAttribute("aria-hidden", "false");
}
function closeDrawer() {
  menuDrawer.classList.remove("open");
  menuBackdrop.classList.remove("show");
  menuDrawer.setAttribute("aria-hidden", "true");
}
menuToggle.addEventListener("click", (e) => { e.stopPropagation(); openDrawer(); });
menuClose.addEventListener("click", (e) => { e.stopPropagation(); closeDrawer(); });
menuBackdrop.addEventListener("click", closeDrawer);

// --- Clean cache (OneDrive-style "remove local copies") ---
// Itemized clean-cache (constraint #2). Counts what's about to vanish at
// each protection level so the user can decide. Default action = cancel.
cleanCacheButton.addEventListener("click", async (e) => {
  e.stopPropagation();
  const all = await listWorlds();
  const local = all.filter((w) => w.source === "local");
  const pendingCount = all.filter((w) => w.pendingUpload && !w.uploadDeferred).length;
  const cloud = all.filter((w) => w.source === "onedrive");
  const bundled = all.filter((w) => w.source === "bundled");
  const fmt = (arr) => arr.length
    ? `${arr.length} (${formatBytes(arr.reduce((s, w) => s + (w.byteLength || 0), 0))})`
    : "0";
  const lines = [
    "Clean ALL local cache?",
    "",
    `  • Local-only worlds: ${fmt(local)} ⚠ NOT recoverable`,
  ];
  if (pendingCount > 0) {
    lines.push(`    └ ${pendingCount} not yet uploaded to OneDrive — those bytes will be lost`);
  }
  lines.push(
    `  • OneDrive cached worlds: ${fmt(cloud)} (re-downloadable when online)`,
    `  • Bundled cached worlds: ${fmt(bundled)} (re-cacheable)`,
    "",
    "All settings (tombstones, seated mode, ...) also reset.",
  );
  const ok = confirm(lines.join("\n"));
  if (!ok) return;
  await clearAllWorlds();
  await clearAllSettings();
  location.reload();
});

// --- Seated mode toggle ---
// On = lift the rig by SEATED_BUMP_M (config; 0.4m by convention).
// Off = no offset. Persisted per-device so a seated user's preference
// survives reload.
seatedToggle.addEventListener("change", () => {
  const on = !!seatedToggle.checked;
  player.setSeatedBump(on ? SEATED_BUMP_M : 0);
  setSetting("seatedMode", on).catch(() => {});
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
    await handleCache(
      cacheBtn.dataset.source,
      cacheBtn.dataset.remoteId,
      cacheBtn.dataset.worldName,
      cacheBtn.dataset.thumbnailRemoteId || null,
    );
    return;
  }
  const deleteRemoteBtn = e.target.closest(".world-delete-remote");
  if (deleteRemoteBtn) { await handleDeleteRemote(deleteRemoteBtn.dataset.id); return; }
  const deleteBtn = e.target.closest(".world-delete");
  if (deleteBtn) { await handleDelete(deleteBtn.dataset.id); return; }
  const item = e.target.closest(".world-card");
  if (item) await handleEnter(item);
});

// Tap on world body = enter. Two cases:
//   - cached entry  → switchToWorld (read IDB blob + parse)
//   - uncached      → streamOpenWorld (download + parse, no IDB write)
//
// Order: LOAD FIRST, then enter VR / lock pointer. The load runs while
// the user is still in menu state — DOM menu covers the canvas so the
// previous world's geometry isn't visible, and setWorld() does an
// atomic swap when the new world is parsed. No blackout needed.
//
// User-gesture: requestSession / pointer-lock both need a "transient
// activation" that lasts ~5s after a click in Chrome. If the load
// finishes inside that window we fire the request automatically. If
// not, we show the enter prompt — a full-screen "Tap to enter" overlay
// that solicits a fresh gesture from the user.
const GESTURE_WINDOW_MS = 4000;     // safe margin under Chrome's ~5s

async function handleEnter(item) {
  if (loading) return;
  hideEnterPrompt();

  const id = item.dataset.id;
  const source = item.dataset.source;
  const remoteId = item.dataset.remoteId;
  const name = item.dataset.worldName
    || item.querySelector(".world-name")?.textContent
    || id || remoteId || "world";
  const isCurrent =
    (id && id === current.id) ||
    (remoteId && source === current.source && remoteId === current.remoteId);

  // Same world already loaded — just enter on this click's activation.
  if (isCurrent) { enterImmersive(); return; }

  const gestureTime = performance.now();
  if (id) await switchToWorld(id);
  else await streamOpenWorld(source, remoteId, name);

  // Bail if the load failed (current state didn't move).
  const loaded =
    (id && current.id === id) ||
    (remoteId && current.source === source && current.remoteId === remoteId);
  if (!loaded) return;

  if (performance.now() - gestureTime < GESTURE_WINDOW_MS) {
    enterImmersive();
  } else {
    showEnterPrompt(name);
  }
}

// Fire VR session / pointer-lock using whatever live user activation the
// caller has. Caller must be inside a fresh-enough gesture context.
function enterImmersive() {
  if (xrSupported && !renderer.xr.isPresenting) enterVR();
  else tryLock();
}

function showEnterPrompt(name) {
  enterPromptName.textContent = name;
  enterPrompt.classList.remove("hidden");
}
function hideEnterPrompt() {
  enterPrompt.classList.add("hidden");
}
enterPromptButton.addEventListener("click", (e) => {
  e.stopPropagation();
  hideEnterPrompt();
  enterImmersive();
});
enterPromptCancel.addEventListener("click", (e) => {
  e.stopPropagation();
  hideEnterPrompt();
});

// ↓ button on uncached entries. Persists the blob to IDB and runs the
// optimizer — but does NOT enter the world. User can tap the body afterwards
// (or right now to enter and re-render from IDB on next session).
async function handleCache(source, remoteId, name, thumbnailRemoteId = null) {
  const rec = await cacheWorld(source, remoteId, name, { thumbnailRemoteId });
  if (rec) await refreshThumbnailForRec(rec, thumbnailRemoteId);
  await renderWorldsList();
}

// × button. Local-cache delete only (does NOT touch the cloud). For
// remote-backed records we write a tombstone pinned to the current etag
// so the next mergeRemoteList won't silently re-discover and resurrect
// the row — see docs/sync-constraints.md constraint #2 + etag-pinning.
// A later cloud-side change to the same item (new etag) invalidates
// the tombstone automatically (we re-discover the new version).
async function handleDelete(id) {
  if (id === current.id) return;  // can't delete the currently-loaded world
  const record = await getWorld(id);
  if (!record) return;
  const msg = record.source === "local"
    ? `Delete "${record.name}"?\n\nLocal uploads have no remote copy — this can't be undone.`
    : `Remove "${record.name}" from cache?\n\nThe cloud copy stays; you can ↓ it again anytime. ` +
      `Background sync won't re-add it as available until the cloud version changes.`;
  if (!confirm(msg)) return;
  if (record.remoteId) {
    await insertTombstone(record.source, record.remoteId, record.remoteEtag);
  }
  await deleteWorld(id);
  await renderWorldsList();
}

// "Delete from OneDrive too" — for cached worlds with source="onedrive".
// Removes the remote item via Graph + the local IDB record. Permanent;
// scarier confirm dialog. Other devices' cached copies are unaffected at
// the time of deletion, but their next background sync will see the file
// is gone (the local record stays; user can × it manually).
async function handleDeleteRemote(id) {
  if (id === current.id) return;
  const record = await getWorld(id);
  if (!record || record.source !== "onedrive" || !record.remoteId) return;
  const ok = confirm(
    `Delete "${record.name}" from OneDrive?\n\n` +
    `This affects all your devices: the file will be removed from your ` +
    `OneDrive RealHome folder permanently. Other devices that still have ` +
    `it cached will keep their local copy until they refresh.\n\n` +
    `This can't be undone.`
  );
  if (!ok) return;
  // Per constraint #2 / P1.10: cloud-delete failure aborts the whole op
  // (don't pretend it's gone if it isn't). User retries when online.
  const provider = getProvider(record.source);
  try {
    await provider.delete(record.remoteId);
  } catch (err) {
    logError(`delete-remote:${record.remoteId}`,
      `OneDrive delete failed (try again when online): ${err.message || err}`);
    return;
  }
  // Defensive tombstone — if cloud delete propagation lags, this stops
  // a fast follow-up mergeRemoteList from resurrecting the row.
  await insertTombstone(record.source, record.remoteId, record.remoteEtag);
  await deleteWorld(id);
  await renderWorldsList();
}

// --- World loading paths ---
//
// loadFile is the local-side ingest path (file picker + drag/drop). Per
// constraint #4 (in-app upload semantics):
//   - signed in at drag time → save locally + mark pendingUpload=true,
//     push opportunistically. Retry across sessions until success.
//   - NOT signed in → save locally, NO pendingUpload (consent doesn't
//     extrapolate to "push to whatever cloud I might add later").
//
// Either way: world is immediately playable from IDB. The push runs in
// background via flushPendingUploads.
async function loadFile(file) {
  if (loading) return;
  if (!/\.(glb|gltf)$/i.test(file.name)) { setStatus("not a .glb/.gltf"); return; }
  loading = true;
  hudName.textContent = file.name;
  showLoading("Loading", file.name, -1);
  try {
    const finalBlob = file instanceof Blob ? file : new Blob([file], { type: "model/gltf-binary" });
    const result = await loadGlbFromBlob(finalBlob, file.name);

    // Save first (pinned, source=local). pendingUpload flag depends on
    // whether the user is signed in RIGHT NOW (their drag-time intent).
    // Don't await account fetch on the critical path — guess via MSAL
    // already-initialized state; flushPendingUploads will reconcile.
    const signedIn = await isSignedInQuick();
    const record = await addWorld(finalBlob, file.name, {
      source: "local",
      pinned: true,
      pendingUpload: signedIn,
    });
    current.id = record.id;
    current.source = record.source;
    current.remoteId = record.remoteId;
    installWorld(result, file.name);
    setStatus(signedIn ? "saved, uploading…" : "saved locally");
    await renderWorldsList();
    if (signedIn) flushPendingUploads().catch(() => {});
  } catch (err) {
    console.error(err);
    setStatus("save failed");
    logError(`upload:${file.name}`, `save failed: ${err.message || err}`);
  } finally {
    hideLoading();
    loading = false;
  }
}

// Lightweight signed-in check used by drag-time intent. Doesn't kick off
// MSAL init — if MSAL hasn't loaded, we report "not signed in" (which is
// a safe default — won't auto-push to a cloud we can't reach anyway).
async function isSignedInQuick() {
  if (!isOneDriveConfigured()) return false;
  try {
    const { getAccount } = await import("./onedriveAuth.js");
    return !!(await getAccount());
  } catch {
    return false;
  }
}

// Push one record to its provider's cloud. Used by flushPendingUploads.
// Handles collision via three-option prompt (overwrite / rename / defer).
// Returns one of: "ok" (record upgraded to source=onedrive), "deferred"
// (user chose keep-local-don't-upload), "skip" (provider not available
// right now, try again later), "fail" (logged the error).
async function pushRecord(rec) {
  if (!rec || !rec.blob || !rec.pendingUpload) return "skip";
  // Where is this record going? If source is "local", it needs to migrate
  // to the OneDrive source on success. If already "onedrive" (e.g. a
  // retry after offline), keep current source.
  const targetSource = rec.source === "local" ? "onedrive" : rec.source;
  const provider = getProvider(targetSource);
  if (!provider || typeof provider.upload !== "function") return "skip";
  // Signed-in gate. flushPendingUploads also checks this before iterating
  // but worth being defensive.
  if (targetSource === "onedrive") {
    try {
      const { getAccount } = await import("./onedriveAuth.js");
      if (!(await getAccount())) return "skip";
    } catch { return "skip"; }
  }

  // Collision precheck — see constraint P1.6 ("default preserve both,
  // not overwrite") and #7 ("surface duplicates, require rename").
  let existing = null;
  try {
    existing = provider.getItemByName ? await provider.getItemByName(rec.name) : null;
  } catch (err) {
    logError(`upload:${rec.name}`, `precheck: ${err.message || err}`);
    return "fail";
  }
  let overwrite = false;
  let uploadName = rec.name;
  if (existing && existing.remoteId !== rec.remoteId) {
    // Three-option prompt. We use one confirm() (overwrite Y/N) and a
    // follow-up confirm() (rename Y / skip N) for portability. A nicer
    // modal UI is a future task.
    const wantsOverwrite = confirm(
      `"${rec.name}" already exists on OneDrive (modified ` +
      `${existing.size ? formatBytes(existing.size) : "?"}).\n\n` +
      `OK = overwrite the cloud version with your local copy.\n` +
      `Cancel = keep both (you'll be asked how next).`
    );
    if (wantsOverwrite) {
      overwrite = true;
    } else {
      const rename = confirm(
        `Upload as a renamed copy?\n\n` +
        `OK = upload as "${rec.name.replace(/\.glb$/i, "")} (offline copy).glb"\n` +
        `Cancel = keep this file local-only, don't upload (you can ↑ later)`
      );
      if (rename) {
        uploadName = rec.name.replace(/\.glb$/i, " (offline copy).glb");
      } else {
        await applySyncPatch(rec.id, { pendingUpload: false, uploadDeferred: true });
        return "deferred";
      }
    }
  }

  showProgress(`Uploading ${uploadName} to OneDrive…`, 0);
  try {
    const result = await provider.upload(uploadName, rec.blob, {
      overwrite,
      onProgress: (loaded, total) => {
        const f = total > 0 ? loaded / total : -1;
        const label = total > 0
          ? `Uploading ${uploadName}… ${formatBytes(loaded)} / ${formatBytes(total)}`
          : `Uploading ${uploadName}… ${formatBytes(loaded)}`;
        showProgress(label, f);
      },
    });
    hideProgress();
    await applySyncPatch(rec.id, {
      source: targetSource,
      remoteId: result.remoteId,
      remoteEtag: result.etag,
      remoteName: uploadName,
      name: uploadName,        // if we suffixed, reflect locally too
      pendingUpload: false,
      remoteFound: true,
      lastSyncedAt: Date.now(),
    });
    return "ok";
  } catch (err) {
    hideProgress();
    logError(`upload:${rec.name}`, `OneDrive upload: ${err.message || err}`);
    return "fail";
  }
}

// Iterate all pendingUpload records and try to push each. Triggered on:
//   - app boot (after MSAL init)
//   - window.online event
//   - sign-in success
//   - drag-drop (kicks one off immediately)
// No polling. No aggressive retry on failure — failed records keep
// pendingUpload=true; next opportunity tries again.
let _flushInFlight = false;
async function flushPendingUploads() {
  if (_flushInFlight) return;
  _flushInFlight = true;
  try {
    if (!isOneDriveConfigured()) return;
    const { getAccount } = await import("./onedriveAuth.js");
    const account = await getAccount();
    if (!account) return;
    const all = await listWorlds();
    const pending = all.filter((w) => w.pendingUpload && !w.uploadDeferred && w.blob);
    if (pending.length === 0) return;
    for (const w of pending) {
      const outcome = await pushRecord(w);
      if (outcome === "ok") {
        await renderWorldsList().catch(() => {});
      }
      // "fail" / "skip" / "deferred" don't trigger re-render of others;
      // pendingUpload stays true for failures, will retry next chance.
      if (outcome === "fail" || outcome === "skip") break;  // stop on first error
    }
  } catch (err) {
    console.warn("flushPendingUploads:", err);
  } finally {
    _flushInFlight = false;
  }
}

async function switchToWorld(id) {
  if (loading || id === current.id) return;
  loading = true;
  setStatus("loading…");
  showLoading("Loading", "", -1);
  try {
    const record = await getWorld(id);
    if (!record || !record.blob) throw new Error("world not found");
    showLoading("Loading", record.name, -1);
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
    setStatus("load failed");
    logError(`load:${id}`, `load failed: ${err.message || err}`);
  } finally {
    hideLoading();
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
  showLoading("Downloading", name, 0);
  try {
    const p = providers.find((p) => p.source === source);
    if (!p) throw new Error(`no provider for ${source}`);
    const result = await p.fetch(remoteId, undefined, (loaded, total) => {
      const f = total > 0 ? loaded / total : -1;
      const det = total > 0
        ? `${name} · ${formatBytes(loaded)} / ${formatBytes(total)}`
        : `${name} · ${formatBytes(loaded)}`;
      updateLoading("Downloading", det, f);
    });
    if (!result) throw new Error("source unavailable");
    updateLoading("Loading", name, -1);
    const parsed = await loadGlbFromBlob(result.blob, name);
    current.id = null;
    current.source = source;
    current.remoteId = remoteId;
    installWorld(parsed, name);
    setStatus("");
    await renderWorldsList();
  } catch (err) {
    console.error(err);
    setStatus("load failed");
    logError(`stream:${source}:${remoteId}`, `${name}: ${err.message || err}`);
  } finally {
    hideLoading();
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

  // Spawn convention: if the glb has an Empty named `_spawn` (or just
  // `spawn`), the player resets to its world-space position + Y rotation.
  // Otherwise falls back to (0, 0, 0). See worldLoader.extractSpawn.
  player.setSpawnPoint(result.spawn);
  // Reset player to spawn. In VR, reset captures the current HMD pose as
  // tracking_origin so the user lands at virtual origin regardless of where
  // local-floor anchored.
  player.reset();
  // Flat mode: PointerLockControls owns camera.quaternion via mouse-look.
  // player.reset() doesn't touch it (mouse-look state is rig-relative).
  // On world swap we want a clean look-forward — otherwise the user lands
  // in the new world still pitched 60° up because that's where their
  // mouse left off in the previous world.
  if (!renderer.xr.isPresenting) camera.quaternion.identity();
  hudName.textContent = name;
  // Updating document.title so the Quest "running in background" panel
  // header reads cleanly (it inherits the tab title). See docs/ui-layers.md.
  document.title = `RealHome — ${name}`;
  const note = [];
  if (result.skyboxes.length) note.push(`skybox×${result.skyboxes.length}`);
  if (result.colliders.length) note.push(`collider×${result.colliders.length}`);
  if (result.spawn) note.push("spawn");
  setStatus(note.join(" · "));
}

function setStatus(s) { hudStatus.textContent = s; }

// Loading indicator. Always DOM-only now: the load-first flow keeps the
// user in menu state until the world is ready, so the DOM progress bar
// is always visible. No more 3D loading panel — see docs/user-flows.md.
function showLoading(label, detail = "", fraction = -1) {
  const text = detail ? `${label} — ${detail}` : label;
  showProgress(text, fraction);
}
function updateLoading(label, detail, fraction) {
  showLoading(label, detail, fraction);
}
function hideLoading() {
  hideProgress();
}

// Persistent error log shown inline in the menu. setStatus() is ephemeral
// (overwritten by next op); logError() entries stay until the user dismisses.
// Key is used to dedup repeated errors (e.g. provider list failing every
// menu open) — passing the same key just refreshes the timestamp.
const errorEntries = new Map();   // key → { time, msg, node }
function logError(key, msg) {
  console.warn(`[${key}]`, msg);
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  let entry = errorEntries.get(key);
  if (entry) {
    entry.node.querySelector(".error-time").textContent = timeStr;
    entry.node.querySelector(".error-text").textContent = msg;
    entry.time = now;
    entry.msg = msg;
  } else {
    const node = document.createElement("div");
    node.className = "error-entry";
    const t = document.createElement("span");
    t.className = "error-time";
    t.textContent = timeStr;
    const text = document.createElement("span");
    text.className = "error-text";
    text.style.flex = "1";
    text.textContent = msg;
    const x = document.createElement("button");
    x.className = "error-dismiss";
    x.type = "button";
    x.textContent = "×";
    x.addEventListener("click", (ev) => {
      ev.stopPropagation();
      node.remove();
      errorEntries.delete(key);
      if (errorEntries.size === 0) errorLog.classList.add("hidden");
    });
    node.appendChild(t);
    node.appendChild(text);
    node.appendChild(x);
    errorLog.appendChild(node);
    errorEntries.set(key, { time: now, msg, node });
  }
  errorLog.classList.remove("hidden");
}
function clearError(key) {
  const entry = errorEntries.get(key);
  if (!entry) return;
  entry.node.remove();
  errorEntries.delete(key);
  if (errorEntries.size === 0) errorLog.classList.add("hidden");
}

// Progress bar — pass fraction in [0, 1] for determinate (download), or -1
// for indeterminate (optimize). hideProgress() removes the bar.
function showProgress(label, fraction) {
  progressLabel.textContent = label;
  progressBar.classList.remove("hidden");
  if (fraction < 0) {
    progressFill.classList.add("indeterminate");
    progressFill.style.width = "";
  } else {
    progressFill.classList.remove("indeterminate");
    progressFill.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  }
}
function hideProgress() {
  progressBar.classList.add("hidden");
  progressFill.classList.remove("indeterminate");
  progressFill.style.width = "0%";
}

let worldToastTimer = 0;
function showWorldUpdateToast(name, isCurrent) {
  worldUpdateText.textContent = isCurrent
    ? `"${name}" was updated upstream. Re-enter to see the new version.`
    : `"${name}" was updated upstream.`;
  worldUpdateToast.classList.remove("hidden");
  clearTimeout(worldToastTimer);
  worldToastTimer = setTimeout(() => worldUpdateToast.classList.add("hidden"), 6000);
}

// --- Provider-based cache (unifies bundled / onedrive) ---
// Fetches the latest bytes via the provider and writes to IDB. No optimize
// pass — bytes are stored verbatim (the artist's Blender export is the
// authoritative form). Failure during download = no IDB write.
//
// `quiet`: suppresses the HUD chatter for background invalidation checks.
// `thumbnailRemoteId`: when provided (and the provider has fetchThumbnail),
//                      a sidecar PNG is pulled into IDB after the world is
//                      saved. Sidecar fetch failures are silent — the
//                      gradient placeholder shows through.
async function cacheWorld(source, remoteId, name, opts = {}) {
  const { quiet = false, thumbnailRemoteId = null } = opts;
  const p = providers.find((p) => p.source === source);
  if (!p) throw new Error(`no provider for source=${source}`);
  const existing = await findByRemoteId(source, remoteId);
  // Manual ↓ supersedes any tombstone for this (source, remoteId).
  // (Background mergeRemoteList respects tombstones; explicit user action
  // doesn't.) Idempotent — no-op if no tombstone exists.
  if (!quiet) await deleteTombstone(source, remoteId).catch(() => {});
  if (!quiet) showProgress(`Downloading ${name}…`, 0);
  let result;
  try {
    result = await p.fetch(remoteId, existing?.remoteEtag, (loaded, total) => {
      if (quiet) return;
      const f = total > 0 ? loaded / total : -1;
      const label = total > 0
        ? `Downloading ${name}… ${formatBytes(loaded)} / ${formatBytes(total)}`
        : `Downloading ${name}… ${formatBytes(loaded)}`;
      showProgress(label, f);
    });
  } catch (err) {
    if (!quiet) {
      hideProgress();
      setStatus("fetch failed");
      logError(`cache:${source}:${remoteId}`, `fetch ${name}: ${err.message || err}`);
    }
    return existing || null;
  }
  if (!result) {
    if (!quiet) hideProgress();
    return existing;
  }

  // No optimize pass. Write the bytes straight to IDB.
  if (!quiet) hideProgress();
  let rec;
  if (existing) {
    await updateRemoteSync(existing.id, result.blob, result.etag);
    rec = await getWorld(existing.id);
  } else {
    rec = await addWorld(result.blob, name, {
      source, remoteId, remoteEtag: result.etag,
      thumbnailRemoteId,                     // remember for offline re-display
    });
  }
  if (!quiet) setStatus("");
  return rec;
}

// Refresh the sidecar thumbnail for a cached world. Called from:
//   - handleCache (manual ↓): grabs the first sidecar at cache time
//   - checkRemoteUpdates (background): re-pulls thumbnails alongside the
//     glb update check so the IDB image stays current when the artist
//     changes the sidecar PNG
// `idOverride` lets the manual path pass a fresh thumbnailRemoteId from
// the provider.list() result, in case it's newer than what's in IDB.
// Failure is silent — the gradient placeholder is the fallback.
async function refreshThumbnailForRec(rec, idOverride = null) {
  if (!rec) return;
  const thumbId = idOverride || rec.thumbnailRemoteId;
  if (!thumbId) return;
  const p = providers.find((p) => p.source === rec.source);
  if (!p?.fetchThumbnail) return;
  try {
    const blob = await p.fetchThumbnail(thumbId);
    if (blob) {
      await setThumbnail(rec.id, blob);
      renderWorldsList().catch(() => {});
    }
  } catch (err) {
    console.warn(`refreshThumbnail ${rec.name}:`, err);
  }
}

// Background sync: per-provider merge + cached-record content refresh.
// Per docs/sync-constraints.md:
//   - List failure → no record mutation at all (U3 — only successful
//     lists can flip remoteFound)
//   - Empty-list safety net (#2 detail) — refuse to batch-ghost when 0
//     items returned but we had N cached for that source
//   - Per-item: mark remoteFound, clear stale tombstones (etag mismatch),
//     conditional content refresh, thumbnail refresh
// Stub creation deferred: v1 doesn't materialize remote-only items into
// IDB rows; the render layer synthesizes them from provider.list().
async function checkRemoteUpdates() {
  const cached = await listWorlds();
  for (const p of providers) {
    if (typeof p.list !== "function") continue;
    const cachedForSource = cached.filter((w) => w.source === p.source && w.remoteId);

    let items;
    try {
      items = await p.list();
    } catch (err) {
      console.warn(`mergeRemoteList ${p.source} failed:`, err.message || err);
      continue;       // no signal → no mutation
    }
    const seen = new Map();
    for (const it of items) seen.set(it.remoteId, it);

    // Empty-list safety net: if remote returned [] but local has cached
    // records for this source, assume transient and DO NOT batch-ghost.
    // Per-item processing still runs for items that ARE in the list.
    const ghostingAll = items.length === 0 && cachedForSource.length > 0;
    if (ghostingAll) {
      console.warn(`mergeRemoteList ${p.source}: empty list but ${cachedForSource.length} cached — safety net engaged, skipping ghost marks`);
    }

    // Per-cached-record: remoteFound flip + content refresh
    for (const w of cachedForSource) {
      const matchingItem = seen.get(w.remoteId);
      if (matchingItem) {
        // Found upstream. Un-ghost if it was a ghost; refresh content if etag changed.
        if (!w.remoteFound) {
          await applySyncPatch(w.id, { remoteFound: true, lastSyncedAt: Date.now() });
        }
        cacheWorld(w.source, w.remoteId, w.name, { quiet: true })
          .then((rec) => {
            if (rec && rec.remoteEtag !== w.remoteEtag) {
              const isCurrent =
                (current.id && current.id === rec.id) ||
                (current.remoteId && current.source === rec.source && current.remoteId === rec.remoteId);
              showWorldUpdateToast(rec.name, isCurrent);
              renderWorldsList().catch(() => {});
            }
          })
          .catch((err) => console.warn(`refresh ${w.source}:${w.remoteId}:`, err));
        refreshThumbnailForRec(w).catch(() => {});
      } else if (!ghostingAll) {
        // Genuinely missing from a successful list → mark ghost.
        // Keep blob (constraint P1.8 — ghosts never auto-delete).
        if (w.remoteFound !== false) {
          await applySyncPatch(w.id, { remoteFound: false });
        }
      }
    }

    // Stale tombstone GC: for any item currently in the remote list with
    // an etag different from a stored tombstone, clear the tombstone so
    // the new version isn't suppressed forever (constraint P1.7).
    for (const it of items) {
      const stillMatches = await isTombstoned(p.source, it.remoteId, it.etag);
      if (!stillMatches) {
        await deleteTombstone(p.source, it.remoteId).catch(() => {});
      }
    }
  }
  renderWorldsList().catch(() => {});
}


// --- OneDrive sign-in UI ---
// Wires the sign-in / sign-out buttons. Sign-in is interactive (loginRedirect
// reloads the page). On boot we drain MSAL's redirect state and refresh the
// status row.
async function refreshOneDriveStatus() {
  if (!isOneDriveConfigured()) {
    onedriveBar.classList.add("hidden");
    menuToggleBadge.classList.add("hidden");
    return;
  }
  onedriveBar.classList.remove("hidden");
  try {
    const { getAccount } = await import("./onedriveAuth.js");
    const account = await getAccount();
    if (account) {
      onedriveStatus.textContent = `Signed in: ${account.username}`;
      onedriveSignIn.classList.add("hidden");
      onedriveSignOut.classList.remove("hidden");
      menuToggleBadge.classList.add("hidden");
    } else {
      onedriveStatus.textContent = "Not signed in";
      onedriveSignIn.classList.remove("hidden");
      onedriveSignOut.classList.add("hidden");
      // Show the orange dot on the hamburger — hints there's a sign-in
      // action available inside, without putting sign-in UI in the main area.
      menuToggleBadge.classList.remove("hidden");
    }
  } catch (err) {
    // MSAL bundle failed to load, init threw, etc. Leave the bar in its
    // default "Not signed in" state — the user can still click sign-in to
    // retry, and everything else (bundled / cached worlds) keeps working.
    // No errorLog: this fires on every boot when offline; would be noise.
    console.warn("OneDrive status refresh failed:", err);
  }
}
onedriveSignIn.addEventListener("click", async (e) => {
  e.stopPropagation();
  try {
    const { signIn } = await import("./onedriveAuth.js");
    await signIn();   // navigates away — code below doesn't run
  } catch (err) {
    logError("onedrive:signin", `sign-in failed: ${err.message || err}`);
  }
});
onedriveSignOut.addEventListener("click", async (e) => {
  e.stopPropagation();
  try {
    const { signOut } = await import("./onedriveAuth.js");
    await signOut();   // local cache clear only — no navigation
    await refreshOneDriveStatus();
    await renderWorldsList();   // re-render so OneDrive entries drop out
  } catch (err) {
    logError("onedrive:signout", `sign-out failed: ${err.message || err}`);
  }
});

// --- Boot ---
// Menu-first: don't auto-load any world. Entering a world (cached or
// available) always requires the user to tap it — which they have to do
// anyway because WebXR session entry / pointer-lock both need a user gesture.
//
// Render order:
//   1. (sync) Show OneDrive sign-in bar in default state so the button is
//      visible on first paint — DO NOT await MSAL init here.
//   2. Render cached worlds list (no provider calls yet).
//   3. (async, background) Drain MSAL redirect + probe. If signed in, swap
//      bar to "Signed in: ..." and re-render to show OneDrive entries.
//
// MSAL.initialize() + handleRedirectPromise() + silent token probe can take
// several seconds (especially when the silent-renew iframe lands on a
// chrome-error page during a redirect URI mismatch — see docs). Blocking
// the menu paint on this == "user sees no Sign in button for many seconds."
async function bootstrap() {
  await migrateLegacyTombstones();          // one-shot from previous localStorage build

  // Restore persisted settings (seated mode, future locomotion knobs).
  // Sync write to player.setSeatedBump so the rig position is correct
  // before the first frame.
  const seatedMode = !!(await getSetting("seatedMode", false));
  seatedToggle.checked = seatedMode;
  player.setSeatedBump(seatedMode ? SEATED_BUMP_M : 0);

  // Show the OneDrive bar synchronously with the default "Not signed in"
  // state. If MSAL later discovers a cached account, refreshOneDriveStatus()
  // swaps the text + button visibility.
  if (isOneDriveConfigured()) {
    onedriveBar.classList.remove("hidden");
    onedriveStatus.textContent = "Not signed in";
    onedriveSignIn.classList.remove("hidden");
    onedriveSignOut.classList.add("hidden");
  }

  await renderWorldsList();
  checkRemoteUpdates();

  // Quota check (constraint #2). If we're over 90% AND eviction would
  // free meaningful space → quietly evict the oldest unpinned. If we're
  // over 90% AND nothing is evictable (everything is pinned user data),
  // surface the warning — only the user can free space via Clean cache.
  checkStorageQuota().catch(() => {});

  // Kick off MSAL init in the background. When it resolves and we have an
  // active account:
  //   - refresh the sign-in bar
  //   - re-render worlds list (OneDrive provider now returns real entries)
  //   - on FIRST-EVER signin (hasEverSignedIn was false) and there are
  //     pre-existing local records, set them pendingUpload=true so the
  //     first-time-signin auto-promote runs. Migration guard: if there's
  //     already a cached MSAL account but hasEverSignedIn was never set
  //     (old user, pre-this-code), silently mark and skip auto-promote.
  //   - flushPendingUploads (handles both fresh pending and just-flagged)
  //
  // Failures here are silent (console only). MSAL flaking — offline, third-
  // party cookies blocked, Microsoft outage — must not surface as a red
  // banner. Bundled + local + cached-onedrive worlds remain fully usable.
  if (isOneDriveConfigured()) {
    (async () => {
      try {
        const { getPCA, getAccount } = await import("./onedriveAuth.js");
        await getPCA();
        const account = await getAccount();
        if (account) {
          const wasFirstTime = !(await hasEverSignedIn());
          await markSignedIn();
          if (wasFirstTime) {
            // Auto-promote ONLY when there's no prior tracked sign-in.
            // For users who had an MSAL cached account from before this
            // code shipped, wasFirstTime is technically true but we want
            // to be conservative — only auto-promote if the user has any
            // source=local records waiting AND hasn't expressed otherwise.
            const localPending = (await listWorlds()).filter((w) =>
              w.source === "local" && !w.uploadDeferred && !w.pendingUpload);
            for (const w of localPending) {
              await applySyncPatch(w.id, { pendingUpload: true });
            }
            if (localPending.length > 0) {
              setStatus(`Pushing ${localPending.length} local world(s) to OneDrive…`);
            }
          }
        }
        await refreshOneDriveStatus();
        await renderWorldsList();
        flushPendingUploads().catch(() => {});
      } catch (err) {
        console.warn("OneDrive boot failed (offline?):", err);
      }
    })();
  }
}

// Storage pressure check — see constraint #2 ("pinned data never auto-
// evicts"). Three tiers:
//   < 90%   : nothing to do
//   >= 90% AND something is unpinned : evict oldest unpinned silently
//   >= 90% AND everything is pinned  : surface a warning so the user
//                                       can Clean cache or × specific
//                                       worlds. We CANNOT silently delete
//                                       their pinned data.
async function checkStorageQuota() {
  const { usage, quota } = await getUsage();
  if (!quota || usage / quota < 0.9) return;
  const evictable = await getEvictableBytes();
  if (evictable > 0) {
    // Silent freeing — aim to bring usage to 70% by evicting unpinned.
    const target = usage - quota * 0.7;
    const freed = await evictUnpinnedLRU(target);
    console.log(`storage pressure: freed ${formatBytes(freed)} unpinned`);
    renderWorldsList().catch(() => {});
    return;
  }
  // All pinned — surface to user. The errorLog is the right channel
  // here (it persists in the menu and the user can dismiss).
  logError("storage:full",
    `Local storage is ${Math.round(usage / quota * 100)}% full (${formatBytes(usage)} of ${formatBytes(quota)}). ` +
    `Everything cached is pinned (your uploads / your manual ↓). ` +
    `Use Clean cache or × specific worlds to free space.`);
}

// Retry triggers for pendingUpload — per constraint #4 / P1.4 these are
// the event-driven opportunities (no polling).
window.addEventListener("online", () => {
  flushPendingUploads().catch(() => {});
  checkRemoteUpdates().catch(() => {});
});
// Menu reappear (controls.unlock, xr.sessionend) → also a good moment.
// The existing handlers in this file already call checkRemoteUpdates;
// add flushPendingUploads alongside.

// Render token: every renderWorldsList increments this and captures it. Any
// async append inside the same render checks the token against the current
// value and bails if a newer render has started — protects against:
//   (a) two concurrent renderWorldsList() calls racing on innerHTML
//   (b) a long-running provider.list() append landing in a stale DOM
let renderToken = 0;

async function renderWorldsList() {
  const token = ++renderToken;
  const cached = await listWorlds();                            // sorted by lastVisitedAt
  if (token !== renderToken) return;
  const cachedKey = new Set();
  for (const w of cached) if (w.remoteId) cachedKey.add(`${w.source}:${w.remoteId}`);

  // Step 1: paint cached worlds immediately. Provider availability lookups
  // happen asynchronously below (one might be a slow Graph round-trip).
  worldsListEl.innerHTML = "";
  // Cleanup blob URLs from previous render to avoid memory leak.
  for (const url of thumbnailUrls) URL.revokeObjectURL(url);
  thumbnailUrls.length = 0;

  for (const w of cached) appendWorldCard(w, false, token);

  // Step 2: per-provider, fetch the available list and append uncached entries
  // as each provider resolves. Errors surface in the inline error log, not
  // console-only. Each provider gets its own try/catch — one provider's
  // failure doesn't block the others.
  //
  // For network-backed providers (OneDrive) we drop a placeholder spinner
  // card so the user sees something is happening — otherwise the menu just
  // looks idle for the seconds a Graph round-trip takes. CSS delays the
  // fade-in 200ms so fast resolves (bundled, cached Graph) don't flash.
  for (const p of providers) {
    const needsNetwork = p.source !== "bundled";
    let placeholder = null;
    if (needsNetwork) {
      placeholder = createSourceLoadingCard(p.source);
      worldsListEl.appendChild(placeholder);
    }
    (async () => {
      let items;
      try {
        items = await p.list();
        clearError(`provider:${p.source}:list`);
      } catch (err) {
        placeholder?.remove();
        logError(`provider:${p.source}:list`, `${p.source}: ${err.message || err}`);
        return;
      }
      placeholder?.remove();
      if (token !== renderToken) return;
      for (const it of items) {
        if (cachedKey.has(`${p.source}:${it.remoteId}`)) continue;
        // Per constraint #2 + P1.7: hide items the user has tombstoned
        // (delete-pinned to their etag). A new cloud-side etag will have
        // invalidated the tombstone in checkRemoteUpdates' GC pass, in
        // which case this is a no-op.
        if (await isTombstoned(p.source, it.remoteId, it.etag)) continue;
        if (token !== renderToken) return;
        appendWorldCard({
          kind: "uncached",
          source: p.source,
          remoteId: it.remoteId,
          name: it.name,
          thumbnailUrl: it.thumbnailUrl || null,
          thumbnailRemoteId: it.thumbnailRemoteId || null,
        }, true, token);
      }
    })();
  }
}

// Track blob URLs created for thumbnails so we can revoke them on re-render.
// objectURLs leak GPU/main-thread memory until revoked; the cleanup above
// handles it.
const thumbnailUrls = [];

// Loading placeholder card. CSS gives it a 200ms fade-in delay so providers
// that resolve quickly (already-cached Graph response, etc.) don't cause a
// visual flash. Removed by renderWorldsList when the provider resolves.
function createSourceLoadingCard(source) {
  const li = document.createElement("li");
  li.className = "world-card world-loading-placeholder";
  li.setAttribute("aria-busy", "true");
  const spinner = document.createElement("div");
  spinner.className = "world-loading-spinner";
  const label = document.createElement("div");
  label.className = "world-loading-label";
  label.textContent =
    source === "onedrive" ? "Loading OneDrive…" :
    source === "bundled"  ? "Loading bundled…" :
    `Loading ${source}…`;
  li.appendChild(spinner);
  li.appendChild(label);
  return li;
}

function appendWorldCard(w, uncached, token) {
  if (token !== renderToken) return;
  const isCurrent =
    (w.id && w.id === current.id) ||
    (w.remoteId && w.source === current.source && w.remoteId === current.remoteId);

  const li = document.createElement("li");
  li.className =
    "world-card" + (isCurrent ? " current" : "") + (uncached ? " uncached" : "");
  if (w.id) li.dataset.id = w.id;
  else {
    li.dataset.source = w.source;
    li.dataset.remoteId = w.remoteId;
    li.dataset.worldName = w.name;
  }

  // Thumbnail policy:
  //   - online: always try fresh from the provider (network URL)
  //   - offline / 404: fall back to IDB blob if the world is cached
  //   - neither: gradient placeholder (img element removed)
  // Bundled and OneDrive use the same render path; only the provider
  // method's behavior differs (sync URL vs Graph round-trip). The IDB
  // blob exists iff the world was manually cached via ↓ (cacheWorld
  // pulls the sidecar at the same time as the glb).
  const idbBlob = w.thumbnail instanceof Blob ? w.thumbnail : null;
  const provider = providers.find((p) => p.source === w.source);
  const thumbKey = w.thumbnailRemoteId
    || (w.source === "bundled" && w.remoteId ? w.remoteId.replace(/\.glb$/i, ".png") : null);

  if (idbBlob || thumbKey) {
    const img = document.createElement("img");
    img.className = "world-thumb";
    img.alt = "";
    li.appendChild(img);

    const useIdb = () => {
      if (!idbBlob) { img.remove(); return; }
      img.onerror = () => img.remove();   // gradient if even the IDB blob fails
      const url = URL.createObjectURL(idbBlob);
      thumbnailUrls.push(url);
      img.src = url;
    };

    if (thumbKey && provider?.getThumbnailViewUrl) {
      img.onerror = useIdb;
      provider.getThumbnailViewUrl(thumbKey).then((url) => {
        if (token !== renderToken) return;
        if (url) img.src = url;
        else useIdb();
      }).catch(useIdb);
    } else {
      useIdb();
    }
  }

  // Source + sync-state badges (top-left)
  const badges = document.createElement("div");
  badges.className = "world-badges";
  if (w.source === "bundled" || w.source === "onedrive") {
    const badge = document.createElement("span");
    badge.className = "world-badge";
    badge.textContent = w.source === "bundled" ? "default" : "onedrive";
    badges.appendChild(badge);
  }
  if (w.pendingUpload) {
    const b = document.createElement("span");
    b.className = "world-badge world-badge-pending";
    b.title = "Waiting to upload to OneDrive";
    b.textContent = "↑ pending";
    badges.appendChild(b);
  } else if (w.uploadDeferred) {
    const b = document.createElement("span");
    b.className = "world-badge world-badge-deferred";
    b.title = "Upload skipped — tap card to re-arm";
    b.textContent = "local only";
    badges.appendChild(b);
  }
  if (w.remoteFound === false && w.source !== "local") {
    const b = document.createElement("span");
    b.className = "world-badge world-badge-ghost";
    b.title = "Removed from cloud — your local copy is preserved";
    b.textContent = "missing upstream";
    badges.appendChild(b);
  }
  if (badges.children.length > 0) li.appendChild(badges);

  // Info overlay (bottom)
  const info = document.createElement("div");
  info.className = "world-info";
  const nameSpan = document.createElement("span");
  nameSpan.className = "world-name";
  nameSpan.textContent = w.name;
  info.appendChild(nameSpan);

  const metaSpan = document.createElement("span");
  metaSpan.className = "world-meta";
  if (uncached) {
    metaSpan.textContent = "checking size…";
    const p = providers.find((p) => p.source === w.source);
    if (p?.getSize) {
      p.getSize(w.remoteId).then((size) => {
        if (token !== renderToken) return;
        metaSpan.textContent = size != null
          ? `${formatBytes(size)} · tap to stream`
          : "tap to stream";
      }).catch(() => {
        if (token !== renderToken) return;
        metaSpan.textContent = "tap to stream";
      });
    } else {
      metaSpan.textContent = "tap to stream";
    }
  } else {
    metaSpan.textContent =
      `${formatBytes(w.byteLength)} · ${formatRelativeTime(w.lastVisitedAt)}`;
  }
  info.appendChild(metaSpan);
  li.appendChild(info);

  // Action buttons (bottom-right). Per source:
  //   uncached         → ↓ (download to cache)
  //   cached local     → × (delete permanently — no remote to recover from)
  //   cached bundled   → × (remove from cache, bundled source can be re-fetched)
  //   cached onedrive  → × (uncache) + 🗑 (delete from OneDrive too)
  //   current          → no buttons (can't act on the world you're inside)
  if (uncached || (w.id && !isCurrent)) {
    const actions = document.createElement("div");
    actions.className = "world-actions";
    if (uncached) {
      const dl = document.createElement("button");
      dl.className = "world-action world-cache";
      dl.type = "button";
      dl.dataset.source = w.source;
      dl.dataset.remoteId = w.remoteId;
      dl.dataset.worldName = w.name;
      if (w.thumbnailRemoteId) dl.dataset.thumbnailRemoteId = w.thumbnailRemoteId;
      dl.title = "Download for offline";
      dl.textContent = "↓";
      actions.appendChild(dl);
    } else {
      const del = document.createElement("button");
      del.className = "world-action world-delete danger";
      del.type = "button";
      del.dataset.id = w.id;
      del.title = w.source === "local" ? "Delete world" : "Remove from cache";
      del.textContent = "×";
      actions.appendChild(del);

      if (w.source === "onedrive") {
        const delRemote = document.createElement("button");
        delRemote.className = "world-action world-delete-remote danger-strong";
        delRemote.type = "button";
        delRemote.dataset.id = w.id;
        delRemote.title = "Delete from OneDrive";
        delRemote.textContent = "🗑";
        actions.appendChild(delRemote);
      }
    }
    li.appendChild(actions);
  }

  worldsListEl.appendChild(li);
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
// ── System tracking-reset handling ────────────────────────────────────────
//
// Quest's "Reset View" (long-press Meta button) fires `reset` on the
// XRReferenceSpace. We must compensate or roomscale interprets the
// apparent HMD jump as user-walked → player_pos drags into invalid
// space → user appears to fall through the floor. See docs/vr-locomotion.md.
//
// event.transform: an XRRigidTransform describing the new origin's pose
// in the OLD frame's coords. The yaw component tells us how much the
// reference frame rotated; we add that to player_rot so world heading
// stays stable. tracking_origin is snapped in handleTrackingReset.
//
// Capture-and-defer: we set a pending flag in the event handler and
// apply in the next animation tick, where camera.position is guaranteed
// to reflect the new reference frame.
let _pendingTrackingResetYaw = null;
let _resetListenerAttached = false;
const _resetQuat = new THREE.Quaternion();
const _resetEuler = new THREE.Euler(0, 0, 0, "YXZ");
function ensureResetListenerAttached() {
  if (_resetListenerAttached) return;
  if (!renderer.xr.isPresenting) return;
  const refSpace = renderer.xr.getReferenceSpace?.();
  if (!refSpace || typeof refSpace.addEventListener !== "function") return;
  refSpace.addEventListener("reset", (event) => {
    const t = event?.transform;
    if (!t) { _pendingTrackingResetYaw = 0; return; }
    _resetQuat.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
    _resetEuler.setFromQuaternion(_resetQuat, "YXZ");
    _pendingTrackingResetYaw = _resetEuler.y;
  });
  _resetListenerAttached = true;
}
renderer.xr.addEventListener("sessionend", () => {
  _resetListenerAttached = false;
  _pendingTrackingResetYaw = null;
});

// setAnimationLoop drives both the regular RAF and the WebXR frame loop —
// three.js swaps the source automatically based on session state.
const clock = new THREE.Clock();
let wasPresenting = false;
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  const isXR = renderer.xr.isPresenting;
  // Capture tracking_origin from real HMD pose on the *first* XR frame —
  // sessionstart fires before pose is read, so reset here when transitioning in.
  if (isXR && !wasPresenting) {
    player.reset();
    ensureResetListenerAttached();
  }
  wasPresenting = isXR;
  // System tracking-reset compensation BEFORE updateVR consumes tracking_origin.
  // Camera.position is in the new reference frame by this point.
  if (isXR) {
    ensureResetListenerAttached();   // in case getReferenceSpace was null on first frame
    if (_pendingTrackingResetYaw !== null) {
      player.handleTrackingReset(_pendingTrackingResetYaw);
      _pendingTrackingResetYaw = null;
    }
  }
  const out = isXR ? xr.update(dt) : flat.update(dt);
  vignette.update(out?.vignette ?? 0, dt);
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
