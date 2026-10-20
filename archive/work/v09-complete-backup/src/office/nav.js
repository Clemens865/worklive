// Office navigation: obstacle map, A* routes, spot reservations and crowd avoidance.
// Pure JS (no three.js) so it runs in node tests. All units metres, floor plane x/z.
import { ROOM, DESK, DESKS, LOUNGE, CAFE, MEETING, PLANTS, seatOf } from "./layout.js";

export const AGENT_RADIUS = 0.3; // comic characters (big heads, hair, arms) are ~0.55 m wide
export const PERSONAL = 0.7; // centre distance agents keep while walking (> 2 × radius)
const CELL = 0.1;

const rect = (x1, x2, z1, z2, tag) => ({ kind: "rect", x1, x2, z1, z2, tag });
const circle = (x, z, r, tag) => ({ kind: "circle", x, z, r, tag });

// Footprints of everything that stands on the floor (matches styles/comic geometry).
export function buildObstacles() {
  const o = [];
  for (const [i, d] of DESKS.entries()) {
    o.push(rect(d.x - DESK.w / 2 - 0.02, d.x + DESK.w / 2 + 0.02, d.z - DESK.d / 2 - 0.04, d.z + DESK.d / 2 + 0.02, "desk" + i));
    const s = seatOf(d);
    o.push(rect(s.x - 0.32, s.x + 0.32, s.z - 0.18, s.z + 0.42, "chair" + i));
  }
  o.push(rect(ROOM.minX, ROOM.minX + 0.5, 0.2, 3.0, "bookshelf"));
  const c = CAFE.counter;
  o.push(rect(c.x - c.w / 2 - 0.05, c.x + c.w / 2 + 0.05, ROOM.minZ, c.z + 0.38, "counter"));
  o.push(circle(CAFE.table.x, CAFE.table.z, 0.5, "cafe-table"));
  for (const [i, s] of CAFE.stools.entries()) o.push(circle(s.x, s.z, 0.22, "stool" + i));
  o.push(rect(MEETING.minX - 0.08, ROOM.maxX, ROOM.minZ, MEETING.maxZ + 0.08, "meeting-room"));
  // Sofa faces +x (yaw π/2): 0.95 deep along x, 2.4 wide along z.
  o.push(rect(LOUNGE.sofa.x - 0.5, LOUNGE.sofa.x + 0.48, LOUNGE.sofa.z - 1.22, LOUNGE.sofa.z + 1.22, "sofa"));
  o.push(circle(LOUNGE.table.x, LOUNGE.table.z, 0.62, "lounge-table"));
  for (const [i, ch] of LOUNGE.chairs.entries()) o.push(rect(ch.x - 0.47, ch.x + 0.47, ch.z - 0.42, ch.z + 0.42, "armchair" + i));
  for (const [i, p] of PLANTS.entries()) o.push(circle(p.x, p.z, 0.26 * p.s + 0.04, "plant" + i));
  return o;
}

// Places idle agents go to. `at` is where the agent's root stands/sits, `yaw` its facing, `pose` what it does there.
export function buildSpots() {
  const s = [];
  const add = (id, x, z, yaw, pose, via) => s.push({ id, at: { x, z }, yaw, pose, via: via || { x, z } });
  const c = CAFE.counter;
  for (const [k, dx] of [-1.3, 0, 1.25].entries()) add("counter" + k, c.x + dx, c.z + 0.82, Math.PI, "coffee");
  add("cafe-n", CAFE.table.x, CAFE.table.z - 0.9, 0, "coffee");
  add("cafe-e", CAFE.table.x + 1.15, CAFE.table.z - 0.7, -1.02, "coffee");
  // Sofa seats and armchairs: agents walk to the front, then settle in (`via` → `at`).
  for (const [k, dz] of [-0.55, 0.55].entries())
    add("sofa" + k, LOUNGE.sofa.x + 0.12, LOUNGE.sofa.z + dz, Math.PI / 2, "lounge", { x: LOUNGE.sofa.x + 0.95, z: LOUNGE.sofa.z + dz });
  for (const [k, ch] of LOUNGE.chairs.entries()) {
    const dir = ch.yaw === 0 ? 1 : -1;
    add("armchair" + k, ch.x, ch.z + dir * 0.05, ch.yaw, "lounge", { x: ch.x + 0.85, z: ch.z + dir * 0.05 });
  }
  for (const [k, x] of [-11.85, -5.45, 0.95].entries()) add("window" + k, x, ROOM.minZ + 0.7, Math.PI, "stand");
  add("books", ROOM.minX + 0.95, 1.6, -Math.PI / 2, "stand");
  add("plant", PLANTS[2].x - 0.75, PLANTS[2].z - 0.35, Math.PI / 2, "stand");
  return s;
}

