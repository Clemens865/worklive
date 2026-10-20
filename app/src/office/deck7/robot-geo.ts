import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { smooth } from "./util";

// Geometry for robots: lathed cans and domes, rounded boxes, and corrugated hoses.
// All results have welded, smooth normals so the inverted-hull outline stays closed.

const V = (x: number, y: number) => new T.Vector2(Math.max(1e-4, x), y);

function arc(pts: T.Vector2[], cx: number, cy: number, r: number, a0: number, a1: number, n = 8) {
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(V(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
}

// Cylinder from y = 0 to y = h with rounded rims; rb/rt = bottom/top radius, bulge pushes the middle out.
export function canGeo(rb: number, rt: number, h: number, round = 0.08, bulge = 0, segs = 40): T.BufferGeometry {
  const pts: T.Vector2[] = [V(0, 0)];
  arc(pts, rb - round, round, round, -Math.PI / 2, 0);
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    pts.push(V(rb + (rt - rb) * t + Math.sin(t * Math.PI) * bulge, round + (h - 2 * round) * t));
  }
  arc(pts, rt - round, h - round, round, 0, Math.PI / 2);
  pts.push(V(0, h));
  return smooth(new T.LatheGeometry(pts, segs));
}

// Smooth pot-bellied bulb from y = 0 to h: one radius R at the equator (no crease), a fuller
// bottom (exponent pb) and a rounder top (pt).
export const BULB_PB = 0.42, BULB_PT = 0.62;
export function bulbGeo(R: number, h: number): T.BufferGeometry {
  const pts: T.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = -Math.PI / 2 + (i / 40) * Math.PI;
    const r = R * Math.pow(Math.cos(a), a < 0 ? BULB_PB : BULB_PT);
    pts.push(V(r, h / 2 + Math.sign(a) * Math.pow(Math.abs(Math.sin(a)), 0.9) * h / 2));
  }
  pts[0].x = 1e-4;
  pts[pts.length - 1].x = 1e-4;
  return smooth(new T.LatheGeometry(pts, 40));
}

// Cylinder side of height h topped by a half-ellipsoid of height dome.
export function domeGeo(r: number, h: number, dome: number, round = 0.06): T.BufferGeometry {
  const pts: T.Vector2[] = [V(0, 0)];
  arc(pts, r - round, round, round, -Math.PI / 2, 0);
  pts.push(V(r, h));
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * (Math.PI / 2);
    pts.push(V(Math.cos(a) * r, h + Math.sin(a) * dome));
  }
  return smooth(new T.LatheGeometry(pts, 40));
}

export function boxGeo(w: number, h: number, d: number, r: number): T.BufferGeometry {
  return smooth(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999));
}

// Tube along a curve with accordion ridges, like a vacuum-cleaner hose.
export function hoseGeo(curve: T.Curve<T.Vector3>, r: number, ridges = 0.1, pitch = 0.075): T.BufferGeometry {
  const len = curve.getLength();
  const tub = Math.max(16, Math.round((len / pitch) * 4));
  const rad = 12;
  const g = new T.TubeGeometry(curve, tub, r, rad, false);
  const p = g.attributes.position as T.BufferAttribute;
  const c = new T.Vector3(), v = new T.Vector3();
  for (let i = 0; i <= tub; i++) {
    const u = i / tub;
    curve.getPointAt(u, c);
    const k = 1 + ridges * (Math.pow(Math.abs(Math.sin((u * len * Math.PI) / pitch)), 0.6) - 0.5);
    for (let j = 0; j <= rad; j++) {
      const idx = i * (rad + 1) + j;
      v.fromBufferAttribute(p, idx).sub(c).multiplyScalar(k).add(c);
      p.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  return smooth(g);
}

// Thin bent finger, pivot at y = 0, pointing down -y.
export function fingerGeo(len: number, r: number, curl: number): T.BufferGeometry {
  const curve = new T.QuadraticBezierCurve3(new T.Vector3(0, 0, 0), new T.Vector3(0, -len * 0.6, 0), new T.Vector3(curl * len, -len, 0));
  const g = new T.TubeGeometry(curve, 12, r, 10, false);
  return smooth(g);
}
