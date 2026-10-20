// Hire dialog: name, role, provider, personality and a character creator with a live 3D turntable.
// The chosen look (reroll seed + overrides) is saved with the agent so it never changes later.
import * as T from "three";
import { PROVIDER } from "./layout.js";
import { TRAITS } from "./crowd.js";

const NAMES = ["Noor", "Tomas", "Lena", "Ravi", "Ines", "Kofi", "Yuki", "Bea", "Otto", "Zara", "Emil", "Priya", "Lars", "Maya", "Jonas", "Clara", "Aiko", "Felix", "Rosa", "Idris"];
const ROLES = ["Researcher", "Analyst", "Copywriter", "Designer", "QA", "Engineer", "Strategist", "Editor"];
const LABELS = { body: "Body", head: "Head", skin: "Skin", hair: "Hair", hairColor: "Hair colour", eyes: "Eyes", eyeColor: "Eye colour", nose: "Nose",
  top: "Top", glasses: "Glasses", beard: "Beard", moustache: "Moustache", freckles: "Freckles", earrings: "Earrings", headset: "Headset", cap: "Cap", pants: "Trousers", shoes: "Shoes" };
const SWATCH_INDEX = new Set(["skin", "hairColor", "pants", "shoes"]); // stored as index into the colour list

const css = `
.hire-bg{position:fixed;inset:0;background:rgba(15,18,24,.38);backdrop-filter:blur(10px) saturate(120%);display:grid;place-items:center;z-index:20;animation:hire-fade .18s ease-out}
@keyframes hire-fade{from{opacity:0}}
@keyframes hire-rise{from{opacity:0;transform:translateY(8px) scale(.985)}}
.hire{--ink:#15181d;--muted:#6b7280;--line:rgba(21,24,29,.09);--soft:#f6f5f2;--accent:#15181d;
  width:min(960px,calc(100vw - 32px));height:min(720px,calc(100vh - 32px));background:#fff;border-radius:20px;
  box-shadow:0 0 0 1px rgba(21,24,29,.06),0 2px 6px rgba(21,24,29,.06),0 24px 64px -12px rgba(21,24,29,.28);
  display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);grid-template-rows:100%;overflow:hidden;
  font:14px/1.45 "Inter",-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;color:var(--ink);animation:hire-rise .22s cubic-bezier(.2,.8,.2,1)}
.hire .stage{position:relative;background:radial-gradient(120% 80% at 50% 18%,#ffffff 0%,#f3efe8 55%,#e7e1d6 100%);border-right:1px solid var(--line)}
.hire .stage canvas{position:absolute;inset:0;display:block;width:100%;height:100%;cursor:grab}
.hire .stage canvas:active{cursor:grabbing}
.hire .stage .tip{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);font-size:12px;color:var(--muted);background:rgba(255,255,255,.72);backdrop-filter:blur(8px);padding:5px 10px;border-radius:999px;box-shadow:0 0 0 1px var(--line)}
.hire .form{padding:26px 28px 20px;overflow:auto;display:flex;flex-direction:column;gap:18px}
.hire h2{margin:0;font-size:20px;font-weight:650;letter-spacing:-.015em}
.hire h2+p{margin:-12px 0 0;color:var(--muted)}
.hire label.f{display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:550;color:var(--ink)}
.hire .lbl{display:flex;justify-content:space-between;align-items:center;gap:8px}
.hire input,.hire textarea{font:inherit;font-size:14px;padding:9px 12px;border:0;border-radius:10px;background:#fff;color:var(--ink);
  box-shadow:0 0 0 1px rgba(21,24,29,.14),0 1px 2px rgba(21,24,29,.05);transition:box-shadow .15s}
.hire textarea{resize:vertical;min-height:72px}
.hire input:focus,.hire textarea:focus{outline:none;box-shadow:0 0 0 1px var(--ink),0 0 0 4px rgba(21,24,29,.08)}
.hire .row{display:flex;gap:12px;flex-wrap:wrap}
.hire .row>label.f{flex:1;min-width:160px}
.hire .ai{font:inherit;font-size:12px;font-weight:550;border:0;border-radius:8px;background:transparent;color:#7c5cff;padding:2px 6px;cursor:pointer}
.hire .ai:hover{background:rgba(124,92,255,.08)}
.hire .ai[disabled]{opacity:.55;cursor:progress}
.hire .chips{display:flex;flex-wrap:wrap;gap:6px}
.hire .chip2{font:inherit;font-size:13px;border:0;border-radius:999px;padding:5px 11px;cursor:pointer;background:var(--soft);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line);transition:background .12s,box-shadow .12s}
.hire .chip2:hover{background:#eeece7}
.hire .chip2[aria-pressed=true]{background:var(--ink);color:#fff;box-shadow:none}
.hire .seg{display:inline-flex;padding:3px;background:var(--soft);border-radius:11px;box-shadow:inset 0 0 0 1px var(--line);gap:2px;align-self:flex-start}
.hire .seg .chip2{background:transparent;box-shadow:none;border-radius:8px;padding:6px 14px;display:inline-flex;align-items:center;gap:7px}
.hire .seg .chip2[aria-pressed=true]{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(21,24,29,.1),0 0 0 1px var(--line)}
.hire .dot{width:8px;height:8px;border-radius:50%}
.hire .sw{width:24px;height:24px;border-radius:50%;border:0;cursor:pointer;padding:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12);transition:transform .1s}
.hire .sw:hover{transform:scale(1.08)}
.hire .sw[aria-pressed=true]{box-shadow:0 0 0 2px #fff,0 0 0 4px var(--ink)}
.hire details{border-radius:14px;background:var(--soft);box-shadow:inset 0 0 0 1px var(--line);padding:4px 14px}
.hire summary{cursor:pointer;font-weight:550;padding:10px 0;list-style:none;display:flex;justify-content:space-between}
.hire summary::after{content:"＋";color:var(--muted)}
.hire details[open] summary::after{content:"－"}
.hire .opt{display:grid;grid-template-columns:92px 1fr;gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--line)}
.hire .opt>span{font-size:12.5px;color:var(--muted)}
.hire .opt .chip2{background:#fff}
.hire .opt .chip2[aria-pressed=true]{background:var(--ink)}
.hire .actions{display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:auto;padding-top:14px;border-top:1px solid var(--line)}
.hire .btn{font:inherit;font-weight:550;border:0;border-radius:10px;padding:9px 16px;cursor:pointer;background:#fff;color:var(--ink);box-shadow:0 0 0 1px rgba(21,24,29,.14),0 1px 2px rgba(21,24,29,.06);transition:transform .08s,box-shadow .15s}
.hire .btn:hover{box-shadow:0 0 0 1px rgba(21,24,29,.24),0 2px 6px rgba(21,24,29,.08)}
.hire .btn:active{transform:translateY(1px)}
.hire .btn.primary{background:var(--ink);color:#fff;box-shadow:0 1px 2px rgba(21,24,29,.2),0 4px 12px -4px rgba(21,24,29,.4)}
.hire .muted{font-size:12.5px;color:var(--muted)}
.hire .note{font-size:12px;color:var(--muted);display:flex;gap:6px;margin-top:-10px}
@media (max-width:760px){.hire{grid-template-columns:1fr;grid-template-rows:280px minmax(0,1fr);height:calc(100vh - 32px)}.hire .stage{border-right:0;border-bottom:1px solid var(--line)}}
@media (prefers-reduced-motion:reduce){.hire-bg,.hire{animation:none}}
`;

