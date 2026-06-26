# World naming convention

> as-of v? / 2026-06-26 — implemented in `src/worldConvention.js`, consumed by `src/worldLoader.js`.

How a `.glb` author (in Blender) tells RealHome which meshes are colliders, which
are invisible, and which belong to the distant backdrop. All of it is driven by
**object names and material names** — no custom glTF extensions, no sidecar.

`src/worldConvention.js` is the single source of truth: one traverse over the
loaded scene, applied in place. Nothing else in the app knows the tokens.

## The core idea: collision and visibility are orthogonal

The old convention bound two things to one tag: a mesh named `collider` both
joined the collision set **and** was hidden (`visible = false`). That made it
impossible to use one mesh for both render and collision — exactly the common
case (a wall you both see and bump into).

So the two concerns are split across **two different naming surfaces**:

| Axis | Driven by | Token | Effect |
|---|---|---|---|
| **Collision** | **Object** name (or parent's) | suffix `_col` / `_collider` | mesh joins the collision BVH; visibility untouched |
| **Nodraw** | **Material** name | `col` / `collider` | that material draws nothing (collision-proxy material) |

Because they ride different surfaces, one mesh freely combines them:

| Object name | Material name | Renders | Collides | Use |
|---|---|---|---|---|
| `wall` | (normal) | ✓ | ✗ | decoration |
| `wall_col` | (normal) | ✓ | ✓ | **same mesh, both** ← the point |
| `proxy_col` | `col` | ✗ | ✓ | invisible low-poly collision proxy (old behaviour) |
| `wall` | `col` | ✗ | ✗ | hidden face |

## Token rules

- **Case-insensitive.** `COL`, `Col`, `_Collider` all match.
- `col` / `collider` must be the **whole name or the trailing segment** after a
  `_ - . ` or space separator. So:
  - match: `col`, `wall_col`, `pillar.collider`, `Floor-COL`
  - no match: `protocol`, `column`, `collider_wall` (token not at the end)
- This is **tighter than the old rule** (which matched the word anywhere). If you
  have legacy worlds tagged in the middle (`collider_foo`), rename to a suffix.
- `col` is the shorthand; `collider` the long form. Both are accepted everywhere.

### Object name vs material name

Collision keys on the **object** name and its **parent** name (so naming a whole
Empty subtree `..._col` tags everything under it). Nodraw keys on the
**material** name only.

### Multi-material meshes (careful case)

A glTF mesh can carry several materials (one per geometry group). Nodraw handles
the mix deliberately:

- **Every** material is a proxy (`col`) → the whole mesh draw is skipped
  (`mesh.visible = false`, cheapest).
- **Mixed** (some `col`, some real) → hiding the mesh would drop the visible
  groups, so only the proxy material groups are neutralised
  (`colorWrite = false; depthWrite = false`) and a `console.warn` is emitted.
  This mutates the material — **don't share a `col` material with a mesh you want
  visible elsewhere.**

## Far layer (`skybox`)

An object or material whose name contains `skybox` (word-boundary, e.g.
`skybox`, `_skybox`, `skybox.001`) is the **distant backdrop**. The token is kept
as `skybox` for familiarity and backward compatibility, but semantically it's the
**far layer**: a sky dome *and* far parallax scenery (distant mountains, etc.).

### Implementation — separate far-frustum pass (flat mode)

`worldConvention.applySkyboxTweaks` puts far-layer meshes on **layer 0 +
`FAR_LAYER`** (`layers.enable`, see the eye-layer trap below), `frustumCulled =
false`, `fog = false`. Depth is kept **ON** (no `depthTest` hack) so multiple far
parallax meshes sort against each other. The flat render loop (`app.js` →
`renderLayered`) then draws two passes that share the view matrix but use
different projection clip planes, with a depth clear between:

| Pass | NEAR | FAR | Notes |
|---|---|---|---|
| **Far layer** (`camera.layers.set(FAR_LAYER)`, drawn first) | **1 m** (`SKY_NEAR`) | **100 000 m** (`SKY_FAR`) | only far meshes (main lacks the FAR_LAYER bit); `autoClear` clears color+depth |
| `renderer.clearDepth()` | | | clear depth only, keep the far-layer color |
| **Main scene** (`camera.layers.set(0)`, far meshes `visible=false`, drawn over) | **0.05 m** (`NEAR`) | **1000 m** (`FAR`) | far meshes are hidden here so they aren't redrawn (and clipped) in the small frustum; restored after |

This is a **partition, not a duplication** — each mesh is rendered once. Marginal
cost: one depth clear + one draw submit + skybox overdraw (already paid before).
Cheap even on mobile (tilers clear ~free). It is *not* the expensive "render the
whole scene twice" of reflections/shadows.

Far meshes keep their **world transform** — distance from the camera still varies
as the player walks, so **parallax is preserved** (they are never camera-locked).
Because the far pass uses `SKY_FAR = 100 km`, large parallax backdrops are no
longer clipped (the old single-pass `depthTest = false` did **not** prevent
clip-space far-plane clipping — that happens before the fragment depth test, so a
mesh past `FAR` was clipped into a hole).

### The WebXR eye-layer trap (why far meshes are on layer 0 + FAR_LAYER)

three.js renders XR stereo with an `ArrayCamera` of two eye sub-cameras and uses
**layer 1 = left eye, layer 2 = right eye** as eye markers. `WebXRManager` splits
the masks: `cameraL = cameraXR & 0b011`, `cameraR = cameraXR & 0b101`. So **layer
0 is the only layer both eyes see**; a mesh on layer 1 or 2 renders in one eye
only, and any layer ≥ 3 is stripped from *both* eyes.

The first cut put the far layer on layer 1 → **the skybox showed in the left eye
only.** Fix: far meshes carry **both** layer 0 (so both XR eyes render them) and
`FAR_LAYER = 3` (so flat mode can still isolate them by setting the camera to that
layer). `applySkyboxTweaks` uses `layers.enable(FAR_LAYER)`, not `.set`.

### XR is a single pass

Because the WebXR runtime owns the projection (`depthNear`/`depthFar` come from
the session), a wider far frustum is impossible in XR — the two-pass would buy
nothing. So XR draws **one** normal pass (`camera.layers.set(0)`), and the far
layer just depth-sorts behind. Consequences:

- Far geometry is bounded by the **session FAR** — keep XR skyboxes within it.
- No `clearDepth` in XR, so the per-eye scissor question never arises. (`clearDepth`
  runs only in flat, single-viewport, where it's safe.)
- Still **needs on-device verification** that both eyes render correctly.

**Why these numbers:**

- Main `0.05 / 1000`: unchanged. 0.05 m lets VR hands/controllers come close;
  1 km easily covers a building/room.
- Far `NEAR2 = 1 m`: a compromise. Pushed **small** for backward compatibility —
  legacy skyboxes may be authored at only a few metres' radius, and `1 m` keeps
  any dome of radius ≳ 2 m safe. Pushed **large** for depth precision when stacking
  parallax layers. If you only use large multi-layer parallax and see z-fighting,
  raise `NEAR2` (no small-skybox concern in that case).
- Far `FAR2 = 100 km`: holds any horizon dome.

**Hard contract:** the far pass draws first, then `clearDepth`, then the main
scene draws unconditionally on top. Therefore **all far-layer geometry must be
genuinely farther than all main-scene geometry** (i.e. beyond `FAR = 1000 m`).
If you put a far mountain at 800 m and a near wall at 900 m, the wall (drawn
later) wrongly occludes the closer mountain. Skyboxes satisfy this naturally.

**Why depth is ON now:** the far layer keeps `depthTest`/`depthWrite` so its own
meshes sort correctly. It can't be occluded by the main scene because the depth
buffer is cleared between the two passes (far drawn first, then main over a fresh
depth buffer).

## Spawn (`spawn`)

An Object3D (any type — Empty is fine) named `spawn` / `_spawn` / `spawn.001`
sets the player's reset target: its world-space position + Y rotation. Pitch/roll
are dropped (the player stands upright). No marker → fall back to origin.
