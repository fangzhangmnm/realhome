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

// Ground-probe sample offsets (× 0.7·radius): foot centre + a 4-point ring.
const GROUND_SAMPLES = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

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
  // Foot Y (step / stick) is handled by groundProbe after this.
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

  // Suspension ground sense (CharacterMotor-style, kinematic). Returns the
  // highest floor the foot rides on, or null for a real drop (→ airborne).
  //
  // The search band is asymmetric and the two reaches are SEPARATE knobs:
  //   • up to `stepUp` ABOVE the foot  → auto-step height (the leg zone is free)
  //   • down to `stickDown` BELOW       → how far the foot still grabs ground.
  // `stickDown` is generous and FIXED (independent of crouch) — that decoupling
  // is what makes the float robust: you don't fall the instant the floor drifts
  // past a tiny step tolerance.
  //
  // Sampling: foot centre + a 4-point ring at 0.7·radius, so a seam/edge under
  // one sample doesn't drop the whole probe, and standing on a ledge edge keeps
  // you up while ANY sample finds floor. Rays are FrontSide (overheads culled),
  // and the origin starts at foot+stepUp so anything taller than a step is below
  // the origin and simply ignored. Highest in-band hit wins (stand on the
  // tallest support under the footprint).
  function groundProbe(pos, stepUp, stickDown) {
    const top = pos.y + stepUp;          // ray origin: nothing taller than a step is hit
    const lo = pos.y - stickDown;        // lowest floor we still grab
    const off = PLAYER_RADIUS * 0.7;
    let best = null;
    for (let i = 0; i < GROUND_SAMPLES.length; i++) {
      const sx = GROUND_SAMPLES[i][0] * off;
      const sz = GROUND_SAMPLES[i][1] * off;
      _ray.origin.set(pos.x + sx, top, pos.z + sz);
      _ray.direction.set(0, -1, 0);
      let closest = null;
      for (const g of geoms) {
        const hit = g.boundsTree.raycastFirst(_ray, THREE.FrontSide);
        if (hit && (!closest || hit.distance < closest.distance)) closest = hit;
      }
      if (!closest) continue;
      const floorY = top - closest.distance;
      if (floorY < lo - 1e-4) continue;                 // out of reach below → not support
      if (best === null || floorY > best) best = floorY;
    }
    return best;
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

  // Read-only: how high the CHARACTER head can rise from `lo` toward `hi` (the
  // HMD intention) before its top sphere would hit an overhead. This is a
  // CONTINUOUS (conservative swept-sphere) scan UP from lo — NOT an endpoint
  // test. An endpoint test is wrong: if `hi` lands in a void ABOVE a thin wall
  // (e.g. the room space over a window lintel), the head would teleport THROUGH
  // the wall to that clear spot. Scanning up and stopping at the first blocked
  // sample keeps "the head sphere never enters geometry" an invariant — the head
  // bonks the lintel and stays clamped (→ blackout) instead of popping through.
  // The 5 cm step is far smaller than the head sphere's 0.6 m diameter, so the
  // samples overlap and nothing thin slips between them.
  function clearHeadHeight(x, y, z, lo, hi, slack = 0.02) {
    const r = PLAYER_RADIUS;
    if (hi <= lo) return hi;
    const STEP = 0.05;
    let reached = lo;                          // lo is clear by invariant (last frame held it)
    for (let h = lo + STEP; h < hi; h += STEP) {
      if (spherePenetrates(x, y, z, h - r, r, slack)) return reached;   // hit → stop below it
      reached = h;
    }
    if (!spherePenetrates(x, y, z, hi - r, r, slack)) return hi;        // path clear all the way
    return reached;
  }

  function dispose() {
    for (const g of geoms) g.dispose();
  }

  return {
    resolveCapsule, groundProbe, headPenetration, clearHeadHeight,
    dispose, lowerBound,
  };
}
