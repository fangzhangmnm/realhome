import * as THREE from "three";

// HL:A-style "head in wall" vignette. A sphere attached to the camera, rendered
// last with depth off. Fragment shader fades from clear (looking direction) to
// black (FOV edges) — when `amount` is small the dark band is at the periphery
// only; as `amount` grows the clear circle shrinks toward the center, eventually
// fully black at amount = 1.
//
// Visible only in VR. Flat mode never sets amount > 0 (the only way to move the
// player is via the rig, which is collision-bounded — no "head goes into wall"
// case to surface).

const VERTEX = /* glsl */`
  varying vec3 vLocalDir;
  void main() {
    vLocalDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Camera forward in camera-local space is -Z. `vLocalDir.z` runs from -1 at
// the front of the sphere (looking direction) to +1 at the back.
// `forwardness` = how aligned with looking direction (1 at center, 0 at edge,
// -1 at back). Angle from forward = acos(forwardness).
const FRAGMENT = /* glsl */`
  uniform float amount;
  varying vec3 vLocalDir;
  void main() {
    float forwardness = -vLocalDir.z;                 // 1 = center, -1 = back
    float clearAngle = mix(2.4, 0.0, amount);         // radians of clear cone
    float fadeWidth  = 0.5;                           // ramp width
    float angle = acos(clamp(forwardness, -1.0, 1.0));
    float a = smoothstep(clearAngle, clearAngle + fadeWidth, angle);
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }
`;

export function createVignette(camera) {
  const geom = new THREE.SphereGeometry(0.5, 24, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: { amount: { value: 0 } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.BackSide,                   // see the inside of the sphere
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10_000;                // draw last so it covers everything
  camera.add(mesh);

  let smoothed = 0;
  // First-order lerp with τ = 100ms — fast enough to feel responsive, slow
  // enough to not flicker on jittery penetration depths near the threshold.
  const TAU = 0.10;

  // target ∈ [0, 1]
  function update(target, dt) {
    const alpha = 1 - Math.exp(-dt / TAU);
    smoothed += (target - smoothed) * alpha;
    mat.uniforms.amount.value = smoothed;
  }

  function dispose() {
    camera.remove(mesh);
    geom.dispose();
    mat.dispose();
  }

  return { update, dispose };
}
