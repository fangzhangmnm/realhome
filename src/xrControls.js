// XR-mode input — reads WebXR controllers per frame and feeds them to the
// shared player module. All locomotion physics + snap-turn live in player.js.
//
// xr-standard gamepad button layout (Quest Touch et al):
//   buttons[0] trigger   buttons[1] grip/squeeze   buttons[3] thumbstick press
//   buttons[4] A / X     buttons[5] B / Y
// Bindings here:
//   left stick           → walk            right stick X      → snap-turn
//   right A / B          → jump            left thumbstick     → dash (hold)
//   BOTH thumbsticks pressed (L3+R3) held ≥ RELOAD_HOLD_MS → live-reload world
//   BOTH grips held ≥ RESPAWN_HOLD_MS                      → respawn to spawn
//     (each edge-fired once per press; see docs/world-transitions.md.)
//   Note: L3 alone = dash, so during the L3+R3 reload combo dash is also
//   active — harmless, since the user is standing still to invoke it and dash
//   only scales joystick glide.

function readStick(gp) {
  if (!gp || !gp.axes) return null;
  const ax = gp.axes;
  const a = (Math.abs(ax[2] || 0) + Math.abs(ax[3] || 0)) >= (Math.abs(ax[0] || 0) + Math.abs(ax[1] || 0));
  return a ? { x: ax[2] || 0, y: ax[3] || 0 } : { x: ax[0] || 0, y: ax[1] || 0 };
}

// Two-hand combos must be held this long before firing — a deliberate hold so
// they can't be tripped mid-locomotion. Reload (network + reparse) gets the
// longer hold; respawn (local, cheap) a shorter one.
const RELOAD_HOLD_MS = 700;
const RESPAWN_HOLD_MS = 500;

// Edge-latched timed hold. Returns true on the single frame the hold completes;
// re-arms only after `active` goes false. State lives in the passed object.
function pollHold(latch, active, now) {
  if (active && !latch.latched) {
    if (latch.start === 0) latch.start = now;
    else if (now - latch.start >= latch.holdMs) { latch.latched = true; return true; }
  } else if (!active) {
    latch.start = 0;
    latch.latched = false;
  }
  return false;
}

export function createXrControls(renderer, /* unused */_player) {
  // Two-hand combo latches (closure-private; persist across frames).
  const reloadLatch = { start: 0, latched: false, holdMs: RELOAD_HOLD_MS };
  const respawnLatch = { start: 0, latched: false, holdMs: RESPAWN_HOLD_MS };

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
    let leftStick = false, rightStick = false;   // thumbstick PRESS (buttons[3])
    let leftGrip = false, rightGrip = false;      // squeeze (buttons[1])

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
        const stickBtn = gp.buttons[3]?.pressed;
        const grip = gp.buttons[1]?.pressed;
        if (isLeft) { leftStick = leftStick || stickBtn; leftGrip = leftGrip || grip; }
        else if (isRight) { rightStick = rightStick || stickBtn; rightGrip = rightGrip || grip; }
        else { // single unknown source: treat its press as "both" so the combos stay reachable
          if (stickBtn) { leftStick = true; rightStick = true; }
          if (grip) { leftGrip = true; rightGrip = true; }
        }
      }
    }

    // Two-hand combos, edge-latched on a timed hold. One perf-now per frame.
    const now = performance.now();
    const reload = pollHold(reloadLatch, leftStick && rightStick, now);
    const respawn = pollHold(respawnLatch, leftGrip && rightGrip, now);
    if (reload || respawn) pulseHaptics(session);

    return { walkX, walkZ, snapStickX, jumpHeld, dash, reload, respawn };
  }

  return { readInputs };
}
