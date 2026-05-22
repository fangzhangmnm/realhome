# UI layers — flat (Windows overlay) vs Quest VR

The same app runs in two very different rendering modes. They DO NOT share
a UI layer the way most web apps do. Anything in the DOM is invisible
during an immersive XR session; anything in the 3D scene is what the user
sees in VR. This doc names where each piece of UI lives and how the in-XR
panel works.

## Three rendering modes

| Mode | Trigger | What the user sees | Where UI lives |
|---|---|---|---|
| **Menu (flat, pre-lock)** | Page load, ESC from flat | HTML overlay over canvas; canvas is black (no world) or shows last frame | DOM (`#startOverlay` etc.) |
| **In-world (flat, pointer-locked)** | User clicked a card on desktop / non-XR mobile | Canvas renders the 3D world. HUD div + drop-overlay still in DOM | DOM (HUD only) + scene (the world) |
| **In-world (Quest VR)** | User clicked a card on Quest with `immersive-vr` available | XR layer renders the 3D world stereo. The 2D browser panel is "running in background" | **Only** what's in the scene graph |

Key point: **during an XR session, the DOM is not visible to the user.**
Quest shows its own "the immersive web experience is running in the
background" header in the regular 2D browser panel. Below that header is
whatever was rendered LAST to the canvas — usually a stale 2D frame or
black. None of our `#startOverlay` / `#hud` / toasts render in the VR view.

This is intentional WebXR behavior, not a bug. Our app keeps running in
the background tab; three.js's renderer redirects draws to the XR layer
instead of the canvas; the user only sees stereo through the headset.

## What that means for the menu

Anything we want the VR user to see while in-XR MUST live in the 3D
scene. Three pieces apply:

1. **Loading indicator** ([src/loadingPanel.js](../src/loadingPanel.js))
   — a 9999-renderOrder textured plane parented to the camera. Visible in
   flat AND VR. Painted via Canvas2D into a CanvasTexture, animated dots
   + progress bar. Drawn over any world geometry near the camera; the
   skybox still paints under it.

2. **Vignette** ([src/vignette.js](../src/vignette.js)) — same idea, a
   shader-painted ring attached to the camera. Always in the scene, just
   modulated by `vignette.update(amount, dt)`.

3. **HUD text** — currently DOM only. Becomes invisible the moment XR
   starts. Should migrate to a textured plane if we want it in VR.

## The Quest "running in background" panel — what it shows

When you enter immersive-vr on Quest, the regular 2D browser panel does
NOT close. It shows:

```
┌─────────────────────────────────────┐
│ The immersive web experience is still
│ running in the background.
│   [Resume]    [Quit]
│                                      RealHome
│   RealHomeDefaultWorldv1.glb        ←  Quest browser's tab/page title
│                                          (it grabs document.title)
└─────────────────────────────────────┘
                                       ↑
                                       Below this: blank/black, OR a frozen
                                       2D frame the canvas had before XR started
```

The world-name text in that panel is the page title — `document.title` or
the inferred tab title. If we want it informative, we should update
`document.title` when a world loads. Currently `<title>RealHome</title>`
is static, so it probably looks weird that the .glb filename appears
there — Quest may be reading the canvas accessibility tree or the
current world name from somewhere.

**TODO (small):** set `document.title = "RealHome — " + world.name` in
installWorld so the Quest panel header reads cleanly.

## Goal: full in-VR menu

The current state: when the user exits XR (sessionend), they pop back to
the 2D DOM menu. To pick another world they have to physically remove
the headset / look at the screen.

The desired state (from user spec): inside VR, the user can:
- See and browse the worlds list
- Tap (controller-raycast) a card to enter that world
- Open a settings panel (snap-turn angle, seated bump, etc.)
- Watch a loading bar while a world streams from OneDrive

This requires moving the menu into the 3D scene. Three approaches:

### Approach A — WebXR DOM Overlay

Request `dom-overlay` as an optionalFeature; pass `#startOverlay` as the
overlay root. Browser composites our actual HTML over the XR scene.

