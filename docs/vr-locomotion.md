# VR Locomotion — 3-Layer Model

How RealHome maps player intent + WebXR head-pose tracking to what gets
rendered. Lives in [src/player.js](../src/player.js).

## The three layers

```
┌─ Gameplay state ──────────────── SSoT, this module owns ──────────┐
│   player_pos      Vector3  body position in world                 │
│   player_rot      scalar   Y-axis heading (rad, accumulated snap) │
│   tracking_origin Vector2  VR calibration only (XZ tracking-space)│
└───────────────────────────────────────────────────────────────────┘
                          │ syncRig() per frame
                          ▼
┌─ Rig (three.js Group) ── bridge, we write each frame ─────────────┐
│   rig.position.xz = player_pos.xz − R(player_rot) · tracking_origin│
│   rig.position.y  = player_pos.y + seated_bump                     │
│   rig.rotation.y  = player_rot                                     │
└────────────────────────────────────────────────────────────────────┘
                          │ parent → child
                          ▼
┌─ Camera (three.js PerspectiveCamera) ── XR writes (VR) / we set (flat) ┐
│   camera.position = HMD pose in local-floor reference space (VR)        │
│                   = (0, PLAYER_HEIGHT, 0) one-shot (flat)               │
│   camera.quaternion = HMD orientation (VR) / mouse-look (flat)          │
└─────────────────────────────────────────────────────────────────────────┘

head_world = rig.matrixWorld × camera.localMatrix   (three.js composes)
           = player_pos + R(player_rot) · (camera.position − tracking_origin)
```

Gameplay code only reads / writes the top layer. The middle and bottom
layers are implementation details of how three.js + WebXR render the view.

## Why three layers?

- **WebXR owns `camera.position`.** Each XR frame, the runtime overwrites
  it with the predicted head pose for that frame's display time. We can't
  reliably control camera world position by writing `camera.position`.
- We need a writable transform that composes with the XR pose to position
  the user in the virtual world. That's `rig` (a parent Group).
- The gameplay layer (`player_pos`, `player_rot`) stays mode-agnostic. The
  bridge handles VR's quirks (HMD playspace offset, snap-turn pivot).

This matches Unity's `XR Rig` pattern. Flattening to two layers means
either (a) writing to `camera.position` which XR overwrites, or (b)
mixing VR-specific calibration into gameplay state. Both are worse.

## `tracking_origin` is the VR calibration

In tracking space (the WebXR `local-floor` reference frame), HMD pose is
some vector `hmd_now = camera.position.xz`. We don't control where the
runtime decides the local-floor origin is — it varies per device, per
session, per Guardian setup.

`tracking_origin` records "what HMD position corresponds to
`player_pos`". It's set on reset:

```
player_pos      = (0, 0, 0)
tracking_origin = camera.position.xz  (whatever HMD reports right now)
```

So immediately after reset, `head_offset = hmd_now − tracking_origin = 0`,
which means `head_world = player_pos`. The user spawns at virtual origin
regardless of where local-floor anchored.

In flat mode, `camera.position.xz` is constant at `(0, 0)`, so
`tracking_origin` is also `(0, 0)`, and the bridge formula degenerates
to `rig.position = player_pos` / `rig.rotation = player_rot`. Same code
path, no branching.

## Per-frame algorithm (VR)

```python
hmd_now = camera.position.xz            # XR has written it before our callback
R = rotY(player_rot)

# 1. Snap-turn edge detector on right stick X.
if |snapStickX| > TURN_THRESHOLD and sign(snapStickX) flipped:
    snap(-sign(snapStickX) * SNAP_TURN_DEG_rad)

# 2. XZ locomotion — joystick XOR roomscale (mutually exclusive).
if |joystick| > deadzone:
    # Locomotion: walk in look-direction. tracking_origin untouched —
    # HMD physical drift will accumulate as head_offset until vignette.
    # speed = (DASH_SPEED if dash held else WALK_SPEED)   # fixed m/s, not a multiple
    player_pos.xz += collide_and_slide(joystick_world)
else:
    # Roomscale: body chases HMD's tracking-space delta.
    intent_local = hmd_now − tracking_origin
    intent_world = R · intent_local
    prev_pos = player_pos.xz
    player_pos.xz += intent_world
    collide_and_slide(player_pos)
    actual_world = player_pos.xz − prev_pos
    tracking_origin += R⁻¹ · actual_world   # origin follows body's actual move

# 3. Vertical — gravity, jump, ground/step snap, fall-too-far respawn.
applyVertical(jumpHeld, dt)

# 4. Bridge gameplay state → three.js rig.
syncRig()

# 5. Vignette amount (UI feedback).
vignette = clamp(|hmd_now − tracking_origin| / VIGNETTE_FULL_LAG, 0, 1)
```

