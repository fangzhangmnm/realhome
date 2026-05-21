import * as THREE from "three";
import {
  WALK_SPEED, JUMP_VELOCITY, GRAVITY, GRAVITY_HELD, TERMINAL_VELOCITY,
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

  // ── Internal physics state ────────────────────────────────────────────
  let velY = 0;
  let grounded = true;
  let lastTurnSign = 0;

  // Bridge: gameplay state → three.js rig node.
  function syncRig() {
    const c = Math.cos(player_rot), s = Math.sin(player_rot);
    // R · tracking_origin   (rotation around +Y by player_rot)
    const rox = c * tracking_origin.x + s * tracking_origin.y;
    const roz = -s * tracking_origin.x + c * tracking_origin.y;
    rig.position.x = player_pos.x - rox;
    rig.position.z = player_pos.z - roz;
    rig.position.y = player_pos.y + seated_bump;
    rig.rotation.y = player_rot;
  }

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
  // Uses camera's world-forward (head's actual look direction).
  function walkVector(walkX, walkZ, dt) {
    const mag = Math.hypot(walkX, walkZ);
    if (mag < STICK_DEADZONE) return null;
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    _right.copy(_forward).cross(_UP).normalize();
    const speed = Math.min(mag, 1) * WALK_SPEED * dt;
    return {
      x: (_forward.x * walkZ + _right.x * walkX) * (speed / mag),
      z: (_forward.z * walkZ + _right.z * walkX) * (speed / mag),
    };
    // Note: dividing by mag normalizes the (walkZ, walkX) magnitude before
    // multiplying by speed — diagonal stick doesn't move faster than cardinal.
  }

  // ── Flat (desktop) ───────────────────────────────────────────────────
  // Mouse-look writes camera.quaternion; we ignore it for direction since
  // camera.getWorldDirection already accounts for it. tracking_origin stays
  // at (0,0) in flat (camera.position.xz stays at (0,0)), so the bridge
  // degenerates to rig.position = player_pos / rig.rotation = player_rot.
  function updateFlat(walkX, walkZ, jumpHeld, dt) {
    const v = walkVector(walkX, walkZ, dt);
    if (v) {
      player_pos.x += v.x;
      player_pos.z += v.z;
      const col = getCollision();
      if (col) col.resolveCapsule(player_pos, camera.position.y);
    }
    applyVertical(jumpHeld, dt);
    syncRig();
    return { vignette: 0 };
  }

  // ── VR ───────────────────────────────────────────────────────────────
  // Single collide_and_slide per frame: joystick XOR roomscale.
  //   Joystick > deadzone   → locomotion only; HMD physical drift accumulates
  //                            as head_offset until vignette kicks in
  //   Joystick idle         → roomscale: body chases HMD's tracking-space
  //                            delta; tracking_origin follows body's actual move
  //
  // Snap-turn fires on the right-stick X axis edge (TURN_THRESHOLD with
  // hysteresis at TURN_RELEASE). Snap forces roomscale catch-up then clears
  // tracking_origin so head re-anchors to player_pos — rotation pivots on
  // player_pos.
  function updateVR(walkX, walkZ, snapStickX, jumpHeld, dt) {
    // (1) Snap-turn edge detector
    const absSnap = Math.abs(snapStickX);
    if (absSnap < TURN_RELEASE) lastTurnSign = 0;
    if (absSnap > TURN_THRESHOLD && Math.sign(snapStickX) !== lastTurnSign) {
      const sign = Math.sign(snapStickX);
      // push right (+1) → turn right → -Y rotation
      snap(-sign * SNAP_TURN_DEG * Math.PI / 180);
      lastTurnSign = sign;
    }

    // (2) XZ locomotion: joystick XOR roomscale
    const v = walkVector(walkX, walkZ, dt);
    if (v) {
      // Joystick mode — tracking_origin untouched
      player_pos.x += v.x;
      player_pos.z += v.z;
      const col = getCollision();
      if (col) col.resolveCapsule(player_pos, camera.position.y);
    } else {
      // Roomscale mode — body chases HMD
      const c = Math.cos(player_rot), s = Math.sin(player_rot);
      const hmdX = camera.position.x, hmdZ = camera.position.z;
      // intent_local = hmd_now − tracking_origin
      const ilx = hmdX - tracking_origin.x;
      const ilz = hmdZ - tracking_origin.y;
      // intent_world = R · intent_local
      const iwx =  c * ilx + s * ilz;
      const iwz = -s * ilx + c * ilz;

      _prev.copy(player_pos);
      player_pos.x += iwx;
      player_pos.z += iwz;
      const col = getCollision();
      if (col) col.resolveCapsule(player_pos, camera.position.y);
      const awx = player_pos.x - _prev.x;
      const awz = player_pos.z - _prev.z;

      // tracking_origin += R⁻¹ · actual_world  (R⁻¹ for +Y rotation is R(-θ))
      tracking_origin.x +=  c * awx - s * awz;
      tracking_origin.y +=  s * awx + c * awz;
    }

    // (3) Vertical
    applyVertical(jumpHeld, dt);

    // (4) Bridge + vignette
    syncRig();
    const offX = camera.position.x - tracking_origin.x;
    const offZ = camera.position.z - tracking_origin.y;
    return { vignette: Math.min(1, Math.hypot(offX, offZ) / VIGNETTE_FULL_LAG) };
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
  }

  // ── Reset (world load / respawn) ─────────────────────────────────────
  function reset() {
    player_pos.set(0, 0, 0);
    player_rot = 0;
    tracking_origin.set(camera.position.x, camera.position.z);
    velY = 0;
    grounded = true;
    lastTurnSign = 0;
    syncRig();
    onReset();
  }

  return {
    updateFlat,
    updateVR,
    reset,
    setSeatedBump: (m) => { seated_bump = m; syncRig(); },
  };
}
