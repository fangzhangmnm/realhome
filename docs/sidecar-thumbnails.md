# Sidecar thumbnails — 404-proof previews for 3D assets

How world cards get their preview image. Lives in
[src/providers.js](../src/providers.js) (fetch + URL providers),
[src/onedriveGraph.js](../src/onedriveGraph.js) (sidecar discovery in
the AppFolder), and [src/app.js](../src/app.js) (card render).

The journey here matters: we tried a runtime-render approach first, it
failed quietly on Quest, and the sidecar pattern is what we ended up
with. Pattern + the rejected alternatives are below.

## What didn't work: runtime render-to-target

First attempt: render each cached world's scene to a 384x384 offscreen
canvas, dump as PNG, store in IDB. On menu open, decode and show.

Three failure modes:

1. **Second WebGLRenderer fails on Quest mid-XR.** Initial implementation
   created a fresh `new WebGLRenderer()` per thumbnail call → new WebGL
   context. Quest's XR runtime holds the active GL context during a
   session; creating a second one silently fails (no error,
   `renderer.dispose()` runs in `finally`, the call returns nothing
   useful, no thumbnail ever persists).

2. **Render-to-target on the main renderer is fragile during XR.** Fix
   attempt #2: share the main renderer via `setRenderTarget()`. Works
   in flat mode. In XR sessions, three.js's XR manager re-asserts its
   target on the next animation frame, but if you don't save +
   restore (`autoClear`, clearColor, render-target), you'll glitch the
   XR layer. Even with that, asking the main renderer to draw a
   different scene mid-XR session is asking for trouble.

3. **Trigger ordering.** Thumbnails only generate when `installWorld`
   runs (i.e., user enters the world). For uncached worlds entered via
   `streamOpenWorld`, `current.id = null` (no IDB record), so the
   trigger silently no-ops. Bundled default world never got a thumbnail
   until manually cached + entered.

We deleted the runtime-render approach. Lesson: don't generate a
visual artifact at runtime when an artist could provide it as an asset.

## The sidecar pattern

Convention: `world.glb` ↔ `world.png` in the same folder. Artist drops
a PNG of whatever they want as the preview.

```
worlds/                          (bundled)
  RealHomeDefaultWorld.glb
  RealHomeDefaultWorld.png

OneDrive Apps/RealHome/          (user's AppFolder)
  house.glb
  house.png
  cabin.glb
  cabin.png
```

Both bundled and OneDrive go through the same code path. The provider
abstraction is what makes this work — see `Provider abstraction with
sidecar metadata` below.

## 404-proof: gradient placeholder via `<img onerror>`

The sidecar PNG is optional. If the artist didn't provide one, we want
to show a gradient placeholder, not a broken-image icon.

```js
const img = document.createElement("img");
img.onerror = () => img.remove();
img.src = sidecarUrl;
li.appendChild(img);
```

On 404 / network error, `img.remove()` strips the `<img>` from the
card. The card's CSS gradient (which was painted behind the img) shows
through. User sees a colored card instead of a broken image.

Don't try to be clever with HEAD requests or `Image.complete` —
`<img>` + `onerror` is the most robust path. Browser does the fetch
for free; we just react.

## Cache policy: thumb cached iff GLB cached

The model:

- **GLB cached in IDB:** the user manually clicked ↓ to cache. They
  want offline access. Cache the thumbnail in IDB too so the card
  renders offline.
- **GLB not cached:** the world is just "available" — pull thumb fresh
  per session like metadata. No IDB.

When the user clicks ↓ to cache a GLB, `cacheWorld()` also pulls the
sidecar (`provider.fetchThumbnail`) and stores it in IDB on the same
record. Background sync's `checkRemoteUpdates` does the same on each
poll, so when the artist updates the sidecar PNG, the cached IDB
thumbnail refreshes too.

## When online, always try fresh

Even for cached worlds (with an IDB blob), we try the network URL
first on every render:

```
1. Try network URL (provider's getThumbnailViewUrl)
2. On 404 / offline / error → fall back to IDB blob
3. If no IDB blob either → remove <img>, gradient shows
```

This is the "treat thumb like metadata" rule. mtime/etag could have
changed; the user opened the menu just now, prefer fresh. The IDB
blob is a fallback for offline use.

Implementation: chain two `onerror` handlers:

```js
const useIdb = () => {
  if (!idbBlob) { img.remove(); return; }
  img.onerror = () => img.remove();   // gradient on second failure
  img.src = URL.createObjectURL(idbBlob);
};
img.onerror = useIdb;
img.src = networkUrl;
```

