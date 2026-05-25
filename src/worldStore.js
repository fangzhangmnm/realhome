// IndexedDB persistence for user worlds.
//
// Schema (v3):
//   "worlds" object store, keyPath "id" (uuid). Each record:
//     id                  string
//     name                string   display name (usually the source filename)
//     blob                Blob     the .glb we render — single source of truth.
//     byteLength          number   blob.size, for quota readouts
//     createdAt           number   epoch ms
//     lastVisitedAt       number   epoch ms — sort order in worlds list
//     source              "local" | "bundled" | "onedrive"
//                                  "bundled"  = same-origin app-shipped
//                                  "onedrive" = synced from Microsoft Graph AppFolder
//     remoteId            string|null  identifier for change detection / re-fetch:
//                                  bundled  → same-origin URL
//                                  onedrive → Graph item ID
//                                  local    → null
//     remoteEtag          string|null  last seen etag/cTag, for If-None-Match
//     remoteName          string|null  actual remote filename (may differ from `name`)
//     thumbnail           Blob|null    cached sidecar PNG bytes (offline preview)
//     thumbnailRemoteId   string|null  opaque key for sidecar re-fetch
//
//   ── v3 additions (see docs/sync-constraints.md) ──
//     pinned              bool     "Top + High protection level" — never auto-evicted.
//                                  True for user uploads (source=local) and user-cached
//                                  cloud items (↓ button). False reserved for future
//                                  auto-sync caches that LRU could evict.
//     pendingUpload       bool     "wants to be on cloud, hasn't made it yet"
//                                  Set at drag time IF signed in; cleared on successful push.
//                                  Stays true across sessions until success or user
//                                  explicitly defers via collision prompt.
//     uploadDeferred      bool     User clicked "keep local, don't upload" on a collision
//                                  prompt. Skip auto-retry. UI surfaces a per-card ↑ to
//                                  re-arm pendingUpload manually.
//     remoteFound         bool     Last successful list saw this remoteId on the cloud.
//                                  False = "ghost" (cloud item gone / moved / account
//                                  switch). Per constraint #2, ghosts are NEVER
//                                  auto-deleted — user must × them.
//
//   "settings" object store, keyPath "key". Free-form k/v.
//
//   "tombstones" object store (v3), keyPath "id" (uuid). Each record:
//     id            uuid
//     sourceId      string   matches Worlds.source for now (single onedrive instance)
//     remoteId      string   the remote item id user deleted
//     remoteEtag    string|null  etag at delete time — see constraint #2 etag pinning.
//                                Null for legacy tombstones (treated as "any etag").
//     deletedAt     number
//   Index: by_source_remote → [sourceId, remoteId], unique.
//
// Legacy tombstones (v2): a settings-store array of remoteIds without etag.
// Kept readable by migrateLegacyTombstones for back-compat; new code uses
// the IDB store API below (insertTombstone / findTombstone / ...).
//
// Migration policy: additive only. Bump DB_VERSION + handle in onupgradeneeded.
// Never drop / rename a store or field destructively.

const DB_NAME = "realhome";
const DB_VERSION = 3;
const STORE = "worlds";
const SETTINGS_STORE = "settings";
const TOMBSTONES_STORE = "tombstones";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      const tx = req.transaction;
      if (e.oldVersion < 1) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("by_lastVisitedAt", "lastVisitedAt", { unique: false });
      }
      if (e.oldVersion < 2) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
      if (e.oldVersion < 3) {
        // New tombstone store. Composite unique index for fast lookup.
        const t = db.createObjectStore(TOMBSTONES_STORE, { keyPath: "id" });
        t.createIndex("by_source_remote", ["sourceId", "remoteId"], { unique: true });

        // Backfill new fields on existing worlds.
        //
        // Defaults follow constraint #2 (no data loss):
        //   pinned=true        → all currently-stored worlds count as user-precious
        //                        ("the only paths that wrote here are user actions:
        //                        drag-drop / ↓ cache / first-time bundled cache").
        //                        Future auto-sync caches will write pinned=false.
        //   pendingUpload=false → nothing is mid-flight at migration time
        //   uploadDeferred=false → nothing deferred either
        //   remoteFound=true   → optimistic; the next mergeRemoteList will correct
        const worldsStore = tx.objectStore(STORE);
        const cursorReq = worldsStore.openCursor();
        cursorReq.onsuccess = (ev) => {
          const cur = ev.target.result;
          if (!cur) return;
          const r = cur.value;
          if (r.pinned === undefined) r.pinned = true;
          if (r.pendingUpload === undefined) r.pendingUpload = false;
          if (r.uploadDeferred === undefined) r.uploadDeferred = false;
          if (r.remoteFound === undefined) r.remoteFound = true;
          if (r.remoteName === undefined) r.remoteName = null;
          cur.update(r);
          cur.continue();
        };
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

async function txTombstones(mode) {
  const db = await openDB();
  return db.transaction(TOMBSTONES_STORE, mode).objectStore(TOMBSTONES_STORE);
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
    source: opts.source || "local",
    remoteId: opts.remoteId || null,
    remoteEtag: opts.remoteEtag || null,
    remoteName: opts.remoteName || null,
    optimized: opts.optimized || false,
    thumbnailRemoteId: opts.thumbnailRemoteId || null,
    // v3 sync-state fields. Caller-controlled. Defaults match constraint #2:
    //   - user uploads / user-cached items default pinned=true (caller can
    //     override for auto-sync writes that should be LRU-evictable)
    //   - pendingUpload only when caller explicitly says so (drag-with-account)
    pinned: opts.pinned !== undefined ? opts.pinned : true,
    pendingUpload: opts.pendingUpload || false,
    uploadDeferred: opts.uploadDeferred || false,
    remoteFound: opts.remoteFound !== undefined ? opts.remoteFound : true,
  };
  const store = await tx("readwrite");
  await reqP(store.add(record));
  return record;
}

