import * as T from "three";

// Walking routes on Deck 7: robots move along three aisles (back, middle, front) and cross
// between them through the gaps between consoles. Cheap, predictable, and no robot walks
// through furniture.

export const AISLES: number[] = []; // z of each aisle, back to front
// x positions where a robot can cross from aisle i to aisle i + 1
export const GAPS: number[][] = [];
export function configureNav(aisles: number[], gaps: number[][]) { AISLES.splice(0, AISLES.length, ...aisles); GAPS.splice(0, GAPS.length, ...gaps); }

const nearestAisle = (z: number) => AISLES.reduce((best, a, i) => (Math.abs(a - z) < Math.abs(AISLES[best] - z) ? i : best), 0);

export function route(from: T.Vector3, to: T.Vector3): T.Vector3[] {
  const pts: T.Vector3[] = [];
  let a = nearestAisle(from.z);
  const b = nearestAisle(to.z);
  let x = from.x;
  pts.push(new T.Vector3(x, 0, AISLES[a]));
  while (a !== b) {
    const step = b > a ? 1 : -1;
    const gaps = GAPS[Math.min(a, a + step)];
    // the gap closest to the straight line between here and the target
    const want = (x + to.x) / 2;
    x = gaps.reduce((best, g) => (Math.abs(g - want) < Math.abs(best - want) ? g : best), gaps[0]);
    pts.push(new T.Vector3(x, 0, AISLES[a]));
    a += step;
    pts.push(new T.Vector3(x, 0, AISLES[a]));
  }
  pts.push(new T.Vector3(to.x, 0, AISLES[b]));
  pts.push(to.clone().setY(0));
  // drop zero-length legs
  return keepRight(pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 0.05), from);
}

// Traffic rule: walk on the right-hand side of every aisle and gap, so robots going opposite ways pass
// each other instead of meeting head-on. Each corner of the (axis-aligned) route moves to where the
// two shifted legs meet; the first and last points stay exact.
export const LANE = 0.42;
function keepRight(pts: T.Vector3[], from: T.Vector3): T.Vector3[] {
  if (pts.length < 2) return pts;
  const all = [from.clone().setY(0), ...pts];
  const shift = (a: T.Vector3, b: T.Vector3) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    return Math.abs(dx) >= Math.abs(dz) ? { x: 0, z: Math.sign(dx) * LANE } : { x: -Math.sign(dz) * LANE, z: 0 };
  };
  const out: T.Vector3[] = [];
  for (let i = 1; i < all.length; i++) {
    if (i === all.length - 1) { out.push(all[i].clone()); break; } // the destination itself
    const s1 = shift(all[i - 1], all[i]), s2 = shift(all[i], all[i + 1]);
    const same = s1.x === s2.x && s1.z === s2.z; // straight on: shift once, not twice
    out.push(new T.Vector3(all[i].x + s1.x + (same ? 0 : s2.x), 0, all[i].z + s1.z + (same ? 0 : s2.z)));
  }
  return out;
}

// Move along a route at a given speed; returns the remaining route.
export function walk(pos: T.Vector3, path: T.Vector3[], speed: number, dt: number): { path: T.Vector3[]; dir: T.Vector3 | null } {
  let left = speed * dt;
  const dir = new T.Vector3();
  while (path.length && left > 0) {
    const d = path[0].clone().sub(pos).setY(0);
    const len = d.length();
    if (len <= left) { pos.x = path[0].x; pos.z = path[0].z; left -= len; path = path.slice(1); continue; }
    d.multiplyScalar(1 / len);
    dir.copy(d);
    pos.addScaledVector(d, left);
    left = 0;
  }
  return { path, dir: dir.lengthSq() > 0 ? dir : null };
}
