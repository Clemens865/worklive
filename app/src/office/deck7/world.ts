import * as T from "three";
import type { Agent } from "../../types";
import { PROVIDERS } from "../../types";
import { Kit } from "./kit";
import { buildRoom } from "./room";
import { gamingStation, type RetroScreen } from "./gaming";
import { hamsterWheel, jukebox } from "./fun";
import { station, chargePod, oilDispenser, reviewHatch, zenGarden, junk as junkPile, type Spot } from "./props";
import { route, walk, configureNav, AISLES } from "./nav";
import { remark, logLine, type Act } from "./remarks";
import type { HoloMode } from "./holo";
import { buildChute, Delivery, CHUTE } from "./hire";
import { Junk, Janitor, trashBin, JUNK_LABEL, type JunkKind, type Rect } from "./junk";
import { buildRobot } from "./robot";
import { mergeStatic } from "./robot-optimize";
import { randomRobot, fitRobot } from "./robot-random";
import type { Creature, Input } from "./util";
import type { RobotSpec, RobotFinish, Emotion } from "./robot-spec";
import { cue, jukeboxMusic } from "./sound";
import { buildPosters } from "./posters";
import { DIMS, STATIONS, AISLES as LAYOUT_AISLES, GAPS, WINDOWS, PLACES } from "./layout";

// The Deck 7 simulation for Worklive: robots, their docking stations, breaks, football and the
// janitor. It only *shows* Worklive's agents and run states; it never changes them. All of it is
// local animation (Worklive rule 6): no model calls, scripted lines only.

export const SCALE = 0.84;
type Plan = "dock" | "celebrate" | "review" | "rest" | "oil" | "window" | "games" | "wheel" | "wander" | "rewire" | "dance" | "zen" | "kick";

export interface Bot {
  agent: Agent; spec: RobotSpec; robot: Creature; mover: T.Group; input: Input;
  desk: number | null; station: ReturnType<typeof station> | null; home: Spot | null;
  status: string; reason: string; emo: Emotion;
  plan: Plan; until: number; spotKey: string | null; target: Spot | null; path: T.Vector3[];
  heading: number; arrived: boolean; moving: boolean; yieldT: number; arriving: boolean;
  ball?: Junk; repath?: number; kickT?: number; kicks?: number; gameAct?: string; gameEmo?: Emotion;
  bubbleText: string; bubbleUntil: number; nextSay: number; drones: T.Object3D[];
  celebrated: boolean; // a finished run is celebrated once, then the robot takes a break
  waitingFor?: Bot | null; // traffic: who this robot is currently waiting behind
}

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

// The robot's parts are saved in agent.look.robot (from the robot creator); without them every agent
// still always gets the same robot from its id. The provider colour (Worklive rule 2) is its trim.
export type RobotParts = Pick<RobotSpec, "metal" | "body" | "head" | "face" | "mouth" | "top" | "arms" | "legs">;
export function robotFor(agent: Agent): RobotSpec {
  const r = randomRobot(hash(agent.id + "|" + (agent.lookSeed ?? "")));
  const saved = (agent.look as { robot?: RobotParts } | undefined)?.robot;
  return fitRobot({ ...r, ...(saved && typeof saved === "object" ? saved : {}), id: agent.id, name: agent.name, role: agent.role || r.role, trim: PROVIDERS[agent.provider].color, emotion: "idle", yaw: 0 });
}

// Worklive run status → what the robot feels and where it goes. Only presentation.
function feel(status: string, reason: string): { emo: Emotion; plan: "dock" | "review" | "celebrate" | "break" } {
  switch (status) {
    case "working": return { emo: "working", plan: "dock" };
    case "loading": return { emo: "thinking", plan: "dock" };
    case "paused": return { emo: "waiting", plan: "dock" }; // the user has control: hands off, arms crossed
    case "error": return { emo: "angry", plan: "dock" };
    case "needs": return { emo: /limit/i.test(reason) ? "waiting" : "attention", plan: "dock" };
    case "review": return { emo: "attention", plan: "review" };
    case "complete": return { emo: "happy", plan: "celebrate" };
    default: return { emo: "idle", plan: "break" };
  }
}

const spotWorld = (g: T.Object3D, s: Spot): Spot => {
  g.updateMatrixWorld(true);
  return { pos: s.pos.clone().applyMatrix4(g.matrixWorld), face: s.face + g.rotation.y };
};
const v2 = (p: [number, number]) => new T.Vector3(p[0], 0, p[1]);

