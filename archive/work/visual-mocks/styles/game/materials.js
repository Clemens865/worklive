import * as T from "three";

// Procedural textures (canvas) and a shared material cache for the "Game" style.
const texCache = new Map();
function canvas(w, h = w) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function toTex(c, { srgb = true, repeat = [1, 1] } = {}) {
  const t = new T.CanvasTexture(c);
  if (srgb) t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  return t;
}
function cached(key, make) { if (!texCache.has(key)) texCache.set(key, make()); return texCache.get(key); }

// Height canvas -> tangent-space normal canvas.
function heightToNormal(src, strength = 2) {
  const w = src.width, h = src.height, sd = src.getContext("2d").getImageData(0, 0, w, h).data;
  const [c, g] = canvas(w, h), out = g.createImageData(w, h), d = out.data;
  const H = (x, y) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x - 1, y) - H(x + 1, y)) * strength, dy = (H(x, y - 1) - H(x, y + 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(out, 0, 0); return c;
}

// Woven fabric height: fine twill weave.
function weaveHeight(size = 128, cells = 32, seed = 3) {
  const [c, g] = canvas(size), r = rng(seed), s = size / cells;
  g.fillStyle = "#808080"; g.fillRect(0, 0, size, size);
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    const over = ((x + y) % 4) < 2, v = over ? 170 + r() * 50 : 70 + r() * 30;
    const grad = g.createLinearGradient(x * s, y * s, x * s + (over ? s : 0), y * s + (over ? 0 : s));
    grad.addColorStop(0, `rgb(${v * 0.7},${v * 0.7},${v * 0.7})`); grad.addColorStop(0.5, `rgb(${v},${v},${v})`); grad.addColorStop(1, `rgb(${v * 0.7},${v * 0.7},${v * 0.7})`);
    g.fillStyle = grad; g.fillRect(x * s, y * s, s, s);
  }
  return c;
}
export const fabricNormal = (kind = "twill") => cached("fab" + kind, () => {
  const h = kind === "knit" ? knitHeight() : kind === "denim" ? weaveHeight(256, 96, 9) : kind === "quilt" ? quiltHeight() : weaveHeight(128, 48, 3);
  return toTex(heightToNormal(h, kind === "knit" ? 3 : kind === "quilt" ? 6 : 1.6), { srgb: false, repeat: kind === "knit" ? [6, 6] : kind === "quilt" ? [1, 5] : [10, 10] });
});
function quiltHeight() {
  const [c, g] = canvas(64, 64), gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, "#111"); gr.addColorStop(0.15, "#aaa"); gr.addColorStop(0.5, "#fff"); gr.addColorStop(0.85, "#aaa"); gr.addColorStop(1, "#111");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
}
function knitHeight(size = 128) {
  const [c, g] = canvas(size); g.fillStyle = "#555"; g.fillRect(0, 0, size, size);
  const cols = 16, rows = 16, cw = size / cols, rh = size / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) for (const sgn of [-1, 1]) {
    g.save(); g.translate(x * cw + cw / 2 + sgn * cw * 0.22, y * rh + rh / 2); g.rotate(sgn * 0.5);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rh * 0.6); gr.addColorStop(0, "#eee"); gr.addColorStop(1, "#555");
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, cw * 0.24, rh * 0.62, 0, 0, 7); g.fill(); g.restore();
  }
  return c;
}

// Soft mottled noise (roughness / skin variation).
export const noiseTex = (seed = 1, size = 256, lo = 110, hi = 170) => cached(`noise${seed}${size}${lo}${hi}`, () => {
  const [c, g] = canvas(size), r = rng(seed);
  g.fillStyle = `rgb(${(lo + hi) / 2 | 0},${(lo + hi) / 2 | 0},${(lo + hi) / 2 | 0})`; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    const v = lo + r() * (hi - lo) | 0, rad = 1 + r() * size * 0.05;
    g.fillStyle = `rgba(${v},${v},${v},0.18)`; g.beginPath(); g.arc(r() * size, r() * size, rad, 0, 7); g.fill();
  }
  return toTex(c, { srgb: false, repeat: [2, 2] });
});

// Skin pores normal map.
export const skinNormal = () => cached("skinN", () => {
  const [c, g] = canvas(256), r = rng(77); g.fillStyle = "#888"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { const v = 90 + r() * 60 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 1.5, 1 + r() * 1.5); }
  const t = toTex(heightToNormal(c, 1.2), { srgb: false, repeat: [3, 3] }); return t;
});

