import * as T from "three";
import { COLLIDERS, boxDistance, colliderCentre } from "./colliders.js";
import { probeWorld } from "./probes.js";

// Read-only pose-check data on window.__worklive.comic. With ?posecheck the worst penetration of every
// body probe vs furniture boxes, the floor and the agent's own head/torso is recorded every frame.
const TOL = 0.02;           // hard surfaces
const SOFT = 0.035;         // cushions may compress a little under seat/back contact
const params = new URLSearchParams(location.search);

export function exposeDebug(scene) {
  const worst = new Map(); // key agent|probe|target -> depth
  let frames = 0;
  // Full-size agents only (subagent helpers are scaled-down copies standing on desks).
  const chars = () => { const a = []; scene.traverse(o => { if (o.userData.probes && o.scale.x > 0.9) a.push(o); }); return a; };
  const note = (agent, probe, target, depth, tol) => {
    if (depth <= 0) return;
    const k = agent + "|" + probe + "|" + target, cur = worst.get(k);
    if (!cur || depth > cur.depth) worst.set(k, { agent, probe, target, depth, tol });
  };
  const _w = new T.Vector3(), _a = new T.Vector3(), _c = new T.Vector3();
  // Agent vs agent: any two probes of different agents closer than their radii (neighbours on the sofa etc.).
  function pairs(list) {
    const W = list.map(r => ({ id: r.userData.agentId, pos: r.getWorldPosition(new T.Vector3()), P: r.userData.probes.map(p => ({ p, w: probeWorld(p, new T.Vector3()) })) }));
    for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
      if (W[i].pos.distanceTo(W[j].pos) > 1.6) continue;
      for (const a of W[i].P) for (const b of W[j].P) {
        const d = a.p.r + b.p.r - a.w.distanceTo(b.w);
        note(W[i].id, a.p.name, "agent:" + W[j].id + "." + b.p.name, d, TOL);
        note(W[j].id, b.p.name, "agent:" + W[i].id + "." + a.p.name, d, TOL);
      }
    }
  }
  function tick() {
    frames++;
    const list = chars();
    for (const r of list) r.updateMatrixWorld(true);
    pairs(list);
    for (const root of list) {
      root.updateMatrixWorld(true);
      const id = root.userData.agentId, P = root.userData.probes;
      root.getWorldPosition(_a);
      const near = COLLIDERS.filter(c => c.obj.visible !== false && colliderCentre(c, _c).distanceTo(_a) < 2.2);
      const core = P.filter(p => p.kind === "core").map(p => ({ p, w: probeWorld(p, new T.Vector3()) }));
      for (const p of P) {
        probeWorld(p, _w);
        for (const c of near) {
          const soft = c.soft && (p.kind === "core" || p.name.startsWith("thigh") || p.name.startsWith("upperarm"));
          note(id, p.name, c.name, p.r - boxDistance(c, _w), soft ? SOFT : TOL);
        }
        note(id, p.name, "floor", p.r - _w.y, TOL);
        // Self contact: hands / forearms / upper arms must not enter the head or torso.
        if (p.kind === "core") continue;
        for (const { p: q, w } of core) {
          if (q.name !== "head" && !(p.kind === "hand" || p.name.startsWith("forearm"))) continue;
          if (q.name === "pelvis") continue;
          note(id, p.name, "self:" + q.name, p.r + q.r - _w.distanceTo(w), TOL);
        }
      }
    }
  }
  function report() {
    const agents = {};
    for (const root of chars()) agents[root.userData.agentId] = { spot: root.userData.spot, pose: root.userData.pose, status: root.userData.status, fails: [], worst: 0 };
    for (const r of worst.values()) {
      const A = agents[r.agent]; if (!A) continue;
      const over = r.depth - r.tol;
      A.worst = Math.max(A.worst, over);
      if (over > 0) A.fails.push({ probe: r.probe, target: r.target, depthCm: +(r.depth * 100).toFixed(1), tolCm: r.tol * 100 });
    }
    for (const A of Object.values(agents)) { A.fails.sort((a, b) => b.depthCm - a.depthCm); A.pass = A.fails.length === 0; }
    return { frames, agents };
  }
  window.__worklive = window.__worklive || {};
  window.__worklive.comic = {
    colliders: () => COLLIDERS.map(c => ({ name: c.name, centre: colliderCentre(c).toArray().map(v => +v.toFixed(2)) })),
    report, reset: () => { worst.clear(); frames = 0; },
    probes: (id) => { const r = chars().find(o => o.userData.agentId === id); if (!r) return null; r.updateMatrixWorld(true);
      return r.userData.probes.map(p => [p.name, ...probeWorld(p, new T.Vector3()).toArray().map(v => +v.toFixed(3)), +p.r.toFixed(3)]); },
  };
  if (params.has("posecheck")) {
    const delay = +(params.get("posecheck") || 2) * 1000, t0 = performance.now();
    const orig = scene.onAfterRender;
    scene.onAfterRender = (...a) => { orig?.(...a); if (performance.now() - t0 > delay) tick(); };
  }
}