// Sync-layer write: apply arbitrary fields to a record without touching
// timestamps. Use for "remote says X" updates (etag bumps, remoteFound
// flips, pendingUpload clearing on push success). The user-initiated
// touchWorld / replaceBlob / updateRemoteSync helpers still exist for
// their specific purposes.
export async function applySyncPatch(id, patch) {
  if (!id) return null;
  const store = await tx("readwrite");
  const r = await reqP(store.get(id));
  if (!r) return null;
  Object.assign(r, patch);
  await reqP(store.put(r));
  return r;
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

// Save a thumbnail Blob onto an existing record. Called lazily by the
// thumbnail pipeline — cards render with a placeholder while the renderer
// catches up in the background, then this swap-in fires + the UI re-renders.
export async function setThumbnail(id, blob) {
  const store = await tx("readwrite");
  const r = await reqP(store.get(id));
  if (!r) return;
  r.thumbnail = blob;
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

// ── Tombstones (v3 IDB store) ────────────────────────────────────────────
//
// Per docs/sync-constraints.md "Empty-list safety net" + "Tombstone
// etag-pinning" rules. A tombstone records "user deleted *this etag* of
// this (source, remoteId)" — a fresh etag on the cloud (artist updated
// the file) makes the tombstone stale and the world is re-discovered.
//
// Per-source-key uniqueness: insertTombstone replaces any existing
// tombstone for the same (sourceId, remoteId) (a fresh delete supersedes).

// Internal: read tombstone by (sourceId, remoteId) via the composite index.
async function getTombstoneRaw(sourceId, remoteId) {
  if (!sourceId || !remoteId) return null;
  const store = await txTombstones("readonly");
  const idx = store.index("by_source_remote");
  return reqP(idx.get([sourceId, remoteId]));
}

// Returns true if (sourceId, remoteId, currentEtag) is suppressed.
//   - No tombstone → not suppressed
//   - Tombstone with etag=null → suppressed (legacy "permanent" tombstone,
//     matches any current etag)
//   - Tombstone with etag AND currentEtag missing → suppressed CONSERVATIVELY
//     (we can't disprove staleness; better to over-suppress than to silently
//     show something the user thought they deleted)
//   - Both etags present → string equality
export async function isTombstoned(sourceId, remoteId, currentEtag) {
  const t = await getTombstoneRaw(sourceId, remoteId);
  if (!t) return false;
  if (t.remoteEtag == null) return true;
  if (!currentEtag) return true;
  return t.remoteEtag === currentEtag;
}

// Write or replace the tombstone for (sourceId, remoteId).
// remoteEtag is the etag at delete time — see constraint #2 etag-pinning.
export async function insertTombstone(sourceId, remoteId, remoteEtag) {
  if (!sourceId || !remoteId) return null;
  const existing = await getTombstoneRaw(sourceId, remoteId);
  const id = existing?.id || crypto.randomUUID();
  const record = {
    id,
    sourceId,
    remoteId,
    remoteEtag: remoteEtag || null,
    deletedAt: Date.now(),
  };
  const store = await txTombstones("readwrite");
  await reqP(store.put(record));
  return record;
}

// Delete a stale tombstone (its pinned etag no longer matches cloud, OR the
// remote item is gone entirely — mergeRemoteList calls this in both cases).
export async function deleteTombstone(sourceId, remoteId) {
  const t = await getTombstoneRaw(sourceId, remoteId);
  if (!t) return;
  const store = await txTombstones("readwrite");
  await reqP(store.delete(t.id));
}

export async function listTombstones() {
  const store = await txTombstones("readonly");
  return reqP(store.getAll());
}

// ── Auth-history flag (used by constraint #4 first-time-signin) ──────────
//
// Persistent boolean that flips true on the user's first-ever successful
// sign-in and never resets. Used to distinguish "first time enabling cloud
// sync" (auto-promote pre-existing local files OK) from "signing back in
// after a logout" (do NOT auto-promote, user might intentionally keep some
// files local).
const HAS_EVER_SIGNED_IN_KEY = "hasEverSignedIn";
export async function hasEverSignedIn() {
  return !!(await getSetting(HAS_EVER_SIGNED_IN_KEY, false));
}
export async function markSignedIn() {
  await setSetting(HAS_EVER_SIGNED_IN_KEY, true);
}

// ── Legacy tombstones (pre-v3, settings-based) ───────────────────────────
// Kept readable for migrateLegacyTombstones; not used by new code paths.

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