## Dash (hold-to-go-faster)

> as-of 2026-06-25

A fixed top speed on joystick locomotion while a dash input is held — no
acceleration ramp, no stamina, matching `WALK_SPEED`'s hard-clip feel.
`config.DASH_SPEED` is an absolute m/s, NOT a multiple of `WALK_SPEED` (so
tuning walk never drags dash). Dash is a placebo "I'm hustling" feel, not an
objective speed. `WALK_SPEED = 3`, `DASH_SPEED = 5` (pinned after render
interpolation made speed smooth — judder was the only reason 10 was tried).
Threaded through `walkVector(..., dash)`, read from `inputs.dash`.

Bindings:

| Mode | Dash input |
|------|-----------|
| Flat (keyboard) | `Shift` |
| Flat (gamepad)  | left stick press (L3, `buttons[10]`) |
| VR              | left thumbstick press (`buttons[3]`) |

Dash affects **joystick glide only**. Physical roomscale walking is 1:1 with
the body and is never scaled — overriding it would mean "you walked 1 m
physically, the body moved 3×," which breaks the head↔body invariant and
induces sim-sickness. See `player.stepVR` — the dash speed rides the joystick
branch, not the roomscale branch.

## Controller binding map (VR)

> as-of 2026-06-25

| xr-standard input | Action |
|---|---|
| left stick | walk |
| left thumbstick press (`buttons[3]`) | dash (hold) |
| right stick X | snap-turn |
| right A / B (`buttons[4]`/`[5]`) | jump |
| both thumbsticks pressed L3+R3 (`buttons[3]`) held ~0.7 s | live-reload current world (see [world-transitions.md](world-transitions.md)) |
| both grips (`buttons[1]`) held ~0.5 s | respawn to spawn marker (`player.reset`) |
## Render interpolation (smooth motion on fixed-dt physics)

> as-of 2026-06-25 — the shipping locomotion path.

Confirmed empirically: per-render-frame motion is what reads as smooth; raw
fixed-dt (no interpolation) judders at speed because the rendered rig quantizes
to physics steps. The fix keeps deterministic fixed-step physics AND renders
smoothly — the standard "Fix Your Timestep" (Gaffer) render interpolation.

**Physics = fixed 60 Hz ground truth** (`PHYS_DT = 1/60`, engine-integration
ready). **Render interpolates the RIG** (the locomotion offset) between the two
most recent physics states by `alpha = physAccumulator / dt`:

```
while (accumulator >= dt) {
  captureRigState(prevRig)   // snapshot BEFORE each step → prev = state before last step
  step(dt)
  accumulator -= dt
}
captureRigState(curRig)      // cur = current state
if (discontinuity) prev = cur // teleport/snap this frame → render destination, no smear
writeRigLerp(prev, cur, accumulator / dt)
```

**The HMD/camera is NEVER interpolated** — the XR runtime owns `camera.position`
live (motion-to-photon); interpolating head tracking = latency = sickness. Only
the locomotion offset (`rig.position`) is interpolated, and that's vection-based,
so a ≤1-step (~16 ms) lag is imperceptible. Rotation isn't interpolated either:
snap-turn must stay instant, and flat-mode turn is on the camera. So only
`rig.position` is lerped; `rig.rotation.y` takes the latest.

**Discontinuity guard** (`player.consumeDiscontinuity()`): `snap()`, `reset()`
(world load / respawn / first XR frame) and `handleTrackingReset()` set a flag;
the render loop renders the destination for that frame instead of smearing the
jump. Consumed both before the step loop (pre-step resets) and inside it (snaps).

**Why 60 not 30**: at `DASH_SPEED` 30 Hz = 33 cm/step (collision can tunnel thin
walls — resolveCapsule runs per step) + 33 ms interp lag; 60 Hz = 16 cm/step +
16 ms lag, robust, deterministic, decoupled from 72/90/120 display. Industry-
normal (Unity FixedUpdate 50, Source 66).

> Confirmed smooth on Quest 2026-06-26 and locked in as the single locomotion
> path; the temporary `B`/menu A/B toggle (fixed60-interp / update / raw modes)
> was removed once interp matched per-frame motion.

## Snap-turn — pivot always on `player_pos`

```python
def snap(delta_angle):
    # 1. Force roomscale catch-up (accept whatever collision lets us do).
    intent_world = R · (hmd_now − tracking_origin)
    player_pos.xz += collide_and_slide(intent_world)
    # NOTE: tracking_origin NOT updated here — about to overwrite.

    # 2. Force-clear: head re-anchors to player_pos.
    tracking_origin = hmd_now

    # 3. Rotate. Next syncRig() picks up new R.
    player_rot += delta_angle
```

