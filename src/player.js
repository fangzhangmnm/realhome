import * as THREE from "three";
import {
  WALK_SPEED, DASH_SPEED, JUMP_VELOCITY, GRAVITY, GRAVITY_HELD, TERMINAL_VELOCITY,
  SNAP_TURN_DEG, PLAYER_HEIGHT, STEP_HEIGHT, DETECT_GROUND_DIST,
  CROUCH_MIN_HEAD, BLACKOUT_GAP, SUBSTEP_LEN, SUBSTEP_CAP, MAX_ROOMSCALE_STEP,
} from "./config.js";

// 3-layer model:
//   Gameplay state  (this module owns these)       → player_pos, player_rot, tracking_origin
//   Bridge / Rig    (three.js Group, we write)     → rig.position, rig.rotation
//   Camera          (three.js Camera)              → XR writes (VR) / we set once (flat)
//
// rig.position.xz = player_pos.xz − R(player_rot) · tracking_origin
// rig.position.y  = player_pos.y + seated_bump
// rig.rotation.y  = player_rot
// head_world = rig + camera   (composed by three.js, gives the rendering view)

const RESPAWN_DROP = 50;          // m below lowest collider before respawn
const VIGNETTE_FULL_LAG = 0.3;    // m of head-body lag at which vignette is fully closed
const STICK_DEADZONE = 0.15;
const TURN_THRESHOLD = 0.7;       // push past this to fire a snap
const TURN_RELEASE = 0.3;         // come back inside this to re-arm

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);
const _prev = new THREE.Vector3();

