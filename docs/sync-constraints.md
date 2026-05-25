# Sync constraints — product-level priorities

The product-level rules the local-cache ↔ cloud-sync layer must obey.
Listed in priority order — higher numbers may be sacrificed for lower
numbers, never the reverse.

This is a **cross-project** doc — same constraints apply across the
sibling-app family (RealHome, WebXiaoHeiWu, Background Audio,
JustReadPapers, JustReadBooks). What differs per project is which
variability axes (last section) apply; the core constraints don't.

## Core constraints (priority order)

### 1. Zero-account is first-class (product promise)

The app works **completely** offline, with **no** cloud account, as a
fully functional standalone tool. Not a degraded fallback — a first-
class mode.

For RealHome: no OneDrive sign-in = drag-drop glb → it plays. Bundled
worlds work. Cached worlds work. Nothing about the UI says "you need
to sign in."

### 2. No consent → no user data deletion (critical safety red line)

The app **never** silently destroys user data. Every destructive
action requires explicit user consent.

#### User data isn't one thing — 4 protection levels

| Level | What it is | How it got into IDB | Eviction rule |
|---|---|---|---|
| **Top: user uploads** | Files the user explicitly added | drag-drop / file picker | Never auto-evict. **Pinned.** |
| **High: user-cached cloud items** | Cloud items the user explicitly asked to have offline | ↓ button | Never auto-evict. **Pinned.** |
| **Medium: auto-sync caches** | Auto-pulled by background sync (thumbnails, freshness refresh) | mergeRemoteList / silentRefreshIfStale | LRU-evictable. Will re-fetch on demand. |
| **Low: session memory** | Stream-and-play, never persisted | (never in IDB) | Naturally gone at end of session |

**Pinned** (Top + High) means: no automatic eviction touches this.
Quota pressure must surface to the user as a prompt, not silently
delete pinned data.

#### Two consent semantics for deletion

- **Local cache consent**: removing a record from the local IDB.
  Lower-risk because (for cloud-backed records) the cloud copy may
  still exist and is re-fetchable. Standard confirm dialog. Applies
  to × button on cards.
- **Cloud consent**: deleting from the user's cloud. High-risk: data
  gone everywhere across devices. Stronger confirm: name the file,
  show "this affects all your devices," default button = Cancel.
  Applies to 🗑 button.

The two MUST be separate UI affordances. A single button must not do
both without making the scope crystal clear.

#### "Clean cache" must itemize across protection levels

If a single bulk-deletion button can touch the Top or High level, it
must itemize:

```
Clean all cache?
Will be deleted:
  - 12 worlds you uploaded locally (4.2 GB)   ⚠ NOT recoverable
  - 8 OneDrive cached worlds (re-downloadable when online)
  - 23 public-source cached worlds (re-fetchable)

[Cancel]   [I understand, delete all]
```

Better still: split into two buttons:
- "Clear recoverable caches only" — Medium level only; preserves Top + High
- "Wipe everything including local uploads" — separate, scarier confirm

#### Empty-list safety net (apply to all auto-sync paths)

If a list/sync operation returns suspiciously empty (e.g., 0 items
where last time we had N), DO NOT batch-ghost everything. The empty
response is more likely a server hiccup, transient auth failure, or
a wrong-folder query than "the user deleted everything."

Rule: a single empty list does not flip multiple `remoteFound` flags
to false at once. Either require corroboration (two consecutive empty
lists) or only flip per-item ghosts on items that have always shown
up consistently and are now individually missing.

(Pattern from JustReadBooks's `reconcileWithRemoteList`, generalized.)

### 3. Sudden offline → all cached content still works (high)

If the network drops mid-session — and especially across sessions —
everything previously cached must remain fully usable. No "loading"
spinner that never resolves, no error toast for content the user has
already downloaded.

For RealHome: cached worlds load from IDB and play. Cached thumbnails
appear. Menu populates from IDB. The only things that fail are
operations that genuinely need network (new download, upload, sign
in).

### 4. In-app upload semantics depend on signin state at drag time (medium-high)

When the user adds a file from the app (drag-drop, file picker), the
implicit consent depends on whether they're signed in **at that
moment**:

- **Signed in at drag time** → consent covers "save in my cloud (which
  is the whole point of being signed in)". App saves to IDB **and**
  pushes to OneDrive. If push fails (network / server), preserve
  intent as `pendingUpload=true` and retry opportunistically. The
  failure is technical; the consent stands.