After step 2, `head_offset_local = hmd_now − tracking_origin = 0`, so
`head_world = player_pos`. Step 3's rotation then pivots `head_world`
exactly on `player_pos`. No matter where the user's HMD is in playspace,
snap-turn is precise.

Cost: if the user had drifted (head ahead of body via lean / HMD push),
step 2 jumps the view back to body. This is the standard VR comfort
trade-off — a small jump during the discrete snap is invisible amid the
rotation itself.

## Fixed-dt physics + per-render-frame representation

> Updated 2026-06-25: physics dt is now **1/60** and the rig is **render-
> interpolated** (see "Render interpolation" above). The "sub-frame jitter is
> imperceptible, accepted" call below was WRONG at speed (dash judder) — interp
> superseded it. Clocks model unchanged; only the rate + the interp step differ.

Two clocks drive the player module:

| Clock | Rate | Who reads / writes |
|---|---|---|
| **render dt** (variable) | display refresh (Quest 72/80/90/120, desktop variable) | camera quaternion (mouse-look / gamepad smooth-look / HMD pose), interpolated rig output, vignette, the render call itself |
| **physics dt** (fixed = 1/60 = 16.67 ms) | constant regardless of render rate | player_pos / player_rot / tracking_origin / velY / grounded / collision queries / snap-turn / roomscale |

Render loop (in `src/app.js`):

```python
render_dt = clock.getDelta()  # variable

# Per-render-frame representation:
#  - camera-look (flat: gamepad applyLook writes camera.quaternion)
#  - inputs cached once
if not is_xr: flat.applyLook(render_dt)
inputs = xr.readInputs() if is_xr else flat.readInputs()

# Accumulator + fixed-dt physics steps:
phys_accumulator += render_dt
while phys_accumulator >= PHYS_DT and step_count < MAX_PHYS_STEPS:
    player.stepVR(inputs, PHYS_DT)  # or stepFlat
    phys_accumulator -= PHYS_DT
    step_count += 1
if step_count == MAX_PHYS_STEPS:
    phys_accumulator = 0  # tab-throttle spike → drop residue

# Per-render-frame representation:
player.syncRig()                       # rig follows latest gameplay state
vignette.update(player.getVignetteAmount(), render_dt)
renderer.render(scene, camera)
```

**Why this split:** each physics tick has identical numerical behavior
(jump apex, walk speed, collision invariants) regardless of render rate.
A 144 Hz monitor and a 60 Hz tab-throttled background tab give the same
gameplay trajectory. The variable-dt-with-cap approach (what we had
before) drifts on dt spikes — semi-implicit Euler's apex error is O(dt),
so a 50ms cap means a 14cm jump-apex variance under spike conditions.

Per docs/principles.md "academic-rigor robustness" + saved feedback
memory: each step preserves its invariants, no "cap and hope."

**Translation jitter at mismatched render/physics rates:** when a
render frame has 0 physics steps (display refresh faster than
PHYS_DT, e.g. desktop 144Hz vs 90Hz physics), rig.position is unchanged
from last frame, head_world.xz still moves with camera.position.xz (HMD
pose). Translation visually "freezes" for that frame in flat mode;
imperceptible in VR (camera tracking dominates head_world).

**Rotation per render frame:** camera-look (mouse-look, gamepad
smooth-look in flat; HMD in VR) MUST be tied to render rate, not
physics. Otherwise rotation feels rate-coupled and induces motion
sickness in VR. So `flat.applyLook(render_dt)` runs every render frame.
Snap-turn in VR is gameplay (writes player_rot, ticks at physics rate)
and visually shows up the moment the next render frame's `syncRig()`
pulls the new player_rot — at worst one render frame of lag, masked
by the snap rotation itself.

## System tracking reset (Quest "Reset View")

When the user long-presses Quest's Meta button → "Reset View", WebXR
fires a `reset` event on the active `XRReferenceSpace`. The reference
frame's origin is re-anchored to the user's current physical pose
(XZ + forward yaw); floor Y is left alone.

Without explicit handling, the next animation frame's `camera.position`
reads in the NEW frame while `tracking_origin` is still anchored to
the OLD frame. The roomscale path reads `intent_local = hmd_now -
tracking_origin` as a huge vector and drags `player_pos.xz` to wherever
the shift was. Common symptom: player falls below the floor (new XZ
is outside the walkable mesh → groundCheck returns null → gravity).
Even when the user stands still: the system re-anchors the origin to
their current pose, the apparent XZ delta is still large.

`event.transform` is an `XRRigidTransform` describing the new origin's
pose in the OLD frame. The yaw component is how much the reference
frame rotated; without compensating it, world heading would appear to
rotate (camera_yaw drops to ~0 in new frame because user's forward IS
the new forward, so we add that yaw to player_rot to preserve
world_heading = player_rot + camera_yaw).

