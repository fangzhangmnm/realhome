import * as THREE from "three";
import { FOV_DEG, NEAR, FAR, PLAYER_HEIGHT } from "./config.js";

// Owns: renderer, scene, camera, lights, and a `worldRoot` Group that holds the
// currently loaded glb. Swapping worlds = remove children of worldRoot + dispose.

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // WebXR. local-floor reference space puts y=0 at the user's actual floor;
  // their head pose is reported relative to that, so the scene's spawn at the
  // origin lines up with the headset wearer standing at origin.
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d10);

  // Default placeholder env (used until a glb provides a real skybox)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffeecc, 1.1);
  dir.position.set(5, 10, 4);
  scene.add(dir);

  // Reference floor (only shown when no world is loaded yet)
  const grid = new THREE.GridHelper(20, 20, 0x44423c, 0x2a2926);
  grid.position.y = 0;
  grid.name = "__placeholderGrid";
  scene.add(grid);

  // Placeholder cube so the user sees something even before they pick a file
  const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
  const cubeMat = new THREE.MeshStandardMaterial({ color: 0xe8d6a8, roughness: 0.6, metalness: 0.0 });
  const cube = new THREE.Mesh(cubeGeo, cubeMat);
  cube.position.set(0, 0.5, -2);
  cube.name = "__placeholderCube";
  scene.add(cube);

  const camera = new THREE.PerspectiveCamera(FOV_DEG, window.innerWidth / window.innerHeight, NEAR, FAR);
  camera.position.set(0, PLAYER_HEIGHT, 3);
  camera.lookAt(0, PLAYER_HEIGHT, 0);

  const worldRoot = new THREE.Group();
  worldRoot.name = "worldRoot";
  scene.add(worldRoot);

  resize();
  window.addEventListener("resize", resize);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setWorld(group) {
    // Dispose old contents
    disposeChildren(worldRoot);
    while (worldRoot.children.length) worldRoot.remove(worldRoot.children[0]);

    // Hide placeholder grid/cube once we have real content
    const grid = scene.getObjectByName("__placeholderGrid");
    if (grid) grid.visible = false;
    const cube = scene.getObjectByName("__placeholderCube");
    if (cube) cube.visible = false;

    worldRoot.add(group);
  }

  return { renderer, scene, camera, worldRoot, setWorld };
}

function disposeChildren(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        for (const k of Object.keys(m)) {
          const v = m[k];
          if (v && v.isTexture) v.dispose();
        }
        m.dispose();
      }
    }
  });
}
