// Render a parsed glb scene to a PNG thumbnail.
//
// Uses the MAIN renderer with a render target rather than spinning up a
// second WebGLRenderer per call. The old "new WebGLRenderer per thumbnail"
// approach silently failed on Quest mid-XR session — browsers limit
// concurrent WebGL contexts and an XR-active runtime tends to be the one
// holding the active context. Render targets are cheap, share the
// renderer's GL context, and work whether or not an XR session is live.
//
// Sizing: 384px square. Stored as PNG.
//
// Camera framing: front-elevated angle, autofit to bounding box of
// non-collider, non-skybox meshes.

import * as THREE from "three";

const SIZE = 384;
const FOV = 35;
const VIEW_DIR = new THREE.Vector3(0.5, 0.4, 1).normalize();
const PADDING = 1.4;

const SKYBOX_RE   = /(^|[_\-\s.])skybox($|[_\-\s.\d])/i;
const COLLIDER_RE = /(^|[_\-\s.])collider($|[_\-\s.\d])/i;

// One-time scene + render-target setup. Subsequent calls reuse the same
// scene (just reparent the world group in/out), the same render target
// (just clear), and the same canvas (just over-write pixels).
let _scene = null;
let _camera = null;
let _renderTarget = null;
let _canvas = null;
let _ctx = null;
let _flipBuffer = null;

function ensureSetup() {
  if (_scene) return;
  _scene = new THREE.Scene();
  // Same lighting policy as the main scene defaults.
  _scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 0.9));
  const dir = new THREE.DirectionalLight(0xffeecc, 1.1);
  dir.position.set(5, 10, 4);
  _scene.add(dir);
  _camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 1000);
  _renderTarget = new THREE.WebGLRenderTarget(SIZE, SIZE, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
  });
  _canvas = document.createElement("canvas");
  _canvas.width = _canvas.height = SIZE;
  _ctx = _canvas.getContext("2d");
  _flipBuffer = new Uint8ClampedArray(SIZE * SIZE * 4);
}

// rootGroup is the .scene from GLTFLoader output. We temporarily reparent
// to our private scene, render, then reattach to the caller's parent.
// mainRenderer is the live three.js renderer (the one driving canvas + XR).
export async function renderThumbnail(rootGroup, mainRenderer) {
  ensureSetup();

  const previousParent = rootGroup.parent;
  _scene.add(rootGroup);
  rootGroup.updateMatrixWorld(true);

  try {
    // Frame the camera to the renderable content.
    const box = computeContentBounds(rootGroup);
    if (box.isEmpty()) {
      _camera.position.set(3, 2.5, 3);
      _camera.lookAt(0, 0, 0);
    } else {
      const center = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() * 0.5;
      const dist = (radius * PADDING) / Math.tan((FOV * Math.PI / 180) * 0.5);
      _camera.position.copy(VIEW_DIR).multiplyScalar(dist).add(center);
      _camera.lookAt(center);
    }
    _camera.updateProjectionMatrix();

    // Render into our target. XR's framebuffer + viewport state remain
    // untouched as long as we save + restore the render target. three.js's
    // XR manager only re-asserts its target on the next animation frame.
    const prevTarget = mainRenderer.getRenderTarget();
    const prevAutoClear = mainRenderer.autoClear;
    const prevClearColor = mainRenderer.getClearColor(new THREE.Color());
    const prevClearAlpha = mainRenderer.getClearAlpha();

    mainRenderer.setRenderTarget(_renderTarget);
    mainRenderer.setClearColor(0x141618, 1);
    mainRenderer.autoClear = true;
    mainRenderer.clear();
    mainRenderer.render(_scene, _camera);

    mainRenderer.setRenderTarget(prevTarget);
    mainRenderer.setClearColor(prevClearColor, prevClearAlpha);
    mainRenderer.autoClear = prevAutoClear;

    // Read back pixels (bottom-up; we flip on the way into the canvas).
    const pixels = new Uint8Array(SIZE * SIZE * 4);
    mainRenderer.readRenderTargetPixels(_renderTarget, 0, 0, SIZE, SIZE, pixels);

    const stride = SIZE * 4;
    for (let y = 0; y < SIZE; y++) {
      const srcRow = (SIZE - 1 - y) * stride;
      const dstRow = y * stride;
      _flipBuffer.set(pixels.subarray(srcRow, srcRow + stride), dstRow);
    }
    const imageData = new ImageData(_flipBuffer, SIZE, SIZE);
    _ctx.putImageData(imageData, 0, 0);

    return await new Promise((resolve) => _canvas.toBlob(resolve, "image/png"));
  } finally {
    _scene.remove(rootGroup);
    if (previousParent) previousParent.add(rootGroup);
  }
}

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
