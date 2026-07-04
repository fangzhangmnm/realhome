// The HUD surface — the one owner of the transient menu/overlay DOM: the status
// line, the progress bar, the persistent (deduped) error log, and the "world
// updated upstream" toast. Every bit of transient user-facing text goes through
// here, so the DOM structure + show/hide toggling + the errorEntries dedup live
// in exactly one place instead of smeared across app.js.
//
// DOM handles + makeIcon are injected by the composition root (app.js owns
// document.getElementById). The returned object is destructured back into the
// same names app.js used before, so call sites (setStatus(…), showProgress(…),
// logError(…)) are unchanged.
export function createHud({
  hudStatus,
  progressBar,
  progressFill,
  progressLabel,
  errorLog,
  worldUpdateToast,
  worldUpdateText,
  makeIcon,
}) {
  function setStatus(s) { hudStatus.textContent = s; }

  // Progress bar — fraction in [0, 1] for determinate (download), -1 for
  // indeterminate (optimize). hideProgress() removes the bar.
  function showProgress(label, fraction) {
    progressLabel.textContent = label;
    progressBar.classList.remove("hidden");
    if (fraction < 0) {
      progressFill.classList.add("indeterminate");
      progressFill.style.width = "";
    } else {
      progressFill.classList.remove("indeterminate");
      progressFill.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
    }
  }
  function hideProgress() {
    progressBar.classList.add("hidden");
    progressFill.classList.remove("indeterminate");
    progressFill.style.width = "0%";
  }

  // Loading indicator is just a labelled progress bar. Always DOM-only now: the
  // load-first flow keeps the user in menu state until the world is ready, so the
  // bar is always visible. See docs/20260522-user-flows.md.
  function showLoading(label, detail = "", fraction = -1) {
    const text = detail ? `${label} — ${detail}` : label;
    showProgress(text, fraction);
  }
  function updateLoading(label, detail, fraction) { showLoading(label, detail, fraction); }
  function hideLoading() { hideProgress(); }

  // Persistent error log shown inline in the menu. setStatus() is ephemeral
  // (overwritten by the next op); logError() entries stay until the user
  // dismisses them. `key` dedups repeated errors (e.g. a provider list failing
  // on every menu open) — the same key just refreshes the timestamp.
  const errorEntries = new Map();   // key → { time, msg, node }
  function logError(key, msg) {
    console.warn(`[${key}]`, msg);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    let entry = errorEntries.get(key);
    if (entry) {
      entry.node.querySelector(".error-time").textContent = timeStr;
      entry.node.querySelector(".error-text").textContent = msg;
      entry.time = now;
      entry.msg = msg;
    } else {
      const node = document.createElement("div");
      node.className = "error-entry";
      const t = document.createElement("span");
      t.className = "error-time";
      t.textContent = timeStr;
      const text = document.createElement("span");
      text.className = "error-text";
      text.style.flex = "1";
      text.textContent = msg;
      const x = document.createElement("button");
      x.className = "error-dismiss";
      x.type = "button";
      x.appendChild(makeIcon("x", 12));
      x.addEventListener("click", (ev) => {
        ev.stopPropagation();
        node.remove();
        errorEntries.delete(key);
        if (errorEntries.size === 0) errorLog.classList.add("hidden");
      });
      node.appendChild(t);
      node.appendChild(text);
      node.appendChild(x);
      errorLog.appendChild(node);
      errorEntries.set(key, { time: now, msg, node });
    }
    errorLog.classList.remove("hidden");
  }
  function clearError(key) {
    const entry = errorEntries.get(key);
    if (!entry) return;
    entry.node.remove();
    errorEntries.delete(key);
    if (errorEntries.size === 0) errorLog.classList.add("hidden");
  }

  let worldToastTimer = 0;
  function showWorldUpdateToast(name, isCurrent) {
    worldUpdateText.textContent = isCurrent
      ? `"${name}" was updated upstream. Re-enter to see the new version.`
      : `"${name}" was updated upstream.`;
    worldUpdateToast.classList.remove("hidden");
    clearTimeout(worldToastTimer);
    worldToastTimer = setTimeout(() => worldUpdateToast.classList.add("hidden"), 6000);
  }

  return {
    setStatus,
    showProgress, hideProgress,
    showLoading, updateLoading, hideLoading,
    logError, clearError,
    showWorldUpdateToast,
  };
}
