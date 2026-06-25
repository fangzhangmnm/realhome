import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

// Flat-mode (desktop) input. Mouse-look via PointerLockControls; movement from
// WASD + Space + a connected PC gamepad (standard mapping, e.g. Xbox).
// Gamepad right stick = smooth yaw + pitch on the camera (standard FPS look).
// Snap-turn is VR-only — desktop gets continuous rotation like every other FPS.

const LOOK_SPEED = 5.0;        // rad/sec at full stick deflection (~286°/s)
const LOOK_DEADZONE = 0.12;
const PITCH_LIMIT = Math.PI / 2 - 0.01;
const _euler = new THREE.Euler(0, 0, 0, "YXZ");

export function createFlatControls(camera, /* unused */_player, domElement) {
  const controls = new PointerLockControls(camera, domElement);

  const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };
  const onKey = (down) => (e) => {
    const k = e.code;
    if (k === "KeyW") keys.w = down;
    else if (k === "KeyA") keys.a = down;
    else if (k === "KeyS") keys.s = down;
    else if (k === "KeyD") keys.d = down;
    else if (k === "Space") { keys.space = down; if (down) e.preventDefault(); }
    else if (k === "ShiftLeft" || k === "ShiftRight") keys.shift = down;  // dash
    else return;
  };
  document.addEventListener("keydown", onKey(true));
  document.addEventListener("keyup", onKey(false));

  // Standard gamepad mapping (Xbox / DualShock / DualSense / Steam / generic):
  //   axes[0,1] = left stick (X right+, Y down+)   → walk
  //   axes[2,3] = right stick (X right+, Y down+)  → smooth yaw + pitch (look)
  //   buttons[0] = bottom face button (A / Cross)   → jump
  //   buttons[10] = left stick press (L3)           → dash
  function readGamepad() {
    const pads = navigator.getGamepads?.() || [];
    for (const p of pads) {
      if (p && p.mapping === "standard" && p.connected) return p;
    }
    return null;
  }

  // Read gameplay inputs (called once per render frame, then handed to
  // physics steps). NO writes — just observation.
  function readInputs() {
    let walkX = 0, walkZ = 0, jumpHeld = false, dash = keys.shift;
    if (keys.w) walkZ += 1;
    if (keys.s) walkZ -= 1;
    if (keys.a) walkX -= 1;
    if (keys.d) walkX += 1;
    if (keys.space) jumpHeld = true;

    const pad = readGamepad();
    if (pad) {
      if (walkX === 0 && walkZ === 0) {
        walkX += pad.axes[0] || 0;
        walkZ += -(pad.axes[1] || 0);
      }
      if (pad.buttons[0]?.pressed) jumpHeld = true;
      if (pad.buttons[10]?.pressed) dash = true;   // L3 = dash
    }
    return { walkX, walkZ, jumpHeld, dash };
  }

  // Apply gamepad smooth-look to camera.quaternion. Per-render-frame
  // (representation, NOT physics) — must match render rate or the look
  // feels rate-coupled. Mouse-look is handled internally by
  // PointerLockControls via mousemove events, already per-frame.
  function applyLook(dt) {
    const pad = readGamepad();
    if (!pad) return;
    const lx = pad.axes[2] || 0;
    const ly = pad.axes[3] || 0;
    if (Math.abs(lx) <= LOOK_DEADZONE && Math.abs(ly) <= LOOK_DEADZONE) return;
    _euler.setFromQuaternion(camera.quaternion, "YXZ");
    _euler.y -= lx * LOOK_SPEED * dt;
    _euler.x -= ly * LOOK_SPEED * dt;
    if (_euler.x > PITCH_LIMIT) _euler.x = PITCH_LIMIT;
    else if (_euler.x < -PITCH_LIMIT) _euler.x = -PITCH_LIMIT;
    _euler.z = 0;
    camera.quaternion.setFromEuler(_euler);
  }

  return { controls, readInputs, applyLook, isLocked: () => controls.isLocked };
}