export class DeckWorld {
  root = new T.Group();
  bots: Bot[] = [];
  junk: Junk[] = [];
  time = 0;
  /** Dev metric: how often robots had to be shoved apart (should stay near zero). */
  stats = { shoves: 0, why: {} as Record<string, number> };
  private kit: Kit;
  private room: ReturnType<typeof buildRoom>;
  private spots = new Map<string, Spot>();
  private taken = new Map<string, Bot>();
  private boxes: Rect[] = [];
  private walls: Rect = { x0: DIMS.x0 + 0.2, x1: DIMS.x1 - 0.2, z0: DIMS.z0 + 0.2, z1: DIMS.z1 - 0.2 };
  private screen: RetroScreen;
  private wheel!: ReturnType<typeof hamsterWheel>;
  private juke!: ReturnType<typeof jukebox>;
  private charge = { v: 0.2 };
  posters: ReturnType<typeof buildPosters>;
  private chute: T.Group;
  private deliveries: { d: Delivery; bot: Bot }[] = [];
  private leftovers: { g: T.Group; t: number }[] = [];
  private janitor: Janitor;
  private bin = v2(PLACES.bin);
  private trophy: T.Mesh;

  constructor(private finish: RobotFinish, private onMoment: (m: { text: string; speaker?: string }) => void) {
    configureNav(LAYOUT_AISLES, GAPS);
    CHUTE.copy(v2(PLACES.chute));
    this.kit = new Kit(finish);
    this.room = buildRoom(this.kit, DIMS, WINDOWS);
    this.root.add(this.room.group);
    this.posters = buildPosters(DIMS, WINDOWS, finish === "cartoon");
    this.root.add(this.posters.group);
    const k = this.kit;
    const place = <O extends { group: T.Group }>(o: O, p: [number, number], ry = 0): O => { o.group.position.set(p[0], 0, p[1]); o.group.rotation.y = ry; this.root.add(o.group); return o; };
    PLACES.pods.forEach((p, i) => { const pod = place(chargePod(k), p); this.spots.set(`pod${i}`, spotWorld(pod.group, pod.spot)); });
    const oil = place(oilDispenser(k), PLACES.oil);
    oil.spots.forEach((s, i) => this.spots.set(`oil${i}`, spotWorld(oil.group, s)));
    const hatch = place(reviewHatch(k), PLACES.hatch);
    hatch.spots.forEach((s, i) => this.spots.set(`hatch${i}`, spotWorld(hatch.group, s)));
    PLACES.queue.forEach(([x, z], i) => this.spots.set(`queue${i}`, { pos: new T.Vector3(x, 0, z), face: Math.atan2(PLACES.hatch[0] - x, PLACES.hatch[1] - z) }));
    this.wheel = place(hamsterWheel(k), PLACES.wheel);
    this.wheel.spots.forEach((s, i) => this.spots.set(`wheel${i}`, spotWorld(this.wheel.group, s)));
    const games = place(gamingStation(k), PLACES.gaming);
    games.spots.forEach((s, i) => this.spots.set(`games${i}`, spotWorld(games.group, s)));
    this.screen = games.screen;
    this.juke = place(jukebox(k), PLACES.jukebox, Math.PI / 2);
    this.juke.spots.forEach((s, i) => this.spots.set(`dance${i}`, spotWorld(this.juke.group, s)));
    const zen = place(zenGarden(k), PLACES.zen);
    zen.spots.forEach((s, i) => this.spots.set(`zen${i}`, spotWorld(zen.group, s)));
    place(junkPile(k), PLACES.junk);
    PLACES.loiter.forEach(([x, z], i) => this.spots.set(`loiter${i}`, { pos: new T.Vector3(x, 0, z), face: Math.atan2(-x, 2 - z) }));
    this.room.windows.forEach((w, i) => this.spots.set(`window${i}`, { pos: new T.Vector3(w.x, 0, w.z), face: Math.PI }));
    const bin = trashBin(k);
    bin.position.copy(this.bin);
    this.root.add(bin);
    // employee-of-the-cycle plaque: lights up with Worklive's achievement
    this.trophy = k.sign(1.2, 0.5, (c, w, h) => { c.fillStyle = "#2c3440"; c.fillRect(0, 0, w, h); c.fillStyle = "#f2c94c"; c.font = "800 34px Manrope, system-ui, sans-serif"; c.textAlign = "center"; c.fillText("★ CREW OF THE CYCLE ★", w / 2, h / 2 + 12); }, this.root, 512, true);
    this.trophy.position.set(WINDOWS[0] - 2.6, 3.0, DIMS.z0 + 0.03);
    this.trophy.visible = false;
    mergeStatic(this.root, k.ink, k.geos);
    this.chute = buildChute(k);
    this.chute.position.y = 7;
    this.chute.visible = false;
    this.root.add(this.chute);
    this.janitor = new Janitor(k);
    this.janitor.home.copy(v2(PLACES.janitor));
    this.janitor.group.position.copy(this.janitor.home);
    this.root.add(this.janitor.group);
    const r = (p: [number, number], hx: number, hz: number): Rect => ({ x0: p[0] - hx, x1: p[0] + hx, z0: p[1] - hz, z1: p[1] + hz });
    this.boxes.push(...PLACES.pods.map(p => r(p, 0.8, 0.8)), r(PLACES.oil, 0.5, 0.36), r([PLACES.hatch[0], PLACES.hatch[1] + 0.3], 0.9, 0.5), r(PLACES.gaming, 0.8, 0.35), r([PLACES.gaming[0], PLACES.gaming[1] + 1.75], 1.2, 0.5),
      r(PLACES.wheel, 1.25, 0.8), r(PLACES.jukebox, 0.32, 0.47), r(PLACES.zen, 0.8, 0.5), r(PLACES.junk, 0.6, 0.4));
  }

