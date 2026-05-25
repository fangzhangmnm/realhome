# Principles — recurring user requirements + design思路

Cross-cutting rules that shaped many decisions in this project. They
came out of pushback from the user during development — most aren't
discoverable from the code alone. Future-me / next AI: apply these by
default in similar projects unless the user says otherwise.

## 1. Single SSoT (Single Source of Truth)

**Rule:** there is one canonical place where a piece of state lives.
Other surfaces (renders, caches) derive from it. Don't maintain two
parallel representations that need to be kept in sync.

**Where this bit us:**
- In-VR menu attempt. Three approaches considered:
  - Native three.js panels: 3D cards built from primitives. Would
    require a parallel UI built on top of the HTML menu — two
    codebases for the same UI, two SSoTs. **Rejected.**
  - HTMLMesh: rasterize the DOM onto a 3D plane. DOM stays the SSoT;
    rasterization is "just a render path." **Acceptable** to user IF
    DOM-Overlay (the preferred path) doesn't work.
  - WebXR `dom-overlay`: browser composites the actual DOM into XR
    view. Same DOM, browser handles render. **Preferred** by user.
    Turned out Quest doesn't support it in immersive-vr; we deferred
    the in-VR menu entirely instead of accepting parallel UIs.

- Loading indicator. Initially had both a 3D `loadingPanel` (camera-
  anchored canvas texture) AND the DOM `#progressBar`. After we moved
  to "load-first" flow, the user was never in XR during a load → 3D
  panel was never visible → dead code. **Deleted.**

**Rule of thumb:** before adding a second render path, ask "could this
be one render of the same SSoT in two states?" If you can't avoid two
paths, you probably have a real second SSoT — and that's the smell.

## 2. Offline-first invariants for PWAs

The app keeps working when Microsoft / GitHub Pages / the user's
network is unavailable. Concretely for RealHome:

| Action | Online | Offline | Microsoft outage |
|---|---|---|---|
| Open menu | ✓ | ✓ (IDB) | ✓ |
| Open bundled world | ✓ | ✓ (cached at first visit) | ✓ |
| Open cached OneDrive world | ✓ | ✓ (IDB blob) | ✓ |
| Open uncached OneDrive world | ✓ | ✗ (need bytes) | ✗ |
| OneDrive sign-in | ✓ | ✗ | ✗ |
| Refresh OneDrive list | ✓ | ✗ (silent fail) | ✗ |

**Three design rules that enforce this:**

1. **Lazy-import the auth bundle.** MSAL is ~660KB. Don't load it
   until the user clicks sign-in or the OneDrive provider's `list()`
   actually runs. Cold-boot offline = no MSAL load = no failure.

2. **Boot path never awaits the auth layer.** MSAL init runs in the
   background; the menu paints cached worlds immediately. Failures
   land in `console.warn`, not the user-visible error log.

3. **Graph failure → fall back to IDB-only listing.** Sibling project
   pattern (`../20260518 JustReadPapers/src/app.js:259-273`): if
   `listChildren()` throws, synthesize the list from `cache.listMeta()`
   so cached items still appear. RealHome gets this for free from the
   render token + progressive paint — cached worlds paint first from
   IDB, providers append async, provider failure is silent.

**The mistake to avoid:** blocking a worlds-list render on a Graph
call. If the menu ever waits for `listChildren()` to resolve, the user
sees a stalled UI on flaky networks. Local-first, append remote.

## 3. Anchor to industry references for game feel

**Rule:** before tuning physics or control numbers, name a concrete
reference game that nails this kind of feel. Adjust from there.

Examples from this project:
- Jump apex: Minecraft (~1.25m baseline) → ours 1.01m, lighter feel
- Variable-jump release/fall gravity: Celeste / Hollow Knight 2× ratio
- Step height: Source ~0.4m / Unreal ~0.45m → ours 0.3m
- Snap-turn angle: Beat Saber / HL:Alyx 45°
- Walk speed: Minecraft ~4.3 m/s → ours 4 m/s
- Seated VR bump: HL:Alyx / Beat Saber / Unity XR Toolkit ~0.4m
- Vignette amount on head-body lag: HL:Alyx

**Why this matters:** "feels heavy / floaty / too sensitive" is
content-dependent. Without an anchor, every tuning round becomes
bikeshedding. Naming the reference makes the discussion about whether
*that game's feel* is what we want — which is concrete and decidable.

This is in user's saved memory as a feedback preference; the user will
push back if you propose numbers without an anchor.

## 4. Consult sibling projects before designing from scratch

