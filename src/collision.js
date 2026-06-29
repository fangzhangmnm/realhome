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

  // Capsule sphere layout for a given character head height. The TOP sphere
  // sits at headHeight − r (its top edge = headHeight). The BOTTOM (belly)
  // sphere sits at min(STEP_HEIGHT + r, top) — so when standing it stays at the
  // fixed step offset, and when the head drops low enough (crouch) it follows
  // the top down, collapsing toward a single sphere. The belly sphere's LOWER
  // EDGE (= bottomY − r) is the one unified "step height" / wall-ignore floor:
  // 0.3 standing, shrinking to 0.15 at full crouch (CROUCH_MIN_HEAD). The leg
  // zone below it is invisible to the wall capsule (auto-step), and ground-snap
  // uses the same edge (see player.stepEdge).
  function capsuleSpheres(headHeight) {
    const r = PLAYER_RADIUS;
    const topY = headHeight - r;
    const bottomY = Math.min(STEP_HEIGHT + r, topY);
    const midY = (bottomY + topY) * 0.5;
    const degenerate = topY <= bottomY + 0.01;     // crouched / short — 1 sphere
    return { r, topY, bottomY, midY, degenerate };
  }

  // Push `pos` (a Vector3) out of walls / ceiling. pos is mutated in place.
  // Step Y is handled by groundCheck snapping after this.
  function resolveCapsule(pos, headHeight) {
    const { r, topY, bottomY, midY, degenerate } = capsuleSpheres(headHeight);
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

  // Floor Y under `pos` (or null if nothing below). Cast straight down from a
  // point just `castUp` above the feet — NOT from head height. raycastFirst
  // returns the CLOSEST hit below the origin, so a high origin (e.g. tied to a
  // standing head) can sit ABOVE an overhead surface — a window lintel or a low
  // ceiling — and that overhead gets returned as "floor" (DoubleSide hits it
  // from the top), which then reads as a huge drop and the player falls through
  // the real floor below. `castUp` only needs to clear the tallest auto-step
  // (≈ stepEdge), keeping the origin safely under any ceiling the player fits
  // beneath. The caller still filters the result to ±stepEdge.
  function groundCheck(pos, castUp) {
    _ray.origin.set(pos.x, pos.y + castUp, pos.z);
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

  // Read-only: would a sphere of `radius` centered at (x, y + offsetY, z)
  // penetrate any collider by more than `slack`? Halts on the first hit (no
  // depth accumulation — caller only needs a yes/no). Sibling of
  // pushSphereOnce / headPenetration but non-mutating.
  function spherePenetrates(x, y, z, offsetY, radius, slack) {
    _sphereCenter.set(x, y + offsetY, z);
    _box.min.set(_sphereCenter.x - radius, _sphereCenter.y - radius, _sphereCenter.z - radius);
    _box.max.set(_sphereCenter.x + radius, _sphereCenter.y + radius, _sphereCenter.z + radius);
    const thr = radius - slack;          // overlap deeper than slack = blocked
    const thrSq = thr * thr;
    let hit = false;
    for (const g of geoms) {
      g.boundsTree.shapecast({
        intersectsBounds: (box) => !hit && box.intersectsBox(_box),
        intersectsTriangle: (tri) => {
          tri.closestPointToPoint(_sphereCenter, _triPoint);
          if (_sphereCenter.distanceToSquared(_triPoint) < thrSq) { hit = true; return true; }  // true → halt
          return false;
        },
      });
      if (hit) break;
    }
    return hit;
  }

  // Read-only: would the player's HEAD (top capsule sphere) be embedded in a
  // wall if the rig stood at (x, y, z) with the given CHARACTER head height?
  // Used to VETO an upward ground-snap onto a ledge too short for the body —
  // e.g. a window opening lower than the head: snapping the feet onto the sill
  // would shove the head into the wall above, so we refuse and let the player
  // fall back instead of clipping in. Only the top sphere is tested — lower
  // spheres near a wall at floor level are the normal "standing beside a wall"
  // case and must not block legit step-ups. Fed the CHARACTER head (charHeadY,
  // not the live HMD): crouching to a real lower charHeadY lets you mount a
  // short sill, then standing up is gated by clearHeadHeight + blackout.
  function headBlocked(x, y, z, headHeight, slack = 0.02) {
    const { r, topY } = capsuleSpheres(headHeight);
    return spherePenetrates(x, y, z, topY, r, slack);
  }

  // Read-only: the highest character head height in [lo, hi] whose TOP sphere
  // stays clear of geometry at (x, y, z). Used to resolve the crouch: the HMD
  // (intention) wants to rise to `hi`, but an overhead keeps the CHARACTER head
  // clamped — return how far it can actually stand. Fast path when `hi` is
  // already clear (the common case); otherwise step down in 5 cm increments to
  // the first clear height. The character head pinned below the HMD is what
  // drives the comfort blackout.
  function clearHeadHeight(x, y, z, lo, hi, slack = 0.02) {
    const r = PLAYER_RADIUS;
    if (hi <= lo) return hi;
    if (!spherePenetrates(x, y, z, hi - r, r, slack)) return hi;
    const STEP = 0.05;
    for (let h = hi - STEP; h > lo; h -= STEP) {
      if (!spherePenetrates(x, y, z, h - r, r, slack)) return h;
    }
    return lo;
  }

  function dispose() {
    for (const g of geoms) g.dispose();
  }

  return {
    resolveCapsule, groundCheck, headPenetration, headBlocked, clearHeadHeight,
    dispose, lowerBound,
  };
}
