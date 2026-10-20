// 20 agents, 5 simulated minutes: nobody overlaps furniture or each other, and everyone keeps moving.
import { NavGrid, buildObstacles, buildSpots, AGENT_RADIUS } from "../nav.js";
import { Crowd, rng } from "../crowd.js";
import { DESKS, seatOf, deskApproach } from "../layout.js";

const grid = new NavGrid(buildObstacles());
const deskSpot = i => { const s = seatOf(DESKS[i]); return { id: "desk" + i, at: { x: s.x, z: s.z }, yaw: s.yaw, pose: "type", via: deskApproach(s) }; };
let failures = 0;
for (const seed of [1, 7, 42]) {
  const crowd = new Crowd({ grid, spots: buildSpots(), random: rng(seed) });
  for (let i = 0; i < 20; i++) crowd.add({ id: "a" + i, home: i < DESKS.length ? deskSpot(i) : null, mode: i < 4 ? "desk" : "wander" });
  const dt = 1 / 30, arrivals = new Map();
  let minGap = Infinity, wallHits = 0, worst = "", walkFrames = 0, crowdedFrames = 0, maxWalkers = 0, stuckInSeat = 0;
  for (let f = 0; f < 5 * 60 * 30; f++) {
    // Flip a desk agent to wandering and back now and then (task finished / new task).
    if (f === 3000) crowd.setMode("a1", "wander");
    if (f === 6000) crowd.setMode("a1", "desk");
    crowd.step(dt);
    const A = crowd.agents;
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      if (a.state === "walking" && !grid.freeAt(a.x, a.z)) wallHits++;
      if ((a.state === "leaving" || a.state === "settling") && a.slide && a.slide.time > 3) stuckInSeat++;
      if (a.state === "walking") {
        walkFrames++;
        // Bunching = another walker within 1.0 m (tailgating / walking in a clump).
        // Passing someone who sits or stands still is normal and not counted.
        if (A.some(b => b !== a && (b.state === "walking" || b.state === "leaving") && Math.hypot(a.x - b.x, a.z - b.z) < 1.0)) crowdedFrames++;
      }
      for (let j = i + 1; j < A.length; j++) {
        const g = Math.hypot(a.x - A[j].x, a.z - A[j].z);
        if (g < minGap) { minGap = g; worst = `${a.id}(${a.state}) ↔ ${A[j].id}(${A[j].state}) at frame ${f}`; }
      }
    }
    maxWalkers = Math.max(maxWalkers, A.filter(a => a.state === "walking").length);
  }
  const s = crowd.stats;
  const crowded = crowdedFrames / Math.max(1, walkFrames);
  const ok = minGap >= 2 * AGENT_RADIUS - 0.01 && wallHits === 0 && s.arrivals >= 60 && crowded < 0.08 && stuckInSeat === 0;
  if (!ok) failures++;
  console.log(`seed ${seed}: ${ok ? "PASS" : "FAIL"} · min centre gap ${minGap.toFixed(3)} m (limit ${(2 * AGENT_RADIUS).toFixed(2)}) ${worst} · obstacle hits ${wallHits} · arrivals ${s.arrivals} · replans ${s.replans} · give-ups ${s.giveups} · walker bunching ${(crowded * 100).toFixed(1)}% of walking time (limit 8%) · max walking at once ${maxWalkers} · stuck-in-seat frames ${stuckInSeat}`);
}
if (failures) process.exitCode = 1;

// Regression: several agents added at the same point (e.g. new hires at the entrance) must never produce NaN.
{
  const crowd = new Crowd({ grid, spots: buildSpots(), random: rng(3) });
  for (let i = 0; i < 6; i++) crowd.add({ id: "e" + i, mode: "wander", start: { x: -1.5, z: 9.1 } });
  for (let f = 0; f < 1800; f++) crowd.step(1 / 30);
  const bad = crowd.agents.filter(a => !Number.isFinite(a.x) || !Number.isFinite(a.z) || !Number.isFinite(a.yaw));
  const A = crowd.agents; let gap = Infinity;
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) gap = Math.min(gap, Math.hypot(A[i].x - A[j].x, A[i].z - A[j].z));
  const ok = !bad.length && gap >= 2 * AGENT_RADIUS - 0.01;
  console.log(`same-spawn: ${ok ? "PASS" : "FAIL"} · NaN agents ${bad.length} · min gap after 60 s ${gap.toFixed(3)} m`);
  if (!ok) process.exitCode = 1;
}
