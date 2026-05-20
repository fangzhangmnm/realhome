# RealHome

**Your custom home, back on Quest.**

Drop in a `.glb`, step inside. No app store. No servers. No strings.

→ **[Open in browser →](https://fangzhangmnm.github.io/realhome/)**

---

## Three things that make this different

### No app to install
RealHome is a webpage. Open it in your Quest browser, tap *Add to home*, and it's there — no Meta store review, no waiting, no version mismatch. Updates apply the next time you open it.

### No servers. Your worlds, yours alone.
Everything stays on your device — in Quest's local storage, or in *your* OneDrive folder if you want sync across devices. There is no backend, no analytics, no account. The entire app is the static page you're reading from. Source open.

### Save in Blender. See it on Quest.
Export your scene as glTF straight to your OneDrive folder. Put on the headset. It's there, exactly as you saved it. No build step, no upload form, no plugin, no compile. Edit, save, look — that's the whole loop.

---

## How to use

**Quest:**
1. Open <https://fangzhangmnm.github.io/realhome/> in Quest browser
2. Tap the install icon → *Add to home*
3. Drop a `.glb` in. Tap the card. You're inside.

**Desktop preview:** Open the same URL in any modern browser. <kbd>WASD</kbd> to walk, mouse to look, <kbd>Space</kbd> to jump, <kbd>Esc</kbd> for the menu.

---

## Tagging things in your scene

Name objects (or materials) in Blender to give them meaning:

- Anything named `_collider` → solid. You can walk on it, you can't walk through it.
- Anything named `_skybox` → backdrop. Renders behind everything else.

1m in Blender = 1m in your home. Scene origin `(0, 0, 0)` is where you spawn.

---

*By [@fangzhangmnm](https://github.com/fangzhangmnm). Built with [Claude Code](https://claude.com/claude-code).*
