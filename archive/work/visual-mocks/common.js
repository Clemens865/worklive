import * as T from "three";
import { STATUS, PROVIDER } from "./layout.js";

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Fake browser page drawn onto an agent's monitor. Scrolls while working.
export function createScreen(agent) {
  const canvas = document.createElement("canvas");
  canvas.width = 768; canvas.height = 480;
  const ctx = canvas.getContext("2d");
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  const seed = agent.id.length * 7;
  function draw(t) {
    const W = 768, H = 480;
    ctx.fillStyle = "#f4f5f4"; ctx.fillRect(0, 0, W, H);
    if (agent.status === "idle") {
      ctx.fillStyle = "#1f2a24"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#9fb3a6"; ctx.font = "600 44px -apple-system,sans-serif";
      ctx.fillText("Worklive", 60, 210);
      ctx.font = "26px -apple-system,sans-serif"; ctx.fillStyle = "#6f8277";
      ctx.fillText("Free · waiting for a task", 60, 260);
      tex.needsUpdate = true; return;
    }
    // Browser chrome
    ctx.fillStyle = "#e3e6e4"; ctx.fillRect(0, 0, W, 58);
    ["#ee6a5f", "#f5bd4f", "#61c454"].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(26 + i * 22, 29, 7, 0, 7); ctx.fill(); });
    ctx.fillStyle = "#fff"; roundRect(ctx, 110, 14, 520, 30, 15); ctx.fill();
    ctx.fillStyle = "#58625c"; ctx.font = "18px -apple-system,sans-serif"; ctx.fillText("🔒 " + agent.url, 128, 35);
    // Page content, scrolling
    const scroll = agent.status === "working" ? (t * 38) % 700 : 120;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 58, W, H - 58); ctx.clip();
    ctx.translate(0, -scroll);
    let y = 100;
    for (let block = 0; block < 6; block++) {
      ctx.fillStyle = "#1c2420"; ctx.font = "700 30px -apple-system,sans-serif";
      ctx.fillText(["Build smaller, faster apps", "Features", "Security first", "Getting started", "Plugins", "Community"][(block + seed) % 6], 48, y);
      y += 30;
      if (block % 2 === 0) { ctx.fillStyle = ["#cfe3d8", "#e6dccf", "#d9dff0"][block % 3]; roundRect(ctx, 48, y, 300, 120, 12); ctx.fill(); }
      const tx = block % 2 === 0 ? 372 : 48;
      for (let l = 0; l < 6; l++) {
        ctx.fillStyle = "#9aa39e";
        ctx.fillRect(tx, y + 10 + l * 20, (block % 2 === 0 ? 330 : 660) * (0.55 + 0.45 * Math.abs(Math.sin(l * 3.1 + block + seed))), 9);
      }
      y += 170;
    }
    ctx.restore();
    // Agent highlight: the passage it is reading
    if (agent.status === "working") {
      const hy = 150 + Math.sin(t * 0.7 + seed) * 90;
      ctx.fillStyle = "rgba(52,199,123,.18)"; ctx.fillRect(40, hy, 690, 36);
      ctx.strokeStyle = "rgba(52,199,123,.9)"; ctx.lineWidth = 2; ctx.strokeRect(40, hy, 690, 36);
    }
    if (agent.status === "needs") {
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(0, 58, W, H - 58);
      ctx.fillStyle = "#fff"; roundRect(ctx, 164, 160, 440, 190, 16); ctx.fill();
      ctx.fillStyle = "#f5a524"; ctx.beginPath(); ctx.arc(210, 210, 20, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "700 26px sans-serif"; ctx.fillText("!", 204, 219);
      ctx.fillStyle = "#1c2420"; ctx.font = "600 24px -apple-system,sans-serif"; ctx.fillText("Needs your input", 246, 218);
      ctx.fillStyle = "#6b736e"; ctx.font = "19px -apple-system,sans-serif";
      ctx.fillText("Cookie wall blocks the page.", 196, 270); ctx.fillText("Take control or skip this source?", 196, 298);
    }
    if (agent.status === "review") {
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 58, W, H - 58);
      ctx.fillStyle = "#8b6cf0"; ctx.font = "600 22px -apple-system,sans-serif"; ctx.fillText("✓ Saved landing-copy-v2.md", 48, 110);
      ctx.fillStyle = "#1c2420"; ctx.font = "700 32px Georgia,serif"; ctx.fillText("A little space for big ideas.", 48, 175);
      for (let l = 0; l < 8; l++) { ctx.fillStyle = "#b3bab6"; ctx.fillRect(48, 210 + l * 26, 560 * (0.6 + 0.4 * Math.abs(Math.sin(l * 2.3))), 10); }
    }
    tex.needsUpdate = true;
  }
  return { tex, draw };
}

