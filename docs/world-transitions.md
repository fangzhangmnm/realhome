# World transitions — load order, user gesture, transition UX

The "click a world card → end up inside the world" flow looks trivial.
It took several iterations to land on a flow that doesn't strand the
user mid-transition or burn their user-gesture activation. This doc
captures the path we walked and the constraints that pinned us.

## The constraint that drives everything

`navigator.xr.requestSession("immersive-vr")` and `element.requestPointerLock()`
both require "transient user activation" — a token Chrome grants
synchronously when the user clicks, valid for roughly 5 seconds. If your
code awaits something for longer than that window, the activation
expires and the request rejects.

Naive code: `click → await load(); await requestSession()` — fails
silently when the load is slow.

## Iterations we tried

### Attempt 1: Enter VR first, load after

```js
function handleEnter() {
  enterVR();              // synchronous, uses the click gesture
  await switchToWorld();  // load while the session boots
}
```

**Problem.** While the world parses, the OLD world is still in the
scene. Quest user clicks card 2 → menu hides → still inside world 1 →
sudden jump to world 2. Felt like a bug.

### Attempt 2: Enter VR first + blackout the old world

Same flow as attempt 1, but at the top of switchToWorld:

```js
worldRoot.visible = false;    // hide the previous world
await parseAndInstall();
worldRoot.visible = true;     // setWorld inside install restores
```

**Problem.** The user explicitly didn't like this. The loading panel
covered the view, but VR users perceived it as "I'm in VR but there's
nothing here, then suddenly a world appears." Felt like a glitch
rather than a transition.

### Attempt 3: Load first, then enter

```js
async function handleEnter() {
  const gestureTime = performance.now();
  await switchToWorld();    // load while still in menu state
  // Was the gesture still valid?
  if (performance.now() - gestureTime < GESTURE_WINDOW_MS) {
    enterVR();              // gesture is still valid, fire it
  } else {
    showEnterPrompt();      // ask for a fresh gesture
  }
}
```

This is the current model. The previous world stays in the scene during
load but is invisible because the menu DOM covers the canvas — no
flash. `setWorld()` does an atomic swap (single frame).

**`GESTURE_WINDOW_MS = 4000`** — Chrome's window is ~5s; we use 4s
margin. For cached worlds (parse ~50-200ms) this is always within
window. For uncached OneDrive downloads (several seconds), the user
hits the enter-prompt fallback path.

## The enter-prompt fallback

When load took too long:

```html
<div id="enterPrompt">
  <p>Ready</p>
  <p id="enterPromptName">house.glb</p>
  <button>Tap to enter</button>
  <button class="cancel">Cancel</button>
</div>
```

Full-screen overlay, dismisses on tap. User's click on the button
provides a fresh user activation, which `enterVR()` consumes
immediately. Cancel just leaves the world loaded in the scene; user
stays in menu. Re-clicking the card now hits the `isCurrent` fast path
(world already loaded) and enters directly.

## What the loading indicator does

We had a 3D textured plane parented to the camera at one point
("loadingPanel"). It existed because the "enter VR first" attempts
needed an in-XR-visible indicator. Once we switched to "load first,"
the indicator was never visible mid-XR — the user is in the menu DOM
the whole time. So the 3D plane was deleted and we use the DOM
`#progressBar` at the top of the menu.

Lesson: stop maintaining a UI element the moment the flow no longer
puts the user in a state where they'd see it. Don't keep "just in
case" code that adds two render paths.

## `document.title` for the Quest panel header

When user is in immersive-vr, Quest's regular 2D browser tab shows a
"running in background" placeholder. Below that header, the Quest
browser displays the page's `document.title`. If you don't update it,
the user sees "RealHome" — fine, but uninformative.

Set `document.title = "RealHome — " + worldName` in `installWorld()` so
the Quest panel header reads cleanly. Costs one line, removes a small
WTF.

## Atomic scene swap

`scene.setWorld(newRoot)`:

```js
disposeChildren(worldRoot);       // dispose old geometry/textures
while (worldRoot.children.length)
  worldRoot.remove(worldRoot.children[0]);
worldRoot.add(newRoot);
worldRoot.visible = true;
```

This runs in one event-loop tick — three.js doesn't render between
`remove()` and `add()`. No "empty world frame" is visible even if you
weren't covering with the menu DOM.

Important: the menu's DOM covers the canvas during load, so the swap
isn't observable to the user. That's the actual reason there's no
flash, not the atomic operation itself.

## Camera quaternion reset on world swap (flat only)

In flat mode, `PointerLockControls` owns `camera.quaternion` (mouse-
look state). `player.reset()` doesn't touch camera quaternion because
in VR that's the HMD pose — not ours to write.

On world swap in flat mode you'd land in the new world with whatever
pitch/yaw your mouse left off in the previous world. Often you're
looking 60° up at the sky. Fix:

```js
player.reset();
if (!renderer.xr.isPresenting) camera.quaternion.identity();
```

VR path untouched (HMD owns the quaternion in XR).

## Spawn point convention

Player resets to `(0, 0, 0)` by default, which is often inside a wall
or under the floor depending on how the artist set up Blender's
coordinates. Better: let the artist place a `spawn` Empty in the glb.

```js
// worldLoader.extractSpawn
const SPAWN_RE = /(^|[_\-\s.])spawn($|[_\-\s.\d])/i;
// Find an Object3D matching this regex, take world-space position +
// Y rotation, drop pitch/roll (player stands upright)
```

Player.setSpawnPoint(spawnInfo) is called before reset() in installWorld.
HUD status appends "spawn" badge so artist can confirm pickup.

## Files

- [src/app.js](../src/app.js) — `handleEnter`, `switchToWorld`,
  `streamOpenWorld`, enter-prompt wiring
- [src/scene.js](../src/scene.js) — `setWorld`
- [src/player.js](../src/player.js) — `setSpawnPoint`, `reset`
- [src/worldLoader.js](../src/worldLoader.js) — `extractSpawn`
- [docs/user-flows.md](user-flows.md) — the whole state model this
  fits into
