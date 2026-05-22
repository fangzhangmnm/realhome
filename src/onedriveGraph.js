// Thin Microsoft Graph client for the AppFolder sandbox.
//
// Scope: Files.ReadWrite.AppFolder — the app sees ONLY a `RealHome` folder
// auto-provisioned under the user's OneDrive Apps/. We never see their other
// files. The folder is created on first GET to /me/drive/special/approot/.
//
// Endpoints we use:
//   GET  approot/children                  → list .glb files (paginated)
//   GET  /items/{id}?$select=...           → metadata for size + eTag + downloadUrl
//   GET  @microsoft.graph.downloadUrl      → short-lived CDN URL for bytes
//
// Why downloadUrl instead of /items/{id}/content:
//   /content auto-302s to a CDN. The browser strips Authorization across
//   cross-origin redirects, so the CDN must serve unauthenticated — which
//   works, but caching/efficiency is better when we go straight to the
//   pre-signed URL ourselves. Pattern lifted from sibling project's
//   downloadItemBlob() in ../20260518 JustReadPapers/src/graph.js.
//
// Error semantics: 401 → token expired (caller retries via getToken's
// interaction-required path). 404 → item gone. Others throw with the Graph
// error body unwrapped for readability.

import { getToken } from "./onedriveAuth.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const APP_ROOT = "/me/drive/special/approot";

async function graphFetch(path, init = {}) {
  const token = await getToken();
  const url = path.startsWith("http") ? path : GRAPH_BASE + path;
  const resp = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    let detail = `${resp.status} ${resp.statusText}`;
    try {
      const body = await resp.json();
      if (body?.error?.message) detail = `${resp.status}: ${body.error.message}`;
    } catch (_) {}
    const err = new Error(`Graph ${path}: ${detail}`);
    err.status = resp.status;
    throw err;
  }
  return resp;
}

// List all .glb files under the AppFolder root, with sibling .png matched
// in by basename. Follows @odata.nextLink for users with >200 files
// (cheap insurance — most users won't hit it).
//
// The sidecar convention: `world.glb` ↔ `world.png` in the same folder.
// If a sibling png exists, its item id is attached so the caller can
// fetch the thumbnail without an extra round-trip.
//
// Returns: [{ remoteId, name, etag, size, thumbnailRemoteId?, thumbnailEtag? }]
export async function listAppFolderGlbs() {
  const fields = "id,name,size,eTag,file";
  let url = `${APP_ROOT}/children?$select=${fields}&$top=200`;
  const all = [];
  while (url) {
    const resp = await graphFetch(url);
    const body = await resp.json();
    if (Array.isArray(body.value)) all.push(...body.value);
    url = body["@odata.nextLink"] || null;
  }

  // Index PNG sidecars by basename (filename minus `.png`).
  const pngByBase = new Map();
  for (const it of all) {
    if (!it.file || !/\.png$/i.test(it.name)) continue;
    const base = it.name.replace(/\.png$/i, "");
    pngByBase.set(base, it);
  }

  return all
    .filter((it) => it.file && /\.glb$/i.test(it.name))
    .map((it) => {
      const base = it.name.replace(/\.glb$/i, "");
      const sidecar = pngByBase.get(base);
      return {
        remoteId: it.id,
        name: it.name,
        etag: it.eTag || "",
        size: typeof it.size === "number" ? it.size : null,
        thumbnailRemoteId: sidecar?.id || null,
        thumbnailEtag: sidecar?.eTag || "",
      };
    });
}

// Get metadata for one item (plus downloadUrl for streaming). Returns null on
// 404. We include @microsoft.graph.downloadUrl in $select because it's a
// computed property — must be opted into.
export async function getItemMeta(itemId) {
  try {
    const resp = await graphFetch(
      `/me/drive/items/${itemId}?$select=id,name,size,eTag,@microsoft.graph.downloadUrl`
    );
    const body = await resp.json();
    return {
      remoteId: body.id,
      name: body.name,
      etag: body.eTag || "",
      size: typeof body.size === "number" ? body.size : null,
      downloadUrl: body["@microsoft.graph.downloadUrl"] || null,
    };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// Download item bytes. Conditional on ifNoneMatch (eTag): returns null if
// upstream hasn't changed. Goes through the short-lived downloadUrl (CDN)
// rather than /content (which redirects and strips auth).
//
// onProgress(loaded, total) is called per chunk. `total` is 0 when the CDN
// doesn't return Content-Length (rare).
export async function fetchItemContent(itemId, ifNoneMatch, onProgress) {
  const meta = await getItemMeta(itemId);
  if (!meta) return null;
  if (ifNoneMatch && meta.etag === ifNoneMatch) return null;

  // downloadUrl is a pre-signed, time-limited URL. Plain unauthenticated fetch.
  // Fallback to /items/{id}/content if Graph didn't return downloadUrl (very
  // rare — happens for some org policies that disable direct download).
  let resp;
  if (meta.downloadUrl) {
    resp = await fetch(meta.downloadUrl);
    if (!resp.ok) throw new Error(`downloadUrl ${resp.status}`);
  } else {
    resp = await graphFetch(`/me/drive/items/${itemId}/content`);
  }

  const total = Number(resp.headers.get("content-length")) || meta.size || 0;
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
    type: resp.headers.get("content-type") || "model/gltf-binary",
  });
  return { blob, etag: meta.etag };
}

