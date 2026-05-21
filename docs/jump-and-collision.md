# Jump & Collision — design + the pitfalls

How the player feels solid in RealHome. Lives in
[src/player.js](../src/player.js) (jump + ground snap) and
[src/collision.js](../src/collision.js) (BVH push-out + ground raycast).

The numbers and structure here are the answers to specific pitfalls — most
of them found by walking into walls, jumping under low ceilings, or VR
users sliding off geometry. Each section ends with the trap that motivated
it.

## Targets (industry references)

Tuning is anchored to actual games, not picked from arithmetic.

| Knob | Reference | Our value |
|---|---|---|
| Jump apex (hold) | Minecraft (~1.25m) | ~1.01 m |
| Jump apex (tap) | Celeste / HollowKnight (~0.6× hold) | ~0.61 m |
| Step height | Source ~0.4m, Unreal ~0.45m | 0.3 m |
| Player capsule radius | Quake-ish | 0.3 m |
| Player height | average human standing | 1.7 m |
| Snap-turn angle | Beat Saber / HL:Alyx | 45° |
| Walk speed | Minecraft (~4.3 m/s) | 4 m/s |

Don't tune by feel without naming a reference first. "Feels heavy" /
"feels floaty" is content-of-game-dependent — anchor to a game that nails
*this kind* of feel, then nudge.

## Jump — variable-height "Better Jump"

Three gravities, two thresholds:

```js
JUMP_VELOCITY = 5.5   // m/s initial head velocity at takeoff
GRAVITY       = 25    // m/s², descent + ascent-after-release
GRAVITY_HELD  = 15    // m/s², ascent while jump held
TERMINAL_VELOCITY = 50  // m/s clamp (~real skydiver)
```

```js
// In applyVertical(jumpHeld, dt):
if (jumpHeld && grounded) { velY = JUMP_VELOCITY; grounded = false; }
const g = (jumpHeld && velY > 0) ? GRAVITY_HELD : GRAVITY;
velY -= g * dt;
if (velY < -TERMINAL_VELOCITY) velY = -TERMINAL_VELOCITY;
player_pos.y += velY * dt;
```

State machine for `g`:

- **rising + held** → `GRAVITY_HELD` (lighter — Minecraft baseline feel)
- **rising + released** → `GRAVITY` (heavier — cuts the jump short)
- **falling** → `GRAVITY` (heavier — no float)

Apex math (`apex = v₀²/(2g)`):

```
held: 5.5² / (2·15)  = 1.01 m
tap:  5.5² / (2·25)  = 0.61 m   (held-then-release-immediately approximation)
```

### Pitfall 1: "shorter air time" ≠ "lower apex"

Tempting to scale `(g, v₀²)` together to shorten air time while keeping the
same jump height. That's the wrong goal for variable-jump: you actually
want the tap to be SHORTER, not just QUICKER. So we leave `v₀` fixed and
ONLY change `g` during ascent — apex changes, total air time changes,
arc-shape changes, everything moves together.

### Pitfall 2: tap detection via state machine, not button-up event

Pure "on jumpHeld=false, kill velY" works in single-frame thinking but
breaks if the user releases at the apex (velY ≈ 0, no upward energy to
kill). The 2× gravity-during-release approach is robust: regardless of
when the user releases, the rest of the rise pulls them down faster.

### Pitfall 3: no drag, just terminal-velocity clamp

We don't model `-η·v` air resistance. Pure clamp at -50 m/s. Integration is
the simple Euler step, dt-bounded by the render-loop's 50ms ceiling
(`Math.min(0.05, clock.getDelta())`). With GRAVITY=25, a 50m fall is the
worst case before clamp kicks in — past that we're definitely respawning
anyway.

## Ground snap & step-up

Falling-to-floor and walking-up-stairs are the same problem: "should my
feet be glued to a nearby floor right now?"

```js
// In applyVertical, after gravity integration:
const floorY = col.groundCheck(player_pos, headHeight);
if (floorY !== null) {
  const d = player_pos.y - floorY;
  if (velY <= 0 && d >= -STEP_HEIGHT && d <= STEP_HEIGHT) {
    player_pos.y = floorY;
    velY = 0;
    grounded = true;
  } else {
    grounded = false;
  }
}
```

