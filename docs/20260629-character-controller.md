# Character Controller — how the player moves, collides, crouches & stays grounded

> as-of 2026-06-29 · commit `c842e32` · build `ad5d2d8f39bf`
>
> This is the **current authority** on RealHome's locomotion / collision /
> crouch / ground mechanics. It supersedes the collision-and-ground parts of
> [20260521-jump-and-collision.md](20260521-jump-and-collision.md); [20260521-vr-locomotion.md](20260521-vr-locomotion.md)'s
> 3-layer model still holds and is summarised below. Code lives in
> [src/player.js](../src/player.js), [src/collision.js](../src/collision.js),
> tunables in [src/config.js](../src/config.js).

The whole thing is **kinematic** — we move plain `Vector3`s and resolve them
against a static BVH. No physics engine, no rigidbody. The design is borrowed in
spirit from a Unity `CharacterMotor` (suspension + capsule + ground sense) but
deliberately avoids PhysX, and avoids anything 2nd-order (springs) that would
bob the VR camera and cause sickness.

One principle runs through all of it:

> **Every part of the character body is a physical entity that moves
> _continuously_. It is never teleport-snapped.** The only exceptions are things
> the player explicitly asked for: respawn, world load, and (future) deliberate
> teleport. A one-frame jump of the body = a lurch of the world in VR = nausea.

---

## 1. Three layers (unchanged)

```
Gameplay state (SSoT, player.js owns)      Bridge / Rig (a THREE.Group)     Camera
  player_pos   Vector3  body in world   →  rig.position = player_pos − R·to →  XR writes it (VR)
  player_rot   scalar   heading (rad)   →  rig.rotation.y = player_rot          we set it once (flat)
  tracking_origin Vec2  VR calibration                                          head_world = rig + camera
  charHeadY    scalar   character head height (see §3)
```

Physics runs at a **fixed 60 Hz**; the render frame **interpolates the rig**
between the two latest physics states so motion is smooth at any display rate.
The HMD/camera pose is **never** interpolated — the XR runtime owns it live, and
interpolating head tracking would add latency = sickness.

---

## 2. The collision body — a levitated capsule + a suspension

The body that hits **walls** is a vertical **capsule** approximated by up to
three spheres (radius `PLAYER_RADIUS = 0.3`):

- a **top** sphere at `charHeadY − r` (the head),
- a **mid** sphere (only when standing tall; it just fills a tall torso),
- a **belly** sphere at `min(STEP_HEIGHT + r, charHeadY − r)`.

The capsule is **levitated**: its bottom (the belly sphere's lower edge) sits at
`STEP_HEIGHT = 0.3` above the foot. Everything below that — the **leg zone** — is
invisible to the wall capsule. That is exactly why you auto-step: a ledge whose
riser is below `STEP_HEIGHT` doesn't hit the capsule, so you walk over it and the
ground sense (below) lifts your foot onto it.

Wall resolution (`collision.resolveCapsule`) is **discrete depenetration**: each
sphere asks the BVH for overlapping triangles and gets pushed out along the
nearest-point direction, iterated a few times for corners. Walls block from both
sides (the push is orientation-agnostic).

**Feet/ground is a separate concern** handled by the suspension, not the capsule.

---

## 3. Crouch — the character head is decoupled from the HMD

This is the VR heart of the design and the reason standing-up-in-a-low-space
behaves sanely.

> The human outside the game ≠ the character inside it. The **HMD is intention
> input**; the **character** has its own head height `charHeadY` and crouches to
> fit. The **camera always follows the live HMD** (never lagged — that's the
> anti-sickness rule); only the **collision/character** head is `charHeadY`.

Each VR physics step (`resolveCrouch`, before anything reads the capsule):

- **HMD goes down** → `charHeadY` follows freely. You can always duck.
- **HMD goes up** → `charHeadY` rises only as far as there's headroom
  (`collision.clearHeadHeight`). This is a **continuous upward swept-sphere
  scan**, not an endpoint test: it steps the head sphere up and stops at the
  first blocked sample, so the head can never teleport *through* a thin ceiling
  into the space above it. The head bonks the lintel and stays clamped.
- `charHeadY` is floored at `CROUCH_MIN_HEAD = 0.75` so the crouched single
  sphere can't sink below the floor (a config-load assert enforces
  `CROUCH_MIN_HEAD ≥ 2·PLAYER_RADIUS`). At 0.75 the body covers 0.15–0.75 m,
  which clears a 1 m (Minecraft-block) opening.

When the human stands taller than the character is allowed (head pinned under an
overhead), the gap `HMD − charHeadY` drives a **comfort vignette to black**
(`BLACKOUT_GAP = 0.25`). Third-person, the character stays crouched while the
real head pokes up; you just fade out so you don't see through the wall. Walk out
of the low spot and `charHeadY` rises again, the black clears — like Link
standing up only where there's room.

The capsule **shrinks and lowers** with the crouch via one formula
(`capsuleSpheres`): standing = three spheres up to 1.7, crouched = a single
sphere. The belly's lower edge (the **one** step-height concept) is emergent:
0.3 standing, 0.15 fully crouched.

---

## 4. The ground — a raycast suspension (the robust float)

This replaced an old brittle "snap-or-fall within ±stepEdge" that dropped you
the instant the floor drifted past a tiny, crouch-shrinking tolerance. The
current model is a kinematic **suspension** with two clearly separate reaches:

`collision.groundProbe(pos, stepUp, stickDown)`:

- Probes **down** for the floor with **two independent reaches**:
  - `stepUp = STEP_HEIGHT` (0.3) **above** the foot — the auto-step height,
  - `stickDown = DETECT_GROUND_DIST` (0.3) **below** — how far the foot still
    grabs ground. **Generous, fixed, crouch-independent** — this is the
    robustness knob.