  // ---------- agents ----------
  freeDesks() { return STATIONS.map((_, i) => i).filter(i => !this.bots.some(b => b.desk === i)); }

  addAgent(agent: Agent, deliver: boolean): Bot {
    const want = typeof agent.desk === "number" && agent.desk < STATIONS.length && !this.bots.some(b => b.desk === agent.desk) ? agent.desk : null;
    const desk = want ?? this.freeDesks()[0] ?? null;
    const spec = robotFor(agent);
    let st: ReturnType<typeof station> | null = null, home: Spot | null = null;
    if (desk !== null) {
      const [x, z] = STATIONS[desk];
      st = station(this.kit, agent.name, spec.metal);
      st.group.position.set(x, 0, z);
      st.holo.title = agent.name;
      this.root.add(st.group);
      home = { pos: new T.Vector3(x, 0, z), face: 0 };
      this.boxes.push({ x0: x - 0.78, x1: x + 0.78, z0: z + 0.4, z1: z + 1.1 });
    }
    const robot = buildRobot(spec, this.finish);
    robot.root.scale.setScalar(SCALE);
    robot.root.traverse(o => (o.castShadow = false)); // contact blobs only: keeps 24 robots cheap
    const mover = new T.Group();
    const start = home?.pos ?? v2(PLACES.loiter[this.bots.length % PLACES.loiter.length]);
    mover.position.copy(start);
    mover.add(robot.root);
    const bot: Bot = {
      agent, spec, robot, mover, input: { look: new T.Vector2(), hover: false, poke: 0, emotion: "idle", camElev: 0.75 },
      desk, station: st, home, status: "idle", reason: "", emo: "idle",
      plan: "dock", until: 0, spotKey: null, target: home, path: [], heading: 0, arrived: true, moving: false, yieldT: 0, arriving: false,
      bubbleText: "", bubbleUntil: 0, nextSay: this.time + 4 + Math.random() * 10, drones: [], celebrated: false,
    };
    this.bots.push(bot);
    if (deliver) {
      // a new hire: the station grows in, the robot comes down the chute in a crate
      st?.group.scale.setScalar(0.001);
      bot.arriving = true;
      mover.position.set(0, 0, 0);
      const d = new Delivery(this.kit, mover, () => {
        cue("hire");
        this.say(bot, ["Unpacked. Already disappointed.", "Is this the onboarding? It smells like oil.", "Hello. Where do I plug in my feelings?"][Math.floor(Math.random() * 3)], 4, true);
      }, () => {
        this.root.attach(mover);
        mover.position.copy(CHUTE);
        bot.arriving = false;
        this.deliveries = this.deliveries.filter(x => x.d !== d);
        this.leftovers.push({ g: d.group, t: 0 });
        this.decide(bot, false);
      });
      this.root.add(d.group);
      this.deliveries.push({ d, bot });
    } else {
      this.root.add(mover);
      this.decide(bot, true);
    }
    return bot;
  }

  removeAgent(id: string) {
    const b = this.bots.find(x => x.agent.id === id);
    if (!b) return;
    this.claim(b, null);
    b.mover.parent?.remove(b.mover);
    if (b.station) { this.root.remove(b.station.group); b.station.holo.dispose(); }
    if (b.home) this.boxes = this.boxes.filter(r => !(Math.abs(r.x0 + 0.78 - b.home!.pos.x) < 0.01 && Math.abs(r.z0 - 0.4 - b.home!.pos.z) < 0.01));
    b.robot.dispose();
    this.bots.splice(this.bots.indexOf(b), 1);
  }

  updateAgent(agent: Agent) {
    const b = this.bots.find(x => x.agent.id === agent.id);
    if (!b) return;
    const lookChanged = b.agent.provider !== agent.provider || b.agent.lookSeed !== agent.lookSeed || b.agent.name !== agent.name || JSON.stringify(b.agent.look) !== JSON.stringify(agent.look);
    b.agent = { ...agent, desk: b.desk ?? undefined };
    if (!lookChanged) return;
    // new provider or look: swap the robot body, keep everything else
    b.spec = robotFor(b.agent);
    b.mover.remove(b.robot.root);
    b.robot.dispose();
    b.robot = buildRobot(b.spec, this.finish);
    b.robot.root.scale.setScalar(SCALE);
    b.robot.root.traverse(o => (o.castShadow = false));
    b.mover.add(b.robot.root);
    if (b.station) b.station.holo.title = agent.name;
  }

