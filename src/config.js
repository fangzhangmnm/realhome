// Player physics (matches the VR-mode spec — kept here so flat & VR share)
export const WALK_SPEED = 4;             // m/s, hard clip, no acceleration

// Jump physics — Minecraft-calibrated, variable-jump-height ("Better Jump" pattern):
//
//   rising + held     → GRAVITY_HELD (Minecraft baseline)
//   rising + released → GRAVITY      (heavier — cuts jump short)
//   falling           → GRAVITY      (heavier — no float)
//
// Numbers come from Minecraft's player physics (v₀=0.42 blocks/tick, g=0.08 blocks/tick²
// → 8.4 m/s and 32 m/s² in SI). 2× ratio for release/fall is the standard from
// Celeste / Hollow Knight / most modern platformers.
//
//   Apex invariance: apex = v₀²/(2g), so doubling g while holding v₀ fixed halves the
//   apex; that's exactly why tap < hold here. To shorten air time without changing
//   apex, you'd scale (g, v₀²) together — we don't, because we WANT tap to be smaller.
//
//   v₀ = 5.5 m/s
//   GRAVITY_HELD = 15 → held-apex = v₀²/(2·g_h) ≈ 1.01m   rise 0.37s + fall 0.28s = 0.65s
//   GRAVITY      = 25 → tap-apex  = v₀²/(2·g)   ≈ 0.61m   rise 0.22s + fall 0.22s = 0.44s
// Gentler than Minecraft baseline (~32/64, 0.45s held air time) — picked for a
// walking-around-home feel rather than block-jumping survival.
export const JUMP_VELOCITY = 5.5;        // m/s initial head velocity at takeoff
export const GRAVITY = 25;               // m/s² descent + ascent-after-release
export const GRAVITY_HELD = 15;          // m/s² during ascent while jump held

// Hard clamp on fall speed. ≈ real human skydiver terminal (~53 m/s belly-down).
// Pure clamp, no -η·v drag — keeps the integration simple. At GRAVITY = 25 m/s²
// you'd need to fall ~50m to reach this, so it's a runaway safety net rather
// than a gameplay value.
export const TERMINAL_VELOCITY = 50;     // m/s — max downward speed (velY clamped to ≥ -50)

export const PLAYER_HEIGHT = 1.7;        // m — used in flat mode (no IPD)
export const PLAYER_RADIUS = 0.3;        // m — capsule radius (used in collision later)

// Step height: how tall a ledge / threshold / stair the player can climb (or
// drop off) without jumping. The collision capsule is only built from y =
// STEP_HEIGHT up — the leg zone is handled by a downward raycast that snaps
// the rig to floor Y within ±STEP_HEIGHT each frame. Walls below this height
// are invisible to the capsule, so they auto-step instead of blocking.
export const STEP_HEIGHT = 0.3;          // m — Source ~0.4, Unreal ~0.45, ours a bit lower

// Mouse-look sensitivity (flat mode)
export const MOUSE_SENSITIVITY = 0.0022;

// Snap-turn angle (gamepad / VR controllers)
export const SNAP_TURN_DEG = 45;

// Render
export const FOV_DEG = 75;
export const NEAR = 0.05;
export const FAR = 1000;