- **Multi-sampled**: foot centre + a 4-point ring at `0.7·radius`. A seam or an
  edge under one sample doesn't drop the whole probe; standing on a ledge edge
  keeps you up as long as *any* sample finds floor.
- Rays are **`FrontSide`**: only up-facing (floor) triangles count. An overhead's
  underside (a window lintel, a ceiling) is a back face and is culled, so it can
  never be mistaken for floor. This is how Unity (`queriesHitBackfaces = false`)
  and SM64 (`find_floor` walks only floor-classified triangles) do it; it relies
  on the world's collider-normal convention (back faces aren't rendered either).

`applyVertical` then **senses support first, decides second**:

1. Jump is an explicit upward impulse, only from a grounded state.
2. `resolveCapsule` pushes out of walls/ceiling; a rise that gets pushed back
   down is a **head bonk** → cancel the upward velocity.
3. Ask `groundProbe`. **If ground is in reach and we're not rising:** we're
   grounded — ease the foot onto it (next paragraph), kill vertical velocity.
   **No gravity is applied while supported**, so a single noisy frame can't start
   a fall. Only a *real* edge (no floor within reach) or a jump's rise falls,
   and then gravity runs.

**The foot follows the floor continuously, never snaps.** The grounded branch
moves the foot toward the probed floor with a **1st-order ease**
(`GROUND_FOLLOW_TAU = 0.06 s`): on flat ground the target ≈ current Y so it's a
no-op; a step up or down eases over ~τ instead of a one-frame jump. 1st-order
means no velocity term, so no overshoot/bounce — and no teleport, honouring the
continuous-body principle. You're "grounded" the whole time (the ease, not
gravity, owns Y), so robustness is unchanged; only the motion is smooth.

Net effect: walking on flats/ramps is glued; small ledges step up/down smoothly;
standing at a ledge edge with half a footprint over the drop holds you; only
walking fully off (or off a drop deeper than `DETECT_GROUND_DIST`) falls. A
`RESPAWN_DROP` below the lowest collider re-spawns you.

---

## 5. Horizontal movement — swept, not teleported

`sweepMove(dx, dz)` substeps the frame's horizontal displacement into chunks of
~`SUBSTEP_LEN` (≈ radius), capped at `SUBSTEP_CAP`, resolving the capsule after
each chunk, so a fast move can't tunnel a thin wall. At walking speed (≤ 5 m/s,
60 Hz → ≤ 0.08 m/frame ≪ radius) that's a single chunk. Used by both joystick
glide and physical roomscale.

Frame order in a VR step: **① resolve `charHeadY` → ② snap-turn → ③ horizontal
sweep → ④ vertical suspension**. `charHeadY` is settled before the sweep so the
sweep uses the correct (possibly crouched) capsule height.

---

## 6. Roomscale, snap-turn, and Quest "Reset View"

- **Roomscale** (no joystick): the body follows the HMD's physical XZ movement,
  `resolveCapsule` keeps it out of walls, and `tracking_origin` re-anchors so the
  head stays over the body. A per-step **tracking-jump guard** absorbs a roomscale
  delta bigger than any real step (`MAX_ROOMSCALE_STEP = 0.5 m`): that's a
  non-physical pose jump (a recenter or a tracking glitch), so we re-anchor and
  do **not** move the body — without it, the jump is read as a giant "walk" and
  drags you through walls / off ledges → fall.
- **Snap-turn** rotates `player_rot` in discrete `SNAP_TURN_DEG` steps with
  hysteresis; it force-catches roomscale drift and re-anchors so the turn is
  clean.
- **Quest "Reset View"** fires a `reset` on the XR reference space. We add its
  yaw to `player_rot` (world heading stays stable) and re-anchor
  `tracking_origin`. The jump guard above is the belt-and-suspenders that makes
  this not throw you through the floor even with the pose-update timing race.

---

## 7. The knobs (all in config.js)

| knob | value | what it controls |
|---|---|---|
| `PLAYER_HEIGHT` | 1.7 | standing head height (flat mode; VR uses live HMD) |
| `PLAYER_RADIUS` | 0.3 | capsule radius |
| `STEP_HEIGHT` | 0.3 | auto-step-UP height = capsule levitation |
| `DETECT_GROUND_DIST` | 0.3 | suspension stick-DOWN reach (robustness) |
| `GROUND_FOLLOW_TAU` | 0.06 s | foot→floor 1st-order ease (continuity) |
| `CROUCH_MIN_HEAD` | 0.75 | lowest character head (clears a 1 m hole) |
| `BLACKOUT_GAP` | 0.25 | head dislocation → full comfort vignette |
| `SUBSTEP_LEN` / `SUBSTEP_CAP` | 0.3 / 8 | horizontal sweep granularity / cap |
| `MAX_ROOMSCALE_STEP` | 0.5 | above this, a roomscale delta is a tracking jump |
| `WALK_SPEED` / `DASH_SPEED` | 2 / 5 | joystick locomotion speeds |
| `JUMP_VELOCITY` / `GRAVITY` / `GRAVITY_HELD` | 5.5 / 25 / 15 | variable-height jump |

---

## 8. Known soft spots (honest)

- **Very fast falls** (near terminal velocity, > `DETECT_GROUND_DIST` per frame)
  can still tunnel a thin floor — the ground probe isn't swept. Accepted
  (Mario-style); only happens after a multi-storey drop.
- **`resolveCapsule` depenetration** is per-frame discrete; the horizontal sweep
  keeps penetration shallow so this is fine in practice, but it isn't a swept
  capsule cast.
- All of the above is **tuned for a calm walk-around-your-home feel**, not
  twitch platforming.
