// Character fit check: builds one character and runs it through the office poses, then reports what clips or floats.
// Used by tests/character-fit.test.mjs (every body × top × head × accessory, plus proportion extremes) and by the
// workbench ("Check this character"). Pure three.js, no DOM, so it runs in Node.
//
// Checks
//  - furniture: seated at a real desk (sit, type), body probes must not cut into the desk, drawer, chair arms or monitor
//    (2 cm; cushions 3.5 cm), the same probes and colliders as the office pose check
//  - floor: standing feet neither sink into the floor nor float above it
//  - self: hands and forearms stay out of the head and torso in every pose
//  - layers: outfit pieces (collar, buttons, tie, bib, straps…) sit on the torso, glasses and ears on the head:
//    not sunk into the surface they belong to and not floating off it
import * as T from "three";
import { buildCharacter } from "./character.js";
import { buildDesk } from "./desks.js";
import { COLLIDERS, boxDistance } from "./colliders.js";
import { probeWorld } from "./probes.js";
import { seatOf } from "../../layout.js";

export const FIT = { furniture: 0.02, cushion: 0.035, floorSink: 0.015, floorFloat: 0.03, self: 0.02, sunk: 0.004, float: 0.012, sunkShare: 0.5 };
// [pose, seated at the desk, status]: statuses change the arms (wave, hands behind the head), so they are checked too.
const POSES = [["stand", false, "idle"], ["walk", false, "idle"], ["coffee", false, "idle"], ["stand", false, "needs"], ["stand", false, "review"],
  ["sit", true, "idle"], ["sit", true, "needs"], ["sit", true, "review"], ["type", true, "working"]];

let deskSet = null;
function desk() {
  if (deskSet) return deskSet;
  const room = new T.Group(), before = COLLIDERS.length;
  buildDesk(room, 0, { x: 0, z: 0 });
  room.updateMatrixWorld(true);
  // Keep this test desk's colliders to ourselves (the office and the workbench share the COLLIDERS list).
  return (deskSet = { room, colliders: COLLIDERS.splice(before), seat: seatOf({ x: 0, z: 0 }) });
}

/** Run every check for one agent ({id, provider, look, lookSeed}). Returns a list of issues (empty = fits). */
export function checkCharacter(agent) {
  const issues = [], seen = new Map();
  // amount: centimetres of overlap or gap, or for "sunk in" the share of the piece below the surface (%)
  const note = (kind, what, amount, pose, unit = "cm") => {
    const key = kind + what, prev = seen.get(key);
    if (prev && prev.amount >= amount) return;
    const issue = { kind, what, amount: Math.round(amount * 10) / 10, unit, pose };
    if (prev) issues[issues.indexOf(prev)] = issue; else issues.push(issue);
    seen.set(key, issue);
  };
  const c = buildCharacter(agent, 0, { merge: false }), root = c.root, P = root.userData.probes;
  const { colliders, seat } = desk();
  const ctx = { status: "idle", lookAt: null, camDist: 3, mode: "preview", chair: null, spot: null };

  // Layers are checked in the rest pose, standing at the origin facing +z.
  c.update(0, 1 / 30, "stand", ctx); root.updateMatrixWorld(true);
  layers(root, note);

  for (const [pose, seated, status] of POSES) {
    ctx.status = status;
    if (seated) { root.position.set(seat.x, 0, seat.z); root.rotation.y = seat.yaw; } else { root.position.set(0, 0, 0); root.rotation.y = 0; }
    for (let f = 0; f < 45; f++) {
      const t = f / 30;
      c.update(t, 1 / 30, pose, ctx);
      if (f < 15 || f % 5) continue;   // let the pose settle, then sample
      root.updateMatrixWorld(true);
      const core = P.filter(p => p.kind === "core").map(p => ({ p, w: probeWorld(p, new T.Vector3()) }));
      for (const p of P) {
        const w = probeWorld(p, new T.Vector3());
        if (seated) for (const col of colliders) {
          const soft = col.soft && (p.kind === "core" || p.name.startsWith("thigh") || p.name.startsWith("upperarm"));
          const over = p.r - boxDistance(col, w) - (soft ? FIT.cushion : FIT.furniture);
          if (over > 0) note("furniture", `${p.name} into ${col.name.replace(/\d+$/, "")}`, over * 100, `${pose}/${status}`);
        }
        if (pose === "stand" && p.kind === "foot") {
          if (p.r - w.y > FIT.floorSink) note("floor", `${p.name} sinks into the floor`, (p.r - w.y) * 100, pose);
        }
        if (p.kind === "core" || !(p.kind === "hand" || p.name.startsWith("forearm"))) continue;
        for (const { p: q, w: qw } of core) {
          if (q.name === "pelvis") continue;
          const over = p.r + q.r - w.distanceTo(qw) - FIT.self;
          if (over > 0) note("self", `${p.name} into ${q.name}`, over * 100, `${pose}/${status}`);
        }
      }
      if (pose === "stand") {
        const low = Math.min(...P.filter(p => p.kind === "foot").map(p => probeWorld(p, new T.Vector3()).y - p.r));
        if (low > FIT.floorFloat) note("floor", "feet float above the floor", low * 100, pose);
      }
    }
  }
  return issues;
}

// ---------- layers ----------
const ray = new T.Raycaster(), _v = new T.Vector3(), _o = new T.Vector3(), _d = new T.Vector3();
function layers(root, note) {
  const surfaces = { torso: [], head: [] }, pieces = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    if (surfaces[o.userData.surface]) surfaces[o.userData.surface].push(o);
    if (o.userData.on) pieces.push(o);
  });
  // Rays start inside the body and hit the surface from behind: test both sides.
  const restore = [];
  for (const m of [...surfaces.torso, ...surfaces.head]) { restore.push([m, m.material]); m.material = m.material.clone(); m.material.side = T.DoubleSide; }
  const headCentre = surfaces.head[0]?.getWorldPosition(new T.Vector3());
  for (const m of pieces) {
    const kind = m.userData.on, surf = surfaces[kind]; if (!surf?.length) continue;
    const pos = m.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 60));
    let tested = 0, sunk = 0, gap = Infinity;
    for (let i = 0; i < pos.count; i += step) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      // torso: from the body axis at the same height, sideways; head: from the head centre
      if (kind === "torso") _o.set(root.position.x + 7e-4, _v.y, root.position.z); else _o.copy(headCentre); // off the lathe seam
      _d.subVectors(_v, _o); const dist = _d.length(); if (dist < 1e-4) continue;
      if (kind === "torso") { _d.y = 0; if (_d.lengthSq() < 1e-8) continue; }
      ray.set(_o, _d.normalize());
      const hits = ray.intersectObjects(surf, false); if (!hits.length) continue;
      const along = kind === "torso" ? Math.hypot(_v.x - _o.x, _v.z - _o.z) : dist;
      const depth = along - hits[hits.length - 1].distance;   // > 0 outside the surface, < 0 sunk in
      tested++; if (depth < -FIT.sunk) sunk++; gap = Math.min(gap, depth);
    }
    if (!tested) continue;
    const name = m.geometry.name || m.geometry.type.replace("Geometry", "").toLowerCase();
    if (sunk / tested > FIT.sunkShare) note("layer", `${kind} ${name} sunk in`, (sunk / tested) * 100, "stand", "%");
    else if (gap > (m.userData.float ?? FIT.float)) note("layer", `${kind} ${name} floats off`, gap * 100, "stand");
  }
  for (const [m, mat] of restore) m.material = mat;
}
