// Deterministic office simulation, independent of rendering and browser work.
export interface Point {
  x: number;
  z: number;
}
export const DESKS: Point[] = [
  { x: 0, z: 0.15 },
  { x: -3.6, z: 0.15 },
  { x: 3.6, z: 0.15 },
  { x: 0, z: 2.95 },
  { x: -3.6, z: 2.95 },
  { x: 3.6, z: 2.95 },
];
export const TABLE = { x: 0, z: -2.65, radius: 0.8 };
export const PERSONAL_SPACE = 0.88;
const RADIUS = 0.4,
  GRID = 0.2,
  SPEED = 0.95;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
type Activity = "desk" | "coffee" | "stretch" | "plant";
export type Phase =
  | "desk"
  | "walking"
  | "coffee"
  | "stretch"
  | "plant"
  | "working";
interface Spot extends Point {
  id: string;
  activity: Activity;
  facing: number;
}
export interface Resident extends Point {
  id: string;
  name: string;
  index: number;
  home: Point;
  busy: boolean;
  phase: Phase;
  activity: Activity;
  spot: Spot | null;
  path: Point[];
  facing: number;
  moving: boolean;
  hold: number;
  blocked: number;
  cycle: number;
  bubble: string;
  bubbleUntil: number;
  label: string;
}
export interface Moment {
  text: string;
  speaker?: string;
}
const COFFEE: Spot[] = Array.from({ length: 6 }, (_, i) => {
  const a = (i * Math.PI) / 3;
  return {
    id: `coffee-${i}`,
    activity: "coffee",
    x: Math.cos(a) * 1.5,
    z: TABLE.z + Math.sin(a) * 1.5,
    facing: Math.atan2(-Math.cos(a), -Math.sin(a)),
  };
});
const SPOTS: Spot[] = [
  ...COFFEE,
  { id: "stretch-left", activity: "stretch", x: -4.7, z: -1.5, facing: 0.5 },
  { id: "stretch-right", activity: "stretch", x: 4.7, z: -1.5, facing: -0.5 },
  { id: "plant-left", activity: "plant", x: -4.6, z: -2.75, facing: -2.7 },
  { id: "plant-right", activity: "plant", x: 4.8, z: -2.6, facing: 2.9 },
];
const CHATS = [
  [
    "I call this a productive pause.",
    "Agreed. The coffee has excellent uptime.",
  ],
  ["Anyone else have 47 tabs open?", "Only emotionally."],
  ["What should we name the office plant?", "Branch manager. Obviously."],
  ["A tiny office. Very big plans.", "And just the right amount of coffee."],
  ["I brought a fresh idea to the table.", "Excellent. I brought a mug."],
];

export class OfficeLife {
  residents: Resident[] = [];
  time = 0;
  private chat: {
    one: Resident;
    two: Resident;
    at: number;
    turn: number;
    lines: string[];
  } | null = null;
  private chatNumber = 0;
  private nextChat = 0;
  private onMoment: (moment: Moment) => void;
  constructor(onMoment: (moment: Moment) => void = () => {}) {
    this.onMoment = onMoment;
  }

  add(id: string, name: string) {
    const existing = this.residents.find((a) => a.id === id);
    if (existing) {
      existing.name = name;
      return existing;
    }
    const index = this.residents.length;
    if (index >= DESKS.length) throw new Error("The office has six desks.");
    const desk = DESKS[index],
      home = { x: desk.x, z: desk.z + 1.1 };
    // A new desk must not appear around a walking resident.
    const resident: Resident = {
      id,
      name,
      index,
      home,
      ...home,
      busy: false,
      phase: "desk",
      activity: "desk",
      spot: null,
      path: [],
      facing: Math.PI,
      moving: false,
      hold: 5 + index * 1.5,
      blocked: 0,
      cycle: 0,
      bubble: "",
      bubbleUntil: 0,
      label: "Settling in",
    };
    this.residents.push(resident);
    return resident;
  }

  setBusy(id: string, busy: boolean) {
    const a = this.residents.find((a) => a.id === id);
    if (!a || a.busy === busy) return;
    a.busy = busy;
    if (busy) {
      this.cancelChat(a);
      a.bubble = "";
      this.go(a, "desk");
    } else {
      a.phase = distance(a, a.home) < 0.08 ? "desk" : "walking";
      a.label = a.phase === "desk" ? "At the desk" : "Heading to desk";
      a.hold = 7 + a.index;
    }
  }

