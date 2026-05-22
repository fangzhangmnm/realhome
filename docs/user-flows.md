# User flows

The complete state model for what RealHome looks like to the user. Lives
between the rendering plumbing (`docs/ui-layers.md`), the sync semantics
(`docs/sync-strategies.md`), and the VR locomotion (`docs/vr-locomotion.md`).

## States

Just two top-level states, plus a transient overlay and a sub-state.

```
              ┌──────────────────────────────────┐
              │              Menu                │
              │  - browse worlds (grid of cards) │
              │  - + Add / ↻ / hamburger         │
              │  - drag-drop a .glb              │
              │  - error log visible             │
              │                                  │
              │     ┌────────────────────┐       │
              │     │  Drawer (sub-state)│       │
              │     │  - OneDrive sign   │       │
              │     │  - Clean cache     │       │
              │     │  - (future) settings│      │
              │     └────────────────────┘       │
              └──────────────────────────────────┘
                              │
                  click card / drop file
                              ▼
              ┌──────────────────────────────────┐
              │           InWorld                │
              │  - the 3D world fills the view   │
              │  - WASD / mouse-look (flat)      │
              │  - controllers + HMD (VR)        │
              │  - jump, snap-turn, collision    │
              └──────────────────────────────────┘

       Loading overlay can appear in either state during transitions.
```

## Per-mode mapping

The same state machine, different input + output devices.

### Flat (desktop browser, no XR hardware)

| State | UI looks like | Inputs |
|---|---|---|
| **Menu** | HTML overlay over the (black) canvas. Top bar + grid + hints. | Mouse + keyboard. Click card / button. Esc closes drawer if open. |
| **Drawer** | Right-side slide-in over the Menu. | Click ☰ to open, ✕ or click backdrop to close. |
| **InWorld** | Canvas with the 3D world. Pointer locked to the canvas. HUD top-left. | WASD, mouse-look, Space jump, gamepad (if present). |

Transitions:
- Menu → InWorld: click a world card. World loads (loading overlay), pointer locks, menu hides.
- InWorld → Menu: Esc (browser unlocks pointer), menu reappears.

### Quest VR

| State | UI looks like | Inputs |
|---|---|---|
| **Menu** | Same HTML overlay, but in Quest's 2D browser panel (headset off, or before tapping a card). | Touch the panel or use Quest's pointer. Click cards/buttons. |
| **Drawer** | Same slide-in inside the 2D browser panel. | Tap ☰ / ✕. |
| **InWorld** | Immersive-VR session. Headset shows stereo render. Quest's docked browser panel shows "running in background" placeholder. | Right thumbstick → walk + snap-turn. Trigger / face button → jump. |

Transitions:
- Menu → InWorld: tap a world card → enter VR session (gesture-driven). World loads in-session (loading panel parented to camera is visible).
- InWorld → Menu: Meta button → quit XR session. Quest returns to 2D browser panel where the menu was.

**Limitation:** the menu is NOT visible during an immersive-vr session.
To switch worlds, change settings, or sign in to OneDrive, the user must
exit VR via the Meta button, do the action in the 2D menu, then tap a
card to re-enter VR. See "Why no in-VR menu" below.

## Transitions in detail

## Artist-side conventions

What artists put in their glbs that the app reads:

- **Skybox mesh** — name contains `skybox` (e.g. `skybox`, `_skybox`,
  `skybox.001`). Rendered first, depth-disabled, no fog.
- **Collider meshes** — name contains `collider`. Invisible but their
  geometry feeds the BVH. Wall + floor collision.
- **Spawn point** — `Empty` named `spawn` or `_spawn` placed in the
  scene. Player resets to this world-space position + Y rotation on
  world load and on respawn. Without one, player lands at origin.
- **Sidecar thumbnail** — a PNG next to the glb with the same basename
  (`house.glb` ↔ `house.png`). For bundled worlds, served from
  `./worlds/`. For OneDrive, dropped in the AppFolder. Auto-discovered
  and shown on the world's card. Optional — gradient placeholder if
  missing.

### Enter a cached world (most common case)

1. User in Menu. Cards painted from IDB, including thumbnails.
2. User clicks/taps a card.
3. `showLoading("Loading", worldName, -1)` — DOM progress bar at top.
4. Parse the IDB blob via GLTFLoader. Build collision BVH. `setWorld()` does
   an atomic swap in the scene (old world's geometry replaced by new in
   a single frame).
5. `player.reset()` — gameplay state recentered.
6. **Check the user-gesture window** — Chrome's transient activation
   lasts ~5s after the click. We use a 4s safety margin.
   - **Within window:** `enterImmersive()` fires — pointer lock (flat) /
     `requestSession` (VR). Menu hides, world is visible.
   - **Beyond window:** show the enter prompt — full-screen "Tap to enter"
     overlay. User clicks → fresh gesture → `enterImmersive()`.
7. `hideLoading()`. World is visible.

The previous world's geometry is in the scene during step 4 but invisible
because the menu DOM covers the canvas — no flash. After `setWorld()`
swaps in the new world, the menu is still on top until step 6 fires
pointer-lock / VR session.

### Enter an uncached (provider-available) world

1. As above through step 2.
2. `showLoading("Downloading", worldName, 0)` with progress callback.
3. Provider's `fetch(remoteId)` streams bytes. Each chunk updates the progress.
4. After download, parse + `setWorld()` swap (NOT written to IDB; this is
   "stream-and-play").
5. **User-gesture check** — same as cached case. Slow downloads ALMOST
   certainly exceed the 4s window, so the enter prompt is the expected
   path here.
6. `hideLoading()`. World visible after user confirms.

### Cache an uncached world without entering (↓ button)