- **Not signed in at drag time** → consent covers "use this file in
  the app." It does **not** cover "push to whatever cloud I might
  connect later." Save to IDB as `source="local"`, **do not** mark
  `pendingUpload`. The file is local-only and stays local-only.

The reason: consent doesn't extrapolate. See "Consent scope
principle" below.

#### Cross-state: first-time signin

Exception: when a user who has NEVER previously signed in to any
cloud account signs in for the first time, that signin act itself IS
implicit consent to "enable cloud sync going forward, including
existing files." The app auto-promotes all `source="local"` records
to the new cloud (going through standard collision handling).

Heuristic: persistent `hasEverSignedIn` flag (localStorage, once
flipped never resets). False at signin → first-time → OK to
auto-promote. True at signin → user is signing back in (possibly to
a different account) → existing local files stay local; user can
manually push via a UI action if they want.

After the first-time auto-promote, the flag is set forever; the
auto-promote path does not re-trigger on subsequent signins or
account changes.

#### Retry policy for pendingUpload

When `pendingUpload=true` and the push fails:
- Flag stays set across sessions
- Retry on: app boot, menu reappear (controls unlock / xr.sessionend),
  `window.online` event, sign-in success
- No polling. No aggressive retry on failure (battery, no benefit).
- User explicitly cancels a collision prompt → set
  `uploadDeferred=true, pendingUpload=false`. Won't auto-retry until
  user explicitly says "upload now" via a per-card UI affordance.

### 5. Users edit the cloud directly (medium)

Users will reorganize on the cloud side outside the app:
- Rename files
- Delete files
- Modify files
- (Some projects) reorganize into subfolders

The app must handle gracefully:
- A rename on the cloud → next sync sees a "new" item (item id may
  change depending on the cloud); local cache may become orphaned.
  Don't crash. Don't silently delete the local cache.
