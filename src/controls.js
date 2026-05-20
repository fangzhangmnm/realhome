import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { WALK_SPEED, JUMP_VELOCITY, GRAVITY, GRAVITY_HELD, TERMINAL_VELOCITY, PLAYER_HEIGHT } from "./config.js";

// Flat-mode movement: mouse-look + WASD + space jump.
// No collision yet — that comes when we wire three-mesh-bvh against `_collider` meshes.
// Until then, jump uses a simple Y=0 ground; horizontal is free flight on the XZ plane.

export function createFlatControls(camera, domElement) {
  const controls = new PointerLockControls(camera, domElement);

  const keys = { w: false, a: false, s: false, d: false, space: false };
  const onKey = (down) => (e) => {
    const k = e.code;
    if (k === "KeyW") keys.w = down;
    else if (k === "KeyA") keys.a = down;
    else if (k === "KeyS") keys.s = down;
    else if (k === "KeyD") keys.d = down;
    else if (k === "Space") keys.space = down;
    else return;
    if (down && (k === "Space")) e.preventDefault();
  };
  document.addEventListener("keydown", onKey(true));
  document.addEventListener("keyup", onKey(false));

  let velY = 0;
  let grounded = true;

  // Reused scratch
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();

  function update(dt) {
    // Horizontal movement
    move.set(0, 0, 0);
    if (keys.w) move.z -= 1;
    if (keys.s) move.z += 1;
    if (keys.a) move.x -= 1;
    if (keys.d) move.x += 1;

    if (move.lengthSq() > 0) {
      move.normalize();
      // Pull yaw-only forward / right from the camera (ignore pitch so WASD doesn't fly up)
      camera.getWorldDirection(forward);
      forward.y = 0; forward.normalize();
      right.copy(forward).cross(new THREE.Vector3(0, 1, 0)).normalize();
      const v = new THREE.Vector3()
        .addScaledVector(forward, -move.z)
        .addScaledVector(right, move.x)
        .normalize()
        .multiplyScalar(WALK_SPEED * dt);
      camera.position.add(v);
    }

    // Jump: hold key during ascent = reduced gravity (modeled as "still pushing legs").
    // Release key OR start falling = real 9.8 gravity. See config.js for derivation.
    if (keys.space && grounded) {
      velY = JUMP_VELOCITY;
      grounded = false;
    }
    const isPushingLegs = keys.space && velY > 0;
    const g = isPushingLegs ? GRAVITY_HELD : GRAVITY;
    velY -= g * dt;
    if (velY < -TERMINAL_VELOCITY) velY = -TERMINAL_VELOCITY;
    camera.position.y += velY * dt;

    if (camera.position.y <= PLAYER_HEIGHT) {
      camera.position.y = PLAYER_HEIGHT;
      velY = 0;
      grounded = true;
    }
  }

  // Reset position + look + jump state. Called on world switch so a new world
  // always starts at spawn (origin), not at wherever the old world's exit pose was.
  function reset() {
    camera.position.set(0, PLAYER_HEIGHT, 0);
    camera.quaternion.set(0, 0, 0, 1);  // identity = looking down -Z, level horizon
    velY = 0;
    grounded = true;
    // Clear inputs so a stuck key from before the switch doesn't carry over.
    keys.w = keys.a = keys.s = keys.d = keys.space = false;
  }

  return { controls, update, reset, isLocked: () => controls.isLocked };
}
