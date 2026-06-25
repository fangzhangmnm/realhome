// Player physics (matches the VR-mode spec — kept here so flat & VR share)
export const WALK_SPEED = 4;             // m/s, hard clip, no acceleration

// Dash / sprint — hold-to-go-faster. Pure speed multiplier on WALK_SPEED while
// the dash input is held (flat: Shift / gamepad L3; VR: left thumbstick press).
// No acceleration ramp, no stamina — it's a "cross the big empty room quickly"
// convenience, matching WALK_SPEED's hard-clip feel. 2.25× → ~9 m/s, a brisk
// jog without launching the user past collision-resolution comfort.
export const DASH_MULTIPLIER = 2.25;

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

// Seated VR offset — additive vertical rig bump when the user toggles
// "Seated mode" in Settings. 0.4m is the convention across Half-Life:
// Alyx, Beat Saber, Unity's XR Toolkit default, etc. — roughly the
// average gap between standing eye height (~1.6m) and seated eye height
// in a chair (~1.2m). The user is sitting; the avatar stands.
export const SEATED_BUMP_M = 0.4;

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

// --- OneDrive / MSAL config ---
//
// To use OneDrive sync you must register a Microsoft Azure AD application
// (free, personal Microsoft account works) and paste your Application
// (client) ID below. Step-by-step: docs/onedrive-setup.md.
//
// `Files.ReadWrite.AppFolder` scope = the app sees ONLY a `RealHome` folder
// inside the user's OneDrive Apps/. We never see their other files. Folder
// is auto-created on first read; users drop .glb files into it.
//
// Azure registration:
//   Display name:       RealHome
//   Supported accounts: All Microsoft account users (personal + work/school)
//   Platform:           SPA (must be SPA, not Web — uses PKCE auth code flow)
//   Redirect URIs:      https://fangzhangmnm.github.io/realhome/  (prod)
//                       http://localhost:8000/                    (local dev)
export const ONEDRIVE_CLIENT_ID = "c987add3-12aa-4e3c-a08a-0c49c80a426e";
// offline_access = give us a refresh token so silent acquireToken works
// across page reloads forever (until user revokes). Without it the user
// has to re-consent every hour-ish when the access token expires.
export const ONEDRIVE_SCOPES = ["Files.ReadWrite.AppFolder", "offline_access"];
// Special Graph path that resolves to the per-user, per-app sandbox folder.
// /me/drive/special/approot is auto-created on first access.
export const ONEDRIVE_APP_ROOT = "/me/drive/special/approot";
// Redirect URI: must EXACTLY match what you registered in Azure. We use the
// page's origin + pathname so it works for both local dev and GitHub Pages.
// Don't include a trailing slash beyond pathname; Azure is strict.
export function onedriveRedirectUri() {
  return location.origin + location.pathname.replace(/\/$/, "/");
}
// True when the user has filled in a real CLIENT_ID. Used as the "is OneDrive
// configured?" gate — without it, the sign-in UI stays hidden and no provider
// gets registered.
export function isOneDriveConfigured() {
  return ONEDRIVE_CLIENT_ID && !ONEDRIVE_CLIENT_ID.startsWith("PASTE_");
}
