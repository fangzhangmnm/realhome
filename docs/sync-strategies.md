# Sync strategies — which to pick for what use case

OneDrive AppFolder sync is not one design. The right strategy depends on
*who edits the file* and *what "merge" even means* for that content. This
doc names three concrete patterns from the sibling-project family, the
trade-offs of each, and which one fits RealHome. Open questions at the
bottom.

## Three patterns in the sibling family

### Pattern A — Writable structured document (sibling-creation merge)

**Example:** WebXiaoHeiWu (note-taking, plain text `.txt` files).
**Editor:** the app itself, multiple devices, possibly concurrent.
**Conflict reality:** Alice types on PC, switches to Quest, types more
without syncing. Two versions of the same file with diverged content.

**Strategy** ([../20260516 WebXiaoHeiWu/src/sync.js](../../20260516%20WebXiaoHeiWu/src/sync.js)):

- `If-Match: <etag>` on every PUT. 412 = "remote changed since we last
  read."
- On 412: **don't overwrite**. Save local dirty content as a SIBLING file
  with a timestamped suffix ("foo (Quest 离线副本 2026-05-21 14-00).txt"),
  then pull remote into the original doc slot. Both versions preserved;
  user merges manually on PC.
- 404 on push: remote was deleted while we were offline. Mark
  `remoteFound=false` and prompt the user — never silently re-create.
- List + merge: missing-on-remote ≠ delete-locally. Always preserve.
- "Write new before delete old" for transitions (encrypt/decrypt actions)
  so an interrupted run leaves two files, not zero.

**Cost:** complex code (~1000 lines of sync). High mental model load. But
correct: NO user keystroke can be silently lost.

### Pattern B — Writable opaque blob (last-write-wins)

**Example:** JustReadPapers's `session.json` (cross-device reading
position).
**Editor:** the app, but the "content" is just position tracking — losing
one device's last position is annoying, not data loss.

**Strategy:** plain PUT with `conflictBehavior=replace`. No If-Match. Newest
write wins. Polling pull on focus to detect drift.

**Cost:** ~20 lines. Trade-off: if Alice scrolls on PC and Quest, last
device's position overwrites — user briefly resumes from the wrong spot,
scrolls once, resyncs. Acceptable for ephemeral state.

The pattern also fits RIME user dictionaries in webxiaoheiwu — IME just
relearns frequencies on overwrite.

### Pattern C — Read-only asset library (one-way pull)

