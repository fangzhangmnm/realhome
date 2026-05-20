import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// V0 loader: parse glb/gltf, pull out skybox + collider meshes by naming convention.
// Later we'll wire DRACOLoader + KTX2Loader + MeshoptDecoder here.
//
// Returns: { root, skyboxes, colliders }
//   - root: THREE.Group with the loaded scene (skybox tweaks + colliders already applied in-place)
//   - skyboxes: array of mesh refs flagged as skybox (visible, but rendered as backdrop)
//   - colliders: array of mesh refs flagged as collider (visible=false, geometry retained for raycast)

const loader = new GLTFLoader();

// Word-boundary match: matches "skybox", "_skybox", "xxx_skybox", "skybox.001", etc.
// Does NOT match "skyboxer" / "myskyboxstuff". Same for collider.
const SKYBOX_RE   = /(^|[_\-\s.])skybox($|[_\-\s.\d])/i;
const COLLIDER_RE = /(^|[_\-\s.])collider($|[_\-\s.\d])/i;

export async function loadGlbFromBlob(blob, name = "world") {
  const buf = await blob.arrayBuffer();
  return parseGlb(buf, name);
}

export async function loadGlbFromFile(file) {
  return loadGlbFromBlob(file, file.name);
}

export async function loadGlbFromURL(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch ${url}: ${resp.status}`);
  const buf = await resp.arrayBuffer();
  return parseGlb(buf, url.split("/").pop() || url);
}

export function parseGlb(arrayBuffer, label = "world") {
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, "", (gltf) => {
      const root = gltf.scene || gltf.scenes?.[0];
      if (!root) return reject(new Error("glTF has no scene"));
      root.name = label;

      const skyboxes = extractSkyboxes(root);
      const colliders = extractColliders(root);
      resolve({ root, skyboxes, colliders });
    }, (err) => reject(err));
  });
}

function extractSkyboxes(root) {
  const found = [];
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    if (matches(obj, SKYBOX_RE)) {
      applySkyboxTweaks(obj);
      found.push(obj);
    }
  });
  return found;
}

function extractColliders(root) {
  const found = [];
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    if (matches(obj, COLLIDER_RE)) {
      obj.visible = false;       // don't render, but keep geometry for raycast/BVH
      obj.userData.isCollider = true;
      found.push(obj);
    }
  });
  return found;
}

// Match against Blender Object name OR Material name. Object name = glTF node
// name = three.js mesh.name; parent.name is the containing Empty's Object name
// (lets you tag a whole subtree). Mesh-data names intentionally not checked —
// Object names already cover that surface.
function matches(mesh, re) {
  if (re.test(mesh.name || "")) return true;
  if (re.test(mesh.parent?.name || "")) return true;
  const mats = Array.isArray(mesh.material) ? mesh.material : (mesh.material ? [mesh.material] : []);
  return mats.some((m) => m.name && re.test(m.name));
}

// Render-first skybox: renderOrder = -Infinity + depthWrite=false + depthTest=false
// → skybox paints the whole framebuffer first, scene draws on top with normal depth.
// Trade ~5% pixel cost over the "render-last with depth=1 trick" for not having to
// care about the skybox sphere's actual radius vs scene extents.
function applySkyboxTweaks(mesh) {
  mesh.frustumCulled = false;
  mesh.renderOrder = -Infinity;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of mats) {
    if (!m) continue;
    m.depthWrite = false;
    m.depthTest = false;
    m.fog = false;
    m.toneMapped = m.toneMapped ?? true;
  }
}