Pros: zero code change to the menu — same HTML, same CSS.
Cons: DOM Overlay was designed for handheld AR. Quest browser's
support is patchy — typically renders as a fixed 2D plane locked to the
user's head, which is jarring. Single overlay root only (drawer becomes
awkward).

Verdict: probably won't ship the experience we want on Quest.

### Approach B — three.js HTMLMesh (rasterize DOM → texture)

Use `three/addons/interactive/HTMLMesh.js` (we'd vendor it). Takes a DOM
element, rasterizes it to a canvas via html2canvas-style serialization,
and maps the canvas onto a 3D Mesh. Pair with `InteractiveGroup` for
controller-raycasted click events that re-dispatch to the DOM element.

Pros: reuses existing HTML/CSS; interactive via standard click events;
both flat and VR works.
Cons: rasterizes via foreignObject + canvas, which has subtle font /
backdrop-filter / `<img>` rendering bugs across browsers. Quality is
"OK at 1024-1536px" — anything thinner (the current 13px world-meta
text) gets blurry. Re-rasterization on every change is expensive — we'd
need to throttle or only update on visible state changes.
Plus: we have to vendor the addons + a html2canvas implementation.

Verdict: viable, but quality compromise is real.

### Approach C — native three.js panels (sprite atlas + canvas textures)

Build the menu from primitives: a card is a 3D plane with a CanvasTexture
showing the thumbnail + name; the grid is positioned planes; clicks come
from controller raycast + onClick handlers on each card. Loading panel
already follows this pattern.

Pros: pixel-perfect quality; can stylize with depth, lighting, animation
that pure HTML can't; controller interaction feels native.
Cons: every visual change requires duplicating effort in both DOM (flat
menu) and 3D (VR menu). Significant code.

Verdict: the right call for a polished VR experience, but biggest
investment.

### Hybrid recommendation

For RealHome where the menu is small (cards + settings + sign-in):

1. **Now** — Approach C for the worlds-list (already have thumbnails as
   CanvasTexture material). Each card = a 3D plane in a grid layout.
2. **Now** — Approach C for the settings drawer (locomotion sliders +
   sign-in button + clean cache).
3. **Later** — keep the DOM menu for flat-mode-only or as a fallback.
4. **Later** — controller raycasting for interaction. Pointing ray
   visible from each controller; trigger = click.

Estimated scope: ~3–5 days of focused work. Cards as 3D objects fit our
existing thumbnail pipeline cleanly.

## Implementation order (proposed)

1. Controller pointer ray + raycaster (visible laser from each
   controller; intersects scene objects in a designated "ui" layer).
2. 3D card grid built as a function of `listWorlds()` + provider lists,
   parented to a `playerRig`-anchored anchor in front of the user.
3. 3D button primitive (plane + canvas-rendered text + hover/active
   states). Used for the action buttons and the sign-in.
4. 3D settings panel — slider primitive for snap-turn angle / seated
   bump / vignette intensity.
5. Show the 3D menu when: not in a world, or when user presses menu
   button on the controller mid-world.

Until that's built: VR users see the loading panel (already in scene),
but for menu interactions they must exit XR.

## Loading indicator — current state

In-scene, always visible regardless of mode. Driven by `loadingPanel.show
/ update / hide` from app.js around `switchToWorld` and `streamOpenWorld`.
Animated even while XR — the requestAnimationFrame ticks at headset frame
rate during a session.

The user can cancel uncached downloads. **Not yet implemented**: would
require:
- AbortController plumbed through `provider.fetch` → `graphFetch` →
  underlying `fetch()`
- "Cancel" button on the loading panel (3D button per Approach C — TBD)
- Wiring abort signal cleanup paths in streamOpenWorld / cacheWorld

Acceptable to defer until controller raycasting is in.

## Files

- [src/loadingPanel.js](../src/loadingPanel.js) — the in-scene loading
  panel (mode-agnostic)
- [src/vignette.js](../src/vignette.js) — the in-scene vignette (mode-
  agnostic)
- [src/app.js](../src/app.js) — DOM event wiring, mostly relevant in
  flat mode
- [docs/vr-locomotion.md](vr-locomotion.md) — 3-layer rig model the
  in-VR menu will need to align with