`src/app.js` attaches a listener on the first XR frame (and on
re-entry) which stores the yaw shift in a pending flag.
`player.handleTrackingReset(yawShift)` runs in the next animation tick
BEFORE `updateVR` consumes `tracking_origin`:

```python
def handleTrackingReset(yawShift):
    player_rot += yawShift                          # world heading stable
    tracking_origin = camera.position.xz            # roomscale anchor at HMD
    syncRig()                                       # immediate visual update
    # body position / velocity / grounded preserved — "Reset View" is
    # a recalibration, not a respawn.
```

Two consecutive resets (user resets, doesn't move, resets again): the
second event still fires; `event.transform.orientation` is identity
(no yaw delta), `tracking_origin` re-snaps to the still-current HMD
position (no movement). World heading and position invariant. ✓

## Reset (world load + first XR frame + fall-too-far respawn)

```python
def reset():
    player_pos = (0, 0, 0)
    player_rot = 0
    tracking_origin = camera.position.xz   # capture current HMD as the origin
    velY = 0
    grounded = true
    syncRig()
```

In `app.js`, `reset()` is called from:
- `installWorld` (every world switch)
- First XR frame after `wasPresenting` flips true (session start)
- Inside `applyVertical` when `player_pos.y < lowerBound − 50` (respawn)

All three paths converge on the same defensive alignment: whatever the
HMD pose is right now becomes the new tracking_origin, so the user always
spawns at virtual origin.

## Invariants

**(a) Δhead_world is smooth.**
```
Locomotion: Δhead_world = joystick_world + R · Δhmd_local
Roomscale:  Δhead_world =                   R · Δhmd_local
```
No warps, no teleports — except during `snap()`, which is the only
designed-in jump and is masked by the rotation.

**(b) Joystick into wall = silent stop.**
`player_pos` advance is clamped by `collide_and_slide`. `tracking_origin`
stays put. `head_offset` doesn't grow. No vignette.

**(c) HMD into wall = body lag → vignette.**
Roomscale's `actual_world` is clamped; `tracking_origin` gains less than
`hmd_now`'s delta. `head_offset = hmd_now − tracking_origin` grows.
Vignette amount = `|head_offset| / VIGNETTE_FULL_LAG`.

**(d) Snap pivots on `player_pos`.**
`tracking_origin = hmd_now` makes `head_offset_local = 0` ⇒ `head_world =
player_pos`. Rotating `player_rot` then rotates `head_world` around
`player_pos`.

## Why XOR locomotion (joystick vs roomscale)?

Two reasons:

1. **No double-count.** If joystick AND HMD drift both fed body intent in
   one frame, fast walking + slight head-bob would add up. XOR keeps
   intent unambiguous.

2. **Joystick intent is "I want to go there"; HMD intent is "I want to
   stay anchored to my physical body."** They're different semantically.
   When the user is joysticking, their attention is on locomotion — head
   wobble shouldn't be treated as a body move. When idle, the body should
   catch up to wherever the head physically is.

The cost: if the user joysticks AND walks in their playspace
simultaneously, the head drifts ahead of the body, eventually triggering
vignette. In practice, joystick + physical walking rarely co-occur — but
the vignette feedback is harmless if it does.

## Math reference (rotation around +Y)

```
R(θ) · (x, z) = (cos(θ)·x + sin(θ)·z, −sin(θ)·x + cos(θ)·z)
R⁻¹(θ) · (x, z) = R(−θ) · (x, z) = (cos(θ)·x − sin(θ)·z, sin(θ)·x + cos(θ)·z)
```

Used in `syncRig` (forward R) and in roomscale's `tracking_origin`
update (inverse R⁻¹).

## What flat mode looks like

```
player_rot stays 0           (no snap-turn — gamepad right stick does
                              smooth mouse-look on camera.quaternion instead)
camera.position = (0, h, 0)  (one-shot in player.reset)
tracking_origin = (0, 0)     (camera.position.xz is always (0,0))
```

The bridge formula collapses:
```
rig.position.xz = player_pos.xz − R(0) · (0,0) = player_pos.xz
rig.rotation.y  = 0
```

So in flat mode, `rig.position == player_pos` and the locomotion path is
just "joystick → player_pos with collision". `updateFlat` and `updateVR`
share `applyVertical` and `walkVector`; the only VR-specific code is the
roomscale branch and the snap-turn edge detector.

## Files

- [src/player.js](../src/player.js) — gameplay state + algorithm
- [src/controls.js](../src/controls.js) — flat input → `player.updateFlat`
- [src/xrControls.js](../src/xrControls.js) — XR input → `player.updateVR`
- [src/collision.js](../src/collision.js) — `collide_and_slide` via three-mesh-bvh
- [src/scene.js](../src/scene.js) — rig + camera node setup
- [src/app.js](../src/app.js) — render loop, calls `player.reset()` on first XR frame
