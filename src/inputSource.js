// InputSource seam — the ONE canonical per-frame input contract.
//
// An `InputSource` is anything with a `readInputs(): InputFrame` method. There
// are exactly two adapters, one per locomotion mode:
//   • flat (desktop)  → controls.js   createFlatControls().readInputs()
//   • xr   (immersive) → xrControls.js createXrControls().readInputs()
// Both MUST build their frame through makeInputFrame() below, so the frame shape
// lives in exactly one place: rename/add a field here and both adapters (and the
// typedef the consumers rely on) move together. player.js stepFlat/stepVR and
// app.js read the fields off the returned frame.
//
// Field ownership:
//   Shared  (both adapters set): walkX, walkZ, jumpHeld, dash
//   XR-only (flat leaves at default): snapStickX, reload, respawn
// The XR-only fields are never read on the flat code path (snapStickX only in
// stepVR; reload/respawn only under `if (isXR && …)` in app.js), so their flat
// defaults below are inert — they exist to make the shape total, not to feed
// behaviour. See the report / commit message for the undefined-vs-default audit.

/**
 * One frame of gameplay input, produced once per render frame by the active
 * InputSource and consumed by player.stepFlat / player.stepVR / app.js.
 *
 * @typedef {Object} InputFrame
 * @property {number}  walkX      Local strafe axis, −1 (left) … +1 (right). SHARED. Read by walkVector.
 * @property {number}  walkZ      Local forward axis, −1 (back) … +1 (forward). SHARED. Read by walkVector.
 * @property {boolean} jumpHeld   Jump button held this frame. SHARED. Read by applyVertical.
 * @property {boolean} dash       Dash (speed-boost) held this frame. SHARED. Read by walkVector.
 * @property {number}  snapStickX Right-stick X for snap-turn edge detection, −1 … +1. XR-ONLY (flat: 0). Read by stepVR.
 * @property {boolean} reload     Edge-fired live-reload combo (L3+R3 held). XR-ONLY (flat: false). Read by app.js.
 * @property {boolean} respawn    Edge-fired respawn combo (both grips held). XR-ONLY (flat: false). Read by app.js.
 */

/**
 * Build a complete {@link InputFrame} from a partial one, filling every absent
 * field with its safe default. This is the single source of truth for the frame
 * shape — the ONLY place the full field set is written down. A producer that
 * forgets a field gets the default; a producer that misspells a field gets
 * ignored here (and would surface as a missing-field bug at one site, not three).
 *
 * @param {Partial<InputFrame>} [partial] fields the adapter actually observed
 * @returns {InputFrame} the full, defaulted frame
 */
export function makeInputFrame(partial = {}) {
  return {
    walkX:      partial.walkX      ?? 0,
    walkZ:      partial.walkZ      ?? 0,
    jumpHeld:   partial.jumpHeld   ?? false,
    dash:       partial.dash       ?? false,
    snapStickX: partial.snapStickX ?? 0,
    reload:     partial.reload     ?? false,
    respawn:    partial.respawn    ?? false,
  };
}
