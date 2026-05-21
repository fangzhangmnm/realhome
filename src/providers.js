// Pluggable sources for "available worlds" (worlds discoverable but not
// necessarily cached locally). Local uploads are NOT a provider — they go
// straight from File API to IDB and have no remote source to re-fetch from.
//
// Each provider exposes:
//   source: string                                 ("bundled" | "onedrive")
//   list():  Promise<{ remoteId, name }[]>         discover available items
//   fetch(remoteId, ifNoneMatch?):                 pull one item
//     → Promise<{ blob, etag }>                    new bytes
//     → Promise<null>                              304 / offline / unchanged
//
// app.js's cacheWorld() routes between providers by `source` and shares one
// flow for add / update / optimize across all of them.

// Hardcoded list of worlds shipped with the app. Add entries here when we
// want to make a new bundled world discoverable. SW does NOT precache these
// (the glb passthrough rule applies) — fetch happens on user click.
const BUNDLED = [
  { url: "./worlds/RealHomeDefaultWorld.glb", name: "RealHome Default" },
];

function createBundledProvider() {
  return {
    source: "bundled",
    async list() {
      return BUNDLED.map((b) => ({ remoteId: b.url, name: b.name }));
    },
    async fetch(remoteId, ifNoneMatch) {
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
      const blob = await resp.blob();
      return { blob, etag };
    },
  };
}

// Future: createOneDriveProvider(msalClient) — same interface, Graph backend.
export const providers = [createBundledProvider()];
