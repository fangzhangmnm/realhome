import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { PLAYER_RADIUS, STEP_HEIGHT } from "./config.js";

// Static-world collision: builds a BVH per collider mesh at world-load time
// (the world doesn't move during play, so the BVH bakes mesh.matrixWorld in).
//
// Player body is approximated as three spheres (feet / mid / head) along the
// camera's local Y. Each sphere queries the BVH for overlapping triangles and
// pushes the rig out. Iterates up to 5× per frame for convergence at corners.
//
// Ground: cast a ray straight down from above the head. The Y of the first hit
// is the floor Y at the rig's xz. Player snaps to it when within a small
// tolerance and not actively rising.

const _box = new THREE.Box3();
const _sphereCenter = new THREE.Vector3();
const _triPoint = new THREE.Vector3();
const _push = new THREE.Vector3();
const _ray = new THREE.Ray();

export function createCollision(colliderMeshes) {
  // Bake matrixWorld into a cloned geometry so the BVH is in world space.
  // Cloning means disposing the player-facing world later doesn't kill our copy.
  const geoms = [];
  let lowerBound = Infinity;  // lowest Y of any collider, for the respawn check
  for (const mesh of colliderMeshes) {
    mesh.updateMatrixWorld(true);
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    g.boundsTree = new MeshBVH(g);
    g.computeBoundingBox();
    if (g.boundingBox.min.y < lowerBound) lowerBound = g.boundingBox.min.y;
    geoms.push(g);
  }

  // Push `pos` out of any triangles overlapping a sphere centered at
  // (pos.x, pos.y + offsetY, pos.z). pos is mutated in place. Returns true if
  // any push happened. Caller passes either rig.position (rig collision) or a
  // scratch body-tracking vector (VR head-follow-body, no rig effect).
  function pushSphereOnce(pos, offsetY, radius) {
    let pushed = false;
    _sphereCenter.set(pos.x, pos.y + offsetY, pos.z);
    _box.min.set(
      _sphereCenter.x - radius,
      _sphereCenter.y - radius,
      _sphereCenter.z - radius,
    );
    _box.max.set(
      _sphereCenter.x + radius,
      _sphereCenter.y + radius,
      _sphereCenter.z + radius,
    );

    for (const g of geoms) {
      g.boundsTree.shapecast({
        intersectsBounds: (box) => box.intersectsBox(_box),
        intersectsTriangle: (tri) => {
          tri.closestPointToPoint(_sphereCenter, _triPoint);
          const dx = _sphereCenter.x - _triPoint.x;
          const dy = _sphereCenter.y - _triPoint.y;
          const dz = _sphereCenter.z - _triPoint.z;
          const dSq = dx * dx + dy * dy + dz * dz;
          if (dSq < radius * radius && dSq > 1e-12) {
            const d = Math.sqrt(dSq);
            const overlap = radius - d;
            _push.set(dx / d, dy / d, dz / d).multiplyScalar(overlap);
            pos.add(_push);
            _sphereCenter.add(_push);
            _box.translate(_push);
            pushed = true;
          }
        },
      });
    }
    return pushed;
  }

  // Push `pos` (a Vector3) out of walls / ceiling. pos is mutated in place.
  // The capsule covers ONLY [STEP_HEIGHT, headHeight] on Y — the leg zone below
  // is invisible to the wall capsule, so small thresholds auto-step instead of
  // blocking. Step Y is handled by groundCheck snapping after this.
  function resolveCapsule(pos, headHeight) {
    const r = PLAYER_RADIUS;
    const bottomY = STEP_HEIGHT + r;
    const topY = Math.max(headHeight - r, bottomY);
    const midY = (bottomY + topY) * 0.5;
    const degenerate = topY <= bottomY + 0.01;     // very crouched user — 1 sphere
    for (let i = 0; i < 5; i++) {
      const a = pushSphereOnce(pos, bottomY, r);
      let b = false, c = false;
      if (!degenerate) {
        b = pushSphereOnce(pos, midY, r);
        c = pushSphereOnce(pos, topY, r);
      }
      if (!a && !b && !c) break;
    }
  }

  // Floor Y under `pos` (or null if no floor within head-height + ε). Cast from
  // above the head so a tall step in front doesn't shadow the floor below the
  // feet.
  function groundCheck(pos, headHeight) {
    _ray.origin.set(pos.x, pos.y + headHeight, pos.z);
    _ray.direction.set(0, -1, 0);
    let closest = null;
    for (const g of geoms) {
      const hit = g.boundsTree.raycastFirst(_ray, THREE.DoubleSide);
      if (hit && (!closest || hit.distance < closest.distance)) {
        closest = hit;
      }
    }
    if (!closest) return null;
    return _ray.origin.y - closest.distance;
  }

  // Penetration of a sphere centered at `point` (world coords) with `radius`.
  // Returns the max overlap depth (0 if no overlap). Used by the VR vignette
  // — query the camera world position to detect when the user has physically
  // moved their HMD into geometry.
  function headPenetration(point, radius) {
    let maxOverlap = 0;
    _sphereCenter.copy(point);
    _box.min.set(point.x - radius, point.y - radius, point.z - radius);
    _box.max.set(point.x + radius, point.y + radius, point.z + radius);
    for (const g of geoms) {
      g.boundsTree.shapecast({
        intersectsBounds: (box) => box.intersectsBox(_box),
        intersectsTriangle: (tri) => {
          tri.closestPointToPoint(_sphereCenter, _triPoint);
          const dSq = _sphereCenter.distanceToSquared(_triPoint);
          if (dSq < radius * radius) {
            const overlap = radius - Math.sqrt(dSq);
            if (overlap > maxOverlap) maxOverlap = overlap;
          }
        },
      });
    }
    return maxOverlap;
  }

  function dispose() {
    for (const g of geoms) g.dispose();
  }

  return { resolveCapsule, groundCheck, headPenetration, dispose, lowerBound };
}
