// Single owner of "which world is loaded" identity + the in-flight load guard.
//
// This knowledge used to be copy-pasted across app.js: the identity predicate
// appeared 4×, the identity quad was written from 3 sites with inconsistent
// null-handling, and the `if (loading) return; loading = true … finally
// loading = false` busy guard was duplicated 4×. Consolidating it here gives
// the incoming canonical store module ONE seam to drop into.
//
// SCOPE: this module owns ONLY session identity — which world the scene is
// currently showing, and whether a load is in flight. Scene state (root,
// skyboxes, colliders, collision) stays on app.js's own `current` object; it
// is render-side, not session-identity, and another change may touch it.
//
// Identity has two match modes:
//   - cached world:   IDB `id` equality
//   - streamed world:  id is null (not in IDB) → match by source + remoteId
//
// loadedEtag is the remoteEtag of the bytes currently PARSED INTO THE SCENE —
// distinct from the IDB record's etag, which a background refresh can bump
// ahead of what's rendered. handleEnter / liveReloadCurrentWorld compare the
// two to decide whether a re-parse is needed.

const _current = { id: null, source: null, remoteId: null, loadedEtag: null };
let _loading = false;

export const worldSession = {
  // --- identity read access ---
  get id() { return _current.id; },
  get source() { return _current.source; },
  get remoteId() { return _current.remoteId; },
  get loadedEtag() { return _current.loadedEtag; },

  // The ONE identity predicate. True when the given descriptor refers to the
  // world currently parsed into the scene.
  //   - cached:   !!id && id === current.id
  //   - streamed: !!remoteId && source === current.source && remoteId === current.remoteId
  isCurrent({ id, source, remoteId } = {}) {
    return (
      (!!id && id === _current.id) ||
      (!!remoteId && source === _current.source && remoteId === _current.remoteId)
    );
  },

  // The ONLY writer of the identity quad. `record` is an IDB/world record
  // (may be null for the streamed case, where there is no IDB row). `overrides`
  // lets streamOpenWorld pass id=null and an etag from the parse result instead
  // of record.remoteEtag. Convention (unified from 3 previously-inconsistent
  // sites): loadedEtag = record?.remoteEtag ?? null.
  adopt(record, overrides = {}) {
    _current.id = "id" in overrides ? overrides.id : (record?.id ?? null);
    _current.source = "source" in overrides ? overrides.source : (record?.source ?? null);
    _current.remoteId = "remoteId" in overrides ? overrides.remoteId : (record?.remoteId ?? null);
    _current.loadedEtag = "loadedEtag" in overrides
      ? overrides.loadedEtag
      : (record?.remoteEtag ?? null);
  },

  // --- load guard ---
  // beginLoad() returns false if a load is already in flight (callers do
  // `if (!worldSession.beginLoad()) return;`). endLoad() in the finally.
  get loading() { return _loading; },
  beginLoad() {
    if (_loading) return false;
    _loading = true;
    return true;
  },
  endLoad() { _loading = false; },
};
