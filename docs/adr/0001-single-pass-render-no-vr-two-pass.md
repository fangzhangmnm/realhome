# ADR-0001: One render pass for both flat and VR — no VR far-layer two-pass

> created 20260704
> Status: Accepted

## Context

RealHome renders each frame for two targets: flat desktop and immersive WebXR.
Distant backdrops (skybox domes, far parallax scenery) can sit far beyond normal
room geometry, so a single perspective frustum with a modest `FAR` clips them.

An earlier design (the `FAR_LAYER` scheme, 2026-06) solved this in **flat mode**
with a **two-pass render**: pass 1 drew only the far-layer meshes in a very wide
frustum (`SKY_NEAR=1m … SKY_FAR=100km`), then `clearDepth`, then pass 2 drew the
main scene in the normal frustum. VR, meanwhile, ran a **single pass** and just
relied on the skybox being on layer 0.

This fork was the root of two problems:

1. **A real bug.** `FAR_LAYER` classification was load-bearing *only* in flat. A
   skybox mesh not named to match the `skybox` token silently fell to layer 0 and
   was clipped by the flat near-scene `FAR`, showing **black on PC while fine in
   VR**. (See `docs/reports/20260704-architecture-drift-audit.md`.)
2. **Standing drift.** Camera `near/far` had two owners (scene.js constructor +
   the per-frame pass swap), and the WebXR eye-layer invariant was re-narrated in
   three files that had to change in lockstep.

The obvious "fix" — give VR the same two-pass — was investigated and found
**impossible on the platform** (this is the crux this ADR pins):

- **three.js masks custom layers out of the XR eye cameras.** `WebXRManager`
  builds per-eye masks as `cameraL = cameraXR.mask & 0b011` and
  `cameraR = cameraXR.mask & 0b101` (`three.module.js`). Bit 3 — any
  `FAR_LAYER ≥ 3` — is stripped from **both** eyes, so `camera.layers.set(FAR_LAYER)`
  in XR renders nothing. (Layers 1/2 are reserved as the left/right-eye markers,
  which is *why* a far layer must be ≥ 3, which is exactly what gets masked.)
- **The WebXR session owns the projection matrix.** `depthNear`/`depthFar` come
  from the session (`session.updateRenderState`, applied next frame). You cannot
  widen the frustum for a "far pass" mid-frame, so the entire *benefit* of the
  two-pass (a wider far frustum) is unattainable in XR regardless of layers.

A VR "two-pass" could only ever redraw the *same* session frustum twice — the
skybox would be clipped identically to a single pass, just slower. It would be
cargo-cult symmetry, not a functional gain.

## Decision

**Flat and VR render through ONE single pass:** `renderer.render(scene, camera)`
for both modes. There is **no far-layer pass, no `FAR_LAYER`, no per-mode render
fork.** Skyboxes are ordinary meshes on layer 0, depth-sorted with everything
else, so **PC and VR render identically.**

Consequences of "one frustum for everything":

- `NEAR = 0.15`, `FAR = 4000` (`config.js`) — one frustum sized so skybox domes /
  distant scenery fit inside it. `NEAR` is generous on purpose (a walking human
  never puts the camera 5 cm from a wall, and collision keeps the capsule further
  out), which preserves depth precision across `0.15 … 4000` without tricks.
- Camera `near/far` has a **single owner** (the scene.js constructor); the render
  loop never mutates it.
- `worldConvention.applySkyboxTweaks` no longer touches layers — it only keeps
  `frustumCulled = false` (dome not culled when the camera is inside it) and
  `fog = false`.

**Do NOT reintroduce a flat-only far-layer two-pass** to "let VR skyboxes go
farther." It cannot help VR (see Context), and a flat-only pass merely rebuilds
the two divergent render paths and the classification-is-load-bearing-in-one-mode
bug this decision removed.

## Consequences

- **Clipping ceiling is shared and finite.** Anything beyond `FAR` (4 km) clips in
  **both** modes. VR always had this ceiling (the session clips at `camera.far`);
  flat now matches it. Author skybox domes / distant scenery within ~4 km.
- The "PC black / VR fine" class of skybox bug is structurally gone — behaviour is
  symmetric, so a mis-authored skybox is either visible in both or black in both
  (obvious), never silently mode-dependent.
- Simpler, one render path; camera near/far single-owned; the eye-layer platform
  note lives in one place instead of three.

## Escape hatch (if a world genuinely needs vistas > `FAR`)

Raise `FAR` and enable `new THREE.WebGLRenderer({ logarithmicDepthBuffer: true })`.
Log-depth redistributes precision so `NEAR = 0.15 / FAR = 100 km` works in one
pass without z-fighting — in **both** modes, keeping this ADR's single-pass shape.

Cost / caveat (why it is NOT the baseline): log-depth writes `gl_FragDepth`
per-fragment (`three.js logdepthbuf` shader chunk), which disables early-Z and is
specifically costly on Quest's tile-based GPU. It is a **deliberate, revertible**
follow-up (tracked as "A2") that must be fill-rate-verified on-device — a 2-line
change (renderer flag + `FAR`), not a return to the two-pass.

## Alternatives considered

- **VR two-pass to mirror flat** — impossible (Context). This is the whole reason
  for the ADR.
- **Keep flat-only two-pass, VR single-pass** — the status quo that produced the
  bug + drift. Rejected: two render paths, classification load-bearing in only
  one, no VR benefit.
- **Camera-locked skybox** (infinite backdrop, no clipping) — rejected earlier by
  the user: large parallax backdrops must keep their world transform so parallax
  survives as the player walks. A locked dome kills parallax.
- **Log-depth as the baseline** — rejected as default for the Quest fill-rate
  cost; kept as the opt-in escape hatch above.

## References

- `docs/reports/20260704-architecture-drift-audit.md` (§1 escalation, the source
  analysis)
- `docs/20260626-world-naming-convention.md` (§ Far layer — authoring rules,
  updated to single-pass)
- Code: `src/scene.js` (camera + renderer), `src/config.js` (`NEAR`/`FAR`),
  `src/worldConvention.js` (`applySkyboxTweaks`), `src/app.js` (the single-pass
  render loop)
- three.js `WebXRManager` eye-layer masking: `src/vendor/three/build/three.module.js`
  (`cameraL.layers.mask = … & 0b011`, `cameraR … & 0b101`)