// Small constant-size name pill, readable from far away.
export function createPill(agent) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 72;
  const ctx = c.getContext("2d");
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  function draw() {
    ctx.clearRect(0, 0, 256, 72);
    ctx.fillStyle = "rgba(255,255,255,.94)"; roundRect(ctx, 4, 8, 248, 56, 28); ctx.fill();
    ctx.fillStyle = PROVIDER[agent.provider].color; ctx.beginPath(); ctx.arc(36, 36, 16, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 17px -apple-system,sans-serif"; ctx.textAlign = "center"; ctx.fillText(agent.name[0], 36, 42);
    ctx.textAlign = "left"; ctx.fillStyle = "#1f2723"; ctx.font = "600 24px -apple-system,sans-serif"; ctx.fillText(agent.name, 62, 44);
    ctx.fillStyle = STATUS[agent.status].color; ctx.beginPath(); ctx.arc(226, 36, 9, 0, 7); ctx.fill();
    tex.needsUpdate = true;
  }
  draw();
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  sprite.scale.set(0.105, 0.03, 1); sprite.renderOrder = 10;
  return { sprite, draw };
}

// Detail card over the desk; fades in when the camera is close.
export function createCard(agent) {
  const c = document.createElement("canvas"); c.width = 640; c.height = 250;
  const ctx = c.getContext("2d");
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
  function draw() {
    ctx.clearRect(0, 0, 640, 250);
    ctx.fillStyle = "rgba(255,255,255,.95)"; roundRect(ctx, 6, 6, 628, 238, 26); ctx.fill();
    const st = STATUS[agent.status], pr = PROVIDER[agent.provider];
    ctx.fillStyle = pr.color; roundRect(ctx, 6, 6, 12, 238, 6); ctx.fill();
    ctx.fillStyle = "#1f2723"; ctx.font = "700 34px -apple-system,sans-serif"; ctx.fillText(agent.name, 40, 56);
    const nameWidth = ctx.measureText(agent.name).width;
    ctx.fillStyle = "#6b736e"; ctx.font = "24px -apple-system,sans-serif"; ctx.fillText(pr.name + " · " + agent.role, 40 + nameWidth + 14, 56);
    ctx.font = "600 22px -apple-system,sans-serif";
    ctx.fillStyle = st.color; roundRect(ctx, 40, 78, ctx.measureText(st.label).width + 36, 36, 18); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "600 22px -apple-system,sans-serif"; ctx.fillText(st.label, 58, 104);
    ctx.fillStyle = "#1f2723"; ctx.font = "26px -apple-system,sans-serif";
    ctx.fillText(agent.task ? agent.task : "No task — click to assign one", 40, 158);
    if (agent.task) {
      ctx.fillStyle = "#e6e9e7"; roundRect(ctx, 40, 186, 480, 14, 7); ctx.fill();
      ctx.fillStyle = st.color; roundRect(ctx, 40, 186, 480 * Math.min(1, agent.step / 40), 14, 7); ctx.fill();
      ctx.fillStyle = "#6b736e"; ctx.font = "20px -apple-system,sans-serif"; ctx.fillText(agent.step + "/40 steps", 534, 199);
    }
    tex.needsUpdate = true;
  }
  draw();
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(0.9, 0.35, 1); sprite.renderOrder = 9;
  return { sprite, draw };
}

// Floating status beacon above a desk: a soft glowing disc that pulses when attention is needed.
export function createBeacon(agent) {
  const g = new T.Group();
  const mat = new T.MeshBasicMaterial({ color: STATUS[agent.status].color, transparent: true, opacity: 0.95, toneMapped: false });
  const orb = new T.Mesh(new T.SphereGeometry(0.045, 20, 14), mat);
  const halo = new T.Mesh(new T.RingGeometry(0.06, 0.1, 32), new T.MeshBasicMaterial({ color: STATUS[agent.status].color, transparent: true, opacity: 0.35, side: T.DoubleSide, toneMapped: false, depthWrite: false }));
  g.add(orb, halo);
  return {
    group: g,
    update(t, camera) {
      const col = STATUS[agent.status].color;
      mat.color.set(col); halo.material.color.set(col);
      const urgent = agent.status === "needs";
      const pulse = urgent ? 0.5 + 0.5 * Math.sin(t * 5) : 0.5 + 0.5 * Math.sin(t * 1.6);
      halo.scale.setScalar(1 + pulse * (urgent ? 0.9 : 0.35));
      halo.material.opacity = 0.45 - pulse * 0.3;
      halo.quaternion.copy(camera.quaternion);
      orb.position.y = Math.sin(t * 2) * 0.02;
    },
  };
}

export function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
