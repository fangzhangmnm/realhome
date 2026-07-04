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

### Implementation — an ordinary mesh in the single render pass

> as-of 20260704: the old flat-only **two-pass / `FAR_LAYER`** scheme was removed.
> PC and XR now share **one** render pass, so they render identically. That split
> was load-bearing only in flat (it silently didn't apply in VR), which both hid a
> "PC black / VR fine" skybox bug and was a standing source of drift. Rationale +
> the platform constraints that make a VR two-pass impossible: see **ADR-0001**
> (`docs/adr/0001-single-pass-render-no-vr-two-pass.md`) and the source analysis in
> `docs/reports/20260704-architecture-drift-audit.md`.

`worldConvention.applySkyboxTweaks` no longer touches layers — the skybox stays on
the default **layer 0** and renders in the one shared pass (`app.js` render loop:
`renderer.render(scene, camera)`), depth-sorted against everything else. What the
tweak still does:

- `frustumCulled = false` — so the dome isn't culled when the camera sits inside it.
- `fog = false` — so the backdrop isn't tinted.
- world transform preserved — distance from the camera still varies as the player
  walks, so **parallax is preserved** (never camera-locked).

**Clipping ceiling (both modes):** everything must fit inside the single frustum
`NEAR = 0.15 m … FAR = 4000 m` (`config.js`). Backdrops beyond `FAR` clip — in flat
AND XR alike. XR always had this ceiling (the WebXR session clips at `camera.far`);
flat now matches it instead of using a wider far-only pass. So: **author skybox
domes / distant scenery within ~4 km.**

**Want vistas beyond `FAR`?** Raise `FAR` and enable
`new THREE.WebGLRenderer({ logarithmicDepthBuffer: true })` — it redistributes depth
precision so `NEAR = 0.15 / FAR = 100 km` works in one pass without z-fighting. But
it writes `gl_FragDepth` per fragment (three.js `logdepthbuf` chunk), which disables
early-Z and can cost fill-rate on Quest's tiler. It's a deliberate, revertible
follow-up (tracked as "A2"), **not** the baseline — measure on-device before shipping.

**Why not keep a separate far pass (the escalation).** A wider far-only pass can't
work in XR *at all*: three.js masks custom layers out of the per-eye cameras
(`WebXRManager`: `cameraL = cameraXR & 0b011`, `cameraR = cameraXR & 0b101` — bit 3,
i.e. any `FAR_LAYER ≥ 3`, is stripped from **both** eyes), and the WebXR session
owns the projection so the frustum can't be widened mid-frame. A flat-only far pass
therefore meant two divergent render paths for zero XR benefit. Single-pass is the
honest unification; the depth-precision job that the far pass used to do is handed
to `logarithmicDepthBuffer` if and when big vistas are actually needed.

## Spawn (`spawn`)

An Object3D (any type — Empty is fine) named `spawn` / `_spawn` / `spawn.001`
sets the player's reset target: its world-space position + Y rotation. Pitch/roll
are dropped (the player stands upright). No marker → fall back to origin.