// Occupancy grid, inflated by the agent radius so routes are for the agent's centre point.
export class NavGrid {
  constructor(obstacles, radius = AGENT_RADIUS) {
    // Plan with a 5 cm margin; movement itself only needs `radius`, so routes never graze corners.
    this.obstacles = obstacles; this.radius = radius; this.planRadius = radius + 0.05;
    this.x0 = ROOM.minX; this.z0 = ROOM.minZ;
    this.nx = Math.round((ROOM.maxX - ROOM.minX) / CELL) + 1;
    this.nz = Math.round((ROOM.maxZ - ROOM.minZ) / CELL) + 1;
    this.blocked = new Uint8Array(this.nx * this.nz);
    for (let i = 0; i < this.nx; i++) for (let j = 0; j < this.nz; j++)
      this.blocked[i * this.nz + j] = this.hits(this.x0 + i * CELL, this.z0 + j * CELL, this.planRadius) ? 1 : 0;
  }
  // True when a disc of radius r at (x, z) touches a wall or obstacle.
  hits(x, z, r) {
    const wall = 0.12;
    if (x - r < ROOM.minX + wall || x + r > ROOM.maxX - wall || z - r < ROOM.minZ + wall || z + r > ROOM.maxZ - wall) return true;
    for (const o of this.obstacles) {
      if (o.kind === "circle") { if (Math.hypot(x - o.x, z - o.z) < o.r + r) return true; }
      else {
        const dx = Math.max(o.x1 - x, 0, x - o.x2), dz = Math.max(o.z1 - z, 0, z - o.z2);
        if (dx * dx + dz * dz < r * r) return true;
      }
    }
    return false;
  }
  cell(x, z) { return [Math.round((x - this.x0) / CELL), Math.round((z - this.z0) / CELL)]; }
  free(i, j) { return i >= 0 && j >= 0 && i < this.nx && j < this.nz && !this.blocked[i * this.nz + j]; }
  freeAt(x, z) { return !this.hits(x, z, this.radius); }
  // Straight segment stays clear (sampled every 5 cm).
  clear(a, b) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.05));
    for (let k = 1; k <= n; k++) if (this.hits(a.x + (b.x - a.x) * k / n, a.z + (b.z - a.z) * k / n, this.planRadius)) return false;
    return true;
  }
}

// ---------- Routing ----------
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
}

// A* over the grid; `extra` = temporary disc obstacles (other agents) [{x, z, r}].
// Returns a smoothed list of waypoints ending exactly at `to`, or null.
export function findPath(grid, from, to, extra = [], penalty = null) {
  const blockedExtra = (x, z) => extra.some(e => Math.hypot(x - e.x, z - e.z) < e.r);
  const ok = (i, j) => grid.free(i, j) && !blockedExtra(grid.x0 + i * CELL, grid.z0 + j * CELL);
  const nearestFree = ([i0, j0]) => {
    for (let r = 0; r <= 6; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++)
      if (Math.max(Math.abs(di), Math.abs(dj)) === r && ok(i0 + di, j0 + dj)) return [i0 + di, j0 + dj];
    return null;
  };
  const s = nearestFree(grid.cell(from.x, from.z)), g = nearestFree(grid.cell(to.x, to.z));
  if (!s || !g) return null;
  const nz = grid.nz, id = (i, j) => i * nz + j, gid = id(g[0], g[1]);
  const cost = new Map([[id(s[0], s[1]), 0]]), parent = new Map(), open = new Heap(), done = new Set();
  const h = (i, j) => { const dx = Math.abs(i - g[0]), dz = Math.abs(j - g[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  open.push({ i: s[0], j: s[1], f: h(s[0], s[1]) });
  let found = false, steps = 0;
  while (open.size && steps++ < 60000) {
    const n = open.pop(), nid = id(n.i, n.j);
    if (done.has(nid)) continue; done.add(nid);
    if (nid === gid) { found = true; break; }
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const i = n.i + di, j = n.j + dj;
      if (!ok(i, j) || (di && dj && (!ok(n.i + di, n.j) || !ok(n.i, n.j + dj)))) continue;
      const k = id(i, j), c = cost.get(nid) + (di && dj ? 1.414 : 1) * (1 + (penalty ? penalty[k] : 0));
      if (c < (cost.get(k) ?? Infinity)) { cost.set(k, c); parent.set(k, nid); open.push({ i, j, f: c + h(i, j) }); }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let k = gid; k !== undefined; k = parent.get(k)) cells.push({ x: grid.x0 + Math.floor(k / nz) * CELL, z: grid.z0 + (k % nz) * CELL });
  cells.reverse(); cells.push({ x: to.x, z: to.z });
  // String pulling: keep only waypoints needed for clear straight segments.
  // Shortcuts may not cut through congested cells either.
  const busy = (a, b) => { if (!penalty) return false; const n = Math.ceil(dist2(a, b) / 0.1); for (let m = 0; m <= n; m++) { const [i, j] = grid.cell(a.x + (b.x - a.x) * m / n, a.z + (b.z - a.z) * m / n); if (penalty[i * nz + j] > 0.9) return true; } return false; };
  const clear = (a, b) => grid.clear(a, b) && !segmentHits(a, b, extra) && !busy(a, b);
  // Starts at k = -1 so the first cell is kept when the agent can't see past it (e.g. after a sidestep).
  const out = []; let cur = { x: from.x, z: from.z }, k = -1;
  while (k < cells.length - 1) {
    let far = k + 1;
    for (let m = cells.length - 1; m > k + 1; m--) if (clear(cur, cells[m])) { far = m; break; }
    out.push(cells[far]); cur = cells[far]; k = far;
  }
  return out.length ? out : [{ x: to.x, z: to.z }];
}

const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function segmentHits(a, b, discs) {
  for (const e of discs) {
    const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz;
    const t = L ? Math.max(0, Math.min(1, ((e.x - a.x) * dx + (e.z - a.z) * dz) / L)) : 0;
    if (Math.hypot(a.x + dx * t - e.x, a.z + dz * t - e.z) < e.r) return true;
  }
  return false;
}
