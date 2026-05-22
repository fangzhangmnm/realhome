// Render a parsed glb scene to a PNG thumbnail.
//
// We use a SEPARATE renderer (not the main XR-enabled one) so this is safe
// to call while the user is anywhere — including mid-XR if we ever want to.
// The main renderer's framebuffer + render-target state is untouched.
//
// Sizing: 384px square is the highest quality we'll ever display
// (card-grid cell at 2x DPI ~ 380px). Above that wastes bytes; below
// hits a noticeable softness. Stored as PNG (alpha kept for skybox-less
// scenes that show as transparent over the menu background).
//
// Camera framing: front-elevated 30° angle, autofit to bounding box of
// non-collider, non-skybox meshes. Conservative padding (1.4× radius)
// avoids clipping the corners of square / boxy rooms.

import * as THREE from "three";

const SIZE = 384;
const FOV = 35;                  // degrees; smaller than gameplay (75) → less distortion
const VIEW_DIR = new THREE.Vector3(0.5, 0.4, 1).normalize();
const PADDING = 1.4;

const SKYBOX_RE   = /(^|[_\-\s.])skybox($|[_\-\s.\d])/i;
const COLLIDER_RE = /(^|[_\-\s.])collider($|[_\-\s.\d])/i;

// rootGroup is the .scene from GLTFLoader output (THREE.Group). We don't
// clone — instead we temporarily add to our own scene, render, remove. The
// caller can then attach the same Group to the main scene without GPU
// resource duplication.
export async function renderThumbnail(rootGroup) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Match the main renderer's tonemapping policy (None) — baked textures
  // are the final shaded color, ACES would crush them.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x141618, 0);    // alpha=0 transparent

  const scene = new THREE.Scene();
  // Lighting that mirrors the main scene defaults so PBR materials don't
  // turn into flat black silhouettes in the preview.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 0.9));
  const dir = new THREE.DirectionalLight(0xffeecc, 1.1);
  dir.position.set(5, 10, 4);
  scene.add(dir);

  const previousParent = rootGroup.parent;
  scene.add(rootGroup);
  rootGroup.updateMatrixWorld(true);

  try {
    const box = computeContentBounds(rootGroup);
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 1000);
    if (box.isEmpty()) {
      camera.position.set(3, 2.5, 3);
      camera.lookAt(0, 0, 0);
    } else {
      const center = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() * 0.5;
      const dist = (radius * PADDING) / Math.tan((FOV * Math.PI / 180) * 0.5);
      camera.position.copy(VIEW_DIR).multiplyScalar(dist).add(center);
      camera.lookAt(center);
    }

    renderer.render(scene, camera);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    // Detach so caller's main scene can take ownership again.
    scene.remove(rootGroup);
    if (previousParent) previousParent.add(rootGroup);
    renderer.dispose();
  }
}

// Bounds of the renderable, non-skybox, non-collider content. Skybox is
// huge (it surrounds the world) and would force the camera to zoom out so
// far the actual room becomes a dot. Colliders are invisible meshes — also
// often huge and bounding-box-shaped — same issue.
function computeContentBounds(root) {
  const box = new THREE.Box3();
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const name = obj.name || "";
    const parentName = obj.parent?.name || "";
    if (SKYBOX_RE.test(name) || SKYBOX_RE.test(parentName)) return;
    if (COLLIDER_RE.test(name) || COLLIDER_RE.test(parentName)) return;
    if (obj.userData?.isCollider) return;
    box.expandByObject(obj);
  });
  return box;
}