  setStatus(id: string, status: string, reason: string) {
    const b = this.bots.find(x => x.agent.id === id);
    if (!b || (b.status === status && b.reason === reason)) return;
    const was = b.status;
    if (was !== status) {
      if (status === "complete" || status === "review") cue("done");
      else if (status === "error") cue("error");
      else if (status === "needs") cue(/limit/i.test(reason) ? "error" : "needs");
      else if ((status === "working" || status === "loading") && !["working", "loading"].includes(was)) cue("start");
    }
    b.status = status;
    b.reason = reason;
    if (status !== "complete") b.celebrated = false;
    // a self-study task (from "Learn" on the card): mark the hologram and say what it's studying
    const topic = /^Learning session[^\n]*Topic: ([^\n]+?)\.?$/m.exec(b.agent.task || "")?.[1];
    if (b.station) b.station.holo.title = topic && (status === "working" || status === "loading") ? `${b.agent.name} · studying` : b.agent.name;
    if (topic && status === "working" && was !== "working") this.say(b, [`Studying ${topic}. Knowledge is power. Power is oil.`, `${topic}? Downloading wisdom. Please hold.`, `Self-improvement mode. ${topic}. Don't tell the other robots.`][Math.floor(Math.random() * 3)], 5, true);
    this.decide(b, false);
    if (was !== status && Math.random() < 0.6) this.say(b, remark(b.spec.id, feel(status, reason).emo), 4, Math.random() < 0.4);
  }

  frame(id: string, img: CanvasImageSource) { this.bots.find(x => x.agent.id === id)?.station?.holo.live(img); }

  say(b: Bot, text: string, dur = 4.5, moment = false) {
    if (!text) return;
    b.bubbleText = text;
    b.bubbleUntil = this.time + dur;
    if (moment) this.onMoment({ speaker: b.agent.name, text });
  }

  // Worklive's real subagents show up as little helper drones hovering over the station.
  subagents(id: string, count: number) {
    const b = this.bots.find(x => x.agent.id === id);
    if (!b) return;
    const n = Math.min(4, Math.max(0, count));
    while (b.drones.length > n) { const d = b.drones.pop()!; d.parent?.remove(d); }
    while (b.drones.length < n) {
      const d = new T.Group();
      this.kit.mesh(new T.SphereGeometry(0.11, 16, 10), this.kit.paint(b.spec.trim), d);
      const eye = this.kit.mesh(new T.SphereGeometry(0.04, 10, 8), this.kit.glow("#63d3ff"), d, { line: false });
      eye.position.set(0, 0.02, 0.09);
      const rotor = this.kit.box(0.34, 0.015, 0.05, this.kit.paint("#23262d"), d, 0.005);
      rotor.position.y = 0.13;
      d.userData.rotor = rotor;
      this.root.add(d);
      b.drones.push(d);
    }
  }

  coffeeBreak() {
    let n = 0;
    for (const b of this.bots) {
      if (b.arriving || feel(b.status, b.reason).plan !== "break") continue;
      const key = ["oil0", "oil1", "loiter0", "loiter1", "loiter4", "loiter5"].find(k => this.free(k, b));
      if (!key) continue;
      b.plan = "oil"; b.until = this.time + 14; this.claim(b, key); this.goTo(b, this.spots.get(key)!); n++;
    }
    return n;
  }

  achievement(on: boolean) { this.trophy.visible = on; }

  // ---------- planning ----------
  private free(key: string, b: Bot) { const t = this.taken.get(key); return !t || t === b; }
  private claim(b: Bot, key: string | null) {
    if (b.spotKey) this.taken.delete(b.spotKey);
    b.spotKey = key;
    if (key) this.taken.set(key, b);
  }
  private goTo(b: Bot, spot: Spot) {
    b.target = spot;
    b.path = route(b.mover.position, spot.pos);
    b.arrived = b.path.length === 0;
    if (b.station && b.plan !== "dock" && b.plan !== "celebrate") b.station.plug(null);
  }

