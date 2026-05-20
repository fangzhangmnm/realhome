import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

// Flat-mode (desktop) input. Mouse-look via PointerLockControls; movement
// from WASD + Space + a connected PC gamepad (standard mapping, e.g. Xbox).
// All movement / jump / snap-turn calls go through the shared `player` object
// so behaviour matches XR.

export function createFlatControls(camera, player, domElement) {
  const controls = new PointerLockControls(camera, domElement);

  const keys = { w: false, a: false, s: false, d: false, space: false };
  const onKey = (down) => (e) => {
    const k = e.code;
    if (k === "KeyW") keys.w = down;
    else if (k === "KeyA") keys.a = down;
    else if (k === "KeyS") keys.s = down;
    else if (k === "KeyD") keys.d = down;
    else if (k === "Space") { keys.space = down; if (down) e.preventDefault(); }
    else return;
  };
  document.addEventListener("keydown", onKey(true));
  document.addEventListener("keyup", onKey(false));

  // Standard gamepad mapping (Xbox / DualShock / DualSense / Steam / generic):
  //   axes[0,1] = left stick (X right+, Y down+)   → walk
  //   axes[2,3] = right stick                       → snap-turn (X) + (Y unused)
  //   buttons[0] = bottom face button (A / Cross)   → jump
  function readGamepad() {
    const pads = navigator.getGamepads?.() || [];
    for (const p of pads) {
      if (p && p.mapping === "standard" && p.connected) return p;
    }
    return null;
  }

  function update(dt) {
    // walkZ > 0 = forward (matches player.js sign convention).
    let walkX = 0, walkZ = 0, jumpHeld = false;
    if (keys.w) walkZ += 1;
    if (keys.s) walkZ -= 1;
    if (keys.a) walkX -= 1;
    if (keys.d) walkX += 1;
    if (keys.space) jumpHeld = true;

    const pad = readGamepad();
    let snapStickX = 0;
    if (pad) {
      // Gamepad walk only when keyboard idle — prevents double-counting.
      if (walkX === 0 && walkZ === 0) {
        walkX += pad.axes[0] || 0;        // stick right (+1) → strafe right
        walkZ += -(pad.axes[1] || 0);     // stick up (-1) → walk forward (+walkZ)
      }
      snapStickX = pad.axes[2] || 0;      // right stick X — snap-turn
      if (pad.buttons[0]?.pressed) jumpHeld = true;  // A / Cross button
    }

    player.applyMove(walkX, walkZ, dt);
    player.applySnapTurn(snapStickX);
    player.applyJump(jumpHeld, dt);
  }

  return { controls, update, isLocked: () => controls.isLocked };
}
