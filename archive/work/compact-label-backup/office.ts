import * as T from "three";
import type { Agent, BrowserState } from "./types";
import { PROVIDERS } from "./types";
import {
  OfficeLife,
  DESKS,
  TABLE,
  type Resident,
  type Moment,
} from "./office-life";
type Material = T.Material | string;
interface Actor {
  agent: Agent;
  group: T.Group;
  body: T.Group;
  head: T.Group;
  arms: T.Group[];
  legs: T.Group[];
  label: HTMLButtonElement;
  monitor: HTMLButtonElement;
  screen: T.CanvasTexture;
  ctx: CanvasRenderingContext2D;
  ring: T.Mesh;
  x: number;
  z: number;
  status: string;
  resident: Resident;
  bubble: HTMLDivElement;
  mug: T.Group;
  wateringCan: T.Group;
  steam: T.Mesh[];
  shownLabel: string;
  shirt: T.MeshStandardMaterial;
}
export function createOffice(
  container: HTMLElement,
  onSelect: (id: string) => void,
  onOpen: (id: string) => void,
  onMoment: (moment: Moment) => void,
) {
  const life = new OfficeLife(onMoment);
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-9, 9, 7, -7, 0.1, 100);
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute(
    "aria-label",
    "Worklive three-dimensional office",
  );
  container.append(renderer.domElement);
  const labels = document.createElement("div");
  labels.className = "office-labels";
  container.append(labels);
  const room = new T.Group(),
    desks = new T.Group();
  scene.add(room);
  room.add(desks);
  const material = (color: string) =>
    new T.MeshStandardMaterial({ color, roughness: 0.78 });
  const m = {
    floor: material("#e0d6c0"),
    wall: material("#e8e4d8"),
    wood: material("#c1a379"),
    leg: material("#63735f"),
    white: material("#f3eee1"),
    dark: material("#33473b"),
    leaf: material("#738e54"),
    leaf2: material("#a5b679"),
    rug: material("#b1bb9e"),
  };
  function mesh(
    geo: T.BufferGeometry,
    mat: Material,
    x = 0,
    y = 0,
    z = 0,
    p: T.Object3D = room,
  ) {
    const o = new T.Mesh(geo, typeof mat === "string" ? material(mat) : mat);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    p.add(o);
    return o;
  }
  const box = (
    w: number,
    h: number,
    d: number,
    mat: Material,
    x = 0,
    y = 0,
    z = 0,
    p: T.Object3D = room,
  ) => mesh(new T.BoxGeometry(w, h, d), mat, x, y, z, p);
  const ball = (
    r: number,
    mat: Material,
    x = 0,
    y = 0,
    z = 0,
    p: T.Object3D = room,
  ) => mesh(new T.SphereGeometry(r, 16, 12), mat, x, y, z, p);
  const cylinder = (
    rt: number,
    rb: number,
    h: number,
    mat: Material,
    x = 0,
    y = 0,
    z = 0,
    p: T.Object3D = room,
  ) => mesh(new T.CylinderGeometry(rt, rb, h, 24), mat, x, y, z, p);
  const capsule = (
    r: number,
    len: number,
    mat: Material,
    x: number,
    y: number,
    z: number,
    p: T.Object3D,
  ) => mesh(new T.CapsuleGeometry(r, len, 5, 12), mat, x, y, z, p);
  scene.add(new T.HemisphereLight("#fff4df", "#879b87", 2.5));
  const sun = new T.DirectionalLight("#fff2d9", 3.8);
  sun.position.set(-5, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -11;
  sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 11;
  sun.shadow.camera.bottom = -11;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const fill = new T.DirectionalLight("#deebff", 1);
  fill.position.set(8, 7, -4);
  scene.add(fill);
  box(12, 0.24, 9.7, m.floor, 0, -0.15, 0);
  box(12.1, 0.1, 9.8, m.wood, 0, -0.31, 0);
  for (let x = -5.8; x < 6; x += 0.68)
    box(0.015, 0.006, 9.7, "#cfc3ab", x, -0.02, 0);
  box(12, 0.98, 0.14, m.wall, 0, 0.45, -4.78);
  box(0.14, 0.98, 9.7, m.wall, -5.94, 0.45, 0);
  box(12, 0.07, 0.23, m.white, 0, 0.98, -4.78);
  box(0.23, 0.07, 9.7, m.white, -5.94, 0.98, 0);
  box(3.9, 0.9, 0.19, m.wall, -3.2, 1.4, -4.78);
  box(3.7, 0.06, 0.24, m.wood, -3.2, 1.89, -4.78);
  box(3.2, 1.55, 0.08, m.white, -3.2, 2.72, -4.8);
  box(3, 1.36, 0.09, "#bbd8d1", -3.2, 2.72, -4.73);
  box(0.08, 1.4, 0.11, m.white, -3.2, 2.72, -4.67);
  box(3, 0.06, 0.11, m.white, -3.2, 2.72, -4.67);
  function plant(x: number, z: number, scale = 1) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    room.add(g);
    cylinder(0.31, 0.23, 0.49, "#cdac87", 0, 0.24, 0, g);
    cylinder(0.28, 0.28, 0.03, "#6d664d", 0, 0.49, 0, g);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4,
        h = 0.9 + (i % 3) * 0.23;
      const leaf = ball(
        0.28,
        i % 2 ? m.leaf : m.leaf2,
        Math.sin(a) * 0.27,
        h,
        Math.cos(a) * 0.26,
        g,
      );
      leaf.scale.set(0.55, 1.9, 0.74);
      leaf.rotation.z = Math.sin(a) * 0.45;
      cylinder(
        0.025,
        0.025,
        h - 0.45,
        m.leaf,
        Math.sin(a) * 0.12,
        (h + 0.45) / 2,
        Math.cos(a) * 0.12,
        g,
      );
    }
  }
  plant(-5.1, -3.9);
  plant(5.1, -3.9, 1.25);
  plant(-5.05, 3.7, 0.8);
  box(2.35, 0.78, 0.6, m.wood, 2.5, 0.4, -4.17);
  box(2.45, 0.08, 0.69, m.white, 2.5, 0.84, -4.17);
  box(0.65, 0.5, 0.5, m.dark, 2.9, 1.13, -4.17);
  box(0.44, 0.2, 0.12, "#778272", 2.9, 1.17, -3.89);
  cylinder(0.1, 0.09, 0.17, m.white, 2.9, 0.99, -3.83);
  cylinder(0.08, 0.07, 0.18, "#b3916d", 1.8, 0.98, -4.05);
  // The table is a shared destination; every visitor gets a reserved place.
  box(3.75, 0.028, 3.65, m.rug, TABLE.x, 0.008, TABLE.z);
  cylinder(TABLE.radius, TABLE.radius, 0.13, m.wood, 0, 0.94, TABLE.z);
  cylinder(0.13, 0.23, 0.88, m.leg, 0, 0.44, TABLE.z);
  cylinder(0.46, 0.46, 0.045, m.dark, 0, 0.028, TABLE.z);
  cylinder(0.21, 0.21, 0.028, "#c1c9ac", 0.15, 1.025, TABLE.z);
  for (let i = 0; i < 3; i++) {
    cylinder(0.06, 0.06, 0.024, "#b68d58", 0.05 + i * 0.1, 1.05, TABLE.z);
  }
  cylinder(0.08, 0.07, 0.16, m.white, -0.36, 1.08, TABLE.z - 0.18);
  const flower = ball(0.065, "#dfbc79", -0.36, 1.38, TABLE.z - 0.18);
  flower.scale.set(1.6, 0.5, 1.6);
  cylinder(0.012, 0.012, 0.22, m.leaf, -0.36, 1.25, TABLE.z - 0.18);
  let width = 900,
    height = 600,
    angle = 35,
    zoom = 1,
    selected = "",
    last = performance.now(),
    paused = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const actors: Actor[] = [];
  function create(agent: Agent) {
    const { x, z } = DESKS[actors.length];
    const resident = life.add(agent.id, agent.name);
    const g = new T.Group();
    g.position.set(x, 0, z);
    desks.add(g);
    box(2.5, 0.12, 1.16, m.wood, 0, 0.94, 0, g);
    for (const lx of [-1.03, 1.03])
      for (const lz of [-0.41, 0.41])
        box(0.085, 0.9, 0.085, m.leg, lx, 0.45, lz, g);
    box(0.54, 0.035, 0.29, m.dark, 0, 1.023, 0.22, g);
    box(0.44, 0.024, 0.22, "#b1b6a7", 0, 1.05, 0.21, g);
    cylinder(0.12, 0.12, 0.024, m.dark, 0, 1.03, -0.2, g);
    box(0.055, 0.2, 0.055, m.dark, 0, 1.16, -0.2, g);
    box(1.22, 0.81, 0.075, m.dark, 0, 1.58, -0.22, g);
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#edf2e6";
    ctx.fillRect(0, 0, 1024, 640);
    ctx.fillStyle = "#587349";
    ctx.font = "44px -apple-system,sans-serif";
    ctx.fillText("Worklive", 65, 115);
    ctx.font = "28px -apple-system,sans-serif";
    ctx.fillText("Browser starting…", 65, 180);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.minFilter = T.LinearFilter;
    mesh(
      new T.PlaneGeometry(1.12, 0.7),
      new T.MeshBasicMaterial({ map: texture, toneMapped: false }),
      0,
      1.59,
      -0.177,
      g,
    );
    cylinder(0.073, 0.06, 0.13, m.white, 0.9, 1.07, 0.23, g);
    box(0.28, 0.04, 0.4, agent.color, -0.88, 1.03, 0.02, g);
    box(0.21, 0.012, 0.31, m.white, -0.88, 1.06, 0.02, g);
    cylinder(0.27, 0.27, 0.08, m.dark, 0, 0.57, 0.95, g);
    cylinder(0.045, 0.045, 0.5, m.leg, 0, 0.28, 0.95, g);
    box(0.47, 0.4, 0.075, agent.color, 0, 0.8, 1.16, g);
    for (let i = 0; i < 3; i++) {
      const leg = box(0.6, 0.05, 0.05, m.leg, 0, 0.075, 0.95, g);
      leg.rotation.y = (i * Math.PI) / 3;
    }
    const body = new T.Group();
    body.position.set(0, 0, 1.1);
    body.rotation.y = Math.PI;
    g.add(body);
    const shirt = material(PROVIDERS[agent.provider].color);
    capsule(0.22, 0.3, shirt, 0, 0.99, 0, body);
    const head = new T.Group();
    head.position.y = 1.51;
    body.add(head);
    const dome = ball(0.29, m.white, 0, 0, 0, head);
    dome.scale.set(1, 1.04, 0.87);
    const visor = ball(0.235, m.dark, 0, 0.015, 0.145, head);
    visor.scale.set(1, 0.61, 0.6);
    for (const px of [-0.086, 0.086]) {
      const eye = ball(0.034, "#d7e8c8", px, 0.045, 0.28, head);
      eye.scale.set(1, 0.55, 0.35);
    }
    ball(0.056, agent.color, 0.3, 0, 0, head);
    ball(0.056, agent.color, -0.3, 0, 0, head);
    const arms: T.Group[] = [],
      legs: T.Group[] = [];
    for (const px of [-0.3, 0.3]) {
      const arm = new T.Group();
      arm.position.set(px, 1.08, 0);
      body.add(arm);
      capsule(0.076, 0.26, shirt, 0, -0.16, 0, arm);
      ball(0.078, m.white, 0, -0.35, 0, arm);
      arms.push(arm);
    }
    for (const px of [-0.12, 0.12]) {
      const leg = new T.Group();
      leg.position.set(px, 0.77, 0);
      body.add(leg);
      capsule(0.085, 0.33, m.dark, 0, -0.23, 0, leg);
      capsule(0.087, 0.12, m.white, 0, -0.46, 0.075, leg).rotation.x =
        Math.PI / 2;
      legs.push(leg);
    }
    const mug = new T.Group();
    arms[1].add(mug);
    mug.position.set(0, -0.32, 0.07);
    cylinder(0.081, 0.066, 0.16, m.white, 0, 0, 0, mug);
    cylinder(0.064, 0.064, 0.008, "#78553a", 0, 0.079, 0, mug);
    const handle = mesh(
      new T.TorusGeometry(0.05, 0.014, 8, 16),
      m.white,
      0.092,
      0,
      0,
      mug,
    );
    const steam: T.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const puff = ball(
        0.026,
        new T.MeshBasicMaterial({
          color: "#ffffff",
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        }),
        0,
        0.15 + i * 0.08,
        0,
        mug,
      );
      puff.scale.set(0.6, 1.8, 0.6);
      steam.push(puff);
    }
    mug.visible = false;
    const wateringCan = new T.Group();
    arms[1].add(wateringCan);
    wateringCan.position.set(0, -0.34, 0.1);
    cylinder(0.12, 0.11, 0.2, "#87aaa0", 0, 0, 0, wateringCan);
    const spout = cylinder(
      0.025,
      0.03,
      0.25,
      "#87aaa0",
      0,
      0.04,
      0.18,
      wateringCan,
    );
    spout.rotation.x = 0.95;
    wateringCan.visible = false;
    const ring = mesh(
      new T.RingGeometry(0.46, 0.51, 48),
      new T.MeshBasicMaterial({
        color: "#628169",
        transparent: true,
        opacity: 0.85,
        side: T.DoubleSide,
      }),
      0,
      0.01,
      0.85,
      g,
    );
    ring.rotation.x = -Math.PI / 2;
    const label = document.createElement("button");
    label.className = "agent-label";
    label.addEventListener("click", () => onSelect(agent.id));
    labels.append(label);
    const monitor = document.createElement("button");
    monitor.className = "monitor-target";
    monitor.setAttribute("aria-label", "Open " + agent.name + " browser");
    monitor.addEventListener("click", () => onOpen(agent.id));
    labels.append(monitor);
    const bubble = document.createElement("div");
    bubble.className = "speech-bubble";
    bubble.hidden = true;
    labels.append(bubble);
    const actor = {
      agent,
      group: g,
      body,
      head,
      arms,
      legs,
      label,
      monitor,
      screen: texture,
      ctx,
      ring,
      x,
      z,
      status: "idle",
      resident,
      bubble,
      mug,
      wateringCan,
      steam,
      shownLabel: "",
      shirt,
    };
    actors.push(actor);
    updateLabel(actor);
  }
  function updateLabel(a: Actor) {
    a.label.replaceChildren();
    const dot = document.createElement("span");
    dot.className = "agent-dot";
    dot.style.background = PROVIDERS[a.agent.provider].color;
    dot.classList.toggle("claude-dot", a.agent.provider === "claude");
    const name = document.createElement("strong");
    name.textContent = a.agent.name;
    const state = document.createElement("small");
    state.textContent =
      a.resident.phase === "working" && a.status !== "working"
        ? a.status === "paused"
          ? "You have control"
          : a.status === "error"
            ? "Needs attention"
            : a.status === "loading"
              ? "Opening browser"
              : "At the desk"
        : a.resident.label;
    a.shownLabel = a.resident.label;
    const provider = document.createElement("span");
    provider.className = "agent-provider-label";
    provider.textContent = PROVIDERS[a.agent.provider].name;
    name.append(provider);
    a.label.append(dot, name, state);
    a.label.setAttribute("aria-pressed", String(selected === a.agent.id));
    a.ring.visible = selected === a.agent.id;
  }
  function cameraSize() {
    const aspect = width / height,
      span = Math.max(13.7, 17 / aspect) / zoom;
    camera.left = (-span * aspect) / 2;
    camera.right = (span * aspect) / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.position.set(
      Math.sin((angle * Math.PI) / 180) * 21,
      18,
      Math.cos((angle * Math.PI) / 180) * 21,
    );
    camera.lookAt(0, 0.8, 0);
    camera.updateProjectionMatrix();
  }
  function resize() {
    if (!container.clientWidth || !container.clientHeight) return;
    width = container.clientWidth;
    height = container.clientHeight;
    renderer.setSize(width, height);
    cameraSize();
    draw(performance.now());
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  function draw(ms: number) {
    const dt = Math.min(Math.max((ms - last) / 1000, 0), 0.25);
    last = ms;
    if (!container.clientWidth) return;
    if (!paused) life.update(dt);
    const t = life.time,
      occupied: { x: number; y: number }[] = [];
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i],
        r = a.resident,
        moving = r.moving,
        coffee = r.phase === "coffee",
        stretch = r.phase === "stretch",
        plant = r.phase === "plant",
        seated = r.phase === "desk" || r.phase === "working",
        working = seated && a.status === "working";
      a.body.position.set(
        r.x - a.x,
        moving ? Math.abs(Math.sin(t * 8)) * 0.03 : 0,
        r.z - a.z,
      );
      if (!paused) {
        const d = r.facing - a.body.rotation.y;
        a.body.rotation.y +=
          Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(dt * 8, 1);
      }
      a.head.rotation.y = Math.sin(t * 1.2 + i) * 0.08;
      for (let j = 0; j < 2; j++) {
        a.arms[j].rotation.z = stretch
          ? (j === 0 ? 1 : -1) * (1.5 + Math.sin(t * 1.3) * 0.45)
          : 0;
        a.arms[j].rotation.x = working
          ? -1.1 + Math.sin(t * 9 + j * 2) * 0.07
          : moving
            ? Math.sin(t * 8 + j * Math.PI) * 0.38
            : coffee && j === 1
              ? -1.15 - Math.max(0, Math.sin(t * 1.4 + i)) * 0.95
              : plant && j === 1
                ? -1.15
                : coffee && r.bubble && j === 0
                  ? -0.65 + Math.sin(t * 4) * 0.18
                  : 0;
        a.legs[j].rotation.x = moving
          ? Math.sin(t * 8 + j * Math.PI) * 0.36
          : seated
            ? -0.75
            : 0;
      }
      a.mug.visible = coffee;
      a.wateringCan.visible = plant;
      a.mug.rotation.x = -a.arms[1].rotation.x * 0.8;
      for (let j = 0; j < a.steam.length; j++) {
        const puff = a.steam[j];
        puff.position.y = 0.14 + ((t * 0.09 + j * 0.09) % 0.26);
        puff.position.x = Math.sin(t * 2 + j) * 0.015;
      }
      a.ring.position.set(r.x - a.x, 0.012, r.z - a.z);
      if (a.shownLabel !== r.label) updateLabel(a);
      const pos = new T.Vector3(r.x, 0.08, r.z + 0.46).project(camera);
      const lx = ((pos.x + 1) * width) / 2;
      let ly = ((1 - pos.y) * height) / 2;
      // Keep small name badges readable when perspective brings people together.
      for (const other of occupied)
        if (Math.abs(other.x - lx) < 105 && Math.abs(other.y - ly) < 42)
          ly = other.y + 43;
      occupied.push({ x: lx, y: ly });
      a.label.style.left = lx + "px";
      a.label.style.top = ly + "px";
      const bp = new T.Vector3(r.x, 2.02, r.z).project(camera);
      a.bubble.hidden = !r.bubble;
      if (a.bubble.textContent !== r.bubble) a.bubble.textContent = r.bubble;
      a.bubble.style.left =
        Math.max(105, Math.min(width - 105, ((bp.x + 1) * width) / 2)) + "px";
      a.bubble.style.top = Math.max(60, ((1 - bp.y) * height) / 2) + "px";
      const mp = new T.Vector3(a.x, 1.59, a.z - 0.177).project(camera);
      a.monitor.style.left = ((mp.x + 1) * width) / 2 + "px";
      a.monitor.style.top = ((1 - mp.y) * height) / 2 + "px";
    }
    renderer.render(scene, camera);
  }

  function animate(ms: number) {
    draw(ms);
    requestAnimationFrame(animate);
  }
  resize();
  requestAnimationFrame(animate);
  // WKWebView may suspend animation frames in an unfocused, still-visible window.
  setInterval(() => {
    if (container.clientWidth && performance.now() - last > 45)
      draw(performance.now());
  }, 50);
  return {
    setAgents(list: Agent[]) {
      for (const a of list) {
        const old = actors.find((x) => x.agent.id === a.id);
        if (old) {
          old.agent = a;
          old.shirt.color.set(PROVIDERS[a.provider].color);
          old.resident.name = a.name;
          old.monitor.setAttribute("aria-label", "Open " + a.name + " browser");
          updateLabel(old);
        } else if (actors.length < 6) create(a);
      }
      draw(performance.now());
    },
    select(id: string) {
      selected = id;
      actors.forEach(updateLabel);
    },
    state(state: BrowserState) {
      const a = actors.find((x) => x.agent.id === state.agentId);
      if (a) {
        a.status =
          state.owner === "user" && state.status === "idle"
            ? "paused"
            : state.status;
        life.setBusy(a.agent.id, !["idle", "complete"].includes(a.status));
        updateLabel(a);
      }
    },
    frame(id: string, img: HTMLImageElement) {
      const a = actors.find((x) => x.agent.id === id);
      if (a) {
        a.ctx.drawImage(img, 0, 0, 1024, 640);
        a.screen.needsUpdate = true;
        if (performance.now() - last > 100) draw(performance.now());
      }
    },
    rotate(delta: number) {
      angle = Math.max(8, Math.min(76, angle + delta));
      cameraSize();
      draw(performance.now());
    },
    zoom(delta: number) {
      zoom = Math.max(0.8, Math.min(1.45, zoom + delta));
      cameraSize();
      draw(performance.now());
    },
    coffeeBreak() {
      return life.coffeeBreak();
    },
    isMoving() {
      return !paused;
    },
    motion() {
      paused = !paused;
      return !paused;
    },
  };
}