Snap conditions, all required:
1. **`velY <= 0`** — never snap while rising (otherwise jumps get yanked
   back to ground mid-arc).
2. **`d >= -STEP_HEIGHT`** — floor isn't more than STEP_HEIGHT above us.
   Lets us walk up a 0.3m step without jumping.
3. **`d <= STEP_HEIGHT`** — floor isn't more than STEP_HEIGHT below us.
   Walking off a 0.3m ledge snaps down silently (no falling animation
   for tiny drops); a 0.31m ledge becomes a free-fall.

### Pitfall 4: raycast direction matters — cast from ABOVE the head, not from feet

The intuition "shoot a ray from my feet downward to find the floor" fails
on stairs. If the player is 0.05m in front of a step's vertical face, a
foot-level downward ray hits the step's *front face* and reports the floor
as right there. Then ground-snap pulls feet into the step's face, and the
horizontal capsule push-out can't recover because the geometry overlaps.

Fix: cast from `pos.y + headHeight`. The ray starts above the step, so it
hits the actual upper surface of the step (or the floor behind it,
whichever is higher). The reported floor Y is correct.

```js
_ray.origin.set(pos.x, pos.y + headHeight, pos.z);
_ray.direction.set(0, -1, 0);
```

## Collision capsule — three spheres along Y

Body approximated as three spheres stacked vertically:

```
        ●  topY  = headHeight - r
        |
        ●  midY  = midpoint
        |
        ●  bottomY = STEP_HEIGHT + r
   ─────────  ground
```

Each frame the capsule loop iterates up to 5× — each iteration calls
`pushSphereOnce(pos, offsetY, r)` on all three spheres. If any push
happened, retry; otherwise break.

```js
function resolveCapsule(pos, headHeight) {
  const r = PLAYER_RADIUS;
  const bottomY = STEP_HEIGHT + r;
  const topY = Math.max(headHeight - r, bottomY);
  const midY = (bottomY + topY) * 0.5;
  const degenerate = topY <= bottomY + 0.01;     // very crouched user
  for (let i = 0; i < 5; i++) {
    const a = pushSphereOnce(pos, bottomY, r);
    let b = false, c = false;
    if (!degenerate) {
      b = pushSphereOnce(pos, midY, r);
      c = pushSphereOnce(pos, topY, r);
    }
    if (!a && !b && !c) break;
  }
}
```

### Pitfall 5: the leg zone is invisible to walls — that IS the step-up

There is no separate "step-up" code path. The trick:

The capsule's bottom sphere is centered at `y = STEP_HEIGHT + r`. So
**no part of the capsule is below `y = STEP_HEIGHT`**. Geometry shorter
than STEP_HEIGHT (a doorstep, a single stair, an uneven floor tile)
**cannot push the capsule horizontally** — it's invisible.

Then `groundCheck` finds the upper surface of that geometry, and the
ground-snap (Pitfall 4) glues the player to it. Net effect: walk into a
0.3m step → capsule sees nothing in the way → bottom sphere drifts forward
→ ground-snap pulls feet up. The user just walks up.

Walk into a 0.4m step → bottom sphere collides with the part above
STEP_HEIGHT → push-out blocks horizontal movement → can't climb. Player
has to jump.

This is the Source / Unreal pattern. The alternative — raycast forward,
detect step, translate up — is more code AND has glitches at angled steps,
spiral staircases, and dynamic collider edges. The leg-zone-exclusion
approach has no special cases.

### Pitfall 6: iteration count for corner convergence

Walking diagonally into a corner: the bottom sphere overlaps both walls.
A single push-out picks ONE direction and exits one wall; the other wall
is still penetrated. Next iteration handles the second wall.

5 iterations covers all sane corner geometries. We could solve corners
analytically (compute the combined push from both triangles before
applying), but iterative is simpler and the worst-case 5× shapecast is
cheap on a BVH.

### Pitfall 7: `dSq > 1e-12` epsilon

