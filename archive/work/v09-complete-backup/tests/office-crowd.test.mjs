// Office movement (src/office/nav.js + crowd.js): nobody overlaps furniture or each other, breaks work,
// tasks call agents back without teleporting, and the simulation is deterministic.
import test from "node:test";
import assert from "node:assert/strict";
import { NavGrid, buildObstacles, buildSpots, AGENT_RADIUS } from "../src/office/nav.js";
import { Crowd, rng } from "../src/office/crowd.js";
import { DESKS, seatOf, deskApproach } from "../src/office/layout.js";

const grid = new NavGrid(buildObstacles());
const deskSpot = (i, pose = "sit") => { const s = seatOf(DESKS[i]); return { id: "desk" + i, at: { x: s.x, z: s.z }, yaw: s.yaw, pose, via: deskApproach(s) }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const SPEED = 1.15, DT = 1 / 30;

function team(seed, n = 20, deskMode = 4) {
  const crowd = new Crowd({ grid, spots: buildSpots(), random: rng(seed) });
  for (let i = 0; i < n; i++) crowd.add({ id: "a" + i, home: i < DESKS.length ? deskSpot(i) : null, mode: i < deskMode ? "desk" : "wander" });
  return crowd;
}

for (const seed of [1, 7, 42]) {
  test(`20 agents for 5 minutes stay clear of furniture and each other (seed ${seed})`, () => {
    const crowd = team(seed);
    let walkFrames = 0, bunched = 0;
    for (let f = 0; f < 5 * 60 * 30; f++) {
      crowd.step(DT);
      const A = crowd.agents;
      for (let i = 0; i < A.length; i++) {
        const a = A[i];
        if (a.state === "walking") {
          assert.ok(grid.freeAt(a.x, a.z), `${a.id} walked into furniture at ${a.x.toFixed(2)}, ${a.z.toFixed(2)}`);
          walkFrames++;
          if (A.some(b => b !== a && (b.state === "walking" || b.state === "leaving") && dist(a, b) < 1)) bunched++;
        }
        for (let j = i + 1; j < A.length; j++)
          assert.ok(dist(a, A[j]) >= 2 * AGENT_RADIUS - 0.01, `${a.id} overlaps ${A[j].id} at frame ${f}`);
      }
    }
    assert.ok(crowd.stats.arrivals >= 50, `only ${crowd.stats.arrivals} arrivals — agents got stuck`);
    assert.ok(bunched / walkFrames < 0.08, `walkers bunched ${(100 * bunched / walkFrames).toFixed(1)} % of the time`);
  });
}

test("a coffee break sends free agents to distinct café spots", () => {
  const crowd = team(3, 6, 0);
  for (let f = 0; f < 60; f++) crowd.step(DT);
  const sent = crowd.agents.filter(a => crowd.sendTo(a.id, /^(counter|cafe)/)).map(a => a.id);
  assert.equal(sent.length, 5, "five café spots for six free agents");
  const reached = new Set();
  for (let f = 0; f < 90 * 30; f++) {
    crowd.step(DT);
    const here = crowd.agents.filter(a => a.state === "seated" && /^(counter|cafe)/.test(a.spot?.id || ""));
    assert.equal(new Set(here.map(a => a.spot.id)).size, here.length, "two agents on one café spot");
    for (const a of here) if (sent.includes(a.id)) reached.add(a.id);
  }
  assert.ok(reached.size >= 4, `only ${reached.size} of 5 reached the café`);
});

test("a task calls an agent back to its desk without teleporting", () => {
  const crowd = team(5, 6, 0);
  for (let f = 0; f < 40 * 30; f++) crowd.step(DT);
  const a = crowd.agents[2];
  crowd.setMode(a.id, "desk");
  let prev = { x: a.x, z: a.z };
  for (let f = 0; f < 90 * 30 && !(a.state === "seated" && a.spot?.id === "desk2"); f++) {
    crowd.step(DT);
    assert.ok(dist(a, prev) <= SPEED * DT * 1.6 + 1e-6, `jumped ${dist(a, prev).toFixed(3)} m in one frame`);
    prev = { x: a.x, z: a.z };
  }
  assert.equal(a.state, "seated");
  assert.equal(a.spot.id, "desk2");
});

test("zero time step freezes everyone", () => {
  const crowd = team(9, 10, 2);
  for (let f = 0; f < 300; f++) crowd.step(DT);
  const before = crowd.agents.map(a => [a.x, a.z, a.yaw]);
  for (let f = 0; f < 100; f++) crowd.step(0);
  assert.deepEqual(crowd.agents.map(a => [a.x, a.z, a.yaw]), before);
});

test("new hires arriving at the same entrance point never produce invalid positions", () => {
  const crowd = new Crowd({ grid, spots: buildSpots(), random: rng(3) });
  for (let i = 0; i < 6; i++) crowd.add({ id: "e" + i, mode: "wander", start: { x: -1.5, z: 9.1 } });
  for (let f = 0; f < 1800; f++) crowd.step(DT);
  for (const a of crowd.agents) assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z) && Number.isFinite(a.yaw), `${a.id} has NaN`);
});

test("the same seed gives the same office", () => {
  const run = () => { const c = team(11, 12, 3); for (let f = 0; f < 1500; f++) c.step(DT); return c.agents.map(a => [a.x.toFixed(6), a.z.toFixed(6), a.state]); };
  assert.deepEqual(run(), run());
});
