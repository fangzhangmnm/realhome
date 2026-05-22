// Pluggable sources for "available worlds" (worlds discoverable but not
// necessarily cached locally). Local uploads are NOT a provider — they go
// straight from File API to IDB and have no remote source to re-fetch from.
//
// Each provider exposes:
//   source: string                                 ("bundled" | "onedrive")
//   list():  Promise<{ remoteId, name, thumbnailUrl?, thumbnailRemoteId? }[]>
//                                                  discover available items
//   fetch(remoteId, ifNoneMatch?):                 pull one item
//     → Promise<{ blob, etag }>                    new bytes
//     → Promise<null>                              304 / offline / unchanged
//   fetchThumbnail?(item):                         pull sidecar PNG bytes
//     → Promise<Blob | null>                       null = no sidecar / 404
//
// Thumbnail strategy:
//   - bundled: thumbnailUrl is a deterministic same-origin path
//     (world.glb → world.png). Card binds <img src> directly; browser
//     handles cache + 404 via onerror.
//   - onedrive: thumbnailRemoteId comes from the AppFolder listing
//     (sibling .png matched by basename). cacheWorld fetches the bytes
//     once at cache time and stores in IDB alongside the world blob.
//   - local: no sidecar source. Card shows the gradient placeholder.
//
// app.js's cacheWorld() routes between providers by `source` and shares one
// flow for add / update / thumbnail across all of them.

// Hardcoded list of worlds shipped with the app. Add entries here when we
// want to make a new bundled world discoverable. SW does NOT precache these
// (the glb passthrough rule applies) — fetch happens on user click.
const BUNDLED = [
  { url: "./worlds/RealHomeDefaultWorld.glb", name: "RealHome Default" },
];

// In-memory cache of HEAD-request results so opening the menu repeatedly doesn't
// re-poll the server. Lifetime = page session; cleared on reload.
const sizeCache = new Map();

function createBundledProvider() {
  return {
    source: "bundled",
    async list() {
      return BUNDLED.map((b) => ({
        remoteId: b.url,
        name: b.name,
        // Sidecar path: same folder, same basename, .png extension.
        // Artist drops a PNG next to the glb. If missing, the <img>
        // load fires onerror and the gradient placeholder shows through.
        thumbnailUrl: b.url.replace(/\.glb$/i, ".png"),
      }));
    },
    // onProgress(loaded, total) called every chunk during body download.
    // `total` is 0 when Content-Length is missing; caller should treat that
    // as indeterminate.
    async fetch(remoteId, ifNoneMatch, onProgress) {
      const headers = {};
      if (ifNoneMatch) headers["If-None-Match"] = ifNoneMatch;
      let resp;
      try {
        resp = await fetch(remoteId, { headers });
      } catch {
        return null;        // offline; caller treats as "no change available"
      }
      if (resp.status === 304) return null;
      if (!resp.ok) throw new Error(`${remoteId}: ${resp.status}`);
      const etag =
        resp.headers.get("etag") || resp.headers.get("last-modified") || "";

      const total = Number(resp.headers.get("content-length")) || 0;
      const reader = resp.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onProgress?.(received, total);
      }
      const blob = new Blob(chunks, {
        type: resp.headers.get("content-type") || "application/octet-stream",
      });
      return { blob, etag };
    },
    // HEAD request for size only — used by the menu to show "X MB · tap to
    // stream" on uncached entries. Returns null on offline / server error.
    async getSize(remoteId) {
      if (sizeCache.has(remoteId)) return sizeCache.get(remoteId);
      try {
        const resp = await fetch(remoteId, { method: "HEAD" });
        if (!resp.ok) { sizeCache.set(remoteId, null); return null; }
        const n = Number(resp.headers.get("content-length"));
        const size = Number.isFinite(n) && n > 0 ? n : null;
        sizeCache.set(remoteId, size);
        return size;
      } catch {
        sizeCache.set(remoteId, null);
        return null;
      }
    },
  };
}

