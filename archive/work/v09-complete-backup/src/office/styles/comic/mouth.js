import * as T from "three";
import { toon, flat } from "./toon.js";

// Procedural cartoon mouth: a curved strip rebuilt from a few parameters each frame.
// params: smile (-1..1), open (0..1), width (0.6..1.3), skew (-1..1), teeth (0..1), tongue (0..1)
const N = 14;
function stripGeo() {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(new Float32Array((N + 1) * 2 * 3), 3));
  g.setAttribute("normal", new T.BufferAttribute(new Float32Array((N + 1) * 2 * 3).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  const idx = [];
  for (let i = 0; i < N; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
  g.setIndex(idx);
  g.boundingSphere = new T.Sphere(new T.Vector3(), 1);
  return g;
}

export function createMouth(parent, { surf, y0 = -0.45, baseW = 0.3 } = {}) {
  const group = new T.Group(); group.position.y = y0; parent.add(group);
  const mk = (color, order) => {
    const m = new T.Mesh(stripGeo(), color instanceof T.Material ? color : flat(color));
    m.renderOrder = order; m.frustumCulled = false; m.userData.keep = true; group.add(m); return m;
  };
  const outline = mk("#241418", 1);
  const inner = mk("#6e1f2a", 2);
  const teeth = mk("#fbf7ef", 3);
  const tongue = mk(toon("#e0727a", { rim: 0 }), 4);
  for (const m of [outline, inner, teeth, tongue]) m.material.polygonOffset = true;

  const P = { smile: 0.3, open: 0, width: 1, skew: 0, teeth: 0.6, tongue: 0, tongueX: 0 };

  function write(mesh, top, bot, dz, pad) {
    const a = mesh.geometry.attributes.position.array;
    const w = baseW * P.width / 2 + pad;
    for (let i = 0; i <= N; i++) {
      const u = i / N * 2 - 1, x = u * w;
      const t = top(u), b = Math.min(bot(u), t);
      const zt = surf(x, y0 + t + pad) + 0.012 + dz, zb = surf(x, y0 + b - pad) + 0.012 + dz;
      a.set([x, t + pad, zt, x, b - pad, zb], i * 6);
    }
    mesh.geometry.attributes.position.needsUpdate = true;
  }
  const center = u => P.smile * (u * u - 0.35) * 0.09 + P.skew * u * 0.025;
  const upper = u => center(u) + P.open * 0.03 * (1 - u * u);
  const lower = u => center(u) - P.open * 0.17 * Math.pow(Math.max(0, 1 - u * u), 0.75) * (P.smile < -0.2 ? 0.7 : 1);

  function update() {
    const pad = 0.024;
    write(outline, upper, u => lower(u) - 0.004, 0, pad);
    const open = P.open > 0.04;
    inner.visible = open; teeth.visible = open && P.teeth > 0.05;
    tongue.visible = P.tongue > 0.05 || (open && P.open > 0.3);
    if (open) write(inner, upper, lower, 0.003, 0);
    if (teeth.visible) write(teeth, u => upper(u) - 0.003, u => upper(u) - Math.min(0.045 * P.teeth, (upper(u) - lower(u)) * 0.45), 0.006, 0);
    if (tongue.visible) {
      const out = P.tongue;
      const tw = 0.4 + out * 0.2, cx = P.tongueX;
      tongue.geometry.attributes.position.needsUpdate = true;
      write(tongue, u => {
        const d = (u - cx) / tw; return Math.abs(d) > 1 ? lower(u) : lower(u) + (P.open * 0.06) * (1 - d * d);
      }, u => {
        const d = (u - cx) / tw; return Math.abs(d) > 1 ? lower(u) : lower(u) - out * 0.12 * Math.sqrt(Math.max(0, 1 - d * d));
      }, 0.01 + out * 0.02, 0);
    }
  }
  update();
  return { group, P, update };
}
