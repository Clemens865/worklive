import * as T from "three";
import { Kit, label } from "./kit";
import type { Spot } from "./props";

// The old gaming station: a CRT on a wobbly stand, a console with two corded controllers and two
// beanbags. The CRT runs little 80s-style games (our own: "Orbit Raiders", a rows-of-aliens shooter,
// and "Chomp Maze", a maze muncher); attract mode when nobody plays, a match when two robots sit down.

export class RetroScreen {
  canvas = document.createElement("canvas");
  tex: T.CanvasTexture;
  private g: CanvasRenderingContext2D;
  private next = 0;
  private game: "raiders" | "chomp" = "raiders";
  private switchAt = 25;
  players = 0;
  constructor() {
    this.canvas.width = 256; this.canvas.height = 192;
    this.g = this.canvas.getContext("2d")!;
    this.tex = new T.CanvasTexture(this.canvas);
    this.tex.colorSpace = T.SRGBColorSpace;
    this.tex.magFilter = T.NearestFilter; // chunky pixels
  }
  update(t: number) {
    if (t < this.next) return;
    this.next = t + 1 / 12;
    if (t > this.switchAt) { this.game = this.game === "raiders" ? "chomp" : "raiders"; this.switchAt = t + 25; }
    const g = this.g, W = 256, H = 192;
    g.fillStyle = "#05060a"; g.fillRect(0, 0, W, H);
    if (this.game === "raiders") this.raiders(t); else this.chomp(t);
    g.fillStyle = "#e9e4d6"; g.font = "bold 10px monospace"; g.textAlign = "left";
    g.fillText(this.players === 2 ? "2P VERSUS" : this.players === 1 ? "1P  NEED P2" : "INSERT COIN", 6, 12);
    g.textAlign = "right"; g.fillText("HI " + String(Math.floor(t * 37) % 99999).padStart(5, "0"), W - 6, 12);
    // scanlines + vignette, it's a CRT
    g.fillStyle = "rgba(0,0,0,0.28)";
    for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);
    this.tex.needsUpdate = true;
  }
  private raiders(t: number) {
    const g = this.g;
    const dx = Math.sin(t * 0.8) * 30, drop = (t * 2) % 30;
    const colors = ["#ff5a4f", "#f2c94c", "#5ff2b5", "#63d3ff"];
    for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) {
      if ((row * 8 + col + Math.floor(t)) % 11 === 0) continue; // a few already shot
      const x = 40 + col * 22 + dx, y = 26 + row * 16 + drop, frame = Math.floor(t * 3) % 2;
      g.fillStyle = colors[row];
      g.fillRect(x, y, 12, 6); g.fillRect(x + 2, y - 2, 8, 2);
      g.fillRect(x + (frame ? 0 : 2), y + 6, 2, 3); g.fillRect(x + (frame ? 10 : 8), y + 6, 2, 3);
      g.fillStyle = "#05060a"; g.fillRect(x + 3, y + 2, 2, 2); g.fillRect(x + 7, y + 2, 2, 2);
    }
    const px = 128 + Math.sin(t * 1.7) * 90;
    g.fillStyle = "#5ff2b5"; g.fillRect(px - 9, 172, 18, 6); g.fillRect(px - 2, 167, 4, 5);
    g.fillStyle = "#fff";
    for (let i = 0; i < 3; i++) g.fillRect(px, 160 - ((t * 140 + i * 50) % 140), 2, 6);
    // the bunkers are crumbling, like morale
    g.fillStyle = "#7cc47a";
    for (const bx of [50, 120, 190]) for (let i = 0; i < 6; i++) if ((i + bx) % 4) g.fillRect(bx + i * 4, 150, 4, 6);
  }
  private chomp(t: number) {
    const g = this.g;
    g.strokeStyle = "#4f6fd8"; g.lineWidth = 3;
    for (let i = 0; i < 4; i++) g.strokeRect(20 + i * 14, 24 + i * 12, 216 - i * 28, 150 - i * 24);
    g.fillStyle = "#f4f1de";
    const lane = 30 + 0 * 14, pathLen = 2 * (216 + 150);
    const pos = (t * 60) % pathLen;
    for (let d = 0; d < pathLen; d += 12) if (d > pos || d < pos - pathLen + 120) {
      const p = this.onRect(d, lane - 10, 24 + 6, 216 - 20, 150 - 12);
      g.fillRect(p.x - 1, p.y - 1, 3, 3);
    }
    const c = this.onRect(pos, lane - 10, 30, 196, 138);
    const mouth = Math.abs(Math.sin(t * 12)) * 0.7;
    g.fillStyle = "#f2c94c";
    g.beginPath(); g.moveTo(c.x, c.y); g.arc(c.x, c.y, 7, c.a + mouth, c.a + Math.PI * 2 - mouth); g.fill();
    ["#ff5a4f", "#ff9fd0", "#63d3ff"].forEach((col, i) => {
      const gp = this.onRect((pos - 30 - i * 22 + pathLen) % pathLen, lane - 10, 30, 196, 138);
      g.fillStyle = col;
      g.beginPath(); g.arc(gp.x, gp.y - 1, 6, Math.PI, 0); g.lineTo(gp.x + 6, gp.y + 6); g.lineTo(gp.x - 6, gp.y + 6); g.fill();
      g.fillStyle = "#fff"; g.fillRect(gp.x - 4, gp.y - 3, 3, 3); g.fillRect(gp.x + 1, gp.y - 3, 3, 3);
    });
  }
  private onRect(d: number, x: number, y: number, w: number, h: number) {
    const per = 2 * (w + h);
    d = ((d % per) + per) % per;
    if (d < w) return { x: x + d, y, a: 0 };
    if (d < w + h) return { x: x + w, y: y + d - w, a: Math.PI / 2 };
    if (d < 2 * w + h) return { x: x + w - (d - w - h), y: y + h, a: Math.PI };
    return { x, y: y + h - (d - 2 * w - h), a: -Math.PI / 2 };
  }
}