```js
if (dSq < radius * radius && dSq > 1e-12) {
```

If the sphere center happens to be exactly on the triangle plane,
`closestPointToPoint` returns the center itself, `d = 0`, and the push
vector divides by zero. The epsilon skips the "exactly on the surface"
case — next iteration with a slightly displaced position will get a real
normal. In practice this never fires (floating-point exactness is rare),
but skipping it once is correct behavior.

## BVH ownership — bake the world transform into a clone

```js
for (const mesh of colliderMeshes) {
  mesh.updateMatrixWorld(true);
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  g.boundsTree = new MeshBVH(g);
  ...
}
```

### Pitfall 8: don't share the geometry with the rendered scene

If you build the BVH on `mesh.geometry` directly, `scene.remove(root) +
geom.dispose()` (which happens on world swap) destroys our BVH's backing
buffers. Crash on next collision query.

Cloning gives the collision system its own copy. World can dispose freely.

### Pitfall 9: bake matrixWorld ONCE, not per-query

Colliders are static (world doesn't move during play). Multiplying every
vertex by `matrixWorld` once at world-load is cheap — and turns every
subsequent query into world-space without any transform math.

If colliders ever needed to move (doors? animated platforms?), we'd
either (a) rebuild the BVH per frame for that mesh, or (b) transform the
query ray/sphere into mesh-local space and back. We don't, so we don't
need to.

## Respawn — `lowerBound − 50`

```js
let lowerBound = Infinity;
for (const mesh of colliderMeshes) {
  // ...
  if (g.boundingBox.min.y < lowerBound) lowerBound = g.boundingBox.min.y;
}
```

If the player falls more than 50m below the lowest collider, `reset()`.

### Pitfall 10: -50 (not 0)

Some scenes have floors at Y = -20 (Blender exported with non-default
origin) or include an enormous skybox sphere with min.y = -1000. `0` as a
floor isn't a safe bet. `lowerBound` is the actual lowest collision
geometry; the 50m offset gives the user a chance to fall-die before being
yanked back, which is part of feeling solid in big rooms.

## Interaction with the 3-layer VR model

See [docs/vr-locomotion.md](vr-locomotion.md). Collision operates on
`player_pos` (gameplay SSoT, top layer) only. It doesn't know about the
rig, the camera, or VR vs flat:

- `resolveCapsule(player_pos, headHeight)` — `headHeight` comes from
  `camera.position.y`, which in VR is the HMD's real height in the
  local-floor reference frame (so a crouched user has a shorter capsule
  automatically), and in flat is `PLAYER_HEIGHT` set once at reset.
- Joystick into a wall = silent stop. `player_pos.xz` is clamped by
  `resolveCapsule`; `tracking_origin` doesn't change; head doesn't drift
  from body; no vignette. The user feels the wall but doesn't get
  vignetted for trying.
- HMD into a wall = vignette. `player_pos` clamps short of `hmd_now`;
  `tracking_origin` only follows the *actual* `player_pos` delta (post-
  collision), so `head_offset` grows; vignette responds. The user's
  actual head is past the wall but their virtual body isn't — vignette
  signals the lag.

### Pitfall 11: collision capsule must be centered on player_pos, not on rig.position

When the rig has a `tracking_origin` offset (VR), `rig.position.xz` is
NOT where the body is in the virtual world — `player_pos.xz` is. A bug
earlier in development centered the capsule on `rig.position`, which
caused VR users walking sideways in playspace to slide along walls
because the "body" the engine was clamping was the rig, not where they
felt they were standing.

Always: collision queries get `player_pos`, never `rig.position`.

## Files

- [src/player.js](../src/player.js) — applyVertical, walkVector, updateFlat / updateVR
- [src/collision.js](../src/collision.js) — createCollision, resolveCapsule, groundCheck
- [src/config.js](../src/config.js) — JUMP_VELOCITY, GRAVITY, STEP_HEIGHT, PLAYER_RADIUS
- [docs/vr-locomotion.md](vr-locomotion.md) — the 3-layer VR model collision plugs into
