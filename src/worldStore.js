// IndexedDB persistence for user worlds.
//
// Schema (v1):
//   one object store "worlds", keyPath "id" (uuid). Each record:
//     id              string
//     name            string   display name (usually the source filename)
//     blob            Blob     the .glb we render — single source of truth. Starts as the
//                              raw upload / remote-fetched bytes, gets replaced in-place
//                              by the optimized output of the gltf-transform pipeline.
//     byteLength      number   blob.size, for quota readouts
//     createdAt       number   epoch ms
//     lastVisitedAt   number   epoch ms — used for sort order in the worlds list
//     source          "local" | "bundled" | "onedrive"
//                              "bundled"  = same-origin app-shipped world
//                              "onedrive" = synced from Microsoft Graph AppFolder
//     remoteId        string|null  source identifier for change detection / re-fetch:
//                              bundled  → the same-origin URL  (e.g. "./worlds/X.glb")
//                              onedrive → the Graph item ID
//                              local    → null (no remote to sync from)
//     remoteEtag      string|null  last seen etag / lastModifiedDateTime from source.
//                              Used for "If-None-Match" conditional GET on bundled,
//                              and for change detection on OneDrive listings.
//     optimized       bool     true iff the blob has already been through the
//                              gltf-transform pipeline. New uploads / fresh sync
//                              start at false; the optimizer flips it after it
//                              produces a meaningful size win.
//
// Migration policy: additive only. Bump DB_VERSION + handle in onupgradeneeded.
// Never drop / rename a store or field destructively.

const DB_NAME = "realhome";
const DB_VERSION = 2;
const STORE = "worlds";
const SETTINGS_STORE = "settings";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (e.oldVersion < 1) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("by_lastVisitedAt", "lastVisitedAt", { unique: false });
      }
      if (e.oldVersion < 2) {
        // Key/value settings (tombstones, future lastWorldId / quota cap / etc.)
        // Lives in IDB instead of localStorage so a single "clear my data"
        // (delete the IDB database) wipes everything.
        db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
  return dbPromise;
}

async function tx(mode) {
  const db = await openDB();
  return db.transaction(STORE, mode).objectStore(STORE);
}

async function txSettings(mode) {
  const db = await openDB();
  return db.transaction(SETTINGS_STORE, mode).objectStore(SETTINGS_STORE);
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addWorld(blob, name, opts = {}) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const record = {
    id,
    name,
    blob,
    byteLength: blob.size,
    createdAt: now,
    lastVisitedAt: now,
    source: opts.source || "local",       // "local" | "bundled" | "onedrive"
    remoteId: opts.remoteId || null,      // URL for bundled, item-id for onedrive
    remoteEtag: opts.remoteEtag || null,  // last-seen etag/mtime for change detection
    optimized: opts.optimized || false,   // true if the blob came out of the optimizer
  };
  const store = await tx("readwrite");
  await reqP(store.add(record));
  return record;
}

// Lookup by source + remoteId. Used to find an existing bundled/onedrive record
// before re-fetching (we sync into the same record, not create a new one).
export async function findByRemoteId(source, remoteId) {
  if (!remoteId) return null;
  const store = await tx("readonly");
  const all = await reqP(store.getAll());
  return all.find((r) => r.source === source && r.remoteId === remoteId) || null;
}

export async function getWorld(id) {
  const store = await tx("readonly");
  return reqP(store.get(id));
}

export async function listWorlds() {
  const store = await tx("readonly");
  const all = await reqP(store.getAll());
  all.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
  return all;
}

export async function countWorlds() {
  const store = await tx("readonly");
  return reqP(store.count());
}

export async function touchWorld(id) {
  const store = await tx("readwrite");
  const r = await reqP(store.get(id));
  if (!r) return;
  r.lastVisitedAt = Date.now();
  await reqP(store.put(r));
}

// In-place replace the blob. `opts.optimized` lets the gltf-transform pipeline
// flip the optimized flag in the same write; leaving it undefined preserves
// the existing value.
export async function replaceBlob(id, blob, opts = {}) {
  const store = await tx("readwrite");
  const r = await reqP(store.get(id));
  if (!r) return;
  r.blob = blob;
  r.byteLength = blob.size;
  if (opts.optimized !== undefined) r.optimized = opts.optimized;
  await reqP(store.put(r));
}

// Replace blob + remoteEtag atomically. Used by remote sync after the cache
// pipeline has already optimized the new bytes — the caller passes
// `optimized: true` once the optimizer succeeded.
export async function updateRemoteSync(id, blob, etag, opts = {}) {
  const store = await tx("readwrite");
  const r = await reqP(store.get(id));
  if (!r) return;
  r.blob = blob;
  r.byteLength = blob.size;
  r.remoteEtag = etag;
  if (opts.optimized !== undefined) r.optimized = opts.optimized;
  await reqP(store.put(r));
}

export async function deleteWorld(id) {
  const store = await tx("readwrite");
  await reqP(store.delete(id));
}

// Wipe everything — worlds and settings (including tombstones). Used by the
// "Reset" debug entry in the menu; on reload, syncs re-fetch and the
// optimizer runs from scratch.
export async function clearAllWorlds() {
  const store = await tx("readwrite");
  await reqP(store.clear());
}

export async function clearAllSettings() {
  const store = await txSettings("readwrite");
  await reqP(store.clear());
}

// Storage quota readouts for the future settings UI.
export async function getUsage() {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0 };
  const { usage, quota } = await navigator.storage.estimate();
  return { usage: usage || 0, quota: quota || 0 };
}

// Request "persistent" storage so the browser won't evict our IndexedDB under
// disk pressure. On installed PWAs this is usually auto-granted silently;
// on a regular browser tab it may prompt. Idempotent — safe to call on every boot.
export async function requestPersist() {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// --- Settings (key/value, lives in the same DB) ---

export async function getSetting(key, fallback = null) {
  try {
    const store = await txSettings("readonly");
    const r = await reqP(store.get(key));
    return r ? r.value : fallback;
  } catch {
    return fallback;
  }
}

export async function setSetting(key, value) {
  const store = await txSettings("readwrite");
  await reqP(store.put({ key, value }));
}

// Tombstones: remoteIds the user has explicitly deleted. Sync skips these so a
// deleted bundled / onedrive world doesn't auto-resurrect on next boot.
export async function getTombstones() {
  const t = await getSetting("tombstones", []);
  return Array.isArray(t) ? t : [];
}

export async function addTombstone(remoteId) {
  const t = await getTombstones();
  if (!t.includes(remoteId)) {
    t.push(remoteId);
    await setSetting("tombstones", t);
  }
}

// One-shot migration for users who were on the localStorage tombstones build.
// Moves any existing entries into IDB and removes the legacy key. Idempotent.
export async function migrateLegacyTombstones() {
  const LEGACY_KEY = "realhome.tombstones";
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return;
  try {
    const old = JSON.parse(raw);
    if (Array.isArray(old) && old.length) {
      const current = await getTombstones();
      const merged = Array.from(new Set([...current, ...old]));
      await setSetting("tombstones", merged);
    }
  } catch (_) {}
  localStorage.removeItem(LEGACY_KEY);
}
