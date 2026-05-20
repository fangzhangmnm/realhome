import * as THREE from "three";
import { createScene } from "./scene.js";
import { createPlayer } from "./player.js";
import { createFlatControls } from "./controls.js";
import { createXrControls } from "./xrControls.js";
import { loadGlbFromFile, loadGlbFromBlob } from "./worldLoader.js";
import {
  addWorld, getWorld, listWorlds, touchWorld, deleteWorld,
  findByRemoteId, updateRemoteSync, requestPersist,
  getTombstones, addTombstone, migrateLegacyTombstones,
} from "./worldStore.js";

const DEFAULT_WORLD_URL = "./worlds/RealHomeDefaultWorld.glb";

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
const hudName = document.getElementById("hudName");
const hudStatus = document.getElementById("hudStatus");
const updateToast = document.getElementById("updateToast");
const updateReload = document.getElementById("updateReload");

const { renderer, scene, camera, playerRig, setWorld } = createScene(canvas);
const player = createPlayer(playerRig, camera);
const flat = createFlatControls(camera, player, canvas);
const xr = createXrControls(renderer, player);

// Currently loaded world. id is null until something's loaded.
const current = { id: null, root: null, skyboxes: [], colliders: [] };
let loading = false;

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
flat.controls.addEventListener("unlock", () => overlay.classList.remove("hidden"));
// Match overlay visibility to XR presenting state too.
renderer.xr.addEventListener("sessionstart", () => overlay.classList.add("hidden"));
renderer.xr.addEventListener("sessionend", () => overlay.classList.remove("hidden"));

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
  const deleteBtn = e.target.closest(".world-delete");
  if (deleteBtn) { await handleDelete(deleteBtn.dataset.id); return; }
  const item = e.target.closest(".world-item");
  if (item) await handleWorldClick(item.dataset.id);
});

async function handleWorldClick(id) {
  // Request VR synchronously while we still hold the user gesture. The actual
  // world swap (if any) is awaited after — VR session enters fast either way.
  if (xrSupported && !renderer.xr.isPresenting) enterVR();
  if (id !== current.id) await switchToWorld(id);
  if (!xrSupported) tryLock();
}

async function handleDelete(id) {
  if (id === current.id) return;  // can't delete the currently-loaded world
  if (!confirm("Delete this world?")) return;
  const record = await getWorld(id);
  // Bundled / onedrive worlds carry a remoteId we have to tombstone, otherwise
  // the next sync will resurrect them.
  if (record?.remoteId && (record.source === "bundled" || record.source === "onedrive")) {
    await addTombstone(record.remoteId);
  }
  await deleteWorld(id);
  await renderWorldsList();
}

// --- World loading paths ---
async function loadFile(file) {
  if (loading) return;
  if (!/\.(glb|gltf)$/i.test(file.name)) { setStatus("not a .glb/.gltf"); return; }
  loading = true;
  setStatus("loading…");
  hudName.textContent = file.name;
  try {
    // Parse first — don't persist invalid glbs.
    const result = await loadGlbFromFile(file);
    const record = await addWorld(file, file.name, { source: "local" });
    current.id = record.id;
    installWorld(result, file.name);
    setStatus("");
    await renderWorldsList();
  } catch (err) {
    console.error(err);
    setStatus("load failed: " + (err.message || err));
  } finally {
    loading = false;
  }
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

function installWorld(result, name) {
  current.root = result.root;
  current.skyboxes = result.skyboxes;
  current.colliders = result.colliders;
  setWorld(result.root);
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

// --- Remote sync: bundled + onedrive share this path ---
// First boot: addWorld with the fetched blob.
// Subsequent boots: conditional GET (If-None-Match); on 304 no-op; on 200 with a
// new etag, replace the blob in place (preserves id, lastVisitedAt, etc.).
// Offline / fetch failure: silent, existing record (if any) stays.
// Tombstoned remoteIds skip entirely — user deleted them, don't resurrect.
async function syncBundledWorld(url, name) {
  const tombs = await getTombstones();
  if (tombs.includes(url)) return;
  const existing = await findByRemoteId("bundled", url);

  const headers = {};
  if (existing?.remoteEtag) headers["If-None-Match"] = existing.remoteEtag;

  let resp;
  try {
    resp = await fetch(url, { headers });
  } catch {
    return;  // offline; keep existing
  }
  if (resp.status === 304) return;
  if (!resp.ok) {
    if (!existing) console.log(`bundled ${url} unavailable: ${resp.status}`);
    return;
  }

  const newEtag = resp.headers.get("etag") || resp.headers.get("last-modified") || "";
  if (existing && newEtag && newEtag === existing.remoteEtag) return;

  const blob = await resp.blob();
  if (existing) {
    await updateRemoteSync(existing.id, blob, newEtag);
    // TODO: re-run gltf-transform pipeline on the new blob
  } else {
    await addWorld(blob, name, {
      source: "bundled",
      remoteId: url,
      remoteEtag: newEtag,
    });
    // TODO: run gltf-transform pipeline on first sync
  }
}

// --- Boot ---
async function bootstrap() {
  await migrateLegacyTombstones();          // one-shot from previous localStorage build
  await syncBundledWorld(DEFAULT_WORLD_URL, "RealHome Default");
  await renderWorldsList();
  const worlds = await listWorlds();
  if (worlds.length > 0) await switchToWorld(worlds[0].id);
  // Else: empty store + no default — placeholder cube stays, overlay shows empty list
}

async function renderWorldsList() {
  const worlds = await listWorlds();
  worldsListEl.innerHTML = "";
  for (const w of worlds) {
    const li = document.createElement("li");
    li.className = "world-item" + (w.id === current.id ? " current" : "");
    li.dataset.id = w.id;

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
    const metaSpan = document.createElement("span");
    metaSpan.className = "world-meta";
    metaSpan.textContent = `${formatBytes(w.byteLength)} · ${formatRelativeTime(w.lastVisitedAt)}`;
    info.appendChild(nameSpan);
    info.appendChild(metaSpan);
    li.appendChild(info);

    if (w.id !== current.id) {
      const del = document.createElement("button");
      del.className = "world-delete";
      del.type = "button";
      del.dataset.id = w.id;
      del.title = "Delete world";
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
  if (renderer.xr.isPresenting) xr.update(dt);
  else flat.update(dt);
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
