// XR-mode input — reads WebXR controllers per frame and feeds them to the
// shared player module. All locomotion physics + snap-turn live in player.js.

function readStick(gp) {
  if (!gp || !gp.axes) return null;
  const ax = gp.axes;
  const a = (Math.abs(ax[2] || 0) + Math.abs(ax[3] || 0)) >= (Math.abs(ax[0] || 0) + Math.abs(ax[1] || 0));
  return a ? { x: ax[2] || 0, y: ax[3] || 0 } : { x: ax[0] || 0, y: ax[1] || 0 };
}

export function createXrControls(renderer, /* unused */_player) {
  // Read gameplay inputs (called once per render frame, then handed to
  // physics steps). NO writes — pure observation. HMD pose is read by
  // player.stepVR directly from camera.position which the XR runtime
  // writes per render frame.
  function readInputs() {
    const session = renderer.xr.getSession();
    let walkX = 0, walkZ = 0, snapStickX = 0, jumpHeld = false;

    if (session) {
      for (const src of session.inputSources) {
        if (!src.gamepad) continue;     // hand-tracking skipped
        const gp = src.gamepad;
        const stick = readStick(gp);
        const isLeft = src.handedness === "left";
        const isRight = src.handedness === "right";
        const unknown = !isLeft && !isRight;
        if (isLeft || (unknown && walkX === 0 && walkZ === 0)) {
          if (stick) {
            walkX += stick.x;
            walkZ += -stick.y;          // stick up → forward
          }
        }
        if (isRight || unknown) {
          if (stick && snapStickX === 0) snapStickX = stick.x;
          if (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed) jumpHeld = true;
        }
      }
    }
    return { walkX, walkZ, snapStickX, jumpHeld };
  }

  return { readInputs };
}