  coffeeBreak() {
    const available = this.residents.filter((a) => !a.busy);
    for (const a of available)
      if (a.activity !== "coffee") this.go(a, "coffee");
    if (available.length)
      this.onMoment({
        text: "Coffee is on. The free agents are meeting at the community table.",
      });
    return available.length;
  }

  // Every possible desk is reserved from the beginning, including its chair.
  // This also keeps newly added agents from spawning into a walking character.
  walkable(p: Point, owner: Resident) {
    if (Math.abs(p.x) > 5.5 || p.z < -4.3 || p.z > 4.4) return false;
    for (let i = 0; i < DESKS.length; i++) {
      const d = DESKS[i];
      if (
        Math.abs(p.x - d.x) < 1.25 + RADIUS &&
        Math.abs(p.z - d.z) < 0.58 + RADIUS
      )
        return false;
      if (
        i !== owner.index &&
        distance(p, { x: d.x, z: d.z + 1.1 }) <
          (i >= this.residents.length ? PERSONAL_SPACE : 0.73)
      )
        return false;
    }
    if (distance(p, TABLE) < TABLE.radius + RADIUS) return false;
    if (p.x > 1.27 && p.x < 4.13 && p.z < -3.4) return false;
    for (const plant of [
      { x: -5.1, z: -3.9 },
      { x: 5.1, z: -3.9 },
      { x: -5.05, z: 3.7 },
    ])
      if (distance(p, plant) < 0.75) return false;
    return true;
  }

  private clear(from: Point, to: Point, owner: Resident, people: boolean) {
    if (!this.walkable(to, owner)) return false;
    const hitRect = (x1: number, x2: number, z1: number, z2: number) => {
      let lo = 0,
        hi = 1;
      for (const [v, dv, min, max] of [
        [from.x, to.x - from.x, x1, x2],
        [from.z, to.z - from.z, z1, z2],
      ]) {
        if (Math.abs(dv) < 1e-10) {
          if (v <= min || v >= max) return false;
        } else {
          const t1 = (min - v) / dv,
            t2 = (max - v) / dv;
          lo = Math.max(lo, Math.min(t1, t2));
          hi = Math.min(hi, Math.max(t1, t2));
        }
      }
      return lo < hi && hi > 0 && lo < 1;
    };
    const hitCircle = (p: Point, radius: number) => {
      const dx = to.x - from.x,
        dz = to.z - from.z,
        length = dx * dx + dz * dz;
      const t = length
        ? Math.max(
            0,
            Math.min(1, ((p.x - from.x) * dx + (p.z - from.z) * dz) / length),
          )
        : 0;
      return (
        Math.hypot(from.x + dx * t - p.x, from.z + dz * t - p.z) < radius - 1e-8
      );
    };
    for (let i = 0; i < DESKS.length; i++) {
      const d = DESKS[i];
      if (
        hitRect(
          d.x - 1.25 - RADIUS,
          d.x + 1.25 + RADIUS,
          d.z - 0.58 - RADIUS,
          d.z + 0.58 + RADIUS,
        )
      )
        return false;
      if (
        i !== owner.index &&
        hitCircle(
          { x: d.x, z: d.z + 1.1 },
          i >= this.residents.length ? PERSONAL_SPACE : 0.73,
        )
      )
        return false;
    }
    if (
      hitCircle(TABLE, TABLE.radius + RADIUS) ||
      hitRect(1.27, 4.13, -5, -3.4)
    )
      return false;
    for (const plant of [
      { x: -5.1, z: -3.9 },
      { x: 5.1, z: -3.9 },
      { x: -5.05, z: 3.7 },
    ])
      if (hitCircle(plant, 0.75)) return false;
    if (
      people &&
      this.residents.some((b) => b !== owner && hitCircle(b, PERSONAL_SPACE))
    )
      return false;
    return true;
  }

