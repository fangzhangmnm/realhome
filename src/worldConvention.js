import * as THREE from "three";
import { FAR_LAYER } from "./config.js";

// ── World naming convention — the single source of truth ─────────────────────
// One pass over a loaded glb scene classifies every node by name and applies the
// family's authoring convention in place. worldLoader delegates here; nothing
// else in the app needs to know the tokens.
//
// THREE ORTHOGONAL AXES, carried by THREE different naming surfaces so a single
// mesh can opt into any combination:
//
//   • COLLISION  ← OBJECT name (or its parent's) ends in `_col` / `_collider`.
//                  Mesh joins the collision BVH. Visibility is NOT touched.
//   • NODRAW     ← MATERIAL name ends in `_col` / `_collider`.
//                  That material draws nothing (a collision-proxy material).
//   • FAR LAYER  ← OBJECT or MATERIAL name contains `skybox`.
//                  Distant backdrop (skybox dome + far parallax scenery).
//
// The collision/nodraw split is the whole point: object-name drives collision,
// material-name drives hiding, so the SAME mesh can both render and collide —
//
//   object `wall_col`   + normal material  → visible AND collides   (one mesh, both)
//   object `proxy_col`   + material `col`   → invisible collider     (low-poly proxy)
//   plain object         + material `col`   → invisible, no collision
//   plain object         + normal material  → visible, no collision  (decor)
//
// SPAWN (object named `spawn`) is a separate marker handled in the same pass.
//
// Tokens are case-INSENSITIVE. `col` / `collider` must be the whole name or the
// trailing segment after `_ - . space` — so `wall_col` / `pillar.collider` match
// but `protocol` / `column` / `collider_wall` do NOT. `skybox` / `spawn` keep the
// looser "word-boundary anywhere" rule for backward compatibility.

// Suffix-only: whole name, or trailing segment after a separator.
const COL_RE = /(^|[_\-\s.])(col|collider)$/i;
// Word-boundary anywhere (legacy form): `skybox`, `_skybox`, `skybox.001`, …
// NOT `skyboxer`. Semantically this is the "far layer", not just a sky dome —
// see docs/20260626-world-naming-convention.md. `skybox` kept as the token for
// familiarity + backward compatibility.
const SKYBOX_RE = /(^|[_\-\s.])skybox($|[_\-\s.\d])/i;
const SPAWN_RE  = /(^|[_\-\s.])spawn($|[_\-\s.\d])/i;

function matList(mesh) {
  return Array.isArray(mesh.material)
    ? mesh.material
    : (mesh.material ? [mesh.material] : []);
}

// Single traverse. Returns { skyboxes, colliders, spawn }; mutates the scene in
// place (visibility / render tweaks / userData flags).
export function classifyWorld(root) {
  const skyboxes = [];
  const colliders = [];
  let spawn = null;

  root.traverse((obj) => {
    // Spawn marker: any Object3D (Empty is fine), first match in traversal wins.
    if (!spawn && SPAWN_RE.test(obj.name || "")) spawn = readSpawn(obj);
    if (!obj.isMesh) return;

    const name = obj.name || "";
    const parentName = obj.parent?.name || "";
    const mats = matList(obj);

    // Far layer first: a skybox is never also a collider/nodraw target.
    if (
      SKYBOX_RE.test(name) ||
      SKYBOX_RE.test(parentName) ||
      mats.some((m) => m?.name && SKYBOX_RE.test(m.name))
    ) {
      applySkyboxTweaks(obj, mats);
      skyboxes.push(obj);
      return;
    }

    // Collision (object/parent name). Orthogonal to visibility.
    if (COL_RE.test(name) || COL_RE.test(parentName)) {
      obj.userData.isCollider = true;
      colliders.push(obj);
    }

    // Nodraw (material name). Orthogonal to collision.
    applyNodrawMaterials(obj, mats);
  });

  return { skyboxes, colliders, spawn };
}

// MATERIAL-driven hide. Careful with multi-material meshes (a glTF mesh can hold
// several materials, one per geometry group):
//   • every material is a proxy → skip the whole mesh draw (cheapest).
//   • MIXED (some proxy, some real) → can't hide the mesh without dropping the
//     real groups, so neutralise ONLY the proxy groups (no color, no depth) and
//     leave the mesh drawing its real parts. Warn, because it's usually an
//     authoring slip. NOTE: this mutates the material — don't share a `col`
//     material with a mesh you want visible elsewhere.
function applyNodrawMaterials(mesh, mats) {
  if (!mats.length) return;
  const proxies = mats.filter((m) => m?.name && COL_RE.test(m.name));
  if (!proxies.length) return;

  if (proxies.length === mats.length) {
    mesh.visible = false;
    return;
  }
  for (const m of proxies) {
    m.colorWrite = false;
    m.depthWrite = false;
  }
  console.warn(
    `[world] mesh "${mesh.name}" mixes a collision-proxy material with real ones; hiding only the proxy group.`,
  );
}

// Spawn: world-space position + Y rotation as the player's reset target. Pitch /
// roll dropped (player stands upright). Returns { position, rotation } or null.
function readSpawn(marker) {
  marker.updateMatrixWorld(true);
  const position = new THREE.Vector3();
  marker.getWorldPosition(position);
  const quat = new THREE.Quaternion();
  marker.getWorldQuaternion(quat);
  const euler = new THREE.Euler().setFromQuaternion(quat, "YXZ");
  return { position, rotation: euler.y };
}

// Far layer: ENABLE FAR_LAYER on top of layer 0 (not .set, which would drop
// layer 0). Layer 0 keeps it visible to both XR eye cameras (which only ever see
// layers {0,1}/{0,2}); FAR_LAYER lets flat mode isolate it into its own large-
// frustum pass. See app.js renderLayered + config.FAR_LAYER for the WebXR
// eye-layer trap. Depth is kept ON (no depthTest hack) so multiple far parallax
// meshes sort against each other. World transforms are preserved — distance from
// the camera still varies as the player walks, so parallax is intact (never
// camera-locked). frustumCulled off so the dome isn't culled when the camera sits
// inside it; fog off so the backdrop isn't tinted.
function applySkyboxTweaks(mesh, mats) {
  mesh.layers.enable(FAR_LAYER);
  mesh.frustumCulled = false;
  for (const m of mats) {
    if (!m) continue;
    m.fog = false;
    m.toneMapped = m.toneMapped ?? true;
  }
}
