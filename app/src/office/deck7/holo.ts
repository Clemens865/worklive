import * as T from "three";

// A holographic screen floating over each docking station. When the agent's browser is live, its real
// page is projected here (tinted, scanlined, flickering like the rest of the deck); otherwise it shows a
// (rude) card for the state.

export type HoloMode = "off" | "idle" | "working" | "thinking" | "waiting" | "attention" | "happy" | "angry" | "sleepy" | "away";

const TINT: Record<HoloMode, string> = {
  off: "#000000", idle: "#63d3ff", working: "#5ff2b5", thinking: "#7fb2ff", waiting: "#ffc65c",
  attention: "#ff9a3c", happy: "#7dff9a", angry: "#ff4b4b", sleepy: "#9d8cff", away: "#63d3ff",
};
const CODE = ["fn fix_everything() {", "  // TODO: care", "  let hope = None;", "  while deadline.near() {", "    coffee.pour();", "    panic!(\"later\");", "  }", "}", "import meaning from '42';",
  "SELECT * FROM blame;", "git push --force # sorry", "assert(user.happy) // fails", "retry(again, forever)", "if (works) { dont_touch(); }"];

export class Holo {
  mesh: T.Mesh;
  beam: T.Mesh;
  private c = document.createElement("canvas");
  private g: CanvasRenderingContext2D;
  private tex: T.CanvasTexture;
  private mat: T.MeshBasicMaterial;
  private next = 0;
  private scroll = 0;
  mode: HoloMode = "idle";
  title = "";
  private liveImg: CanvasImageSource | null = null;
  private liveAt = -1e9;
  private dirty = true;
  /** Latest frame of the agent's live browser (1024 × 640). */
  live(img: CanvasImageSource) { this.liveImg = img; this.liveAt = performance.now(); this.dirty = true; }
  get showingLive() { return !!this.liveImg && performance.now() - this.liveAt < 20000 && ["working", "thinking", "waiting", "attention", "angry"].includes(this.mode); }

