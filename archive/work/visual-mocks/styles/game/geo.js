import * as T from "three";

// Shared, cached sculpted geometry helpers.
const cache = new Map();
export function cached(key, make) { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }

// Lathe along -y from 0 to -len. profile = [[t(0..1), radius], ...]; ellipse scale (sx, sz); front bulge.
export function lathe(key, len, profile, { sx = 1, sz = 1, seg = 18, rows = 14, bulge = null, gap = 0 } = {}) {
  return cached(`lathe:${key}:${len.toFixed(3)}:${sx.toFixed(3)}:${sz.toFixed(3)}:${gap.toFixed(2)}`, () => {
    const pts = [];
    for (let i = 0; i <= rows; i++) {
      const t = i / rows; pts.push(new T.Vector2(Math.max(0.0005, interp(profile, t)), -t * len));
    }
    pts.reverse(); // bottom-to-top so faces point outward
    const g = new T.LatheGeometry(pts, seg, gap / 2, Math.PI * 2 - gap);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) * sx, z = p.getZ(i) * sz;
      if (bulge) { const t = -p.getY(i) / len, a = Math.atan2(x, z); const b = bulge(t, a); x *= b[0]; z *= b[1]; }
      p.setX(i, x); p.setZ(i, z);
    }
    g.computeVertexNormals(); return g;
  });
}
export function interp(profile, t) {
  for (let i = 1; i < profile.length; i++) {
    const [t0, r0] = profile[i - 1], [t1, r1] = profile[i];
    if (t <= t1) { const k = (t - t0) / (t1 - t0 || 1), s = k * k * (3 - 2 * k); return r0 + (r1 - r0) * s; }
  }
  return profile[profile.length - 1][1];
}

// Sphere deformed by a function (x,y,z unit sphere) -> [x,y,z].
export function sculpt(key, fn, w = 32, h = 24) {
  return cached("sculpt:" + key, () => {
    const g = new T.SphereGeometry(1, w, h), p = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const o = fn(v.x, v.y, v.z); p.setXYZ(i, o[0], o[1], o[2]); }
    g.computeVertexNormals(); return g;
  });
}

// Tube along a list of points.
export function tube(key, pts, r, seg = 20, radial = 8, closed = false) {
  return cached("tube:" + key, () => new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), seg, r, radial, closed));
}

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function mesh(geo, mat, parent, pos, opts = {}) {
  const m = new T.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  if (opts.scale) typeof opts.scale === "number" ? m.scale.setScalar(opts.scale) : m.scale.set(...opts.scale);
  m.castShadow = opts.cast !== false; m.receiveShadow = opts.receive !== false;
  parent.add(m); return m;
}
export function joint(parent, pos = [0, 0, 0], name) { const g = new T.Group(); g.position.set(...pos); if (name) g.name = name; parent.add(g); return g; }
