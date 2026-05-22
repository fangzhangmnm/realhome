// In-world loading indicator. A textured plane parented to the camera so
// it stays in front of the user in both flat and VR — single code path,
// no need for separate DOM vs 3D versions.
//
// Painted via Canvas2D into a 512x256 CanvasTexture. Animated dots run on
// requestAnimationFrame while visible; tick stops when hidden so we don't
// burn cycles drawing a panel nobody can see.
//
// renderOrder + depthTest=false means the panel paints last, on top of any
// world geometry that happens to be near the camera. (Skybox is fine —
// it's also depthTest=false but with renderOrder=-Infinity, so it draws
// first.) The world stays underneath, but covered by our backdrop fill.

import * as THREE from "three";

const PANEL_W = 0.9;          // metres in front of the camera
const PANEL_H = 0.36;
const PANEL_Z = -1.4;         // depth in front of camera (≥ NEAR clip)
const TEX_W = 512;
const TEX_H = 200;

export function createLoadingPanel(camera) {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;

  const geom = new THREE.PlaneGeometry(PANEL_W, PANEL_H);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(0, 0, PANEL_Z);
  mesh.renderOrder = 9999;
  mesh.frustumCulled = false;
  mesh.visible = false;
  camera.add(mesh);

  let label = "Loading";
  let detail = "";
  let progress = -1;           // -1 = indeterminate; 0..1 = determinate
  let frame = 0;
  let rafId = 0;

  function paint() {
    ctx.clearRect(0, 0, TEX_W, TEX_H);

    // Backdrop card
    ctx.fillStyle = "rgba(11, 13, 16, 0.92)";
    roundRect(ctx, 4, 4, TEX_W - 8, TEX_H - 8, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(232, 214, 168, 0.22)";
    ctx.lineWidth = 2;
    roundRect(ctx, 4, 4, TEX_W - 8, TEX_H - 8, 14);
    ctx.stroke();

    // Primary label
    ctx.fillStyle = "#e8d6a8";
    ctx.font = "600 30px -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const dots = ".".repeat(((frame / 24) | 0) % 4);
    ctx.fillText(label + dots, TEX_W / 2, 60);

    // Detail (file name / size / etc)
    if (detail) {
      ctx.fillStyle = "rgba(232, 214, 168, 0.55)";
      ctx.font = "18px -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
      ctx.fillText(detail, TEX_W / 2, 100);
    }

    // Progress bar
    const barX = 60, barY = 140, barW = TEX_W - 120, barH = 6;
    ctx.fillStyle = "rgba(232, 214, 168, 0.15)";
    roundRect(ctx, barX, barY, barW, barH, 3);
    ctx.fill();
    ctx.fillStyle = "#e8d6a8";
    if (progress >= 0) {
      const w = Math.max(2, Math.min(1, progress) * barW);
      roundRect(ctx, barX, barY, w, barH, 3);
      ctx.fill();
    } else {
      // Indeterminate: 30% slider sweeps across
      const sweepW = barW * 0.3;
      const t = (frame % 90) / 90;
      const x = barX - sweepW + (barW + sweepW) * t;
      const clipX = Math.max(barX, x);
      const clipR = Math.min(barX + barW, x + sweepW);
      if (clipR > clipX) {
        roundRect(ctx, clipX, barY, clipR - clipX, barH, 3);
        ctx.fill();
      }
    }

    texture.needsUpdate = true;
  }

  function tick() {
    frame++;
    paint();
    rafId = requestAnimationFrame(tick);
  }

  return {
    // text:   primary label, e.g. "Loading"
    // detail: secondary (file name, byte counts)
    // fraction: -1 indeterminate, [0,1] determinate
    show(text, detail_ = "", fraction = -1) {
      label = text || "Loading";
      detail = detail_ || "";
      progress = fraction;
      mesh.visible = true;
      if (!rafId) {
        frame = 0;
        rafId = requestAnimationFrame(tick);
      }
    },
    update(text, detail_, fraction) {
      if (text !== undefined) label = text;
      if (detail_ !== undefined) detail = detail_;
      if (fraction !== undefined) progress = fraction;
    },
    hide() {
      mesh.visible = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