  constructor(w: number, h: number) {
    this.c.width = 512; this.c.height = Math.round((512 * h) / w);
    this.g = this.c.getContext("2d")!;
    this.tex = new T.CanvasTexture(this.c);
    this.tex.colorSpace = T.SRGBColorSpace;
    this.mat = new T.MeshBasicMaterial({ map: this.tex, transparent: true, opacity: 0.92, side: T.FrontSide, depthWrite: false, blending: T.AdditiveBlending });
    this.mesh = new T.Mesh(new T.PlaneGeometry(w, h), this.mat);
    this.mesh.renderOrder = 5;
    // back face with flipped UVs: the page reads correctly from behind too (the robot's own view)
    const back = new T.PlaneGeometry(w, h);
    const uv = back.attributes.uv as T.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    const backMesh = new T.Mesh(back, this.mat);
    backMesh.rotation.y = Math.PI;
    backMesh.renderOrder = 5;
    this.mesh.add(backMesh);
    // light cone from the projector puck up to the screen
    const cone = new T.ConeGeometry(w * 0.42, 0.9, 24, 1, true);
    cone.translate(0, -0.45, 0);
    this.beam = new T.Mesh(cone, new T.MeshBasicMaterial({ color: "#63d3ff", transparent: true, opacity: 0.08, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
    this.beam.renderOrder = 4;
  }

  update(t: number, dt: number) {
    const on = this.mode !== "off";
    this.mesh.visible = this.beam.visible = on;
    if (!on) return;
    // flicker: mostly stable, occasional dropouts (it's a cheap projector)
    const glitch = this.mode === "angry" ? Math.random() < 0.25 : Math.random() < 0.01;
    this.mat.opacity = glitch ? 0.35 : 0.85 + Math.sin(t * 30) * 0.05;
    (this.beam.material as T.MeshBasicMaterial).color.set(TINT[this.mode]);
    this.mesh.position.x = glitch ? (Math.random() - 0.5) * 0.04 : 0;
    this.scroll += dt;
    if (t < this.next && !this.dirty) return;
    this.dirty = false;
    this.next = t + (this.showingLive ? 1 / 4 : 1 / 8); // a hologram doesn't need more
    this.draw(t);
    this.tex.needsUpdate = true;
  }

  private draw(t: number) {
    const g = this.g, W = this.c.width, H = this.c.height, tint = TINT[this.mode];
    g.clearRect(0, 0, W, H);
    if (this.showingLive) { this.drawLive(tint); return; }
    g.save(); g.scale(W / 320, W / 320); // the state cards are laid out for 320 px
    const Wc = W, Hc = H;
    {
    const W = 320, H = Math.round((320 * Hc) / Wc);
    g.fillStyle = tint + "22"; g.fillRect(0, 0, W, H);
    g.strokeStyle = tint; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4);
    g.fillStyle = tint; g.font = "700 15px ui-monospace, Menlo, monospace"; g.textAlign = "left";
    g.fillText(this.title.toUpperCase() + " · DECK7-OS", 12, 22);
    g.fillRect(12, 30, W - 24, 2);
    const mono = (s: string, x: number, y: number, size = 14) => { g.font = `700 ${size}px ui-monospace, Menlo, monospace`; g.fillText(s, x, y); };
    const big = (s: string, y: number, size = 24) => { g.font = `800 ${size}px Manrope, system-ui, sans-serif`; g.textAlign = "center"; g.fillText(s, W / 2, y); g.textAlign = "left"; };
    switch (this.mode) {
      case "working": {
        const off = Math.floor(this.scroll * 3);
        for (let i = 0; i < 6; i++) mono(CODE[(i + off) % CODE.length], 14, 54 + i * 18, 13);
        const p = (this.scroll * 0.07) % 1;
        g.strokeRect(14, H - 26, W - 28, 12); g.fillRect(16, H - 24, (W - 32) * p, 8);
        break;
      }
      case "thinking": {
        big("COMPUTING", H / 2 - 4);
        for (let i = 0; i < 8; i++) { const a = t * 4 + (i / 8) * Math.PI * 2; g.globalAlpha = (i + 1) / 8; g.beginPath(); g.arc(W / 2 + Math.cos(a) * 18, H / 2 + 26 + Math.sin(a) * 18, 4, 0, 7); g.fill(); }
        g.globalAlpha = 1;
        break;
      }
      case "waiting":
        big("RATE LIMITED", 64, 22);
        mono("Please enjoy this progress bar.", 20, 88, 12);
        g.strokeRect(14, H - 34, W - 28, 14); g.fillRect(16, H - 32, (W - 32) * 0.99, 10);
        mono("99%", W - 52, H - 40, 12);
        break;
      case "attention":
        if (Math.floor(t * 3) % 2) { big("HUMAN INPUT", 70, 26); big("REQUIRED", 100, 26); }
        mono("No rush. (Rush.)", W / 2 - 66, H - 18, 13);
        break;
      case "happy":
        big("TASK COMPLETE", 72, 24);
        mono("Applause: 0 humans", W / 2 - 74, 100, 13);
        break;
      case "angry":
        big("ERROR 0xDEADBEEF", 66, 20);
        mono("Not my fault.", 20, 94, 13);
        mono("Statistically never my fault.", 20, 112, 12);
        break;
      case "sleepy": { // bouncing screensaver
        const x = 40 + Math.abs(((t * 40) % (2 * (W - 120))) - (W - 120)), y = 50 + Math.abs(((t * 26) % (2 * (H - 90))) - (H - 90));
        g.font = "800 22px Manrope, system-ui, sans-serif"; g.fillText("zZz", x, y);
        break;
      }
      case "away":
        big("BACK IN 5 MIN", H / 2, 24);
        mono("(this is a lie)", W / 2 - 58, H / 2 + 26, 13);
        break;
      default:
        big("DECK 7 OS", H / 2 - 4, 26);
        mono("Awaiting purpose.", W / 2 - 70, H / 2 + 22, 13);
    }
    }
    g.restore();
    // scanlines
    g.fillStyle = "rgba(0,0,0,0.22)";
    for (let y = 0; y < Hc; y += 3) g.fillRect(0, y, Wc, 1);
  }

  // The real page, projected: letterboxed frame, a tint wash in the state colour, scanlines, a frame.
  private drawLive(tint: string) {
    const g = this.g, W = this.c.width, H = this.c.height;
    const fw = W - 16, fh = Math.min(H - 34, (fw * 640) / 1024);
    g.globalAlpha = 0.95;
    g.drawImage(this.liveImg!, 8, 26, fw, fh);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "multiply";
    g.fillStyle = tint + "55"; g.fillRect(8, 26, fw, fh);
    g.globalCompositeOperation = "source-over";
    g.strokeStyle = tint; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4);
    g.fillStyle = tint; g.font = "700 15px ui-monospace, Menlo, monospace"; g.textAlign = "left";
    g.fillText("● LIVE · " + this.title.toUpperCase(), 12, 19);
    g.fillStyle = "rgba(0,0,0,0.18)";
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  }

  dispose() { this.tex.dispose(); this.mat.dispose(); this.mesh.geometry.dispose(); this.mesh.children.forEach(c => (c as T.Mesh).geometry.dispose()); this.beam.geometry.dispose(); (this.beam.material as T.Material).dispose(); }
}
