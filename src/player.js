import * as THREE from "three";
import {
  WALK_SPEED, DASH_SPEED, JUMP_VELOCITY, GRAVITY, GRAVITY_HELD, TERMINAL_VELOCITY,
  SNAP_TURN_DEG, PLAYER_HEIGHT, STEP_HEIGHT,
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

  // ── Shared vertical physics: gravity + jump + ground/step + respawn ──
  function applyVertical(jumpHeld, dt) {
    if (jumpHeld && grounded) { velY = JUMP_VELOCITY; grounded = false; }
    const g = (jumpHeld && velY > 0) ? GRAVITY_HELD : GRAVITY;
    velY -= g * dt;
    if (velY < -TERMINAL_VELOCITY) velY = -TERMINAL_VELOCITY;
    player_pos.y += velY * dt;

    const col = getCollision();
    if (!col) {
      // y=0 infinite floor fallback
      if (player_pos.y <= 0) { player_pos.y = 0; velY = 0; grounded = true; }
      return;
    }
    const headHeight = camera.position.y;
    col.resolveCapsule(player_pos, headHeight);     // ceiling push
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
    } else {
      grounded = false;
    }
    if (Number.isFinite(col.lowerBound) && player_pos.y < col.lowerBound - RESPAWN_DROP) {
      reset();
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
    const v = walkVector(inputs.walkX, inputs.walkZ, dt, inputs.dash);
    if (v) {
      player_pos.x += v.x;
      player_pos.z += v.z;
      const col = getCollision();
      if (col) col.resolveCapsule(player_pos, camera.position.y);
    }
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
      player_pos.x += v.x;
      player_pos.z += v.z;
      const col = getCollision();
      if (col) col.resolveCapsule(player_pos, camera.position.y);
    } else {
      const c = Math.cos(player_rot), s = Math.sin(player_rot);
      const hmdX = camera.position.x, hmdZ = camera.position.z;
      const ilx = hmdX - tracking_origin.x;
      const ilz = hmdZ - tracking_origin.y;
      const iwx =  c * ilx + s * ilz;
      const iwz = -s * ilx + c * ilz;

      _prev.copy(player_pos);
      player_pos.x += iwx;
      player_pos.z += iwz;
      const col = getCollision();
      if (col) col.resolveCapsule(player_pos, camera.position.y);
      const awx = player_pos.x - _prev.x;
      const awz = player_pos.z - _prev.z;
      tracking_origin.x +=  c * awx - s * awz;
      tracking_origin.y +=  s * awx + c * awz;
    }

    // (3) Vertical.
    applyVertical(inputs.jumpHeld, dt);
  }

  // Vignette amount based on current HMD position vs tracking_origin.
  // Called once per render frame (visual feedback). Returns 0 in flat
  // mode (camera.position stays put + tracking_origin stays put).
  function getVignetteAmount() {
    const offX = camera.position.x - tracking_origin.x;
    const offZ = camera.position.z - tracking_origin.y;
    return Math.min(1, Math.hypot(offX, offZ) / VIGNETTE_FULL_LAG);
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
    if (col) col.resolveCapsule(player_pos, camera.position.y);

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