The user maintains a family of PWAs in adjacent directories:
- `../20260516 WebXiaoHeiWu/` — note-taking, plain-text + OneDrive sync
- `../20260517 Background Radio/` — audio player + OneDrive sync
- `../20260518 JustReadPapers/` — PDF reader + OneDrive sync

All share the same auth pattern, the same offline-first model, similar
UI conventions (right-drawer settings, hamburger menu). Before
designing a new flow, **grep the siblings** for the same problem.

Examples of cross-pollination in this project:
- MSAL setup (auth.js shape, scopes, redirect flow): from
  JustReadPapers
- Graph helpers (getItemMeta, downloadUrl pattern, chunked upload):
  from WebXiaoHeiWu's `graph.js`
- Offline fallback for listing (synthesize from IDB cache on Graph
  failure): from JustReadPapers's `loadFolderItems`
- Drawer + hamburger UI pattern: from Background Radio
- Sync strategies (writable doc / writable blob / read-only asset):
  three patterns the family already uses

**Lesson:** don't reinvent. Even if the sibling code looks
domain-specific, the *shape* (state machine, error handling, sync
semantics) usually transfers cleanly.

## 5. Vendor every runtime dependency

**Rule:** no CDN runtime dependency. Everything the page needs to run
lives in the repo and is precached by the service worker.

For RealHome, this means:
- three.js + addons → vendored to `src/vendor/three/`
- three-mesh-bvh → `src/vendor/three-mesh-bvh/`
- @azure/msal-browser → bundled as ESM via esbuild to
  `src/vendor/msal/index.js` (~660KB)

Trade-off: repo is larger (~3MB+). Benefits: PWA truly works on first
visit + offline thereafter; no CDN outage can break the app; version
pinning is explicit (look at the file timestamps).

The user explicitly required this. "vendor everything, including ms
auth" — JustReadPapers had previously loaded MSAL from a CDN; for
RealHome we vendored it.

## 6. Atomic operations

If an operation has multiple steps, either all succeed or none does.
No half-states in IDB / no half-states on disk.

Original example: `cacheWorld` used to do "download → optimize →
write IDB". We dropped the optimize pass (it was hanging), but the
principle held — when optimize was in there, failure during optimize
meant no IDB write (caller saw "cache failed"; user retries).

Today: `cacheWorld` is just "download → write IDB". The sidecar
thumbnail fetch is a background follow-up (not part of the atomic
unit) because the user can recover ("no thumbnail" is fine, "no glb"
is broken).

**Apply this when:** you're about to add a "raw" state to a record.
Probably it's wrong; either succeed completely or don't write.

## 7. Confirm before destructive — but don't double-confirm

User clicks × on a cached world → confirm dialog. Hits OK → done.

Don't:
- Add a "are you really really sure" second confirm
- Auto-delete on first click hoping the user reads a toast

Do:
- Make the confirm dialog clear about what's irreversible vs not.
  Local upload deletion is permanent; uncaching a OneDrive world is
  reversible (background sync will re-discover). Word the confirm
  accordingly.
- For OneDrive worlds, two buttons (×: uncache only / 🗑: delete from
  OneDrive too) — distinct blast radius warrants distinct controls.

## 8. Menu-first boot — don't auto-load anything

**Rule:** on cold start, the user lands in a menu. They explicitly pick
what to enter. Don't auto-load the previous world.

**Why:**
- VR entry requires a user gesture. Auto-loading and trying to enter
  VR programmatically would fail.
- The user might have closed the previous session intentionally
  (paused, switched contexts). Auto-loading is presumptuous.
- "Menu-first" is a clean, predictable mental model. Users always know
  where they are.

The cost: extra click per session. Worth it.

## 9. Use sidecars over runtime generation

When the user-visible content depends on per-asset data, prefer asset-
side conventions (artist drops a file alongside the main asset) over
runtime-generating it.

Sidecar PNG thumbnails (see `docs/sidecar-thumbnails.md`) are an
instance. Runtime rendering was fragile across XR boundaries; sidecar
is just a file lookup with `<img onerror>` fallback. The artist owns
the preview frame — usually they have a better idea than our auto-
framed camera anyway.

Generalize: when you're tempted to write "render-to-buffer + cache
in IDB", check whether the artist could provide it as a sidecar.

## 10. Don't optimize at runtime in the client

We had an optimize pass via `gltf-transform` (prune + dedup). It
hung on certain inputs, only saved ~10-30% on already-tidy Blender
exports, and added complexity. We dropped it entirely.

If size becomes a problem later: do it server-side (artist's
build pipeline, OneDrive ingest hook, whatever). Don't make every
client redo the same work on every cache.

## Validation note

Each principle above is supported by something we built (or built then
removed) in this project — not a "what I think might be good." If a
principle stops being demonstrated by the code, take it off the list.
