// XR-mode input — reads WebXR controllers per frame and feeds them to the
// shared player module. All locomotion physics + snap-turn live in player.js.
//
// xr-standard gamepad button layout (Quest Touch et al):
//   buttons[0] trigger   buttons[1] grip/squeeze   buttons[3] thumbstick press
//   buttons[4] A / X     buttons[5] B / Y
// Bindings here:
//   left stick           → walk            right stick X     → snap-turn
//   right A / B          → jump            left thumbstick    → dash (hold)
//   BOTH grips held ≥ RELOAD_HOLD_MS → live-reload the current world
//     (edge-fired once per squeeze; see docs/world-transitions.md).

function readStick(gp) {
  if (!gp || !gp.axes) return null;
  const ax = gp.axes;
  const a = (Math.abs(ax[2] || 0) + Math.abs(ax[3] || 0)) >= (Math.abs(ax[0] || 0) + Math.abs(ax[1] || 0));
  return a ? { x: ax[2] || 0, y: ax[3] || 0 } : { x: ax[0] || 0, y: ax[1] || 0 };
}

// Both grips must be squeezed together this long before live-reload fires.
// A deliberate two-hand hold so it can't be tripped while walking/jumping
// (grips are otherwise unused in this app). Edge-latched: fires once, re-arms
// only after both grips release.
const RELOAD_HOLD_MS = 700;

export function createXrControls(renderer, /* unused */_player) {
  // Live-reload combo state (closure-private; lives across frames).
  let gripHoldStart = 0;     // perf-now when both grips first went down (0 = not held)
  let reloadLatched = false; // true after a fire, until both grips release

  // Buzz both controllers so the artist gets a tactile "got it" even though
  // the DOM HUD is invisible in immersive VR. Best-effort — not all runtimes
  // expose hapticActuators.
  function pulseHaptics(session, intensity = 0.8, ms = 90) {
    if (!session) return;
    for (const src of session.inputSources) {
      const act = src.gamepad?.hapticActuators?.[0];
      if (act?.pulse) { try { act.pulse(intensity, ms); } catch (_) {} }
    }
  }

  // Read gameplay inputs (called once per render frame, then handed to
  // physics steps). NO writes — pure observation. HMD pose is read by
  // player.stepVR directly from camera.position which the XR runtime
  // writes per render frame.
  function readInputs() {
    const session = renderer.xr.getSession();
    let walkX = 0, walkZ = 0, snapStickX = 0, jumpHeld = false, dash = false;
    let leftGrip = false, rightGrip = false;

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
          if (gp.buttons[3]?.pressed) dash = true;   // left thumbstick press = dash
        }
        if (isRight || unknown) {
          if (stick && snapStickX === 0) snapStickX = stick.x;
          if (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed) jumpHeld = true;
        }
        if (gp.buttons[1]?.pressed) {
          if (isLeft) leftGrip = true;
          else if (isRight) rightGrip = true;
          else { leftGrip = true; rightGrip = true; }   // single unknown source: treat as both
        }
      }
    }

    // Both-grips-held live-reload, edge-latched on a timed hold.
    let reload = false;
    const bothGrips = leftGrip && rightGrip;
    if (bothGrips && !reloadLatched) {
      const now = performance.now();
      if (gripHoldStart === 0) gripHoldStart = now;
      else if (now - gripHoldStart >= RELOAD_HOLD_MS) {
        reload = true;
        reloadLatched = true;
        pulseHaptics(session);
      }
    } else if (!bothGrips) {
      gripHoldStart = 0;
      reloadLatched = false;
    }

    return { walkX, walkZ, snapStickX, jumpHeld, dash, reload };
  }

  return { readInputs };
}
