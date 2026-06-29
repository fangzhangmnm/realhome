// Player physics (matches the VR-mode spec — kept here so flat & VR share)
export const WALK_SPEED = 2;               // m/s, hard clip, no acceleration

// Dash — fixed top speed while the dash input is held (flat: Shift / gamepad L3;
// VR: left thumbstick press). FIXED m/s, NOT a multiple of WALK_SPEED, so tuning
// walk never drags dash along. Per design: dash is a placebo "I'm hustling"
// feel, not an objective speed — it doesn't need to be fast. No accel ramp / no
// stamina. Pinned at 5 after the render-interpolation fix made high speeds
// smooth (judder was the only reason 10 was ever on the table). 5 m/s ≈ a brisk
// jog — fast enough to feel like hustling, slow enough to stay comfortable.
export const DASH_SPEED = 5;             // m/s while dashing

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

// Step-UP height: how tall a ledge / threshold / stair the foot auto-climbs.
// It is the levitation of the wall capsule above the foot (the leg zone below
// is free), and the UPWARD reach of the suspension ground probe. The DOWNWARD
// reach is a SEPARATE knob (DETECT_GROUND_DIST) — keeping them split is what
// makes the float robust (see collision.groundProbe).
export const STEP_HEIGHT = 0.3;          // m — Source ~0.4, Unreal ~0.45, ours a bit lower

// Suspension stick-down: how far BELOW the foot the ground probe still grabs a
// floor and holds the body on it (kinematic hard-snap — no 2nd-order spring,
// which would bob the camera and nauseate in VR). SEPARATE from STEP_HEIGHT and
// crouch-INDEPENDENT on purpose: this is the robustness knob, so the float
// doesn't drop you the instant the floor drifts past a tiny tolerance (the old
// ±stepEdge-that-shrank-with-crouch bug). Only when NO floor sits within this
// reach (a real edge) do you go airborne.
export const DETECT_GROUND_DIST = 0.3;   // m below the foot the suspension still grabs

// Ground follow: the foot moves toward the probed floor with a 1st-order ease
// (time constant τ), NEVER an instant snap — the character body is a physical
// entity that always moves continuously (no teleport except explicit respawn /
// world-load). On flat ground the target ≈ current Y so this is a no-op; a step
// up/down eases over ~τ instead of a one-frame jump (a teleport would bob the
// VR camera). 1st-order (no velocity term) so there's no overshoot/bounce.
export const GROUND_FOLLOW_TAU = 0.06;   // s — foot→floor ease time constant

// ── Crouch (VR) ──────────────────────────────────────────────────────────
// The CHARACTER's head height is a state decoupled from the live HMD: the HMD
// is intention input, the character crouches to fit. CROUCH_MIN_HEAD is the
// lowest the character head can drop to — sized so the crouched single-sphere
// body clears a 1 m (Minecraft-block) opening: top = CROUCH_MIN_HEAD, belly
// lower edge = CROUCH_MIN_HEAD − 2·PLAYER_RADIUS = 0.15 m. (Crouch, not crawl —
// Link crawls, we only squat.)
export const CROUCH_MIN_HEAD = 0.75;     // m — character head floor when crouched

// HMD-vs-character head gap (the user standing taller than the character can,
// because the character head is pinned under an overhead) at which the comfort
// vignette is fully black. Past this the near clip plane clips a little — fine.
export const BLACKOUT_GAP = 0.25;        // m of head dislocation → full vignette

// Horizontal move is swept by substepping the discrete capsule resolve: split
// the frame's displacement into chunks of ~SUBSTEP_LEN and resolve each, capped
// at SUBSTEP_CAP chunks. At walking speed (≤5 m/s, 60 Hz → ≤0.08 m/frame ≪ r)
// this is 1 chunk; the cap only bites on a huge single-frame teleport, where we
// accept Mario-style tunnelling rather than spend unbounded queries.
export const SUBSTEP_LEN = 0.3;          // m per sweep substep (~PLAYER_RADIUS)
export const SUBSTEP_CAP = 8;            // max substeps per frame

// Max plausible roomscale head movement in one physics step (60 Hz). Real
// walking is ≤ ~0.1 m/step; anything past this is a non-physical pose jump —
// a Quest "Reset View" recenter or a tracking glitch — which must NOT be
// applied as locomotion (it drags the body into walls / off ledges → fall
// through). Past the threshold we just re-anchor tracking_origin and don't move.
export const MAX_ROOMSCALE_STEP = 0.5;   // m — above this, treat as a tracking jump, not a walk

// Fail fast: if CROUCH_MIN_HEAD drops below 2·PLAYER_RADIUS the crouched
// single-sphere's lower edge (center − r = CROUCH_MIN_HEAD − 2r) goes negative
// — the body sphere would sink below the floor. Catch the misconfig here rather
// than silently clip through the ground.
if (CROUCH_MIN_HEAD < 2 * PLAYER_RADIUS) {
  throw new Error(
    `config: CROUCH_MIN_HEAD (${CROUCH_MIN_HEAD}) must be >= 2*PLAYER_RADIUS (${2 * PLAYER_RADIUS}) ` +
    `or the crouched body sphere dips below the floor`,
  );
}

// Mouse-look sensitivity (flat mode)
export const MOUSE_SENSITIVITY = 0.0022;

// Snap-turn angle (gamepad / VR controllers)
export const SNAP_TURN_DEG = 45;

// Render
export const FOV_DEG = 75;
export const NEAR = 0.05;
export const FAR = 1000;

// Far layer (skybox + distant parallax scenery). In FLAT mode it renders in a
// SEPARATE pass with a much larger frustum so big parallax backdrops aren't
// clipped by the main FAR; the main scene then draws over a cleared depth buffer.
// In XR the runtime owns the projection, so it's a single normal pass (far
// geometry bounded by the session FAR). See docs/world-naming-convention.md and
// app.js renderLayered.
//
// FAR_LAYER MUST be ≥ 3: in WebXR three.js reserves layer 1 = left eye, layer 2 =
// right eye (WebXRManager splits the eye masks &0b011 / &0b101), so a far mesh on
// layer 1/2 would render in ONE eye only, and any layer ≥ 3 is stripped from both
// eyes. So far meshes ALSO stay on layer 0 (the only both-eyes layer) and add
// FAR_LAYER on top — see worldConvention.applySkyboxTweaks.
export const FAR_LAYER = 3;
export const SKY_NEAR = 1;               // m
export const SKY_FAR = 100000;           // m (100 km)

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