// Delete an item from the AppFolder. 404 is treated as success (already
// gone). All other errors propagate.
export async function deleteAppFolderItem(itemId) {
  try {
    await graphFetch(`/me/drive/items/${itemId}`, { method: "DELETE" });
  } catch (err) {
    if (err.status === 404) return;
    throw err;
  }
}

// Check if a file with `filename` already exists in the AppFolder. Returns
// item meta or null. Caller uses this to ask the user "overwrite?" before
// upload — the alternative (let Graph's conflictBehavior=fail surface a 409
// mid-upload) is messier, especially for chunked uploads where the conflict
// only fires at the final chunk.
export async function getAppFolderItemByName(filename) {
  const enc = encodeURIComponent(filename);
  try {
    const resp = await graphFetch(`${APP_ROOT}:/${enc}?$select=id,name,size,eTag`);
    const body = await resp.json();
    return {
      remoteId: body.id,
      name: body.name,
      etag: body.eTag || "",
      size: typeof body.size === "number" ? body.size : null,
    };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// Upload a glb to the AppFolder. Returns the new driveItem (id, name, size,
// eTag).
//
// Uses simple PUT for blobs ≤4MB; otherwise createUploadSession + chunked
// PUTs (Graph requires the chunked path for larger uploads).
//
// `overwrite` controls the conflict behavior:
//   - false → conflictBehavior=fail. Graph returns 409 if name exists.
//             Caller should pre-check existence and either avoid the call
//             or pass overwrite=true after confirming with the user.
//   - true  → conflictBehavior=replace. Existing item is overwritten
//             in-place; the itemId stays the same, content + eTag update.
//
// onProgress(loaded, total) is called per chunk during chunked upload, or
// just once at the end for simple PUT (the Fetch API doesn't expose
// request body streaming progress without dropping to XHR).
//
// Pattern from sibling: ../20260518 JustReadPapers/src/graph.js uploadFileToApproot.
const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024;        // 4 MB Graph PUT ceiling
const CHUNK_SIZE = 5 * 1024 * 1024;                 // 5 MB chunks (Graph requires multiples of 320 KiB; 5MB is safe)

export async function uploadItemToAppFolder(filename, blob, { overwrite = false, onProgress } = {}) {
  const encName = encodeURIComponent(filename);
  const conflict = overwrite ? "replace" : "fail";

  if (blob.size <= SIMPLE_UPLOAD_LIMIT) {
    const resp = await graphFetch(
      `${APP_ROOT}:/${encName}:/content?@microsoft.graph.conflictBehavior=${conflict}`,
      {
        method: "PUT",
        headers: { "Content-Type": "model/gltf-binary" },
        body: blob,
      },
    );
    onProgress?.(blob.size, blob.size);
    const item = await resp.json();
    return {
      remoteId: item.id,
      name: item.name,
      etag: item.eTag || "",
      size: typeof item.size === "number" ? item.size : blob.size,
    };
  }

  // Chunked upload via createUploadSession. uploadUrl is unauthenticated and
  // short-lived; do NOT send the Authorization header on chunk PUTs (Graph
  // requires the URL itself to authenticate).
  const sessResp = await graphFetch(
    `${APP_ROOT}:/${encName}:/createUploadSession`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item: {
          "@microsoft.graph.conflictBehavior": conflict,
          name: filename,
        },
      }),
    },
  );
  const { uploadUrl } = await sessResp.json();

  let offset = 0;
  let lastItem = null;
  while (offset < blob.size) {
    const end = Math.min(offset + CHUNK_SIZE, blob.size) - 1;
    const chunk = blob.slice(offset, end + 1);
    const r = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.size),
        "Content-Range": `bytes ${offset}-${end}/${blob.size}`,
      },
      body: chunk,
    });
    if (!r.ok && r.status !== 202) {
      throw new Error(`OneDrive chunked upload failed at ${offset}: ${r.status}`);
    }
    onProgress?.(end + 1, blob.size);
    lastItem = await r.json().catch(() => null);
    offset = end + 1;
  }
  if (!lastItem) throw new Error("OneDrive upload completed but no item returned");
  return {
    remoteId: lastItem.id,
    name: lastItem.name,
    etag: lastItem.eTag || "",
    size: typeof lastItem.size === "number" ? lastItem.size : blob.size,
  };
}