  private route(a: Resident, goal: Point): Point[] {
    if (this.clear(a, goal, a, true)) return [{ ...goal }];
    const key = (p: Point) =>
      `${Math.round(p.x / GRID)},${Math.round(p.z / GRID)}`;
    const nodes = new Map<
      string,
      { p: Point; cost: number; score: number; parent: string | null }
    >();
    const open = new Set<string>();
    // Connect the exact position to nearby grid nodes without snapping it.
    for (let ix = -1; ix <= 1; ix++)
      for (let iz = -1; iz <= 1; iz++) {
        const p = {
          x: (Math.round(a.x / GRID) + ix) * GRID,
          z: (Math.round(a.z / GRID) + iz) * GRID,
        };
        if (!this.clear(a, p, a, true)) continue;
        const k = key(p),
          cost = distance(a, p);
        nodes.set(k, {
          p,
          cost,
          score: cost + distance(p, goal),
          parent: null,
        });
        open.add(k);
      }
    let visited = 0;
    const closed = new Set<string>();
    while (open.size && visited++ < 4000) {
      let best = "",
        score = Infinity;
      for (const k of open) {
        const n = nodes.get(k)!;
        if (n.score < score) {
          score = n.score;
          best = k;
        }
      }
      open.delete(best);
      closed.add(best);
      const n = nodes.get(best)!;
      if (distance(n.p, goal) < 0.32 && this.clear(n.p, goal, a, true)) {
        const result: Point[] = [{ ...goal }];
        let cursor: string | null = best;
        while (cursor) {
          const node: { p: Point; parent: string | null } = nodes.get(cursor)!;
          result.unshift(node.p);
          cursor = node.parent;
        }
        // Smooth only segments that clear furniture and other residents.
        const smooth: Point[] = [];
        let start: Point = a;
        while (result.length) {
          let end = result.length - 1;
          while (end > 0 && !this.clear(start, result[end], a, true)) end--;
          start = result[end];
          smooth.push(start);
          result.splice(0, end + 1);
        }
        return smooth;
      }
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          if (!dx && !dz) continue;
          const p = { x: n.p.x + dx * GRID, z: n.p.z + dz * GRID },
            k = key(p);
          if (closed.has(k) || !this.clear(n.p, p, a, true)) continue;
          const cost = n.cost + distance(n.p, p),
            old = nodes.get(k);
          if (!old || cost < old.cost) {
            nodes.set(k, {
              p,
              cost,
              score: cost + distance(p, goal),
              parent: best,
            });
            open.add(k);
          }
        }
    }
    return [];
  }

  private go(a: Resident, activity: Activity) {
    this.cancelChat(a);
    a.bubble = "";
    const options = SPOTS.filter(
      (s) =>
        s.activity === activity &&
        !this.residents.some((b) => b !== a && b.spot?.id === s.id),
    );
    let spot: Spot | null = null;
    if (activity !== "desk") {
      options.sort((u, v) => distance(a, u) - distance(a, v));
      spot = options[0] || null;
      if (!spot) {
        a.hold = 3;
        return;
      }
    }
    a.activity = activity;
    a.spot = spot;
    a.phase = "walking";
    a.blocked = 0;
    a.moving = false;
    a.path = this.route(a, spot || a.home);
    a.label =
      activity === "desk"
        ? "Heading to desk"
        : activity === "coffee"
          ? "Coffee break"
          : activity === "plant"
            ? "Plant duty"
            : "Stretch break";
  }

  private arrive(a: Resident) {
    a.path = [];
    a.moving = false;
    a.blocked = 0;
    if (a.activity === "desk") {
      a.spot = null;
      a.phase = a.busy ? "working" : "desk";
      a.facing = Math.PI;
      a.hold = 7 + a.index;
      a.label = a.busy ? "Working" : "At the desk";
      return;
    }
    a.phase = a.activity;
    a.facing = a.spot!.facing;
    a.hold = a.activity === "coffee" ? 22 : 9;
    a.label =
      a.activity === "coffee"
        ? "Sipping coffee"
        : a.activity === "plant"
          ? "Watering plants"
          : "Stretching";
    if (a.activity === "plant")
      this.say(a, "Tiny jungle. Big responsibilities.");
    if (a.activity === "stretch")
      this.say(a, "A little stretch. A fresh perspective.");
    if (a.activity === "coffee")
      this.onMoment({ text: `${a.name} made it to the coffee table.` });
  }

  private say(a: Resident, text: string) {
    a.bubble = text;
    a.bubbleUntil = this.time + 5.5;
    this.onMoment({ speaker: a.name, text });
  }
  private cancelChat(a: Resident) {
    if (this.chat && (this.chat.one === a || this.chat.two === a)) {
      this.chat.one.bubble = "";
      this.chat.two.bubble = "";
      this.chat = null;
      this.nextChat = this.time + 6;
    }
  }
  private conversations() {
    if (this.chat) {
      const c = this.chat;
      if (
        c.one.phase !== "coffee" ||
        c.two.phase !== "coffee" ||
        c.one.busy ||
        c.two.busy
      ) {
        this.cancelChat(c.one);
        return;
      }
      if (this.time >= c.at) {
        if (c.turn === 0) {
          this.say(c.one, c.lines[0]);
          c.turn = 1;
          c.at = this.time + 5.8;
        } else if (c.turn === 1) {
          this.say(c.two, c.lines[1]);
          c.turn = 2;
          c.at = this.time + 5.8;
        } else {
          this.chat = null;
          this.nextChat = this.time + 7;
        }
      }
      return;
    }
    if (this.time < this.nextChat) return;
    const ready = this.residents.filter(
      (a) => a.phase === "coffee" && !a.busy && a.hold > 7,
    );
    if (ready.length < 2) return;
    const [one, two] = ready;
    one.hold = Math.max(one.hold, 16);
    two.hold = Math.max(two.hold, 16);
    one.facing = Math.atan2(two.x - one.x, two.z - one.z);
    two.facing = Math.atan2(one.x - two.x, one.z - two.z);
    this.chat = {
      one,
      two,
      at: this.time + 1,
      turn: 0,
      lines: CHATS[this.chatNumber++ % CHATS.length],
    };
  }

  update(elapsed: number) {
    // Bounded substeps keep movement collision checks stable at low frame rates.
    let left = Math.min(Math.max(elapsed, 0), 0.25);
    while (left > 0) {
      const dt = Math.min(left, 1 / 30);
      this.tick(dt);
      left -= dt;
    }
  }
  private tick(dt: number) {
    this.time += dt;
    for (const a of this.residents) {
      a.moving = false;
      if (a.bubble && this.time > a.bubbleUntil) a.bubble = "";
      if (a.phase === "walking") {
        const goal = a.spot || a.home;
        if (distance(a, goal) < 0.035) {
          this.arrive(a);
          continue;
        }
        if (!a.path.length) {
          a.blocked += dt;
          if (a.blocked > 1 + a.index * 0.07) {
            a.path = this.route(a, goal);
            a.blocked = 0;
          }
          continue;
        }
        const target = a.path[0],
          d = distance(a, target),
          step = Math.min(SPEED * dt, d);
        const next = {
          x: a.x + ((target.x - a.x) * step) / (d || 1),
          z: a.z + ((target.z - a.z) * step) / (d || 1),
        };
        if (this.clear(a, next, a, true)) {
          a.facing = Math.atan2(next.x - a.x, next.z - a.z);
          a.x = next.x;
          a.z = next.z;
          a.moving = step > 0.0001;
          a.label =
            a.activity === "desk"
              ? "Heading to desk"
              : a.activity === "coffee"
                ? "Coffee break"
                : a.activity === "plant"
                  ? "Plant duty"
                  : "Stretch break";
          a.blocked = 0;
          if (d <= step + 0.001) a.path.shift();
        } else {
          a.blocked += dt;
          a.label = "After you…";
          if (a.blocked > 0.8 + a.index * 0.09) {
            a.path = this.route(a, goal);
            a.blocked = 0;
          }
        }
      } else if (!a.busy) {
        a.hold -= dt;
        if (a.hold <= 0) {
          if (a.phase === "desk") {
            const sequence: Activity[] = [
              "coffee",
              "stretch",
              "plant",
              "coffee",
            ];
            this.go(a, sequence[a.cycle++ % sequence.length]);
          } else this.go(a, "desk");
        }
      }
    }
    this.conversations();
  }
}
