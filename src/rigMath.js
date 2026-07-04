// Pure rig-projection math for VR locomotion. Feel-sensitive — behavior must
// stay byte-identical to the inlined formulas it replaces. Caller owns how a
// yaw becomes (cos, sin) — that convention varies per call site, so it is NOT
// hidden in here.
//
// rotateXZ rotates a 2D vector (x, z) by the angle whose cosine is `cos` and
// sine is `sin`, using the exact convention the player rig uses:
//   out.x =  cos*x + sin*z
//   out.z = -sin*x + cos*z
// (This is R(+yaw)·[x;z] with the sign convention where cos=Math.cos(rot),
// sin=Math.sin(rot); i.e. rotation by −rot in standard XZ, matching the
// captureRigState / roomscale-projection / snap-turn call sites verbatim.)
//
// Writes into `out` {x, z} to avoid per-frame allocation on the render-interp
// hot path. Uses local temps so aliasing `out` with an input source is safe.
export function rotateXZ(x, z, cos, sin, out) {
  const rx =  cos * x + sin * z;
  const rz = -sin * x + cos * z;
  out.x = rx;
  out.z = rz;
  return out;
}
