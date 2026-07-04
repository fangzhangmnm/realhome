// The worlds gallery view — the one owner of rendering the world list DOM: the
// cached-first paint, per-provider async append of uncached entries, the
// render-token race guard, thumbnail load/fallback chain, source + sync-state
// badges, and the per-source action buttons.
//
// It does NOT wire click handlers: cards carry `dataset` attributes (id / source
// / remoteId / worldName / thumbnailRemoteId) and app.js's event delegation
// reads those to dispatch enter/cache/delete. So this module needs no action
// callbacks — only its data sources (imported) plus the list element + the two
// error-log hooks (injected, since those are app-owned instances).

import { listWorlds, isTombstoned } from "./worldStore.js";
import { providers, getProvider } from "./providers.js";
import { worldSession } from "./worldSession.js";
import { makeIcon, formatBytes, formatRelativeTime } from "./format.js";

export function createGalleryView({ worldsListEl, logError, clearError }) {
  // Render token: every renderWorldsList increments this and captures it. Any
  // async append inside the same render checks the token against the current
  // value and bails if a newer render has started — protects against:
  //   (a) two concurrent renderWorldsList() calls racing on innerHTML
  //   (b) a long-running provider.list() append landing in a stale DOM
  let renderToken = 0;

  // Track blob URLs created for thumbnails so we can revoke them on re-render.
  // objectURLs leak GPU/main-thread memory until revoked.
  const thumbnailUrls = [];

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
    const isCurrent = worldSession.isCurrent({ id: w.id, source: w.source, remoteId: w.remoteId });

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
    const provider = getProvider(w.source);
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
      b.appendChild(makeIcon("upload", 11));
      b.appendChild(document.createTextNode("pending"));
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
      const p = getProvider(w.source);
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
        dl.appendChild(makeIcon("download"));
        actions.appendChild(dl);
      } else {
        const del = document.createElement("button");
        del.className = "world-action world-delete danger";
        del.type = "button";
        del.dataset.id = w.id;
        del.title = w.source === "local" ? "Delete world" : "Remove from cache";
        del.appendChild(makeIcon("x"));
        actions.appendChild(del);

        if (w.source === "onedrive") {
          const delRemote = document.createElement("button");
          delRemote.className = "world-action world-delete-remote danger-strong";
          delRemote.type = "button";
          delRemote.dataset.id = w.id;
          delRemote.title = "Delete from OneDrive";
          delRemote.appendChild(makeIcon("trash"));
          actions.appendChild(delRemote);
        }
      }
      li.appendChild(actions);
    }

    worldsListEl.appendChild(li);
  }

  return { renderWorldsList };
}