1. User clicks ↓ on a card.
2. `cacheWorld(source, remoteId, name)` — download (top progress bar) + write to IDB.
3. List re-renders. Card now shows as cached with size + last-visited time.
4. User stays in Menu. No transition into InWorld.

### Add a local file (drag-drop or Add button)

1. User drops a .glb on the window, or clicks Add and picks a file.
2. **Save path:** `loadFile()` saves the bytes to IDB as `source: "local"`.
3. **If OneDrive signed in:** `maybeUploadToOneDrive` runs. If filename
   collides in AppFolder, `confirm("overwrite?")` — cancel = save as
   local-only, OK = upload with `conflictBehavior=replace`. On upload
   success the IDB record becomes `source: "onedrive"` instead.
4. The world also parses + installs immediately (entering it).
5. New card appears in the grid for next time.

### Delete a world (× or 🗑)

- **× on a `local` world:** confirms then permanently deletes the IDB record.
- **× on `bundled` / `onedrive` world:** confirms then removes the cache.
  Background sync will re-discover it as "available" next time the menu opens.
- **🗑 on a cached `onedrive` world:** scarier confirm. Calls
  `deleteAppFolderItem(remoteId)` then deletes the local IDB record.
  Permanent across all devices.

### OneDrive sign-in

1. User opens drawer, clicks "Sign in with Microsoft."
2. `loginRedirect` — full page navigates to login.microsoftonline.com.
3. User authenticates / consents.
4. Microsoft redirects back to our origin with an auth code.
5. MSAL drains the redirect on next boot via `handleRedirectPromise`.
6. Drawer's status flips to "Signed in: alice@…", OneDrive worlds appear in the grid.

The redirect costs us in-page state (selection, scroll, drawer state) —
but the menu rebuilds entirely from IDB + providers, so there's nothing
meaningful to lose. Background sign-in flows ("silent SSO") are dropped
on purpose, see `docs/msal-onedrive-patterns.md` pattern 5.

## Why no in-VR menu (decision log)

Tried Quest Browser's WebXR `dom-overlay` feature on 2026-05-22 — the
overlay didn't render in immersive-vr (the optional feature didn't seem
to be granted, or was granted but invisible). dom-overlay is primarily
specced for handheld AR and Quest doesn't seem to support it for
immersive-vr in current builds.

Other approaches considered and rejected:
- **Native three.js panels** (3D cards built from primitives) — would
  reinvent a UI toolkit. Two SSoTs (HTML menu + 3D menu) to maintain.
- **HTMLMesh** (rasterize the DOM onto a 3D plane via canvas) — keeps
  SSoT but floats free of the docking panel, would feel like a "second
  HUD" alongside Quest's already-present "running in background" panel.

So the decision: accept that in VR, the menu requires exiting the
session via Meta button. The penalty is one extra ceremony per world-
switch. Once we have the 3D loading panel covering the transition (which
we do), the immersive-mode UX feels intentional.

If Quest browser ever ships proper dom-overlay support for
immersive-vr, the path back is: re-add the `dom-overlay` optionalFeature
to enterVR (was removed on 2026-05-22), test, ship. The
`showLoading`/`hideLoading` dispatcher already has the `xrDomOverlayGranted`
branch; just flip it back on.

## What lives in the menu vs in-world

| Action | Where |
|---|---|
| Browse worlds, see thumbnails | Menu only |
| Click a world card to enter | Menu only |
| Drag-drop a .glb to add | Menu only (drop overlay) |
| Cache an uncached world (↓) | Menu only |
| Delete a world (× / 🗑) | Menu only |
| OneDrive sign-in / sign-out | Drawer only |
| Clean cache (wipe IDB) | Drawer only |
| Refresh provider lists (↻) | Menu top bar |
| Walk, jump, look around | InWorld |
| Snap-turn, vignette feedback | InWorld VR only |
| Pointer-lock, ESC to menu | InWorld flat only |
| See HUD (current world name + status) | InWorld flat (top-left); not visible in VR |
| Loading indicator | Either state, during transitions |

## Failure modes the user sees

- **OneDrive list fails (offline, token expired, etc.)**: red error log entry
  in the menu. Cached worlds still load from IDB. Bundled / local worlds
  unaffected.
- **Stream/download fails**: red error log. User stays in menu.
- **Parse fails (corrupt glb)**: red error log. Previous world stays loaded.
- **PWA shell update available**: bottom toast with Reload button. User clicks
  when they're between worlds.
- **Cached world's source bytes changed upstream**: top toast notifies.
  "Re-enter to see the new version" if it's the currently-rendered world.
- **Module load fails on first boot**: inline red banner from the catcher
  in index.html — shows the actual error so it's not a blank page.

## Future flows (not implemented)

- **In-VR pickup of a world** — blocked on no-in-VR-menu decision.
- **Locomotion settings** — would live in Drawer (snap angle, seated bump,
  vignette intensity). Reachable only from Menu, which is fine.
- **Per-world rename + custom thumbnail** — would need text input UX,
  drawer-level form.
- **Cancel loading** — would need an AbortController plumbed through
  provider.fetch. UX: a cancel button on the loading panel (visible in
  both flat DOM #progressBar and the 3D loadingPanel).
- **Multi-room synced world** — way past v1; would need a WebRTC layer.

## Files

- [src/app.js](../src/app.js) — event wiring, state transitions
- [src/loadingPanel.js](../src/loadingPanel.js) — 3D loading indicator
- [src/styles.css](../src/styles.css) — Menu / Drawer / Loading visuals
- [index.html](../index.html) — DOM layout
- [docs/ui-layers.md](ui-layers.md) — rendering-mode details (flat vs VR plumbing)
- [docs/sync-strategies.md](sync-strategies.md) — OneDrive sync rules
- [docs/vr-locomotion.md](vr-locomotion.md) — 3-layer VR rig