**Example:** a public glb gallery. App lists OneDrive folder, downloads on
request, never writes back.
**Editor:** outside the app entirely (artist exports from Blender,
uploads to OneDrive via OneDrive's own UI).

**Strategy:** `listAppFolderGlbs()` periodically. `If-None-Match: <etag>`
conditional fetch for change detection. No upload paths.

**Cost:** ~30 lines. Cleanest of all. Works for any artist-first content
pipeline.

## Where RealHome lives

**RealHome is C-with-an-optional-B-on-top.**

The substantive content (the .glb worlds) is *produced outside the app* —
nobody edits a glb in-place inside RealHome. The actual "editor" is
Blender. So the primary path is one-way pull: artist exports → drops in
OneDrive → all devices pick up the new version.

The optional B layer is the in-app upload path (file picker / drag-drop).
When the user drags a fresh glb in, we (now) auto-upload it to the AppFolder
so the rest of their devices see it. This is just a courtesy: it saves
them switching tabs to OneDrive Web.

The Pattern A "sibling-on-conflict" machinery does NOT apply here:

- Concurrent edits don't exist. The user isn't typing into a glb across
  two devices.
- Merging two glbs is nonsense — there's no semantic "union" of two 3D
  models.
- "Losing a version" means the user has to re-drag the file from the
  filesystem they exported it to. Recoverable.

So the conflict resolution for RealHome is **last-write-wins**:

- User drags a file with a name that already exists in OneDrive →
  `confirm("overwrite?")` → if yes, `conflictBehavior=replace`, OneDrive
  keeps the same itemId, content + eTag update.
- Background pull: if remote eTag differs from local, the new bytes win
  unconditionally. No merge step.

The only nuance is the `confirm()` UX — see open question #3 below.

## Specifics that DON'T translate from webxiaoheiwu

When porting patterns over, these intentionally don't carry:

- **412 sibling creation:** not needed. Plain LWW with `replace`.
- **ETag preflight on push:** still useful for "did anything change?" but
  not for blocking writes. We pre-check filename existence (via
  `getAppFolderItemByName`) before upload to ask the user, then PUT.
- **`If-None-Match` on background pull:** kept. Avoids re-downloading
  large glbs when nothing changed. Drives the world-update toast.
- **Trash folder:** not adopted (yet — see open question #2). webxiaoheiwu
  uses `.trash/` so a deletion on one device is sync'd, not silently
  re-uploaded by a stale device. For RealHome, this might be overkill;
  see below.
- **Last-active doc pointer:** not relevant. RealHome's "menu-first" boot
  means we never auto-load a world; the user always picks.
- **Encrypted variant:** out of scope. Worlds are not sensitive.

## "Long offline then come back" — RealHome scenarios

Walking through the failure modes the user worried about:

### S1. Quest offline, user drags new local file
- `loadFile` → optimize → `maybeUploadToOneDrive` sees no network /
  not-signed-in / Graph 5xx → returns null → IDB record saved with
  `source: "local"`, no `remoteId`.
- File works on Quest. Not visible from PC.
- **No conflict.** Once online, the user can re-drag from the picker
  while signed in, and the upload retries (going through the standard
  confirm-overwrite path if PC has a same-named file in the meantime).

### S2. PC user uploaded v2 to OneDrive while Quest had v1 cached
- Quest cached `world.glb` last week (`source: "onedrive"`, `etag: E1`,
  IDB blob is v1).
- PC artist exports `world.glb` v2 and uploads via OneDrive Web → eTag E2.
- Quest opens menu → `checkRemoteUpdates()` runs in background:
  - For the cached world: provider.fetch with `If-None-Match: E1` →
    OneDrive serves the v2 bytes → optimizer → replace IDB blob.
  - Toast: "world.glb was updated upstream."
- Quest user re-enters world → sees v2.
- **No conflict.** Plain LWW pull.

### S3. Both PC and Quest upload "same-name" while offline
- This is the actual conflict-shaped case.
- PC offline, drag-drop `house.glb` from filesystem → IDB local (no
  remoteId). PC comes online, drag-drops again → upload → OneDrive has
  `house.glb` from PC.
- Meanwhile Quest, also offline, drag-dropped a DIFFERENT `house.glb` from
  the Quest's local filesystem → IDB local (no remoteId). Quest comes
  online, drag-drops again → confirm("`house.glb` already exists in
  OneDrive. Overwrite?") → user picks.
- **Last write wins, with explicit user confirmation.** This is the only
  case the confirm() dialog handles.

### S4. User deletes a cached OneDrive world locally
- Currently: `deleteWorld(id)` removes from IDB, the OneDrive copy stays.
- Background sync re-discovers it on next ↻ → reappears as uncached.
- Annoying if the user wanted it gone for real. See open question #2.

## File layout — proposed

Right now everything lives flat under `Apps/RealHome/`. We may want:

```
Apps/RealHome/
  *.glb              ← worlds (current)
  .trash/            ← TBD per open question #2
  .userdata/
    settings.json    ← future: seated_bump pref, etc, per device
```

webxiaoheiwu's `.userdata/last-active.json` and
`.userdata/rime-user-dir.json` are the precedent for a hidden settings
folder under the AppFolder.

## Resolved decisions

These were the open questions; the user picked:

### Q1. Drag-drop = auto-upload (no opt-in)

When signed in, every drag-drop attempts an upload to AppFolder.
`maybeUploadToOneDrive()` is the implementation in
[src/app.js](../src/app.js). Fall-through: if not signed-in / offline /
upload fails, save as `source: "local"` and the local file still works.

### Q2. × button on a cached OneDrive world = two buttons

Cached OneDrive worlds render with two action buttons in the menu:

| Button | Action | Blast radius |
|---|---|---|
| **×**  | Remove from local cache only | Recoverable — reappears in list as available, re-cache anytime |
| **🗑** | Delete from OneDrive AND local cache | Permanent across devices |

Implementation: `handleDelete(id)` (existing) for cache-only, new
`handleDeleteRemote(id)` calls `deleteAppFolderItem(remoteId)` then
deletes the IDB record.

Other devices that have the same world cached locally are NOT affected at
delete time. Their next background sync sees the file missing from
OneDrive — they'll continue to show it as cached (entry stays valid; they
can manually × to clean up). We don't auto-purge IDB records on
remote-missing, because the user might be temporarily offline / the
remote-list might be a transient failure.

### Q3. Upload name conflict = confirm dialog (current behavior)

`confirm("'world.glb' already exists in your OneDrive RealHome folder.
Overwrite?")`. Cancel = save as local-only on this device, no upload.

### Q4. No `.trash/` subfolder — hard delete

Glbs are produced outside the app (Blender), source-of-truth lives in the
artist's filesystem. Soft-delete + cross-device tombstone propagation is
overkill for content the user can re-export anyway.

## Still open

### Q5. Should we sync per-world metadata (seated_bump, custom name)?

If a user renames a world via the menu (not yet implemented), or sets a
per-world seated_bump, should that live on OneDrive too?

`.userdata/world-meta.json` keyed by remoteId, last-write-wins. Trivial
to add but not free — boot path grows one more Graph call.

Deferred: revisit when we actually add per-world settings.

## Files

- [src/onedriveAuth.js](../src/onedriveAuth.js) — MSAL wrapper
- [src/onedriveGraph.js](../src/onedriveGraph.js) — list / fetch / upload /
  getItemByName helpers
- [src/providers.js](../src/providers.js) — OneDrive provider
- [src/app.js](../src/app.js) — `loadFile` / `cacheWorld` /
  `checkRemoteUpdates` / `maybeUploadToOneDrive`
- [docs/msal-onedrive-patterns.md](msal-onedrive-patterns.md) — auth
  layer patterns
- [docs/onedrive-setup.md](onedrive-setup.md) — Azure registration