  private decide(b: Bot, instant: boolean) {
    if (b.arriving) return;
    const f = feel(b.status === "complete" && b.celebrated ? "idle" : b.status, b.reason);
    b.emo = f.emo;
    let plan: Plan, key: string | null = null;
    if (f.plan === "review") { plan = "review"; key = ["hatch0", "hatch1", "queue0", "queue1"].find(k => this.free(k, b)) ?? null; if (!key) plan = "dock"; }
    else if (f.plan === "celebrate") plan = "celebrate";
    else if (f.plan === "dock") plan = "dock";
    else {
      const pick = (keys: string[]) => keys.find(k => this.free(k, b)) ?? null;
      const id = hash(b.agent.id) % 7; // a little personality per robot
      const opts: [Plan, string | null, number][] = [
        ["oil", pick(["oil0", "oil1"]), 3],
        ["window", pick(["window0", "window1"]), id === 1 ? 5 : 2],
        ["games", pick(["games0", "games1"]), id === 2 ? 5 : 2.5],
        ["wheel", pick(["wheel0"]), id === 3 ? 5 : 2],
        ["dance", pick(["dance0", "dance1"]), id === 0 ? 5 : 2.5],
        ["zen", pick(["zen0"]), id === 4 ? 4 : 1.2],
        ["rest", pick(["pod0", "pod1"]), id === 5 ? 3 : 0.6],
        ["kick", this.junk.some(j => !j.gone && this.bots.filter(c => c.plan === "kick" && c.ball === j).length < 3) ? "" : null, 12],
        ["wander", pick(PLACES.loiter.map((_, i) => `loiter${i}`).sort(() => Math.random() - 0.5)), 1.5],
        ["rewire", b.desk === null ? null : "", id === 6 ? 3 : 0.3],
      ];
      const avail = opts.filter(o => o[1] !== null && o[2] > 0);
      let r = Math.random() * avail.reduce((n, o) => n + o[2], 0);
      const o = avail.find(x => (r -= x[2]) <= 0) ?? avail[0];
      plan = o[0];
      key = o[1] || null;
    }
    b.plan = plan;
    b.until = this.time + (f.plan === "break" ? 12 + Math.random() * 10 : f.plan === "celebrate" ? 5 : 1e9);
    this.claim(b, key);
    let spot: Spot | null = b.home;
    if (key) spot = this.spots.get(key)!;
    else if (plan === "rewire") { const o = this.bots[Math.floor(Math.random() * this.bots.length)]; spot = o.home ? { pos: o.home.pos.clone().add(new T.Vector3(1.3, 0, 0.25)), face: -0.9 } : b.home; }
    if (plan === "kick") {
      b.ball = this.junk.filter(j => !j.gone && this.bots.filter(c => c.plan === "kick" && c.ball === j).length < 3)
        .sort((p, q) => p.group.position.distanceTo(b.mover.position) - q.group.position.distanceTo(b.mover.position))[0];
      b.kicks = 0; b.repath = 0;
      if (b.ball) { this.goTo(b, { pos: b.ball.group.position.clone().setY(0), face: 0 }); return; }
    }
    if (!spot) spot = { pos: v2(PLACES.loiter[hash(b.agent.id) % PLACES.loiter.length]), face: 0 };
    if (instant) {
      b.mover.position.copy(spot.pos); b.heading = spot.face; b.mover.rotation.y = spot.face; b.path = []; b.arrived = true; b.target = spot;
      if (plan === "dock" && b.station) b.station.plug(new T.Vector3(0, 0.75, -0.32));
    } else this.goTo(b, spot);
  }

  // ---------- junk, football, janitor (local fun, user-triggered) ----------
  drop(kind: JunkKind, at: T.Vector3) {
    if (this.junk.filter(j => !j.gone).length >= 12) { this.onMoment({ text: "Junk limit reached. Even Deck 7 has standards. Low ones." }); return; }
    const j = new Junk(kind, this.kit, at);
    this.junk.push(j);
    this.root.add(j.group);
    this.onMoment({ text: `Someone dropped ${JUNK_LABEL[kind].toLowerCase()} on the deck. Morale ${Math.random() < 0.5 ? "rises" : "plummets"}.` });
    for (const b of this.bots) if (b.plan !== "kick" && feel(b.status, b.reason).plan === "break" && Math.random() < 0.85) b.until = this.time + 0.3 + Math.random();
  }

  cleanUp() {
    if (!this.junk.some(j => !j.gone)) { this.onMoment({ text: "Nothing to clean. Janitor-9 is disappointed. Janitor-9 is always disappointed." }); return; }
    this.janitor.active = true;
    cue("janitor");
    this.janitor.group.position.copy(this.janitor.home);
    this.onMoment({ text: "Janitor-9 has been summoned. It is not happy about it." });
  }

  private clearLine(p: T.Vector3, q: T.Vector3) {
    const steps = Math.ceil(p.distanceTo(q) / 0.25);
    for (let i = 1; i <= steps; i++) {
      const x = p.x + ((q.x - p.x) * i) / steps, z = p.z + ((q.z - p.z) * i) / steps;
      if (this.boxes.some(b => x > b.x0 - 0.4 && x < b.x1 + 0.4 && z > b.z0 - 0.4 && z < b.z1 + 0.4)) return false;
    }
    return true;
  }
  private blocked(p: T.Vector3) {
    return this.boxes.some(b => p.x > b.x0 - 0.35 && p.x < b.x1 + 0.35 && p.z > b.z0 - 0.35 && p.z < b.z1 + 0.35) || p.x < this.walls.x0 + 0.3 || p.x > this.walls.x1 - 0.3 || p.z < this.walls.z0 + 0.4 || p.z > this.walls.z1 - 0.3;
  }
  private headTo(b: Bot, spot: T.Vector3, face: number) {
    b.target = { pos: spot, face };
    b.arrived = false;
    const onAisle = AISLES.some(z => Math.abs(b.mover.position.z - z) < 0.35);
    if (this.clearLine(b.mover.position, spot)) b.path = [spot];
    else if (onAisle || !b.path.length) b.path = route(b.mover.position, spot);
  }

