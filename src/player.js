import * as THREE from "three";
import {
  WALK_SPEED, JUMP_VELOCITY, GRAVITY, GRAVITY_HELD, TERMINAL_VELOCITY,
  SNAP_TURN_DEG, PLAYER_HEIGHT,
} from "./config.js";

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

export function createPlayer(rig, camera) {
  let velY = 0;
  let grounded = true;
  let lastTurnSign = 0;

  // walkX = strafe (+right), walkZ = forward (+forward).
  // Magnitude is clipped to 1 so diagonal stick doesn't go faster than cardinal.
  function applyMove(walkX, walkZ, dt) {
    const mag = Math.hypot(walkX, walkZ);
    if (mag < STICK_DEADZONE) return;
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
    if (rig.position.y <= 0) {
      rig.position.y = 0;
      velY = 0;
      grounded = true;
    }
  }

  // Hard reset to spawn — called on world switch + on XR session start.
  // In flat mode camera local Z=3 puts us 3m back from rig origin so a world
  // centered on origin is visible without walking. XR overrides camera pose
  // anyway so the Z=3 is flat-only.
  function reset() {
    rig.position.set(0, 0, 0);
    rig.rotation.set(0, 0, 0);
    camera.position.set(0, PLAYER_HEIGHT, 3);
    camera.quaternion.set(0, 0, 0, 1);
    velY = 0;
    grounded = true;
    lastTurnSign = 0;
  }

  return { applyMove, applySnapTurn, applyJump, reset };
}