export function gamingStation(kit: Kit) {
  const g = new T.Group();
  const wood = kit.paint("#8a6f5a"), dark = kit.paint("#2c3440"), plastic = kit.paint("#cfc8b6");
  // rug
  const rug = kit.mesh(new T.CircleGeometry(1.7, 40), kit.paint("#7d4a6a"), g, { line: false, shadow: false });
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.01, 1.0);
  rug.scale.set(1.25, 0.8, 1);
  // stand + CRT
  kit.box(1.5, 0.55, 0.6, wood, g, 0.03).position.set(0, 0.275, 0);
  const tv = kit.box(1.05, 0.85, 0.75, kit.paint("#3f3d4a"), g, 0.12);
  tv.position.set(0, 0.98, -0.02);
  const screen = new RetroScreen();
  const glass = new T.Mesh(new T.PlaneGeometry(0.82, 0.62), new T.MeshBasicMaterial({ map: screen.tex, toneMapped: false }));
  kit.geos.push(glass.geometry);
  glass.position.set(-0.05, 1.0, 0.372); // just in front of the bezel
  g.add(glass);
  kit.box(0.92, 0.72, 0.04, dark, g, 0.05).position.set(-0.05, 1.0, 0.345); // bezel
  for (const y of [0.85, 1.05]) { // channel knobs
    const knob = kit.mesh(new T.CylinderGeometry(0.035, 0.035, 0.04, 12), plastic, g, { line: false });
    knob.rotation.x = Math.PI / 2;
    knob.position.set(0.43, y, 0.36);
  }
  // rabbit-ear antenna
  for (const s of [-1, 1]) { const ant = kit.can(0.012, 0.008, 0.5, plastic, g); ant.position.set(0.1 * s, 1.4, -0.05); ant.rotation.z = -s * 0.5; }
  // console + controllers
  const con = kit.box(0.5, 0.1, 0.32, plastic, g, 0.03);
  con.position.set(0, 0.6, 0.12);
  kit.mesh(new T.BoxGeometry(0.14, 0.05, 0.2), kit.paint("#c0462f"), g, { line: false }).position.set(0.05, 0.67, 0.08); // cartridge
  const sign = kit.sign(0.7, 0.16, (c, w, h) => label(c, w, h, "RETRO-TRON 2600*", { bg: "#2c3440", fg: "#f2c94c" }), g, 256);
  sign.position.set(0, 0.32, 0.305);
  // beanbags where the players sit
  const bagColors = ["#4f6fa8", "#e07a5f"];
  const spots: Spot[] = [];
  [-0.65, 0.65].forEach((x, i) => {
    const bag = kit.mesh(new T.SphereGeometry(0.5, 24, 16), kit.paint(bagColors[i]), g);
    bag.scale.set(1, 0.42, 1);
    bag.position.set(x, 0.2, 1.75);
    const pad = kit.box(0.2, 0.05, 0.12, dark, g, 0.02);
    pad.position.set(x * 0.8, 0.03, 1.2);
    kit.cable(new T.Vector3(x * 0.3, 0.58, 0.25), pad.position.clone(), 0.2, 0.012, dark, g);
    spots.push({ pos: new T.Vector3(x, -0.12, 1.85), face: Math.PI }); // sunk into the beanbag, facing the TV
  });
  return { group: g, spots, screen };
}
