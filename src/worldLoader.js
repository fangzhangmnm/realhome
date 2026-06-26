import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { classifyWorld } from "./worldConvention.js";

// V0 loader: parse glb/gltf, then hand the scene to worldConvention.classifyWorld
// which pulls out the far layer (skybox), collider meshes and spawn marker by
// naming convention. All convention knowledge lives in worldConvention.js — this
// file is just glTF IO. Later we'll wire DRACOLoader + KTX2Loader + MeshoptDecoder.
//
// Returns: { root, skyboxes, colliders, spawn }
//   - root: THREE.Group with the loaded scene (tweaks already applied in-place)
//   - skyboxes: far-layer meshes (skybox dome + far parallax), rendered as backdrop
//   - colliders: meshes flagged for the collision BVH (may also be visible)
//   - spawn: { position, rotation } | null

const loader = new GLTFLoader();

// No KTX2 / Draco / Meshopt decoders — we don't ship the wasm. glbs must be
// plain (PNG/JPEG textures, uncompressed mesh accessors). For artists who
// want compressed assets, that work happens server-side / before upload;
// we'll render whatever GLTFLoader can decode natively.
export function bindRenderer(/* renderer */) {
  // no-op; kept for API stability with app.js
}

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

      const { skyboxes, colliders, spawn } = classifyWorld(root);
      resolve({ root, skyboxes, colliders, spawn });
    }, (err) => reject(err));
  });
}