// OneDrive provider. Available only when ONEDRIVE_CLIENT_ID is set AND the
// user is signed in — list() returns empty otherwise, so the menu just shows
// nothing from this source. UI's sign-in button drives the actual login.
function createOneDriveProvider() {
  // Lazy-import the OneDrive modules so the MSAL bundle isn't loaded until
  // someone actually clicks sign-in. Keeps the cold-boot import graph small.
  let modPromise = null;
  function getMod() {
    if (!modPromise) modPromise = (async () => ({
      auth: await import("./onedriveAuth.js"),
      graph: await import("./onedriveGraph.js"),
    }))();
    return modPromise;
  }

  const sizeCache = new Map();
  // Session cache for sidecar PNG view URLs. downloadUrls expire (~1h) but
  // we only need them within one page session. On reload they expire and
  // we re-fetch. Same lifetime model as sizeCache.
  const thumbnailViewUrlCache = new Map();

  return {
    source: "onedrive",
    async list() {
      const { auth, graph } = await getMod();
      if (!auth.isConfigured()) return [];
      const account = await auth.getAccount();
      if (!account) return [];
      const items = await graph.listAppFolderGlbs();
      // Stash sizes from list() so getSize() doesn't re-fetch per row.
      for (const it of items) if (it.size != null) sizeCache.set(it.remoteId, it.size);
      return items.map((it) => ({
        remoteId: it.remoteId,
        name: it.name,
        thumbnailRemoteId: it.thumbnailRemoteId || null,
        thumbnailEtag: it.thumbnailEtag || "",
      }));
    },
    async fetch(remoteId, ifNoneMatch, onProgress) {
      const { graph } = await getMod();
      return graph.fetchItemContent(remoteId, ifNoneMatch, onProgress);
    },
    // Fetch a sidecar PNG by Graph item ID. Returns null on 404 / missing —
    // caller falls back to the gradient placeholder. cacheWorld calls this
    // when an item has a thumbnailRemoteId so the bytes land in IDB next to
    // the world blob.
    async fetchThumbnail(thumbnailRemoteId) {
      if (!thumbnailRemoteId) return null;
      try {
        const { graph } = await getMod();
        const result = await graph.fetchItemContent(thumbnailRemoteId);
        return result?.blob || null;
      } catch {
        return null;
      }
    },
    // Per-session-cached sidecar view URL. Used for UNCACHED OneDrive
    // entries so the menu can show a thumbnail without committing to a
    // full download. Once the user ↓-caches the world, the bytes go to
    // IDB via fetchThumbnail and this URL is no longer needed.
    //
    // Graph's @microsoft.graph.downloadUrl is a short-lived (~1h)
    // pre-signed CDN URL — we cache it for the page session to avoid
    // re-hitting Graph on every render, and re-fetch on the next reload.
    async getThumbnailViewUrl(thumbnailRemoteId) {
      if (!thumbnailRemoteId) return null;
      if (thumbnailViewUrlCache.has(thumbnailRemoteId)) {
        return thumbnailViewUrlCache.get(thumbnailRemoteId);
      }
      try {
        const { graph } = await getMod();
        const meta = await graph.getItemMeta(thumbnailRemoteId);
        const url = meta?.downloadUrl || null;
        thumbnailViewUrlCache.set(thumbnailRemoteId, url);
        return url;
      } catch {
        thumbnailViewUrlCache.set(thumbnailRemoteId, null);
        return null;
      }
    },
    async getSize(remoteId) {
      if (sizeCache.has(remoteId)) return sizeCache.get(remoteId);
      try {
        const { graph } = await getMod();
        const meta = await graph.getItemMeta(remoteId);
        const size = meta?.size ?? null;
        sizeCache.set(remoteId, size);
        return size;
      } catch {
        sizeCache.set(remoteId, null);
        return null;
      }
    },
  };
}

export const providers = [createBundledProvider(), createOneDriveProvider()];
