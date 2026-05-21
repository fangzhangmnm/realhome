// Lazy-loaded gltf-transform pipeline. We dynamic-import so the ~150KB of
// gltf-transform code only fetches when an actual optimization runs (most
// boots use cached IDB blobs and never need it). The CDN URLs are SW-precached
// so the first import is fast and works offline thereafter.
//
// V1: pure-JS transforms only — prune (drop unreferenced accessors/textures/
// materials) + dedup (merge duplicate textures/materials/accessors).
//
// Intentionally NOT in V1:
//   - flatten — collapses the scenegraph hierarchy. We keep it so future
//     features (animation, interactive bits, per-node tagging like `_collider`)
//     can use the named nodes. The hierarchy is rarely the size win anyway.
//   - KTX2 / Basis texture compression (needs ~3MB wasm transcoder)
//   - Draco / meshopt mesh compression (needs encoder wasm)
//   - weld / simplify (geometric — can affect collider matching)
// These can be added behind a setting once content scale demands them.

let modulesPromise = null;
async function loadModules() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      import("@gltf-transform/core"),
      import("@gltf-transform/extensions"),
      import("@gltf-transform/functions"),
    ]).then(([core, ext, fns]) => ({ core, ext, fns }));
  }
  return modulesPromise;
}

// Run the optimization on a glb blob/ArrayBuffer. Returns a new Uint8Array of
// the optimized glb. Throws on parse / transform failure — caller is expected
// to fall back to the original blob in that case.
export async function optimizeGlb(input) {
  const buf = input instanceof Uint8Array
    ? input
    : new Uint8Array(input instanceof ArrayBuffer ? input : await input.arrayBuffer());

  const { core, ext, fns } = await loadModules();
  const { WebIO } = core;
  const { ALL_EXTENSIONS } = ext;
  const { prune, dedup } = fns;

  const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(buf);
  await doc.transform(
    prune(),
    dedup(),
  );
  return await io.writeBinary(doc);
}
