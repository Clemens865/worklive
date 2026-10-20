// Office crowd: agents walk between reserved spots without overlapping furniture or each other.
// Pure JS (no three.js). Invariant: a floor agent never moves closer than 2 × radius to another agent
// and never into an obstacle; seats are entered by a short scripted "settle" slide from their approach point.
import { AGENT_RADIUS, PERSONAL, findPath } from "./nav.js";
import { ROOM } from "./layout.js";

export const TRAITS = { coffee: "Coffee lover", lounge: "Couch potato", nature: "Plant & window gazer", books: "Bookworm", chatty: "Chatty", focused: "Focused" };
const TRAIT_SPOTS = [["coffee", /^(counter|cafe)/], ["lounge", /^(sofa|armchair)/], ["nature", /^(window|plant)/], ["books", /^books/]];
const SPEED = 1.15, SETTLE = 0.7, MIN_GAP = 2 * AGENT_RADIUS + 0.04;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function rng(seed = 1) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

export class Crowd {
  constructor({ grid, spots, random = Math.random }) {
    this.grid = grid; this.spots = spots.map(s => ({ ...s, taken: null })); this.random = random;
    this.agents = []; this.stats = { arrivals: 0, replans: 0, giveups: 0 };
  }
  // home: optional desk spot { id, at, yaw, pose, via }; mode "desk" (stays seated) or "wander".
  add({ id, home = null, mode = "wander", start, traits = [] }) {
    const a = { id, home, mode, traits, x: 0, z: 0, yaw: 0, pose: "stand", state: "idle", spot: null, path: [], timer: 0, stuck: 0, lastD: Infinity, slide: null };
    if (home) { home.taken = id; }
    if (mode === "desk" && home) Object.assign(a, { x: home.at.x, z: home.at.z, yaw: home.yaw, pose: home.pose, state: "seated", spot: home, timer: Infinity });
    else {
      const p = start ? this.freeNear(start) : this.randomFreePoint();
      Object.assign(a, { x: p.x, z: p.z, timer: this.random() * 2 });
    }
    this.agents.push(a); return a;
  }
  // Debug/tests: put an agent straight into a spot and keep it there.
  place(id, spotId) {
    const a = this.agents.find(a => a.id === id), spot = this.spots.find(s => s.id === spotId) || (a?.home?.id === spotId ? a.home : null);
    if (!a || !spot) return false;
    this.release(a); spot.taken = id; a.mode = "desk";
    Object.assign(a, { spot, x: spot.at.x, z: spot.at.z, yaw: spot.yaw, pose: spot.pose, state: "seated", timer: Infinity, path: [], slide: null });
    return true;
  }
  // Send a free agent to a free spot whose id matches `re` (e.g. the coffee counter). Returns true if it goes.
  sendTo(id, re) {
    const a = this.agents.find(a => a.id === id);
    if (!a || a.mode === "desk" || a.state === "leaving" || a.state === "settling") return false;
    if (a.spot && re.test(a.spot.id)) return true;
    const free = this.spots.filter(s => !s.taken && re.test(s.id));
    if (!free.length) return false;
    this.goTo(a, free[Math.floor(this.random() * free.length)]);
    return true;
  }
  setMode(id, mode) {
    const a = this.agents.find(a => a.id === id); if (!a || a.mode === mode) return;
    a.mode = mode;
    if (mode === "desk" && a.home) this.goTo(a, a.home); else if (a.state === "seated") a.timer = 1 + this.random() * 3;
  }
  randomFreePoint() {
    for (let k = 0; k < 500; k++) {
      const p = { x: ROOM.minX + 1 + this.random() * (ROOM.maxX - ROOM.minX - 2), z: ROOM.minZ + 1 + this.random() * (ROOM.maxZ - ROOM.minZ - 2) };
      if (this.grid.freeAt(p.x, p.z) && this.agents.every(b => dist(b, p) > PERSONAL + 0.3) && this.spots.every(s => dist(s.via, p) > 0.9)) return p;
    }
    return { x: 0, z: 2.4 };
  }
  // `p` itself if nobody stands there, else the closest free point on growing rings around it.
  freeNear(p) {
    const ok = q => this.grid.freeAt(q.x, q.z) && this.agents.every(b => dist(b, q) > MIN_GAP + 0.05);
    if (ok(p)) return { x: p.x, z: p.z };
    for (let r = 0.3; r < 3; r += 0.3) for (let k = 0; k < 12; k++) {
      const q = { x: p.x + Math.sin(k / 12 * 6.283) * r, z: p.z + Math.cos(k / 12 * 6.283) * r };
      if (ok(q)) return q;
    }
    return this.randomFreePoint();
  }
  pointNearSomeone() {
    for (const b of [...this.agents].sort(() => this.random() - 0.5)) {
      if (b.state === "walking") continue;
      for (let k = 0; k < 12; k++) {
        const ang = this.random() * 6.28, p = { x: b.x + Math.sin(ang) * 1.1, z: b.z + Math.cos(ang) * 1.1 };
        if (this.grid.freeAt(p.x, p.z) && this.agents.every(c => dist(c, p) > PERSONAL + 0.2) && this.spots.every(s => dist(s.via, p) > 0.9)) return p;
      }
    }
    return this.randomFreePoint();
  }
  release(a) { if (a.spot && a.spot !== a.home) a.spot.taken = null; a.spot = null; }
  pickTarget(a) {
    const has = t => a.traits.includes(t);
    if (a.home && this.random() < (has("focused") ? 0.5 : 0.2)) return a.home;
    // Skip spots right next to where another walker is heading, so two agents don't converge.
    const heading = this.agents.filter(b => b !== a && b.state === "walking" && b.spot).map(b => b.spot.via);
    const free = this.spots.filter(s => !s.taken && s !== a.spot && heading.every(v => dist(v, s.via) > 1.6));
    // Personality: favourite kinds of spots are picked ~4× as often; chatty agents loiter near others more.
    const weight = s => 1 + 3 * TRAIT_SPOTS.reduce((w, [t, re]) => w + (has(t) && re.test(s.id) ? 1 : 0), 0);
    if (free.length && this.random() < (has("chatty") ? 0.55 : 0.8)) {
      let r = this.random() * free.reduce((n, s) => n + weight(s), 0);
      for (const s of free) if ((r -= weight(s)) <= 0) return s;
      return free[free.length - 1];
    }
    const p = has("chatty") ? this.pointNearSomeone() : this.randomFreePoint();
    return { id: "loiter", at: p, via: p, yaw: this.random() * 6.28, pose: "stand", loiter: true };
  }
  // avoidWalkers: after getting stuck, also route around walkers close by (two walkers planning straight
  // through each other would otherwise deadlock head-on).
  obstaclesFor(a, avoidWalkers = false) {
    const discs = this.agents.filter(b => b !== a && (b.state !== "walking" || (avoidWalkers && dist(a, b) < 2.5)))
      .map(b => ({ x: b.x, z: b.z, r: MIN_GAP + 0.03 }));
    // Keep other agents' seat approach points clear so nobody parks where someone needs to get up.
    for (const s of this.spots) if (s.taken && s.taken !== a.id && s !== a.spot && (s.via.x !== s.at.x || s.via.z !== s.at.z)) discs.push({ x: s.via.x, z: s.via.z, r: 0.42 });
    for (const b of this.agents) if (b !== a && b.home && b.home !== a.spot) discs.push({ x: b.home.via.x, z: b.home.via.z, r: 0.3 });
    return discs;
  }
  // Extra route cost near where other walkers are heading, so agents spread over different aisles.
  congestion(a) {
    const g = this.grid, cost = new Float32Array(g.nx * g.nz);
    for (const b of this.agents) {
      if (b === a || b.state !== "walking") continue;
      const pts = [b, ...b.path];
      for (let k = 1; k < pts.length; k++) {
        const p = pts[k - 1], q = pts[k], n = Math.ceil(dist(p, q) / 0.3);
        for (let m = 0; m <= n; m++) {
          const [ci, cj] = g.cell(p.x + (q.x - p.x) * m / n, p.z + (q.z - p.z) * m / n);
          for (let di = -6; di <= 6; di++) for (let dj = -6; dj <= 6; dj++) {
            const i = ci + di, j = cj + dj;
            if (i >= 0 && j >= 0 && i < g.nx && j < g.nz && di * di + dj * dj <= 36) cost[i * g.nz + j] = Math.min(4, cost[i * g.nz + j] + 0.6);
          }
        }
      }
    }
    return cost;
  }
  walkingCount() { return this.agents.filter(b => b.state === "walking" || b.state === "leaving").length; }
  goTo(a, spot) {
    const old = a.spot, leaving = a.state === "seated" && old && (old.via.x !== old.at.x || old.via.z !== old.at.z);
    this.release(a);
    if (!spot.loiter) spot.taken = a.id;
    a.spot = spot; a.stuck = 0; a.lastD = Infinity;
    if (leaving) { a.slide = { from: { x: a.x, z: a.z }, to: { ...old.via }, t: 0, yaw: a.yaw, seat: old, wait: 0, time: 0 }; a.state = "leaving"; return; }
    this.plan(a);
  }
  plan(a, avoidWalkers = false) {
    const path = findPath(this.grid, a, a.spot.via, this.obstaclesFor(a, avoidWalkers), this.congestion(a));
    if (!path) { this.stats.giveups++; this.release(a); a.state = "idle"; a.timer = 0.5 + this.random(); return; }
    a.path = path; a.state = "walking"; a.pose = "walk";
  }
  step(dt) {
    for (const a of this.agents) this.stepAgent(a, dt);
  }
  stepAgent(a, dt) {
    if (a.state === "idle" || a.state === "seated") {
      a.timer -= dt;
      if (a.timer <= 0 && (a.mode === "wander" || (a.home && a.spot !== a.home))) {
        const toDesk = a.mode === "desk" && a.home;
        // Only about a quarter of the office is on the move at once; the rest stay a bit longer.
        if (!toDesk && this.walkingCount() >= Math.max(2, Math.ceil(this.agents.length * 0.25))) { a.timer = 2 + this.random() * 4; return; }
        // Don't set off right next to someone who is already walking (that's how clumps start).
        if (!toDesk && this.agents.some(b => b !== a && b.state === "walking" && dist(a, b) < 1.8)) { a.timer = 1 + this.random() * 2; return; }
        this.goTo(a, toDesk ? a.home : this.pickTarget(a));
      }
      return;
    }
    if (a.state === "leaving" || a.state === "settling") {
      const s = a.slide, t = Math.min(1, s.t + dt / SETTLE), k = t * t * (3 - 2 * t);
      const n = { x: s.from.x + (s.to.x - s.from.x) * k, z: s.from.z + (s.to.z - s.from.z) * k };
      s.time += dt;
      // Someone is in the way: wait seated (never half-standing inside the furniture); give up after 1.5 s.
      if (this.agents.some(b => b !== a && dist(n, b) < MIN_GAP && dist(n, b) < dist(a, b))) {
        if (a.state === "leaving" && s.t === 0 && (s.wait += dt) > 1.5) this.sitBack(a);
        return;
      }
      s.t = t; a.x = n.x; a.z = n.z;
      // Seated pose while inside the seat, standing/walking pose outside it.
      const seatPose = (a.state === "leaving" ? s.seat : a.spot).pose;
      a.pose = a.state === "leaving" ? (t < 0.35 ? seatPose : "stand") : (t > 0.6 ? seatPose : "stand");
      if (a.state === "settling") a.yaw = s.yaw + wrap(a.spot.yaw - s.yaw) * k;
      if (s.t >= 1) {
        a.slide = null; this.stats.maxSlide = Math.max(this.stats.maxSlide || 0, s.time);
        if (a.state === "leaving") this.plan(a);
        else { a.state = "seated"; a.pose = a.spot.pose; a.timer = a.mode === "desk" && a.spot === a.home ? Infinity : (a.spot.loiter ? 4 : 10) + this.random() * 16; this.stats.arrivals++; }
      }
      return;
    }
    this.walk(a, dt);
  }
  sitBack(a) {
    const seat = a.slide.seat;
    if (a.spot && !a.spot.loiter && a.spot !== a.home) a.spot.taken = null;
    seat.taken = a.id; a.spot = seat; a.slide = null;
    Object.assign(a, { state: "seated", pose: seat.pose, x: seat.at.x, z: seat.at.z, yaw: seat.yaw, timer: 3 + this.random() * 4 });
  }
  walk(a, dt) {
    const wp = a.path[0], to = { x: wp.x - a.x, z: wp.z - a.z }, d = Math.hypot(to.x, to.z);
    if (d < 0.06) {
      a.path.shift();
      if (!a.path.length) {
        a.slide = { from: { x: a.x, z: a.z }, to: { ...a.spot.at }, t: 0, yaw: a.yaw };
        a.slide.time = 0; a.state = "settling"; a.pose = a.spot.pose === "stand" || a.spot.pose === "coffee" ? a.spot.pose : "stand";
      }
      return;
    }
    const dir = { x: to.x / d, z: to.z / d }, right = { x: -dir.z, z: dir.x };
    let fwd = SPEED, side = 0;
    for (const b of this.agents) {
      if (b === a) continue;
      const rx = b.x - a.x, rz = b.z - a.z, r = Math.hypot(rx, rz);
      if (r > 2.2 || r < 1e-6) continue; // r = 0 (same spot) has no direction
      const ahead = (rx * dir.x + rz * dir.z) / r;
      if (ahead < 0.15) continue;
      // Same direction: follow at a relaxed distance instead of tailgating (a long wait triggers a detour).
      if (b.state === "walking" && (b.hx || 0) * dir.x + (b.hz || 0) * dir.z > 0.5) {
        fwd = Math.min(fwd, SPEED * Math.max(0, Math.min(1, (r - 1.0) / 0.8)));
        continue;
      }
      const lateral = (rx * right.x + rz * right.z) / r;
      const near = Math.max(0, Math.min(1, (r - PERSONAL) / (2.2 - PERSONAL)));
      fwd = Math.min(fwd, SPEED * Math.max(0.15, near));
      // Pass on the side away from the other agent; head-on → both keep right.
      side += (lateral > 0.05 ? -1 : 1) * (1 - near) * 0.9 * ahead;
    }
    const vx = dir.x * fwd + right.x * side, vz = dir.z * fwd + right.z * side;
    const moved = this.tryMove(a, vx * dt, vz * dt) || this.tryMove(a, dir.x * fwd * dt, dir.z * fwd * dt) || this.tryMove(a, right.x * side * dt, right.z * side * dt);
    if (moved) { const h = Math.atan2(vx, vz), v = Math.hypot(vx, vz) || 1; a.hx = vx / v; a.hz = vz / v; a.yaw += wrap(h - a.yaw) * Math.min(1, dt * 8); }
    const remaining = a.path.reduce((s, p, i) => s + dist(p, i ? a.path[i - 1] : a), 0);
    if (remaining < a.lastD - 0.02) { a.lastD = remaining; a.stuck = 0; } else a.stuck += dt;
    if (a.stuck > 1.2) { this.stats.replans++; a.stuck = 0; a.lastD = Infinity; if (a.replans = (a.replans || 0) + 1, a.replans > 4) { a.replans = 0; this.goTo(a, this.pickTarget(a)); } else this.plan(a, true); }
    else if (a.stuck === 0) a.replans = 0;
  }
  // Move only if it keeps the agent off obstacles and never brings it closer than MIN_GAP to anyone.
  tryMove(a, mx, mz) {
    if (Math.abs(mx) + Math.abs(mz) < 1e-6) return false;
    const n = { x: a.x + mx, z: a.z + mz };
    if (!this.grid.freeAt(n.x, n.z)) return false;
    for (const b of this.agents) {
      if (b === a) continue;
      const before = dist(a, b), after = dist(n, b);
      if (after < MIN_GAP && after < before) return false;
    }
    a.x = n.x; a.z = n.z; return true;
  }
}
