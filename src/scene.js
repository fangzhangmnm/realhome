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
  // No tonemapping. Worlds are baked-lighting glbs — the texture data IS the
  // final shaded color. ACES would re-compress highlights/mids and make every
  // baked scene look murky. NoToneMapping keeps texture-as-authored.
  renderer.toneMapping = THREE.NoToneMapping;

  // WebXR. local-floor reference space puts y=0 at the user's actual floor;
  // their head pose is reported relative to that, so the scene's spawn at the
  // origin lines up with the headset wearer standing at origin.
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Default lights — used by any world whose materials respond to lighting
  // (most baked-lit glbs ignore lights entirely). Cheap; keep them around
  // so the first installWorld doesn't need to set up its own.
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffeecc, 1.1);
  dir.position.set(5, 10, 4);
  scene.add(dir);

  // No placeholder geometry. Before the user picks a world, the canvas is
  // pure black — the menu overlay shows on top. Avoids the "what is this
  // floating cube?" moment, and means we don't have to dispose anything
  // on first installWorld.

  // Player rig: the locomotion anchor (feet on floor). Camera is a child of it,
  // offset upward by PLAYER_HEIGHT for flat-mode head pose. In XR, the headset
  // pose overrides camera.position; the rig still provides locomotion offset
  // and snap-turn rotation.
  const playerRig = new THREE.Group();
  playerRig.name = "playerRig";
  scene.add(playerRig);

  const camera = new THREE.PerspectiveCamera(FOV_DEG, window.innerWidth / window.innerHeight, NEAR, FAR);
  // Local to rig. Must be (0, PLAYER_HEIGHT, 0) so the head sits directly above
  // the rig's feet — otherwise the collision capsule (centered on rig) would be
  // offset from where the camera renders, producing "I hit an invisible wall N
  // meters ahead of the visible wall" misalignment. In XR the headset overrides
  // this each frame.
  camera.position.set(0, PLAYER_HEIGHT, 0);
  playerRig.add(camera);

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
    worldRoot.add(group);
    worldRoot.visible = true;
  }

  // Toggle visibility of the entire world (skybox + meshes + everything).
  // Used to "black out" mid-transition so the user doesn't see the previous
  // world's geometry while the next one is parsing. Cheap — three.js skips
  // traversal entirely when visible=false.
  function setWorldVisible(visible) {
    worldRoot.visible = visible;
  }

  return { renderer, scene, camera, playerRig, worldRoot, setWorld, setWorldVisible };
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