// Oak planks / veneer.
export const woodTex = (base = "#8a6242", seed = 5, planks = 6, w = 1024, h = 1024) => cached(`wood${base}${seed}${planks}`, () => {
  const [c, g] = canvas(w, h), r = rng(seed), col = new T.Color(base);
  const ph = h / planks;
  for (let p = 0; p < planks; p++) {
    const k = 0.85 + r() * 0.3, cc = col.clone().multiplyScalar(k);
    g.fillStyle = `#${cc.getHexString()}`; g.fillRect(0, p * ph, w, ph);
    for (let l = 0; l < 70; l++) {
      const y0 = p * ph + r() * ph, amp = 2 + r() * 6, fr = 0.002 + r() * 0.01, ph0 = r() * 10;
      g.strokeStyle = `rgba(${r() < 0.5 ? "40,24,12" : "255,235,200"},${0.04 + r() * 0.1})`; g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + Math.sin(x * fr + ph0) * amp + Math.sin(x * fr * 3.1) * amp * 0.3); g.stroke();
    }
    if (r() < 0.5) { const kx = r() * w, ky = p * ph + ph * 0.5; for (let i = 0; i < 8; i++) { g.strokeStyle = "rgba(50,28,12,.18)"; g.beginPath(); g.ellipse(kx, ky, 6 + i * 5, 3 + i * 2, 0, 0, 7); g.stroke(); } }
    g.fillStyle = "rgba(20,12,6,.55)"; g.fillRect(0, p * ph, w, 2);
    const off = r() * w; g.fillRect(off, p * ph, 2, ph);
  }
  return toTex(c);
});

// Polished concrete floor.
export const concreteTex = () => cached("concrete", () => {
  const [c, g] = canvas(1024), r = rng(11);
  g.fillStyle = "#8d8a85"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9000; i++) {
    const v = 110 + r() * 70 | 0, rad = r() < 0.97 ? 1 + r() * 3 : 20 + r() * 90;
    g.fillStyle = `rgba(${v},${v - 2},${v - 6},${rad > 10 ? 0.05 : 0.25})`; g.beginPath(); g.arc(r() * 1024, r() * 1024, rad, 0, 7); g.fill();
  }
  g.strokeStyle = "rgba(40,38,35,.5)"; g.lineWidth = 2;
  for (const p of [0, 512]) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 1024); g.moveTo(0, p); g.lineTo(1024, p); g.stroke(); }
  return toTex(c, { repeat: [5, 3.5] });
});
export const concreteRough = () => cached("concreteR", () => { const t = noiseTex(12, 512, 70, 200).clone(); t.repeat.set(5, 3.5); t.needsUpdate = true; return t; });

// Brushed metal roughness (anisotropic look).
export const brushedTex = () => cached("brushed", () => {
  const [c, g] = canvas(256), r = rng(21); g.fillStyle = "#777"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 600; i++) { const v = 80 + r() * 110 | 0; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.fillRect(0, r() * 256, 256, 0.5 + r()); }
  return toTex(c, { srgb: false, repeat: [1, 1] });
});

// Upholstery / rug fabric colour texture.
export const feltTex = (base, seed = 4) => cached("felt" + base + seed, () => {
  const [c, g] = canvas(256), r = rng(seed), col = new T.Color(base);
  g.fillStyle = `#${col.getHexString()}`; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) { const k = 0.85 + r() * 0.3, cc = col.clone().multiplyScalar(k); g.fillStyle = `#${cc.getHexString()}`; g.fillRect(r() * 256, r() * 256, 1, 2 + r() * 2); }
  return toTex(c, { repeat: [3, 3] });
});

// Plaster wall.
export const plasterTex = () => cached("plaster", () => {
  const [c, g] = canvas(512), r = rng(31); g.fillStyle = "#d9d3c9"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3000; i++) { const v = 200 + r() * 40 | 0; g.fillStyle = `rgba(${v},${v - 5},${v - 12},.12)`; g.beginPath(); g.arc(r() * 512, r() * 512, 2 + r() * 14, 0, 7); g.fill(); }
  return toTex(c, { repeat: [4, 1] });
});

// ---------- Material cache ----------
const matCache = new Map();
export function std(color, o = {}) {
  const key = "s" + color + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (!matCache.has(key)) matCache.set(key, new T.MeshStandardMaterial({ color, roughness: 0.6, ...o }));
  return matCache.get(key);
}
export function phys(color, o = {}) {
  const key = "p" + color + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (!matCache.has(key)) matCache.set(key, new T.MeshPhysicalMaterial({ color, roughness: 0.6, ...o }));
  return matCache.get(key);
}
// Cloth: sheen + woven normal map, shared per colour/kind.
export function cloth(color, kind = "twill", o = {}) {
  const sheenCol = new T.Color(color).lerp(new T.Color("#ffffff"), 0.35);
  return phys(color, { roughness: kind === "denim" ? 0.85 : 0.78, sheen: 1, sheenRoughness: 0.55, sheenColor: sheenCol,
    normalMap: fabricNormal(kind), normalScale: new T.Vector2(0.55, 0.55), ...o });
}
// Skin: physical with sheen + a warm subsurface-ish rim via onBeforeCompile.
export function skin(color, vc = false) {
  const key = "skin" + color + vc;
  if (matCache.has(key)) return matCache.get(key);
  const m = new T.MeshPhysicalMaterial({ color, roughness: 0.62, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new T.Color("#ff9d80"),
    normalMap: skinNormal(), normalScale: new T.Vector2(0.18, 0.18), clearcoat: 0.04, clearcoatRoughness: 0.6,
    roughnessMap: noiseTex(9, 256, 120, 180), vertexColors: vc });
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <opaque_fragment>", `
      { float nv = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        vec3 sss = vec3(0.55, 0.12, 0.06) * pow(1.0 - nv, 2.5) * 0.35;
        outgoingLight += sss * diffuseColor.rgb * 1.6 + diffuseColor.rgb * vec3(0.06, 0.015, 0.0); }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => "gameSkin";
  matCache.set(key, m); return m;
}
