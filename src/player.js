import * as THREE from "three";
import {
  WALK_SPEED, JUMP_VELOCITY, GRAVITY, GRAVITY_HELD, TERMINAL_VELOCITY,
  SNAP_TURN_DEG, PLAYER_HEIGHT, STEP_HEIGHT,
} from "./config.js";

const RESPAWN_DROP = 50;          // m below lowest collider before snapping back to origin
const VIGNETTE_FULL_LAG = 0.3;    // m — lag at which the VR vignette is fully closed

// Shared player physics + locomotion primitives. Both flat-mode controls
// (keyboard + mouse + PC gamepad) and XR controls (Quest sticks) call into
// the same methods so behaviour stays consistent between modes.
//
// Rig is the locomotion anchor — feet on floor. Camera is parented to it,
// offset upward by PLAYER_HEIGHT in flat mode; in XR the headset pose
// overrides camera local pose.
//
// Snap-turn rotates the rig (player's world frame). Walk computes direction
// from the camera's world-forward (so you walk where you're looking, not
// where your rig "faces" — important for VR head-look + thumbstick combo).

const STICK_DEADZONE = 0.15;
const TURN_THRESHOLD = 0.7;     // push past this to fire a snap
const TURN_RELEASE = 0.3;       // come back inside this to re-arm

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);
const _camWorld = new THREE.Vector3();
const _bodyTry = new THREE.Vector3();

// getCollision returns the current collision system (created from the loaded
// world's `_collider` meshes), or null. Read fresh each frame so world switches
// pick up the new colliders without re-instantiating the player.
// onReset is called from inside reset() — used by the app to flag an
// HMD-pose recenter on the next XR frame so respawns + world switches always
// bring the user back to virtual origin in VR.
export function createPlayer(rig, camera, getCollision = () => null, onReset = () => {}) {
  let velY = 0;
  let grounded = true;
  let lastTurnSign = 0;

  // walkX = strafe (+right), walkZ = forward (+forward).
  // Magnitude is clipped to 1 so diagonal stick doesn't go faster than cardinal.
  function applyMove(walkX, walkZ, dt) {
    const mag = Math.hypot(walkX, walkZ);
    if (mag >= STICK_DEADZONE) {
      camera.getWorldDirection(_forward);
      _forward.y = 0;
      _forward.normalize();
      _right.copy(_forward).cross(_UP).normalize();
      _move.set(0, 0, 0)
        .addScaledVector(_forward, walkZ)
        .addScaledVector(_right, walkX)
        .normalize()
        .multiplyScalar(Math.min(mag, 1) * WALK_SPEED * dt);
      rig.position.add(_move);
    }
    // Resolve walls — always run, even when input is zero, in case the rig
    // is sitting on a wall after a world swap or previous-frame push.
    const c = getCollision();
    if (c) c.resolveCapsule(rig.position, camera.position.y);
  }

  // Discrete snap-turn — push the stick past TURN_THRESHOLD to fire once,
  // come back inside TURN_RELEASE to re-arm. Standard VR comfort pattern.
  function applySnapTurn(stickX) {
    const absX = Math.abs(stickX);
    if (absX < TURN_RELEASE) { lastTurnSign = 0; return; }
    const sign = Math.sign(stickX);
    if (absX > TURN_THRESHOLD && sign !== lastTurnSign) {
      // Push right (+1) → turn right → rig rotates clockwise from above (–Y).
      rig.rotation.y -= sign * (SNAP_TURN_DEG * Math.PI / 180);
      lastTurnSign = sign;
    }
  }

  // jumpHeld = current button/key state. Edge to trigger jump, held to extend
  // (Better-Jump pattern, see config.js).
  function applyJump(jumpHeld, dt) {
    if (jumpHeld && grounded) {
      velY = JUMP_VELOCITY;
      grounded = false;
    }
    const g = (jumpHeld && velY > 0) ? GRAVITY_HELD : GRAVITY;
    velY -= g * dt;
    if (velY < -TERMINAL_VELOCITY) velY = -TERMINAL_VELOCITY;
    rig.position.y += velY * dt;

    const c = getCollision();
    if (c) {
      const headHeight = camera.position.y;
      // Push out of ceiling / overhead. If we hit a ceiling rising, the push is
      // downward and the next-frame groundCheck handles the rest.
      c.resolveCapsule(rig.position, headHeight);
      // Ground / step: snap to the floor under us when within ±STEP_HEIGHT and
      // not actively rising. Symmetric range = auto step-up + smooth slope walk
      // + sticking to micro-drops (avoid bobbing on uneven floors). Drops
      // bigger than STEP_HEIGHT just turn into normal falls.
      const floorY = c.groundCheck(rig.position, headHeight);
      if (floorY !== null) {
        const distToFloor = rig.position.y - floorY;
        if (velY <= 0 && distToFloor >= -STEP_HEIGHT && distToFloor <= STEP_HEIGHT) {
          rig.position.y = floorY;
          velY = 0;
          grounded = true;
        } else {
          grounded = false;
        }
      } else {
        grounded = false;
      }
      // Respawn if we've fallen far below the lowest collider in the world.
      if (Number.isFinite(c.lowerBound) && rig.position.y < c.lowerBound - RESPAWN_DROP) {
        reset();
      }
    } else {
      // No collider mesh in this world — fall back to a y=0 infinite floor so
      // the player still has somewhere to stand.
      if (rig.position.y <= 0) {
        rig.position.y = 0;
        velY = 0;
        grounded = true;
      }
    }
  }

  // VR-only. Each frame, project the head's world XZ as where the body wants to
  // be, then run the same capsule resolve against the world. The lag between
  // the head's actual position and the body's clipped position is the vignette
  // amount — heads poked through walls / small holes will lag the body and
  // darken the view; thumbstick locomotion stops the rig at walls cleanly with
  // no lag (because rig is already collision-bounded above).
  function updateBodyTracking(vignette, dt) {
    if (!vignette) return;
    const c = getCollision();
    if (!c) { vignette.update(0, dt); return; }
    camera.getWorldPosition(_camWorld);
    _bodyTry.set(_camWorld.x, rig.position.y, _camWorld.z);
    c.resolveCapsule(_bodyTry, camera.position.y);
    const lagX = _camWorld.x - _bodyTry.x;
    const lagZ = _camWorld.z - _bodyTry.z;
    const lag = Math.hypot(lagX, lagZ);
    vignette.update(Math.min(1, lag / VIGNETTE_FULL_LAG), dt);
  }

  // Hard reset to spawn — called on world switch, on XR session start, and on
  // the fell-too-far respawn. Camera local sits at head height directly above
  // the rig — must NOT carry the old flat Z=3 offset, that desyncs the body
  // capsule (centered on rig) from the visible camera position.
  function reset() {
    rig.position.set(0, 0, 0);
    rig.rotation.set(0, 0, 0);
    camera.position.set(0, PLAYER_HEIGHT, 0);
    camera.quaternion.set(0, 0, 0, 1);
    velY = 0;
    grounded = true;
    lastTurnSign = 0;
    onReset();
  }

  return { applyMove, applySnapTurn, applyJump, updateBodyTracking, reset };
}