- A delete on the cloud → local cache becomes a "ghost" (was on
  cloud, isn't anymore). UI shows this state. **Do not** auto-delete
  the local cache (constraint #2).
- A modification on the cloud → next sync detects via mtime/etag,
  pulls new content (constraint #6).

### 6. Cache freshness via mtime/etag (medium)

The app needs a cheap signal for "has this content changed?" Standard
mechanism: store the mtime/etag/cTag the cloud returned at last sync;
conditional GET with `If-None-Match` / `If-Modified-Since` on
subsequent reads.

304 → cache is fresh, no download needed.
200 → new bytes, update local cache.

This is what allows opening the menu to be fast even with many cached
items (the conditional GETs are cheap on 304).

### 7. Long-offline → reconnect with many queued uploads needs a strategy (low)

Edge case: user is offline (or signed-out) for a long time. Adds many
files to the app. Eventually reconnects.

The system must do something coherent. Options:
- Auto-push each one in order; collisions resolved per-item
- **Surface duplicates as a local error**: "you have N files that
  collide with cloud, please rename them before they can upload"
- Combination: push the non-colliding ones automatically, surface
  collisions for user attention

User preference: surface collisions, require rename before upload.
More friction but prevents accidental overwrite of cloud data the
user may have forgotten was there.

### 8. Minimize duplicates as an aesthetic goal (lowest)

Even when conflicts are correctly resolved, the result can pollute
the cloud / cache with multiple copies (e.g., auto-suffix uploads:
`house.glb`, `house (Quest 2026-05-22).glb`, `house (PC).glb`, …).
The user has to clean up later.

Design should:
- Prefer asking the user to disambiguate over silent auto-suffix
- Surface duplicates in the UI (badge / counter)
- Provide a "resolve duplicates" helper for cleanup

This is the *last* priority — it can be sacrificed when it conflicts
with #2 (no data loss). Better a duplicate than a missing file.

## Consent scope principle

This is the lens for interpreting any "did the user consent to X?"
question that comes up while designing a flow.

**A user gesture grants consent only for the (action, scope) the user
saw at the time of the gesture. Consent does not extrapolate to
related future actions, different scopes, or different system states.**

Worked examples:

| User gesture | What consent covers | What consent does NOT cover |
|---|---|---|
| Drag-drop file (no account) | Save locally; use in the app | Push to any cloud added later |
| Drag-drop file (signed in) | Save locally; push to **current** cloud account | Push to a future different cloud account |
| Click ↓ on a cloud world | Cache this version offline | Auto-overwrite future cloud updates (that's freshness, separate) |
| Click × on a card | Delete this local record | Delete from cloud |
| Click 🗑 on a cloud world | Delete from cloud (and local) | Delete other records |
| Sign in to account A | Use account A from now on | Push existing local files unless first-time (see #4) |
| Sign out | Stop using cloud | Delete cached cloud content |
| Switch from account A to B | Use account B from now on | (cascade delete REQUIRES separate explicit consent — data loss) |
| Click "Clean cache" | Delete what the button copy itemizes | Delete things the button copy didn't list |

When a code path is about to do something that wasn't covered by an
explicit user gesture, **stop and ask whether you're extrapolating
consent**. If yes, either find a way to surface a new consent prompt,
or don't do it.

## Variability across sibling projects

Different projects in the family touch different combinations of
these orthogonal axes. **What's common is the priority order above.**
What differs is which features apply.

### Axis A: Data source topology

- **Single personal cloud + maybe public sources** — RealHome (OneDrive
  + future GitHub public-source). Local cache is for offline; cloud is
  the authoritative copy for personal data.
- **Single personal cloud, no public sources** — WebXiaoHeiWu,
  JustReadPapers, Background Audio. Cloud is the only remote source.

### Axis B: Local edit-and-upload patterns

- **Heavy local editing with frequent push** — WebXiaoHeiWu (note-
  taking, every few seconds of typing is dirty). Needs dirty-state
  tracking, sibling-on-412, atomic conditional writes.
- **No in-app editing, only ingest + render** — RealHome (artist
  exports glb in Blender), JustReadPapers / JustReadBooks (existing
  files). Constraint #4's "upload" means "ingest from local disk",
  not "save user edits". Much simpler.

### Axis C: Cloud-side subfolder organization

- **Flat AppFolder** — RealHome, WebXiaoHeiWu, JustReadPapers.
  Everything at the AppFolder root.
- **Subfolder taxonomy** — Background Audio (playlists / folders),
  JustReadBooks (categories / shelves). Users organize hierarchically.

For projects on this axis: provider API must support folder
operations (create, move-between, list-recursive), `Sources` table or
schema must encode the hierarchy, UI must let users navigate.

### Axis D: Multi-cloud (future, not v1 for any project)

- All projects currently: **at most one personal cloud account**
- Future: multiple cloud providers (Dropbox / Google Drive / iCloud)
  AND multiple accounts per provider AND NAS support
- One account logged in at a time (no concurrent multi-account)
- Account-switch options:
  - **discard-all-rebuild** — cascade delete current cache, sign in,
    re-sync. Very dangerous: requires serious consent surface.
  - **auto-migrate-upload** — push current cached content to new
    account before clearing. Minimizes duplicates but slow.

Out of scope for current implementations; reserved here so data model
doesn't paint into a corner.

## Which axes apply to RealHome

| Axis | RealHome status |
|---|---|
| A. Data sources | Single OneDrive cloud + future GitHub public sources |
| B. Local edits | No (artist edits in Blender, app only ingests). Constraint #4 is "ingest from disk → push to cloud" |
| C. Subfolders | No — flat AppFolder |
| D. Multi-cloud | Out of scope v1 |

So RealHome's sync layer is the *simplest* combination: single cloud,
no in-app edits, flat. The cross-project constraints (1-8) still apply.

## What this doc is for

- **Design check**: when proposing a new feature or refactor, walk
  through 1-8 and the Consent scope principle. If priorities conflict,
  the lower-numbered constraint wins.
- **Code review check**: any code path that might delete, overwrite,
  or silently fail must be auditable against 1-3.
- **Cross-project alignment**: when porting a pattern from one sibling
  to another, refer to the variability matrix to see what's relevant.

## Not in this doc (intentionally)

- **Schema** — to be captured in a `data-model.md` when the refactor
  lands. Until then, schema discussions live in design notes.
- **Specific implementation rules** (atomic writes, etag pinning,
  tombstone semantics) — derived from these constraints; will live
  alongside the schema doc.
- **UI flows for specific operations** — see
  [docs/user-flows.md](user-flows.md).
- **Per-provider quirks** (Graph API patterns, MSAL traps) — see
  [docs/msal-onedrive-patterns.md](msal-onedrive-patterns.md).
- **Three-pattern taxonomy** (writable-doc / opaque-blob /
  read-only-asset) — see [docs/sync-strategies.md](sync-strategies.md)
  for the orientation lens.

## One-sentence summary

> Offline-first; pinned data (user uploads + user-cached) never
> auto-evicts; cloud writes only via explicit user gesture (×, 🗑,
> sign-in, drag-with-account); consent doesn't extrapolate; cache
> works during outages; etag-based freshness; long-offline-reconnect
> handled coherently; minimize duplicates only after all of the above.
