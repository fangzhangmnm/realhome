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

export function createXrControls(renderer, player) {
  function update(dt) {
    const session = renderer.xr.getSession();

    let walkX = 0, walkZ = 0, snapStickX = 0, jumpHeld = false;
    if (session) {
      for (const src of session.inputSources) {
        if (!src.gamepad) continue;
        const axes = src.gamepad.axes;
        const buttons = src.gamepad.buttons;
        if (src.handedness === "left") {
          walkX += axes[2] || 0;            // right (+1) → strafe right
          walkZ += -(axes[3] || 0);         // up (-1) → walk forward (+walkZ)
        } else if (src.handedness === "right") {
          snapStickX = axes[2] || 0;
          if (buttons[4]?.pressed) jumpHeld = true;  // A/X
        }
      }
    }

    player.applyMove(walkX, walkZ, dt);
    player.applySnapTurn(snapStickX);
    player.applyJump(jumpHeld, dt);
  }

  return { update };
}
