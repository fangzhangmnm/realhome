// glResilience.js —— WebGL 上下文创建失败的韧性模块（深模块）。
//
// WebGL context creation can fail when the system is out of GPU memory (another
// app / the Quest compositor holding it). three throws "Error creating WebGL
// context." This happens at the very top of app boot, so an unguarded throw = a
// dead black screen that SURVIVES reopening (the memory is still held) until a
// full headset restart — exactly the regression the user hit.
//
// This module hides ALL of that recovery machinery behind one call: catch the
// failure, reveal a friendly Chinese retry overlay (index.html #glErrorOverlay),
// and auto-reload with capped exponential backoff so a transient memory spike
// self-heals hands-free; the manual 「重试」button lets the user free memory
// (close other apps) and recover WITHOUT restarting the headset. On success it
// resets the backoff counter. It also owns the `window.__glFatal` handshake that
// tells index.html's generic red error banner to stay quiet — this overlay owns
// the failure's UI. See docs/gl-context-resilience.md.
//
// The retry counter persists across reloads in sessionStorage (survives the
// auto-reload, dies with the tab) so backoff can grow monotonically until it
// caps out on a device that genuinely can't get a context (WebGL disabled,
// driver dead) instead of reload-looping forever.

const RETRY_KEY = "glRetryCount";   // sessionStorage: reloads seen this boot-attempt chain
const MAX_AUTO = 3;                 // hands-free reloads before we stop and wait for the user

function resetBackoff() {
  try { sessionStorage.removeItem(RETRY_KEY); } catch (_) {}
}

// Reveal the overlay, wire its retry button, and schedule the capped auto-retry.
function showFailureOverlay(err) {
  window.__glFatal = true;
  console.error("WebGL context creation failed:", err);
  const ov = document.getElementById("glErrorOverlay");
  if (!ov) { setTimeout(() => location.reload(), 2000); return; }  // old shell w/o overlay → blind retry
  ov.classList.remove("hidden");
  document.getElementById("glErrorRetry")?.addEventListener("click", () => {
    resetBackoff();
    location.reload();
  });

  // Auto-retry with growing delay, capped — a transient spike self-heals
  // hands-free, but we never reload-loop forever on a device that genuinely
  // can't get a context (WebGL disabled, driver dead).
  const note = document.getElementById("glErrorNote");
  let n = 0;
  try { n = parseInt(sessionStorage.getItem(RETRY_KEY) || "0", 10) || 0; } catch (_) {}
  if (n < MAX_AUTO) {
    try { sessionStorage.setItem(RETRY_KEY, String(n + 1)); } catch (_) {}
    const delaySec = Math.round(1.5 * Math.pow(2, n));   // 1.5s → 3s → 6s
    if (note) note.textContent = `正在自动重试…（约 ${delaySec} 秒后）`;
    setTimeout(() => location.reload(), delaySec * 1000);
  } else if (note) {
    note.textContent = "多次重试仍失败。请关闭其他应用释放显存后点「重试」，或重启头显。";
  }
}

// Run the renderer/scene factory guarded. On success: reset the backoff counter
// and return the bundle. On failure: reveal the retry overlay + schedule the
// capped auto-retry, then re-throw so the caller aborts the rest of module init
// (the renderer is required everywhere downstream — a half-built app is worse
// than a clean stop behind the overlay).
export function guardGlContext(createSceneBundle) {
  try {
    const bundle = createSceneBundle();
    resetBackoff();
    return bundle;
  } catch (err) {
    showFailureOverlay(err);
    throw err;
  }
}
