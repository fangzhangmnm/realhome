// The world-load lifecycle — the ONE owner of "run a world load safely".
//
// Every load (local file ingest, cached switch, uncached stream, live-reload)
// used to hand-code the same skeleton around its own byte-acquisition:
//
//     if (!worldSession.beginLoad()) return;      // busy guard (was 3×)
//     try {
//       …fetch/parse the bytes…                   // the ONLY per-path difference
//       worldSession.adopt(record);               // identity
//       installWorld(result, name);               // destructive scene swap
//       setStatus(…); await renderWorldsList();
//     } catch (err) {
//       console.error(err); setStatus("… failed"); logError(key, …);   // triad (was 3×)
//     } finally {
//       hideLoading(); worldSession.endLoad();     // cleanup (was 3×)
//     }
//
// Consolidating it here removes the triplicated guard/triad/cleanup AND lets the
// two load-ordering invariants live in exactly one place:
//
//   1. INSTALL-THEN-ADOPT. Identity (worldSession) must only ever name a world
//      that was actually shown. `installWorld` runs first; only if it returns
//      without throwing do we adopt. A mid-install failure therefore leaves the
//      previous identity intact instead of pointing at a half-installed world.
//      (installWorld is synchronous — no await between install and adopt — so
//      the pair is atomic w.r.t. anything that reads worldSession.)
//
//   2. GUARD-OWNS-EVERY-EXIT. beginLoad()/endLoad() bracket the whole run in one
//      try/finally, so no path can leak the busy flag by forgetting a `finally`.
//
// SEAM for the future store: this is where real cancellation will live (an
// AbortController created in beginLoad, aborted when a newer load supersedes the
// in-flight one). Today the policy is "a second load while one is in flight is
// DROPPED" (beginLoad returns false) — unchanged here; the seam just has an owner
// now. Note the `interrupt = cancel` red-line is already satisfied: a load that
// never reaches installWorld persists nothing to the scene, and callers that
// persist to IDB (loadFile) write a COMPLETE record before install, so an
// interrupted load leaves a valid saved world, never a half-created one.

export function createWorldLifecycle({
  worldSession,
  installWorld,
  renderWorldsList,
  setStatus,
  hideLoading,
  logError,
}) {
  // Run one load. `acquire` is the per-path async step; it does the loading-UI
  // and the byte fetch/parse, then returns a descriptor:
  //
  //   { result, name, record?, adoptOverrides?, status?, onDone? }
  //
  //   result         parsed glb (from loadGlbFromBlob) — required
  //   name           display name — required
  //   record         IDB/world record for worldSession.adopt (null for streamed)
  //   adoptOverrides  passed as adopt(record, overrides) — e.g. streamed id:null
  //   status         hudStatus text on success (default "")
  //   onDone         optional side-effect after a successful load (e.g. flush)
  //
  // `acquire` may return a falsy value to opt out AFTER the guard was taken
  // (nothing installs; cleanup still runs). Throwing routes to the error triad.
  //
  // `failStatus` is the hudStatus on failure — "load failed" for reads, but
  // loadFile passes "save failed" since its failure is a persist failure.
  //
  // Returns true iff a world was installed + adopted.
  async function run(errorKey, acquire, { failStatus = "load failed" } = {}) {
    if (!worldSession.beginLoad()) return false;
    try {
      const acquired = await acquire();
      if (!acquired) return false;
      const { result, name, record = null, adoptOverrides, status = "", onDone } = acquired;

      // Install-then-adopt (invariant #1). Order matters — do not reorder.
      installWorld(result, name);
      worldSession.adopt(record, adoptOverrides ?? {});

      setStatus(status);
      await renderWorldsList();
      if (onDone) onDone();
      return true;
    } catch (err) {
      console.error(err);
      setStatus(failStatus);
      logError(errorKey, `${err.message || err}`);
      return false;
    } finally {
      hideLoading();
      worldSession.endLoad();
    }
  }

  return { run };
}