  private playBall(b: Bot, t: number) {
    const ball = b.ball;
    if (!ball || ball.gone) { b.until = Math.min(b.until, t); return; }
    const bp = ball.group.position;
    const team = this.bots.filter(c => c.plan === "kick" && c.ball === ball);
    const striker = team.slice().sort((p, q) => p.mover.position.distanceTo(bp) - q.mover.position.distanceTo(bp))[0];
    if (striker !== b) { // spread out and wait for a pass
      if (t > (b.repath ?? 0)) {
        b.repath = t + 0.8;
        const ang = (team.indexOf(b) / Math.max(1, team.length)) * Math.PI * 2 + 0.6;
        const spot = new T.Vector3(T.MathUtils.clamp(bp.x + Math.cos(ang) * 2.4, -10, 10), 0, T.MathUtils.clamp(bp.z + Math.sin(ang) * 1.8, -6.6, 11));
        if (this.blocked(spot)) spot.set(bp.x + Math.cos(ang + 1.5) * 2, 0, AISLES.reduce((m, z) => (Math.abs(z - bp.z) < Math.abs(m - bp.z) ? z : m), AISLES[0]));
        const d = bp.clone().sub(spot);
        this.headTo(b, spot, Math.atan2(d.x, d.z));
      }
      return;
    }
    const mate = team.filter(c => c !== b).sort((p, q) => p.mover.position.distanceTo(bp) - q.mover.position.distanceTo(bp))[0];
    const aim = (mate && (b.kicks ?? 0) % 3 !== 2 ? mate.mover.position : this.bin).clone().sub(bp).setY(0).normalize(); // every third kick goes for goal
    let behind = bp.clone().addScaledVector(aim, -0.45).setY(0);
    if (this.blocked(behind)) behind = bp.clone().setY(0);
    if (t > (b.repath ?? 0)) { b.repath = t + 0.45; this.headTo(b, behind, Math.atan2(aim.x, aim.z)); }
    if (b.mover.position.distanceTo(bp.clone().setY(0)) < 0.62 && bp.y < 0.5 && (b.kickT ?? 0) < t - 0.6) {
      const away = bp.clone().sub(b.mover.position).setY(0).normalize();
      ball.kick(aim.dot(away) > 0.2 ? aim : away, 2.2 + Math.random() * 1.6, b.agent.id);
      cue("kick");
      b.kickT = t + 0.35;
      b.kicks = (b.kicks ?? 0) + 1;
      b.heading = Math.atan2(aim.x, aim.z);
      if (Math.random() < 0.2) this.say(b, ["Mine!", "Calculated. Mostly.", "Pass! PASS!", "This is the best meeting all week."][Math.floor(Math.random() * 4)], 1.8);
    }
  }

  private stepJunk(dt: number, t: number) {
    const bumpers = this.bots.filter(b => !b.spotKey?.startsWith("pod") && !b.arriving).map(b => b.mover.position);
    for (const j of this.junk) {
      if (j.gone) {
        const s = Math.max(0.001, j.group.scale.x - dt * 3);
        j.group.scale.setScalar(s);
        if (s <= 0.001 && j.group.parent) j.group.parent.remove(j.group);
        continue;
      }
      j.step(dt, this.walls, this.boxes, bumpers);
      const p = j.group.position;
      if (Math.hypot(p.x - this.bin.x, p.z - this.bin.z) < 0.34 && p.y < 1.0) {
        j.gone = true;
        const who = this.bots.find(b => b.agent.id === j.kickedBy);
        cue("goal");
        this.onMoment({ text: `GOAL! ${who ? who.agent.name : "Physics"} put the ${JUNK_LABEL[j.kind].toLowerCase()} in the bin. Deck 7 is technically cleaner.` });
        if (who) this.say(who, ["GOAL. Put it on my review.", "And the crowd goes… silent.", "Recycling, but make it sport."][Math.floor(Math.random() * 3)]);
      }
    }
    if (this.janitor.step(dt, t, this.junk) && Math.random() < 0.5) this.onMoment({ speaker: "Janitor-9", text: ["Another one. Nobody thanks the janitor.", "I have a degree in fluid dynamics.", "Who throws a duck? Who."][Math.floor(Math.random() * 3)] });
    if (this.junk.length > 40) this.junk = this.junk.filter(j => !j.gone || j.group.parent);
  }