The first `onerror` is `useIdb` (network failed → try IDB). The
`useIdb` swaps `onerror` to `img.remove` before setting `img.src` to
the blob URL (IDB blob also failed → give up).

## Provider abstraction with sidecar metadata

Both bundled and OneDrive expose the same three methods for thumbnails:

```js
// providers.js (both implement)
list(): Promise<{
  remoteId, name,
  thumbnailRemoteId?: string,    // opaque key; bundled = URL, onedrive = item id
}[]>
getThumbnailViewUrl(thumbnailRemoteId): Promise<string | null>
fetchThumbnail(thumbnailRemoteId): Promise<Blob | null>
```

Bundled implementation:
```js
list() returns BUNDLED entries with thumbnailRemoteId = URL.replace(/\.glb$/i, ".png")
getThumbnailViewUrl(url) → Promise.resolve(url)
fetchThumbnail(url) → fetch(url) → blob
```

OneDrive implementation:
```js
listAppFolderGlbs() scans for .glb AND .png, matches by basename,
attaches matching png's item id as thumbnailRemoteId
getThumbnailViewUrl(itemId) → Graph getItemMeta → @microsoft.graph.downloadUrl
fetchThumbnail(itemId) → Graph /content download → blob
```

Card render code doesn't care which provider — it just calls the same
methods. This is the "default home vs OneDrive home should be treated
as similarly as possible" requirement (user words) implemented as
provider abstraction.

## OneDrive list: include PNGs in the same query

Naive: list `.glb` files, then for each one, separately query the
sibling `.png`. That's N+1 round-trips per menu open.

Better: list everything (`.glb` AND `.png`) in one call, group by
basename in app code, attach matching `.png` item id to each `.glb`
entry:

```js
const all = await listAllAppFolderChildren();    // single Graph call
const pngByBase = new Map();
for (const it of all) {
  if (/\.png$/i.test(it.name)) pngByBase.set(it.name.replace(/\.png$/i, ""), it);
}
return all.filter(it => /\.glb$/i.test(it.name)).map((g) => ({
  remoteId: g.id,
  name: g.name,
  thumbnailRemoteId: pngByBase.get(g.name.replace(/\.glb$/i, ""))?.id || null,
}));
```

One round-trip. Cheap.

## OneDrive: short-lived downloadUrl, session-cached

`@microsoft.graph.downloadUrl` is a pre-signed CDN URL valid for ~1
hour. We cache it in memory per page session in
`thumbnailViewUrlCache`. Cleared on reload (URLs would have expired
anyway). Avoids re-hitting Graph for every menu render.

```js
const thumbnailViewUrlCache = new Map();   // remoteId → url
async getThumbnailViewUrl(remoteId) {
  if (thumbnailViewUrlCache.has(remoteId)) return thumbnailViewUrlCache.get(remoteId);
  const meta = await graph.getItemMeta(remoteId);
  const url = meta?.downloadUrl || null;
  thumbnailViewUrlCache.set(remoteId, url);   // including null so we don't re-try
  return url;
}
```

## Storing `thumbnailRemoteId` in the IDB record

The IDB record persists `thumbnailRemoteId` so subsequent
`checkRemoteUpdates` can re-pull the thumbnail using the stored key.
Without this, after the first cache, we'd only know the world's
remoteId — re-listing the provider would give us the new
thumbnailRemoteId, but we'd have re-list overhead. Storing avoids
that.

```js
// worldStore.addWorld
{
  ...,
  thumbnailRemoteId: opts.thumbnailRemoteId || null,
}
```

## Where local uploads fit (or don't)

Local uploads (drag-drop a glb from filesystem) have no sidecar
source. Card always shows gradient. The user could:

- Upload to OneDrive too (auto-upload on drag-drop, default behavior).
  Then the OneDrive sidecar pattern applies.
- Drop a PNG separately at upload time — not implemented; would need a
  way to associate the two files.

For v1, local = gradient. Acceptable since most users will end up
using OneDrive.

## Files

- [src/providers.js](../src/providers.js) — bundled + OneDrive
  provider implementations with sidecar methods
- [src/onedriveGraph.js](../src/onedriveGraph.js) — `listAppFolderGlbs`
  with sidecar matching
- [src/worldStore.js](../src/worldStore.js) — IDB schema with
  `thumbnail` blob + `thumbnailRemoteId` key
- [src/app.js](../src/app.js) — `cacheWorld` fetches sidecar,
  `refreshThumbnailForRec` background-syncs, `appendWorldCard` renders
  with the chained-fallback logic
