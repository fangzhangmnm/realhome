// XR-mode input — Quest / generic immersive-vr controllers. WebXR exposes
// each controller as an XRInputSource with .handedness ("left" | "right") and
// a standard .gamepad (xr-standard mapping).
//
// xr-standard mapping (Meta Quest Touch, most modern WebXR controllers):
//   axes[2]  thumbstick X  (right +)
//   axes[3]  thumbstick Y  (down +)  — push up to walk forward
//   buttons[0] trigger
//   buttons[1] grip
//   buttons[3] thumbstick click
//   buttons[4] A / X (primary)
//   buttons[5] B / Y (secondary)
//
// Left controller stick → walk. Right controller stick X → snap-turn.
// Right A button → jump (same Better-Jump model as flat).
// Gravity still applies in XR — call player.applyJump every frame with the
// current button state.

// Pull the thumbstick axes off an XRInputSource's gamepad. Most controllers
// report a 4-axis layout where the thumbstick sits at [2],[3]; some older
// devices put it at [0],[1]. Returns null if no usable axes present.
function readStick(gp) {
  if (!gp || !gp.axes) return null;
  // Pick the axis pair with non-trivial magnitude — handles both layouts.
  const ax = gp.axes;
  const a = (Math.abs(ax[2] || 0) + Math.abs(ax[3] || 0)) >= (Math.abs(ax[0] || 0) + Math.abs(ax[1] || 0));
  return a ? { x: ax[2] || 0, y: ax[3] || 0 } : { x: ax[0] || 0, y: ax[1] || 0 };
}

export function createXrControls(renderer, player) {
  function update(dt) {
    const session = renderer.xr.getSession();

    let walkX = 0, walkZ = 0, snapStickX = 0, jumpHeld = false;
    if (session) {
      for (const src of session.inputSources) {
        if (!src.gamepad) continue;     // hand-tracking inputs skipped
        const gp = src.gamepad;
        const stick = readStick(gp);
        const isLeft = src.handedness === "left";
        const isRight = src.handedness === "right";
        // Defensive fallback for sources reporting "none" — assume the first
        // unknown controller is the locomotion stick.
        const unknown = !isLeft && !isRight;
        if (isLeft || (unknown && walkX === 0 && walkZ === 0)) {
          if (stick) {
            walkX += stick.x;
            walkZ += -stick.y;          // stick up → forward
          }
        }
        if (isRight || unknown) {
          if (stick && snapStickX === 0) snapStickX = stick.x;
          // Jump on A/X (buttons[4]) — fall back to any pressed face button.
          if (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed) jumpHeld = true;
        }
      }
    }

    player.applyMove(walkX, walkZ, dt);
    player.applySnapTurn(snapStickX);
    player.applyJump(jumpHeld, dt);
  }

  return { update };
}