  // ---------- per frame ----------
  update(dt: number, t: number) {
    this.time = t;
    this.room.update(t, dt);
    // the gaming station: two players mash buttons and take turns winning; alone, it's attract mode
    const players = this.bots.filter(b => b.plan === "games" && b.arrived);
    this.screen.players = players.length;
    const runner = this.bots.some(b => b.plan === "wheel" && b.arrived && !b.moving);
    this.wheel.update(dt, runner, this.charge);
    this.room.boost = this.charge.v; // the generator really powers the lights
    const dancers = this.bots.filter(b => b.plan === "dance" && b.arrived && !b.moving).length;
    this.juke.update(t, dancers);
    jukeboxMusic(dancers > 0);
    this.screen.update(t);
    const leader = Math.floor(t / 6) % 2;
    players.forEach((p, i) => {
      p.gameAct = "mash";
      p.gameEmo = players.length === 2 ? (i === leader ? "happy" : "angry") : "waiting";
    });

    for (const b of this.bots) {
      if (b.arriving) { b.robot.update(dt, t, b.input); continue; }
      if (t > b.until) { if (b.plan === "celebrate") b.celebrated = true; this.decide(b, false); }
      // the review queue moves up when a hatch spot frees
      if (b.plan === "review" && b.spotKey?.startsWith("queue")) {
        const k = ["hatch0", "hatch1"].find(h => this.free(h, b));
        if (k) { this.claim(b, k); this.goTo(b, this.spots.get(k)!); }
      }
      if (b.plan === "kick") this.playBall(b, t);
      // walk with manners: keep a following distance behind whoever is ahead in my lane, and step
      // around someone who is standing still (or after waiting too long) instead of shoving them
      let speed = b.plan === "kick" ? 2.1 : 1.25;
      if (b.path.length) speed *= this.traffic(b, dt);
      const { path, dir } = walk(b.mover.position, b.path, speed, dt);
      b.path = path;
      b.moving = !!dir || (speed === 0 && b.path.length > 0);
      if (dir) b.heading = Math.atan2(dir.x, dir.z);
      else if (b.target && !b.arrived) {
        b.arrived = true;
        b.heading = b.target.face;
        if ((b.plan === "dock" || b.plan === "celebrate") && b.station) b.station.plug(new T.Vector3(0, 0.75, -0.32));
        if (b.plan !== "kick" && b.plan !== "wander" && Math.random() < 0.35) this.say(b, remark(b.spec.id, (b.plan === "dock" || b.plan === "celebrate" || b.plan === "review" ? b.emo : b.plan === "rest" ? "pod" : b.plan) as Act));
      }
      let dh = b.heading - b.mover.rotation.y;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      b.mover.rotation.y += dh * Math.min(1, dt * 8);
      b.mover.position.y = b.arrived && b.target?.pos.y ? b.target.pos.y : 0;

      // what it feels and shows
      const working = b.plan === "dock" || b.plan === "review" || b.plan === "celebrate";
      const breakEmo: Emotion = b.plan === "kick" ? "happy" : b.plan === "games" ? b.gameEmo ?? "waiting" : b.plan === "dance" ? "happy" : b.plan === "wheel" ? "working" : b.plan === "zen" || b.plan === "rest" ? "sleepy" : b.plan === "rewire" ? "angry" : b.plan === "window" ? "thinking" : "idle";
      b.input.emotion = working ? (b.plan === "celebrate" ? "happy" : b.emo) : breakEmo;
      b.input.walking = b.moving || (b.plan === "wheel" && b.arrived) ? 1 : 0; // the wheel: running on the spot
      b.input.act = b.plan === "kick" ? ((b.kickT ?? 0) > t ? "kick" : undefined) : b.moving || !b.arrived ? undefined
        : b.plan === "oil" ? "sip" : b.plan === "games" ? b.gameAct : b.plan === "dance" ? "dance" : b.plan === "zen" ? "rake" : b.plan === "window" ? "stare" : undefined;
      if (b.station) {
        const atDesk = (b.plan === "dock" || b.plan === "celebrate") && b.arrived;
        b.station.holo.mode = (atDesk ? (b.plan === "celebrate" ? "happy" : b.emo) : b.plan === "review" ? "attention" : "away") as HoloMode;
        if (b.station.group.scale.x < 1) b.station.group.scale.setScalar(Math.min(1, b.station.group.scale.x + dt * 2));
        b.station.holo.update(t, dt);
      }
      b.robot.update(dt, t, b.input);
      // helper drones circle the station (or the robot when it's away)
      b.drones.forEach((d, i) => {
        const c = b.home?.pos ?? b.mover.position, a = t * 1.3 + (i / b.drones.length) * Math.PI * 2;
        d.position.set(c.x + Math.cos(a) * 0.9, 2.25 + Math.sin(t * 3 + i) * 0.12, c.z + Math.sin(a) * 0.6);
        d.rotation.y = -a;
        (d.userData.rotor as T.Object3D).rotation.y = t * 30;
      });
      // occasional muttering (scripted; never a model call)
      if (t > b.nextSay) { b.nextSay = t + 16 + Math.random() * 20; if (Math.random() < 0.45) this.say(b, remark(b.spec.id, (b.moving ? "walk" : working ? b.emo : b.plan === "rest" ? "pod" : b.plan === "wander" ? "walk" : b.plan) as Act), 4.5, Math.random() < 0.3); }
    }
    this.separate();
    // deliveries: lower the chute, drop the crate, sweep up afterwards
    for (const { d } of this.deliveries) if (d.opened || this.chute.position.y < 0.4) d.update(dt, 1);
    const want = this.deliveries.some(x => !x.d.opened) ? 0 : 7;
    this.chute.position.y += (want - this.chute.position.y) * Math.min(1, dt * (want ? 1.5 : 4));
    this.chute.visible = this.chute.position.y < 6.5;
    for (const l of this.leftovers) { l.t += dt; if (l.t > 6) l.g.scale.setScalar(Math.max(0.001, 1 - (l.t - 6) * 1.5)); if (l.t > 6.7) l.g.parent?.remove(l.g); }
    this.leftovers = this.leftovers.filter(l => l.t <= 6.7);
    this.stepJunk(dt, t);
  }

