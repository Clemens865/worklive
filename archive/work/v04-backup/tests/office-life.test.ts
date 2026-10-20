import test from "node:test";
import assert from "node:assert/strict";
import { OfficeLife, PERSONAL_SPACE } from "../src/office-life.ts";

function advance(life: OfficeLife, seconds: number, inspect = () => {}) {
  for (let i = 0; i < seconds * 30; i++) {
    life.update(1 / 30);
    inspect();
  }
}
function assertClear(life: OfficeLife) {
  for (const a of life.residents) {
    assert.ok(
      life.walkable(a, a),
      `${a.id} intersects furniture at ${a.x}, ${a.z}`,
    );
    for (const b of life.residents)
      if (a !== b)
        assert.ok(
          Math.hypot(a.x - b.x, a.z - b.z) >= PERSONAL_SPACE - 1e-6,
          `${a.id} overlaps ${b.id}`,
        );
  }
}
test("six agents reach distinct coffee spots without crossing each other or furniture", () => {
  const life = new OfficeLife();
  for (let i = 0; i < 6; i++) life.add("agent" + i, "Agent " + i);
  assert.equal(life.coffeeBreak(), 6);
  const arrived = new Set();
  advance(life, 70, () => {
    assertClear(life);
    for (const a of life.residents) if (a.phase === "coffee") arrived.add(a.id);
  });
  assert.equal(
    arrived.size,
    6,
    `Arrived: ${[...arrived]}; positions: ${JSON.stringify(life.residents.map((a) => [a.id, a.phase, a.x, a.z, a.path.length]))}`,
  );
});
test("an assigned task interrupts a break and walks the agent back without teleporting", () => {
  const life = new OfficeLife();
  const a = life.add("ada", "Ada");
  life.add("milo", "Milo");
  life.coffeeBreak();
  advance(life, 14);
  const before = { x: a.x, z: a.z };
  life.setBusy("ada", true);
  assert.deepEqual({ x: a.x, z: a.z }, before);
  advance(life, 30, () => assertClear(life));
  assert.equal(a.phase, "working");
  assert.ok(Math.hypot(a.x - a.home.x, a.z - a.home.z) < 0.04);
  assert.equal(a.spot, null);
  assert.equal(a.bubble, "");
  assert.equal(life.coffeeBreak(), 1);
});
test("coffee conversations include two speakers; solo agents do not talk to themselves", () => {
  const moments: { speaker?: string; text: string }[] = [];
  const life = new OfficeLife((m) => moments.push(m));
  life.add("ada", "Ada");
  life.add("milo", "Milo");
  life.coffeeBreak();
  advance(life, 32);
  const speakers = new Set(
    moments.filter((m) => m.speaker).map((m) => m.speaker),
  );
  assert.ok(speakers.has("Ada") && speakers.has("Milo"));
  const soloMessages: { speaker?: string; text: string }[] = [];
  const solo = new OfficeLife((m) => soloMessages.push(m));
  solo.add("one", "Solo");
  solo.coffeeBreak();
  advance(solo, 24);
  assert.equal(soloMessages.filter((m) => m.speaker).length, 0);
});
test("zero elapsed time freezes positions and routines; long frames preserve spacing", () => {
  const life = new OfficeLife();
  for (let i = 0; i < 6; i++) life.add("a" + i, "Agent " + i);
  life.coffeeBreak();
  advance(life, 5);
  const before = JSON.stringify(life.residents);
  life.update(0);
  assert.equal(JSON.stringify(life.residents), before);
  for (let i = 0; i < 160; i++) {
    life.update(0.25);
    assertClear(life);
  }
});

test("daily routines stay clear across new arrivals and all agents returning to work", () => {
  const life = new OfficeLife();
  life.add("a0", "Ada");
  life.add("a1", "Milo");
  life.coffeeBreak();
  advance(life, 6, () => assertClear(life));
  for (let i = 2; i < 6; i++) life.add("a" + i, "Agent " + i);
  const seen = new Set<string>();
  advance(life, 190, () => {
    assertClear(life);
    for (const a of life.residents) seen.add(a.phase);
  });
  assert.ok(seen.has("stretch") && seen.has("plant"));
  for (const a of life.residents) life.setBusy(a.id, true);
  advance(life, 45, () => assertClear(life));
  assert.ok(life.residents.every((a) => a.phase === "working"));
});
