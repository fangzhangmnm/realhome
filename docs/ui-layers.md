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

## In-VR menu: decided to defer

We tried `dom-overlay` on Quest browser (2026-05-22) and it didn't render
in immersive-vr. The user-facing flow is now documented as
"exit VR → use menu → re-enter VR" — see [docs/user-flows.md](user-flows.md).

The three approaches we considered before deferring (HTMLMesh, native
three.js panels, dom-overlay) are described there in the "Why no in-VR
menu" decision log. If Quest browser ships proper dom-overlay support
later, re-add the optionalFeature in `enterVR` and the
`xrDomOverlayGranted` branch in showLoading; the rest of the wiring
(body class, CSS hooks) is already prepared.

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