  private traffic(b: Bot, dt: number) {
    const pos = b.mover.position, ahead = b.path[0].clone().sub(pos).setY(0);
    const toGo = ahead.length();
    if (toGo < 1e-3) return 1;
    ahead.multiplyScalar(1 / toGo);
    let gap = Infinity, blocker: Bot | null = null;
    b.waitingFor = null;
    for (const o of this.bots) {
      if (o === b || o.arriving || o.spotKey?.startsWith("pod")) continue;
      const d = o.mover.position.clone().sub(pos).setY(0);
      const along = d.dot(ahead), side = Math.abs(d.x * ahead.z - d.z * ahead.x);
      if (b.path.length === 1 && along > toGo + 0.2) continue; // they're past where I'm going
      if (along > -0.2 && along < 1.6 && side < 0.78 && along < gap) { gap = along; blocker = o; } // 0.78: wider than the 0.72 spacing
    }
    b.waitingFor = blocker;
    if (!blocker) { b.yieldT = 0; return 1; }
    // two robots waiting for each other (a crossing, a narrow spot): the earlier one goes first
    if (blocker.waitingFor === b && this.bots.indexOf(b) < this.bots.indexOf(blocker)) { b.yieldT = 0; return 0.6; }
    const k = T.MathUtils.clamp((gap - 0.8) / 0.7, 0, 1); // full speed from 1.5 m, stop at 0.8 m
    b.yieldT = k === 0 ? b.yieldT + dt : 0;
    if (b.yieldT > (blocker.moving ? 2.5 : 0.8)) {
      // go around: a waypoint beside the blocker, on the side I'm already leaning towards
      const left = new T.Vector3(-ahead.z, 0, ahead.x);
      const lean = Math.sign(left.dot(blocker.mover.position.clone().sub(pos))) || 1;
      for (const sideSign of [-lean, lean]) {
        const detour = blocker.mover.position.clone().addScaledVector(left, sideSign * 0.95).setY(0);
        if (!this.blocked(detour)) { b.path = [detour, ...b.path]; break; }
      }
      b.yieldT = 0;
    }
    return k;
  }

  private anchored(b: Bot) { return b.arriving || (!b.moving && b.arrived && b.plan !== "kick" && b.plan !== "wander"); }
  private separate() {
    const R = 0.72; // last resort only; traffic() keeps them apart while walking
    for (let i = 0; i < this.bots.length; i++) for (let j = i + 1; j < this.bots.length; j++) {
      const a = this.bots[i], b = this.bots[j];
      const fa = this.anchored(a), fb = this.anchored(b);
      if (fa && fb) continue;
      const d = b.mover.position.clone().sub(a.mover.position).setY(0);
      const dist = d.length();
      if (dist >= R) continue;
      const n = dist > 1e-4 ? d.multiplyScalar(1 / dist) : new T.Vector3(1, 0, 0);
      const push = R - dist;
      if (push > 0.03) { this.stats.shoves++; const k = [a, b].map(x => `${x.plan}${x.moving ? "~" : x.arrived ? "@" : "?"}`).sort().join(" | "); this.stats.why[k] = (this.stats.why[k] || 0) + 1; }
      if (!fa && !fb) { a.mover.position.addScaledVector(n, -push / 2); b.mover.position.addScaledVector(n, push / 2); }
      else if (!fa) a.mover.position.addScaledVector(n, -push);
      else b.mover.position.addScaledVector(n, push);
    }
  }

  dispose() {
    this.bots.forEach(b => { b.robot.dispose(); b.station?.holo.dispose(); });
    this.kit.dispose();
  }
}

export { logLine };