// Small separate three.js scene: podium + slowly turning character that follows the pointer when dragged.
function createPreview(S, host) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = T.SRGBColorSpace;
  host.prepend(renderer.domElement);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, 0.05, 50);
  camera.position.set(0, 1.15, 5.4); camera.lookAt(0, 0.88, 0);
  scene.add(new T.HemisphereLight("#fff6e8", "#b9a7c9", 1.5));
  const key = new T.DirectionalLight("#fff0d8", 2.2); key.position.set(-2, 4, 3); scene.add(key);
  const podium = new T.Mesh(new T.CylinderGeometry(0.62, 0.64, 0.06, 64), new T.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35 }));
  podium.position.y = -0.03; scene.add(podium);
  const shadow = new T.Mesh(new T.CircleGeometry(0.45, 48), new T.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.12, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; scene.add(shadow);
  let char = null, spin = 0, drag = null, alive = true;
  const el = renderer.domElement;
  el.addEventListener("pointerdown", e => { drag = e.clientX; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", e => { if (drag !== null) { spin += (e.clientX - drag) * 0.012; drag = e.clientX; } });
  el.addEventListener("pointerup", () => (drag = null));
  const clock = new T.Timer(), eye = new T.Vector3();
  function size() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function frame() {
    if (!alive) return;
    clock.update(); const dt = Math.min(clock.getDelta(), 0.05), t = clock.getElapsed();
    if (drag === null) spin += dt * 0.5;
    if (char) {
      char.root.rotation.y = spin;
      eye.copy(camera.position);
      char.update(t, dt, "stand", { status: "idle", lookAt: Math.cos(spin) > 0.3 ? eye : null, camDist: 4, mode: "preview", chair: null, spot: null });
    }
    renderer.render(scene, camera); requestAnimationFrame(frame);
  }
  const ro = new ResizeObserver(size); ro.observe(host); size(); frame();
  return {
    show(agent) { if (char) scene.remove(char.root); char = S.createCharacter(agent, 0); scene.add(char.root); },
    dispose() { alive = false; ro.disconnect(); renderer.dispose(); },
  };
}

const pick = a => a[Math.floor(Math.random() * a.length)];
const seed = () => Math.random().toString(36).slice(2, 10);

// Opens the dialog. `taken` = names already used; resolves via onHire(agent) or closes on cancel.
// Local stand-in for AI suggestions (mock only). The app calls the chosen provider's CLI with a short prompt instead.
export async function mockSuggest(field, d, taken) {
  await new Promise(r => setTimeout(r, 450));
  const traits = d.traits.map(t => TRAITS[t].toLowerCase());
  if (field === "name") { const free = NAMES.filter(n => !taken.includes(n) && n !== d.name); return pick(free.length ? free : NAMES); }
  if (field === "role") return pick(ROLES.filter(r => r !== d.role));
  return `${d.name} is our ${d.role.toLowerCase()}${traits.length ? ` — a ${traits.join(" and ")}` : ""}. Works with ${PROVIDER[d.provider].name}, ` +
    `digs into sources carefully, keeps notes tidy and flags open questions early instead of guessing.`;
}

export function openHireDialog({ S, taken = [], deskFor, onHire, suggest = mockSuggest, suggestNote = "✦ Suggestions in this mock are local placeholders. In the app they come from Claude Code or Codex through your subscription." }) {
  if (!document.getElementById("hire-css")) document.head.append(Object.assign(document.createElement("style"), { id: "hire-css", textContent: css }));
  const bg = document.createElement("div"); bg.className = "hire-bg";
  bg.innerHTML = `<div class="hire" role="dialog" aria-modal="true" aria-label="Hire a new agent">
    <div class="stage"><div class="tip">Drag to turn</div></div>
    <div class="form">
      <h2>Hire a new agent</h2><p>Give them a name, a job and a face. You can change everything later.</p>
      <div class="row">
        <label class="f"><span class="lbl">Name <button type="button" class="ai" data-ai="name" title="Suggest a name">✦ Suggest</button></span><input name="name" maxlength="24"></label>
        <label class="f"><span class="lbl">Role <button type="button" class="ai" data-ai="role" title="Suggest a role">✦ Suggest</button></span><input name="role" maxlength="40"></label>
      </div>
      <label class="f"><span class="lbl">Description <button type="button" class="ai" data-ai="description" title="Write a description">✦ Write for me</button></span>
        <textarea name="description" rows="3" maxlength="400" placeholder="What they do, how they work, what they're good at…"></textarea></label>
      <div class="note" data-k="ai-note"></div>
      <label class="f">Works with<div class="seg" data-k="provider"></div></label>
      <label class="f"><span class="lbl">Personality <span class="muted" style="font-weight:400">Up to two · shapes where they spend breaks</span></span><div class="chips" data-k="traits"></div></label>
      <div class="row" style="align-items:center;gap:12px"><button class="btn" data-act="reroll">↻ New look</button><span class="muted">Every look is unique — shuffle, then fine-tune.</span></div>
      <details><summary>Customise appearance</summary><div data-k="look"></div></details>
      <div class="actions"><span class="muted" data-k="desk"></span><span style="display:flex;gap:10px"><button class="btn" data-act="cancel">Cancel</button><button class="btn primary" data-act="hire">Hire agent</button></span></div>
    </div></div>`;
  document.body.append(bg);
  const $ = q => bg.querySelector(q);
  const free = NAMES.filter(n => !taken.includes(n));
  const draft = { name: pick(free.length ? free : NAMES), role: pick(ROLES), provider: Math.random() < 0.5 ? "claude" : "codex", status: "idle", traits: [], lookSeed: seed(), look: {} };
  draft.id = "hire-" + draft.lookSeed;
  $("[name=name]").value = draft.name; $("[name=role]").value = draft.role;
  $("[data-k=ai-note]").textContent = suggestNote;
  bg.querySelectorAll("[data-ai]").forEach(b => b.onclick = async e => {
    e.preventDefault();
    const field = b.dataset.ai, input = $(`[name=${field}]`), label = b.textContent;
    draft.name = $("[name=name]").value.trim() || draft.name; draft.role = $("[name=role]").value.trim() || draft.role;
    b.disabled = true; b.textContent = "Thinking…";
    try { input.value = await suggest(field, draft, taken); } catch { b.title = "Suggestion failed — type it yourself"; }
    b.disabled = false; b.textContent = label;
  });
  const preview = createPreview(S, $(".stage"));
  const refresh = () => { preview.show(draft); renderLook(); };

  const chip = (label, pressed, onClick) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip2"; b.textContent = label;
    b.setAttribute("aria-pressed", String(pressed)); b.onclick = onClick; return b;
  };
  function renderProvider() {
    const box = $("[data-k=provider]"); box.replaceChildren();
    for (const [k, p] of Object.entries(PROVIDER)) {
      const b = chip(p.name, draft.provider === k, () => { draft.provider = k; renderProvider(); preview.show(draft); });
      b.prepend(Object.assign(document.createElement("span"), { className: "dot", style: `background:${p.color}` })); box.append(b);
    }
  }
  function renderTraits() {
    const box = $("[data-k=traits]"); box.replaceChildren();
    for (const [k, label] of Object.entries(TRAITS)) box.append(chip(label, draft.traits.includes(k), () => {
      draft.traits = draft.traits.includes(k) ? draft.traits.filter(t => t !== k) : [...draft.traits, k].slice(-2); renderTraits();
    }));
  }
  function renderLook() {
    const box = $("[data-k=look]"); box.replaceChildren();
    const current = S.lookFor(draft);
    for (const [k, options] of Object.entries(S.LOOK_OPTIONS)) {
      const row = document.createElement("div"); row.className = "opt";
      row.append(Object.assign(document.createElement("span"), { textContent: LABELS[k] || k }));
      const opts = document.createElement("div"); opts.className = "chips";
      options.forEach((v, i) => {
        const value = SWATCH_INDEX.has(k) ? i : v, on = current[k] === value || (v === null && !current[k]);
        const set = () => { draft.look = { ...draft.look, [k]: value }; refresh(); };
        if (typeof v === "string" && v.startsWith("#")) {
          const b = document.createElement("button"); b.type = "button"; b.className = "sw"; b.style.background = v; b.title = v;
          b.setAttribute("aria-label", `${LABELS[k]} ${i + 1}`); b.setAttribute("aria-pressed", String(on)); b.onclick = set; opts.append(b);
        } else opts.append(chip(v === null || v === false ? "none" : v === true ? "yes" : v, on, set));
      });
      row.append(opts); box.append(row);
    }
    const desk = deskFor();
    $("[data-k=desk]").textContent = desk === null ? "All desks are taken — they'll join as a floater for now." : `They get free desk ${desk + 1}.`;
  }
  const close = () => { preview.dispose(); bg.remove(); removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  addEventListener("keydown", onKey);
  $("[data-act=cancel]").onclick = close;
  bg.onclick = e => { if (e.target === bg) close(); };
  $("[data-act=reroll]").onclick = () => { draft.lookSeed = seed(); draft.look = {}; refresh(); };
  $("[data-act=hire]").onclick = () => {
    draft.name = $("[name=name]").value.trim() || draft.name; draft.role = $("[name=role]").value.trim() || draft.role;
    draft.description = $("[name=description]").value.trim();
    draft.desk = deskFor();
    close(); onHire({ ...draft, look: { ...draft.look } });
  };
  renderProvider(); renderTraits(); refresh();
  $("[name=name]").focus();
}