export function createPlayer(rig, camera, getCollision = () => null, onReset = () => {}) {
  // ── Gameplay state (SSoT) ─────────────────────────────────────────────
  const player_pos = new THREE.Vector3();
  let   player_rot = 0;
  const tracking_origin = new THREE.Vector2();     // XZ in tracking space
  let   seated_bump = 0;                            // future: artificial Y bump

  // Spawn target — written by setSpawnPoint(), read by reset(). Defaults
  // to origin when no `_spawn` Empty exists in the glb.
  const spawn_pos = new THREE.Vector3();
  let   spawn_rot = 0;

  // ── Internal physics state ────────────────────────────────────────────
  let velY = 0;
  let grounded = true;
  let lastTurnSign = 0;

  // CHARACTER head height — the collision body's height, a state DECOUPLED from
  // the live HMD. The HMD is intention input (and the camera always follows it,
  // for comfort); the character crouches to fit. Drops freely when the HMD goes
  // down; rises only as far as overhead clearance allows when the HMD goes up
  // (clearHeadHeight). The gap (HMD above charHeadY) drives the comfort
  // blackout. Flat mode pins it to PLAYER_HEIGHT (no crouch).
  let charHeadY = PLAYER_HEIGHT;

  // ── Bridge: gameplay state → three.js rig node ────────────────────────
  // captureRigState computes the rig values from current gameplay state into
  // `out` {x,y,z,rotY} WITHOUT writing — single source of the rig formula,
  // used by syncRig (write latest) and the render-interpolation path.
  function captureRigState(out) {
    const c = Math.cos(player_rot), s = Math.sin(player_rot);
    // R · tracking_origin   (rotation around +Y by player_rot)
    const rox = c * tracking_origin.x + s * tracking_origin.y;
    const roz = -s * tracking_origin.x + c * tracking_origin.y;
    out.x = player_pos.x - rox;
    out.z = player_pos.z - roz;
    out.y = player_pos.y + seated_bump;
    out.rotY = player_rot;
    return out;
  }
  const _rigTmp = { x: 0, y: 0, z: 0, rotY: 0 };
  function syncRig() {
    captureRigState(_rigTmp);
    rig.position.set(_rigTmp.x, _rigTmp.y, _rigTmp.z);
    rig.rotation.y = _rigTmp.rotY;
  }

  // ── Render interpolation ──────────────────────────────────────────────
  // Physics (player_pos/rot/tracking_origin) is fixed-dt ground truth; the
  // render frame interpolates the RIG (= locomotion offset, "where the virtual
  // body stands in the world") between the two most recent physics states so
  // motion is smooth at any display rate. The HMD/camera pose is NEVER
  // interpolated — the XR runtime owns it live; interpolating head tracking
  // would add latency = sickness. See docs/vr-locomotion.md.
  //
  // Position is lerped; rotation is NOT (snap-turn must stay instant, and
  // flat-mode turn lives on the camera, not the rig) → take the latest rotY.
  function writeRigLerp(prev, cur, alpha) {
    rig.position.x = prev.x + (cur.x - prev.x) * alpha;
    rig.position.y = prev.y + (cur.y - prev.y) * alpha;
    rig.position.z = prev.z + (cur.z - prev.z) * alpha;
    rig.rotation.y = cur.rotY;
  }
  // Set on any teleport / discrete jump (snap-turn, reset, tracking-reset) so
  // the render loop skips interpolation that frame (prev=cur) — never smear a
  // designed-in jump across frames.
  let _discontinuity = false;
  function consumeDiscontinuity() { const d = _discontinuity; _discontinuity = false; return d; }

  // ── Shared vertical physics: suspension + jump + gravity + respawn ──
  //
  // Suspension model (kinematic port of the CharacterMotor vehicle-spring, with
  // the 2nd-order spring replaced by a hard snap — a damped spring bobs the
  // camera and nauseates in VR). Sense support FIRST, then decide:
  //   • ground within reach AND not rising → snap the foot onto it, kill velY,
  //     grounded. No gravity is applied while supported, so a noisy frame can't
  //     start a fall the way the old "gravity-first, then maybe-snap ±stepEdge"
  //     did. The stick-down reach (DETECT_GROUND_DIST) is generous and crouch-
  //     independent → robust float.
  //   • otherwise (real edge, or rising from a jump) → airborne: gravity.
  function applyVertical(jumpHeld, dt) {
    const col = getCollision();

    // Jump: an explicit upward impulse, only from a supported state.
    if (jumpHeld && grounded) { velY = JUMP_VELOCITY; grounded = false; }

    if (!col) {
      // y=0 infinite floor fallback
      velY -= GRAVITY * dt;
      if (velY < -TERMINAL_VELOCITY) velY = -TERMINAL_VELOCITY;
      player_pos.y += velY * dt;
      if (player_pos.y <= 0) { player_pos.y = 0; velY = 0; grounded = true; }
      return;
    }

    // Wall / ceiling push (CHARACTER capsule height, not the live HMD).
    const yBeforeResolve = player_pos.y;
    col.resolveCapsule(player_pos, charHeadY);
    // Head bonk: rising into an overhead pushes us back DOWN → cancel the rise.
    if (velY > 0 && player_pos.y < yBeforeResolve - 1e-4) velY = 0;

    // Suspension sense: the foot grabs ground up to STEP_HEIGHT above (auto-step)
    // and DETECT_GROUND_DIST below (stick). Skip while rising so a jump leaves
    // the ground cleanly.
    const groundY = (velY <= 0) ? col.groundProbe(player_pos, STEP_HEIGHT, DETECT_GROUND_DIST) : null;
    if (groundY !== null) {
      player_pos.y = groundY;     // hard snap to ride height (1st-order ≡ snap; no VR bob)
      velY = 0;
      grounded = true;
    } else {
      grounded = false;
      const g = (jumpHeld && velY > 0) ? GRAVITY_HELD : GRAVITY;
      velY -= g * dt;
      if (velY < -TERMINAL_VELOCITY) velY = -TERMINAL_VELOCITY;
      player_pos.y += velY * dt;
    }

    if (Number.isFinite(col.lowerBound) && player_pos.y < col.lowerBound - RESPAWN_DROP) {
      reset();
    }
  }

  // ── Crouch resolve (VR) — frame step ① ───────────────────────────────
  // Reconcile the CHARACTER head (charHeadY) with the HMD intention. Down is
  // free (you can always duck); up is clamped to overhead clearance so a head
  // pinned under a ledge can't pop into geometry. Floored at CROUCH_MIN_HEAD so
  // the crouched body sphere never sinks below the floor — the human may duck
  // physically lower, which just widens the dislocation → blackout. Flat mode:
  // camera.position.y ≡ PLAYER_HEIGHT, so this no-ops at standing height.
  function resolveCrouch() {
    const desired = camera.position.y;
    const col = getCollision();
    if (!col) { charHeadY = Math.max(CROUCH_MIN_HEAD, desired); return; }
    if (desired <= charHeadY) {
      charHeadY = desired;                                   // duck: always allowed
    } else {
      charHeadY = col.clearHeadHeight(player_pos.x, player_pos.y, player_pos.z, charHeadY, desired);
    }
    if (charHeadY < CROUCH_MIN_HEAD) charHeadY = CROUCH_MIN_HEAD;
  }

  // Horizontal move with a swept capsule resolve — frame step ③. Substeps the
  // displacement into ~SUBSTEP_LEN chunks (capped at SUBSTEP_CAP) and resolves
  // each, so a fast move can't tunnel a thin wall. At walking speed this is a
  // single chunk = one resolve (the old behaviour). pos is mutated in place.
  function sweepMove(dx, dz) {
    const col = getCollision();
    if (!col) { player_pos.x += dx; player_pos.z += dz; return; }
    const dist = Math.hypot(dx, dz);
    const n = Math.min(SUBSTEP_CAP, Math.max(1, Math.ceil(dist / SUBSTEP_LEN)));
    const sx = dx / n, sz = dz / n;
    for (let i = 0; i < n; i++) {
      player_pos.x += sx;
      player_pos.z += sz;
      col.resolveCapsule(player_pos, charHeadY);
    }
  }

  // Walk direction in world XZ given local stick X/Z (+right, +forward).
  // Uses camera's world-forward (head's actual look direction). `dash` (held)
  // swaps WALK_SPEED for the fixed DASH_SPEED — see config. Dash only affects
  // horizontal locomotion; jump/gravity are untouched.
  function walkVector(walkX, walkZ, dt, dash = false) {
    const mag = Math.hypot(walkX, walkZ);
    if (mag < STICK_DEADZONE) return null;
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    _right.copy(_forward).cross(_UP).normalize();
    const speed = Math.min(mag, 1) * (dash ? DASH_SPEED : WALK_SPEED) * dt;
    return {
      x: (_forward.x * walkZ + _right.x * walkX) * (speed / mag),
      z: (_forward.z * walkZ + _right.z * walkX) * (speed / mag),
    };
    // Note: dividing by mag normalizes the (walkZ, walkX) magnitude before
    // multiplying by speed — diagonal stick doesn't move faster than cardinal.
  }

  // ── Flat (desktop) ───────────────────────────────────────────────────
  //
  // Physics step only — does NOT write to the rig. Caller (app.js render
  // loop) runs syncRig() once per render frame after one-or-more steps.
  // Splitting state-update from representation-write lets us run physics
  // at fixed dt while rendering / camera-look stay per-render-frame.
  // See docs/vr-locomotion.md "Fixed-dt physics" + memory rule
  // "academic-rigor robustness".
  function stepFlat(inputs, dt) {
    charHeadY = PLAYER_HEIGHT;     // flat: no crouch, body is always standing height
    const v = walkVector(inputs.walkX, inputs.walkZ, dt, inputs.dash);
    if (v) sweepMove(v.x, v.z);
    applyVertical(inputs.jumpHeld, dt);
  }

  // ── VR ───────────────────────────────────────────────────────────────
  // Same split: physics state only, no syncRig. Roomscale reads
  // camera.position.xz which is the live HMD pose (XR runtime writes it
  // every render frame). When multiple physics steps run in a single
  // render frame, all steps read the SAME camera.position — that's
  // correct (the HMD pose doesn't change between physics steps within
  // one render frame).
  //
  // Single collide_and_slide per step: joystick XOR roomscale.
  function stepVR(inputs, dt) {
    // (0) Resolve the character head height vs the HMD BEFORE anything reads the
    // capsule — the horizontal sweep and vertical resolve below all use charHeadY.
    resolveCrouch();

    // (1) Snap-turn edge detector. The lastTurnSign hysteresis means
    // repeated steps in one render frame with the same stick value
    // correctly only fire once per crossing.
    const absSnap = Math.abs(inputs.snapStickX);
    if (absSnap < TURN_RELEASE) lastTurnSign = 0;
    if (absSnap > TURN_THRESHOLD && Math.sign(inputs.snapStickX) !== lastTurnSign) {
      const sign = Math.sign(inputs.snapStickX);
      snap(-sign * SNAP_TURN_DEG * Math.PI / 180);
      lastTurnSign = sign;
    }

    // (2) XZ locomotion: joystick XOR roomscale. Dash boosts joystick glide
    // only — physical roomscale walking is 1:1 with the body, never scaled.
    const v = walkVector(inputs.walkX, inputs.walkZ, dt, inputs.dash);
    if (v) {
      sweepMove(v.x, v.z);
    } else {
      const c = Math.cos(player_rot), s = Math.sin(player_rot);
      const hmdX = camera.position.x, hmdZ = camera.position.z;
      const ilx = hmdX - tracking_origin.x;
      const ilz = hmdZ - tracking_origin.y;
      const iwx =  c * ilx + s * ilz;
      const iwz = -s * ilx + c * ilz;

      // Tracking-jump guard: a per-step roomscale delta bigger than any real
      // step is a non-physical HMD pose jump (Quest "Reset View" recenter, a
      // tracking glitch). Applying it as locomotion drags the body through walls
      // / off ledges → fall through the floor. Absorb it instead: re-anchor
      // tracking_origin to the current HMD and DON'T move the body.
      if (Math.hypot(iwx, iwz) > MAX_ROOMSCALE_STEP) {
        tracking_origin.set(camera.position.x, camera.position.z);
      } else {
        _prev.copy(player_pos);
        sweepMove(iwx, iwz);
        const awx = player_pos.x - _prev.x;
        const awz = player_pos.z - _prev.z;
        tracking_origin.x +=  c * awx - s * awz;
        tracking_origin.y +=  s * awx + c * awz;
      }
    }

    // (3) Vertical.
    applyVertical(inputs.jumpHeld, dt);
  }

  // Vignette amount — the max of two comfort signals (both 0 in flat mode, where
  // camera.position and tracking_origin stay put and charHeadY ≡ PLAYER_HEIGHT):
  //   • horizontal head-body lag (roomscale pushed against a wall)
  //   • vertical head dislocation: the human standing taller than the CHARACTER
  //     can (head pinned under an overhead) → fade to black past BLACKOUT_GAP, so
  //     the user doesn't see through the wall their real head is poking into.
  function getVignetteAmount() {
    const offX = camera.position.x - tracking_origin.x;
    const offZ = camera.position.z - tracking_origin.y;
    const lag = Math.hypot(offX, offZ) / VIGNETTE_FULL_LAG;
    const crouchGap = Math.max(0, camera.position.y - charHeadY) / BLACKOUT_GAP;
    return Math.min(1, Math.max(lag, crouchGap));
  }

  // ── Snap-turn (internal; call from updateVR) ─────────────────────────
  function snap(deltaAngle) {
    // 1. Force roomscale catch-up — accept whatever collision lets us do
    const c = Math.cos(player_rot), s = Math.sin(player_rot);
    const ilx = camera.position.x - tracking_origin.x;
    const ilz = camera.position.z - tracking_origin.y;
    const iwx =  c * ilx + s * ilz;
    const iwz = -s * ilx + c * ilz;
    player_pos.x += iwx;
    player_pos.z += iwz;
    const col = getCollision();
    if (col) col.resolveCapsule(player_pos, charHeadY);

    // 2. Force-clear: head re-anchors to player_pos regardless of step 1's outcome
    tracking_origin.x = camera.position.x;
    tracking_origin.y = camera.position.z;

    // 3. Rotate. syncRig() at end of updateVR will pick up new R.
    player_rot += deltaAngle;
    _discontinuity = true;   // discrete jump — don't interpolate across it
  }

  // ── Spawn point (read from glb on installWorld, see worldLoader.js) ──
  // Called by app.js before reset() during installWorld. Null clears back
  // to origin so a world without a spawn marker behaves like the old
  // hardcoded (0, 0, 0).
  function setSpawnPoint(spawn) {
    if (spawn?.position) spawn_pos.copy(spawn.position);
    else spawn_pos.set(0, 0, 0);
    spawn_rot = spawn?.rotation ?? 0;
  }

  // ── Reset (world load / respawn) ─────────────────────────────────────
  function reset() {
    player_pos.copy(spawn_pos);
    player_rot = spawn_rot;
    tracking_origin.set(camera.position.x, camera.position.z);
    charHeadY = Math.max(CROUCH_MIN_HEAD, camera.position.y);   // re-anchor to current HMD; no spurious blackout
    velY = 0;
    grounded = true;
    lastTurnSign = 0;
    _discontinuity = true;   // teleport (world load / respawn) — no interp smear
    syncRig();
    onReset();
  }

  // ── System-level tracking reset (Quest "Reset View") ─────────────────
  //
  // WebXR fires `reset` on the XRReferenceSpace when the runtime re-anchors
  // tracking (user long-presses Meta button → "Reset View"). The reference
  // frame's origin + forward shift to match the user's current physical
  // pose. Without handling this we'd:
  //   - interpret the apparent HMD XZ jump as roomscale "user walked" and
  //     drag player_pos to a possibly-invalid position (→ fall below floor)
  //   - have the world appear rotated by the yaw component of the shift
  //
  // Fix: receive the transform's yaw shift from app.js's reset listener
  // (XRReferenceSpace.reset event), add it to player_rot to keep world
  // heading stable, and snap tracking_origin to current HMD pose so the
  // next roomscale tick reads intent_local = 0. Body position / velocity /
  // grounded stay intact — the user pressed "Reset View", not "Respawn".
  function handleTrackingReset(yawShift) {
    if (Number.isFinite(yawShift)) player_rot += yawShift;
    tracking_origin.set(camera.position.x, camera.position.z);
    _discontinuity = true;   // reference-frame re-anchor — no interp smear
    syncRig();
  }

  return {
    // Fixed-dt physics step (caller in render loop with accumulator)
    stepFlat,
    stepVR,
    // Per-render-frame representation write (raw = latest; or interpolate via
    // captureRigState + writeRigLerp with consumeDiscontinuity to guard jumps)
    syncRig,
    captureRigState,
    writeRigLerp,
    consumeDiscontinuity,
    getVignetteAmount,
    // State management
    reset,
    setSpawnPoint,
    handleTrackingReset,
    setSeatedBump: (m) => { seated_bump = m; syncRig(); },
  };
}
