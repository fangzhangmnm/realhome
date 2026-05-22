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
} from "./worldStore.js";
import { renderThumbnail } from "./thumbnailer.js";
import { createLoadingPanel } from "./loadingPanel.js";
import { providers } from "./providers.js";
import { isOneDriveConfigured } from "./config.js";

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
const loadingPanel = createLoadingPanel(camera);

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
//
// dom-overlay (optional): request that Quest's compositor render
// #startOverlay (and any other DOM that's on top of the canvas) as a 2D
// surface inside the XR view, so the user can keep using the regular HTML
// menu while in immersive-vr. Browser may refuse — we log session.
// domOverlayState on start so we can see whether it was granted.
//
// Why "optional": if Quest's WebXR runtime doesn't support it OR the user's
// browser version is too old, the session must still start. If it's
// "required" and the runtime refuses, requestSession rejects.
function enterVR() {
  navigator.xr.requestSession("immersive-vr", {
    optionalFeatures: ["local-floor", "dom-overlay"],
    domOverlay: { root: document.getElementById("startOverlay") },
  })
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
// Track whether the current XR session granted dom-overlay. When granted,
// we keep #startOverlay visible (Quest's compositor draws it inside the
// XR view) so the user can pick a different world without leaving VR.
// When NOT granted, hide the overlay — the DOM is invisible in immersive
// anyway, and Quest's "running in background" panel takes over.
let xrDomOverlayGranted = false;
renderer.xr.addEventListener("sessionstart", () => {
  const session = renderer.xr.getSession();
  // domOverlayState is the canonical way to check whether the browser
  // honored our request. type is "screen" (the dom-overlay spec uses this
  // for AR phone-as-window AND VR head-locked overlay).
  xrDomOverlayGranted = !!session?.domOverlayState;
  document.body.classList.toggle("xr-active", true);
  document.body.classList.toggle("xr-dom-overlay", xrDomOverlayGranted);
  if (xrDomOverlayGranted) {
    // Overlay stays visible — Quest paints it into the XR view.
    logError("xr:overlay", `dom-overlay granted (type=${session.domOverlayState.type})`);
  } else {
    overlay.classList.add("hidden");
    logError("xr:overlay", "dom-overlay NOT granted — exit VR to switch worlds");
  }
  // First XR frame (not this event) is when camera.position reflects the
  // real HMD pose — defer the reset to the animation loop where we can read
  // it and capture tracking_origin correctly.
});
renderer.xr.addEventListener("sessionend", () => {
  document.body.classList.remove("xr-active", "xr-dom-overlay");
  xrDomOverlayGranted = false;
  overlay.classList.remove("hidden");
  clearError("xr:overlay");
  checkRemoteUpdates();
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
// Order: enter VR / lock pointer FIRST, then load. The user-gesture
// activation is consumed by enterVR/lock and would expire if we awaited
// the parse first. While the world parses, the existing scene stays
// visible — we cover it with a 3D loading panel parented to the camera
// (visible both in VR and flat) so the user doesn't see the old world.
async function handleEnter(item) {
  if (loading) return;
  if (xrSupported && !renderer.xr.isPresenting) enterVR();
  else tryLock();

  const id = item.dataset.id;
  const source = item.dataset.source;
  const remoteId = item.dataset.remoteId;
  const isCurrent =
    (id && id === current.id) ||
    (remoteId && source === current.source && remoteId === current.remoteId);

  if (isCurrent) return;
  if (id) await switchToWorld(id);
  else await streamOpenWorld(source, remoteId, item.dataset.worldName || remoteId);
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
    `This removes the file from your OneDrive RealHome folder permanently. ` +
    `Other devices that still have it cached will keep their local copy ` +
    `until they refresh.\n\n` +
    `This can't be undone.`
  );
  if (!ok) return;
  try {
    const { deleteAppFolderItem } = await import("./onedriveGraph.js");
    await deleteAppFolderItem(record.remoteId);
  } catch (err) {
    logError(`delete-remote:${record.remoteId}`, `OneDrive delete: ${err.message || err}`);
    return;   // leave IDB record intact so the user can retry
  }
  await deleteWorld(id);
  await renderWorldsList();
}

// --- World loading paths ---
//
// loadFile is the local-side ingest path (file picker + drag/drop). After
// optimize, if the user is signed in to OneDrive we attempt to upload the
// blob to the AppFolder so it auto-syncs across devices:
//   - filename collides in AppFolder → confirm overwrite. Cancel = save as
//     local-only, no upload (file is still usable on THIS device).
//   - upload fails for any other reason → save as local-only, surface the
//     error in the log. Don't block the user from playing the world.
//
// Outcome:
//   - success path → IDB record has source="onedrive" + remoteId + remoteEtag
//   - cancel or upload failure → IDB record has source="local", no remote
async function loadFile(file) {
  if (loading) return;
  if (!/\.(glb|gltf)$/i.test(file.name)) { setStatus("not a .glb/.gltf"); return; }
  loading = true;
  hudName.textContent = file.name;
  try {
    // We persist the file as-is — no optimize pass. The artist's Blender
    // export is the authoritative bytes; trying to re-pack here gave hangs
    // and tiny savings on real-world glbs. If we need a size win in the
    // future, do it server-side / in the artist's pipeline, not at runtime.
    const finalBlob = file instanceof Blob ? file : new Blob([file], { type: "model/gltf-binary" });
    const result = await loadGlbFromBlob(finalBlob, file.name);

    // OneDrive sync (best effort). Falls back to local-only on any failure
    // or user cancel; in both cases the world is fully usable from IDB.
    const onedriveResult = await maybeUploadToOneDrive(file.name, finalBlob);

    const record = await addWorld(finalBlob, file.name, onedriveResult
      ? {
          source: "onedrive",
          remoteId: onedriveResult.remoteId,
          remoteEtag: onedriveResult.etag,
        }
      : { source: "local" }
    );
    current.id = record.id;
    current.source = record.source;
    current.remoteId = record.remoteId;
    installWorld(result, file.name);
    setStatus(onedriveResult ? "synced to OneDrive" : "");
    await renderWorldsList();
  } catch (err) {
    console.error(err);
    setStatus("upload failed");
    logError(`upload:${file.name}`, `upload failed: ${err.message || err}`);
  } finally {
    loading = false;
  }
}

// Returns the upload result on success, or null if the user isn't signed
// in, cancelled an overwrite prompt, or the upload failed. Failures (vs
// cancel) are logged so the user knows why their file didn't sync — but
// it's never fatal to the loadFile flow.
async function maybeUploadToOneDrive(filename, blob) {
  if (!isOneDriveConfigured()) return null;
  let auth, graph, account;
  try {
    auth = await import("./onedriveAuth.js");
    graph = await import("./onedriveGraph.js");
    account = await auth.getAccount();
  } catch (err) {
    console.warn("OneDrive modules unavailable, skipping upload:", err);
    return null;
  }
  if (!account) return null;       // not signed in — silent fall-through

  // Pre-check for filename collision so we can ask the user before any
  // bytes go up the wire. Chunked uploads in particular are bad at
  // surfacing late conflicts.
  let existing = null;
  try {
    existing = await graph.getAppFolderItemByName(filename);
  } catch (err) {
    logError(`upload:${filename}`, `OneDrive precheck: ${err.message || err}`);
    return null;
  }
  let overwrite = false;
  if (existing) {
    const ok = confirm(
      `"${filename}" already exists in your OneDrive RealHome folder.\n\n` +
      `Overwrite it?\n\n` +
      `Cancel keeps the file local-only on this device.`
    );
    if (!ok) return null;
    overwrite = true;
  }

  showProgress(`Uploading ${filename} to OneDrive…`, 0);
  try {
    const result = await graph.uploadItemToAppFolder(filename, blob, {
      overwrite,
      onProgress: (loaded, total) => {
        const f = total > 0 ? loaded / total : -1;
        const label = total > 0
          ? `Uploading ${filename}… ${formatBytes(loaded)} / ${formatBytes(total)}`
          : `Uploading ${filename}… ${formatBytes(loaded)}`;
        showProgress(label, f);
      },
    });
    hideProgress();
    return result;
  } catch (err) {
    hideProgress();
    logError(`upload:${filename}`, `OneDrive upload: ${err.message || err}`);
    return null;
  }
}

async function switchToWorld(id) {
  if (loading || id === current.id) return;
  loading = true;
  setStatus("loading…");
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

  // Reset player to spawn. In VR, reset captures the current HMD pose as
  // tracking_origin so the user lands at virtual origin regardless of where
  // local-floor anchored.
  player.reset();
  hudName.textContent = name;
  // Updating document.title so the Quest "running in background" panel
  // header reads cleanly (it inherits the tab title). See docs/ui-layers.md.
  document.title = `RealHome — ${name}`;
  const note = [];
  if (result.skyboxes.length) note.push(`skybox×${result.skyboxes.length}`);
  if (result.colliders.length) note.push(`collider×${result.colliders.length}`);
  setStatus(note.join(" · "));

  // Generate a thumbnail for this world if we have an IDB record and don't
  // already have one. Background — failure is silent (placeholder stays).
  maybeGenerateThumbnail(current.id).catch(() => {});
}

// Render a thumbnail off-screen and persist to IDB. No-op if there's no
// IDB record, or the record already has a thumbnail. Run from installWorld
// so first-entry of a world generates its preview.
async function maybeGenerateThumbnail(id) {
  if (!id || !current.root) return;
  try {
    const record = await getWorld(id);
    if (!record || record.thumbnail instanceof Blob) return;
    const blob = await renderThumbnail(current.root);
    if (!blob) return;
    await setThumbnail(id, blob);
    // Refresh the menu so the new thumbnail shows next time the user opens
    // it. Cheap if the menu is hidden; no flash.
    renderWorldsList().catch(() => {});
  } catch (err) {
    console.warn("thumbnail generation failed:", err);
  }
}

function setStatus(s) { hudStatus.textContent = s; }

// Unified loading display. Picks the right render target:
//   - flat / no XR  → DOM #progressBar (existing showProgress/hideProgress)
//   - XR + dom-overlay  → DOM #progressBar (still visible inside overlay)
//   - XR + NO dom-overlay → 3D loadingPanel parented to camera
// Single SSoT: callers don't know or care which path renders.
function showLoading(label, detail = "", fraction = -1) {
  if (renderer.xr.isPresenting && !xrDomOverlayGranted) {
    loadingPanel.show(label, detail, fraction);
  } else {
    const text = detail ? `${label} — ${detail}` : label;
    showProgress(text, fraction);
  }
}
function updateLoading(label, detail, fraction) {
  if (renderer.xr.isPresenting && !xrDomOverlayGranted) {
    loadingPanel.update(label, detail, fraction);
  } else {
    const text = detail ? `${label} — ${detail}` : label;
    showProgress(text, fraction);
  }
}
function hideLoading() {
  loadingPanel.hide();
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
async function cacheWorld(source, remoteId, name, opts = {}) {
  const { quiet = false } = opts;
  const p = providers.find((p) => p.source === source);
  if (!p) throw new Error(`no provider for source=${source}`);
  const existing = await findByRemoteId(source, remoteId);
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

  // Kick off MSAL init in the background. When it resolves:
  //   - refresh the sign-in bar (might find a cached signed-in account)
  //   - re-render worlds list (OneDrive provider now returns real entries)
  //
  // Failures here are silent (console only). MSAL flaking — offline, third-
  // party cookies blocked, Microsoft outage — must not surface as a red
  // banner. Bundled + local + cached-onedrive worlds remain fully usable.
  if (isOneDriveConfigured()) {
    (async () => {
      try {
        const { getPCA } = await import("./onedriveAuth.js");
        await getPCA();
        await refreshOneDriveStatus();
        await renderWorldsList();
      } catch (err) {
        console.warn("OneDrive boot failed (offline?):", err);
      }
    })();
  }
}

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
  for (const p of providers) {
    (async () => {
      let items;
      try {
        items = await p.list();
        clearError(`provider:${p.source}:list`);
      } catch (err) {
        logError(`provider:${p.source}:list`, `${p.source}: ${err.message || err}`);
        return;
      }
      if (token !== renderToken) return;
      for (const it of items) {
        if (cachedKey.has(`${p.source}:${it.remoteId}`)) continue;
        appendWorldCard({
          kind: "uncached",
          source: p.source,
          remoteId: it.remoteId,
          name: it.name,
        }, true, token);
      }
    })();
  }
}

// Track blob URLs created for thumbnails so we can revoke them on re-render.
// objectURLs leak GPU/main-thread memory until revoked; the cleanup above
// handles it.
const thumbnailUrls = [];

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

  // Thumbnail image (or placeholder via card background gradient).
  if (w.thumbnail instanceof Blob) {
    const img = document.createElement("img");
    img.className = "world-thumb";
    img.alt = "";
    const url = URL.createObjectURL(w.thumbnail);
    thumbnailUrls.push(url);
    img.src = url;
    li.appendChild(img);
  }

  // Source badges (top-left)
  if (w.source === "bundled" || w.source === "onedrive") {
    const badges = document.createElement("div");
    badges.className = "world-badges";
    const badge = document.createElement("span");
    badge.className = "world-badge";
    badge.textContent = w.source === "bundled" ? "default" : "onedrive";
    badges.appendChild(badge);
    li.appendChild(badges);
  }

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
// setAnimationLoop drives both the regular RAF and the WebXR frame loop —
// three.js swaps the source automatically based on session state.
const clock = new THREE.Clock();
let wasPresenting = false;
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  const isXR = renderer.xr.isPresenting;
  // Capture tracking_origin from real HMD pose on the *first* XR frame —
  // sessionstart fires before pose is read, so reset here when transitioning in.
  if (isXR && !wasPresenting) player.reset();
  wasPresenting = isXR;
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
