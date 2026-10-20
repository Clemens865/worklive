from pathlib import Path
root=Path('outputs/worklive')
p=root/'src/office.ts';s=p.read_text()
s=s.replace('  const actors: Actor[] = [];','''  const actors: Actor[] = [];
  let hovered: string | null = null, keyboardFocus: string | null = null;
  const tooltip = document.createElement("div");
  tooltip.className = "agent-tooltip";
  tooltip.id = "office-agent-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  const tooltipName = document.createElement("strong");
  const tooltipProvider = document.createElement("span");
  const tooltipStatus = document.createElement("small");
  tooltip.append(tooltipName, tooltipProvider, tooltipStatus);
  labels.append(tooltip);
  const raycaster = new T.Raycaster();
  function actorAt(event: PointerEvent | MouseEvent) {
    const bounds = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new T.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    ), camera);
    const hit = raycaster.intersectObjects(actors.map(a => a.body), true)[0];
    if (!hit) return null;
    let target: T.Object3D | null = hit.object;
    while (target) {
      const actor = actors.find(a => a.body === target);
      if (actor) return actor;
      target = target.parent;
    }
    return null;
  }
  renderer.domElement.addEventListener("pointermove", event => {
    hovered = actorAt(event)?.agent.id || null;
    renderer.domElement.style.cursor = hovered ? "pointer" : "";
  });
  renderer.domElement.addEventListener("pointerleave", () => { hovered = null; });
  renderer.domElement.addEventListener("click", event => {
    const actor = actorAt(event);
    if (actor) onSelect(actor.agent.id);
  });
  container.addEventListener("keydown", event => {
    if (event.key === "Escape") { hovered = null; keyboardFocus = null; tooltip.hidden = true; }
  });''')
s=s.replace('    label.addEventListener("click", () => onSelect(agent.id));','''    label.addEventListener("click", () => onSelect(agent.id));
    label.addEventListener("pointerenter", () => { hovered = agent.id; });
    label.addEventListener("pointerleave", () => { hovered = null; });
    label.addEventListener("focus", () => { keyboardFocus = agent.id; });
    label.addEventListener("blur", () => { keyboardFocus = null; });''')
start=s.index('  function updateLabel(a: Actor) {');end=s.index('  function cameraSize()',start)
s=s[:start]+'''  function actorStatus(a: Actor) {
    return a.resident.phase === "working" && a.status !== "working"
      ? a.status === "paused" ? "You have control"
        : a.status === "error" ? "Needs attention"
          : a.status === "loading" ? "Opening browser" : "At the desk"
      : a.resident.label;
  }
  function updateLabel(a: Actor) {
    a.label.replaceChildren();
    const dot = document.createElement("span");
    dot.className = "agent-dot";
    dot.style.background = PROVIDERS[a.agent.provider].color;
    dot.classList.toggle("claude-dot", a.agent.provider === "claude");
    const initials = document.createElement("span");
    initials.className = "agent-initials";
    initials.textContent = a.agent.name.trim().split(/\\s+/).map(word => Array.from(word)[0] || "").slice(0, 2).join("").toLocaleUpperCase() || "?";
    a.label.append(dot, initials);
    a.label.setAttribute("aria-label", `${a.agent.name}, ${PROVIDERS[a.agent.provider].name}, ${actorStatus(a)}`);
    a.label.setAttribute("aria-pressed", String(selected === a.agent.id));
    a.shownLabel = a.resident.label;
    a.ring.visible = selected === a.agent.id;
  }
  function positionTooltip() {
    const actor = actors.find(a => a.agent.id === (hovered || keyboardFocus));
    tooltip.hidden = !actor;
    for (const a of actors) {
      if (a === actor) a.label.setAttribute("aria-describedby", tooltip.id);
      else a.label.removeAttribute("aria-describedby");
    }
    if (!actor) return;
    const provider = PROVIDERS[actor.agent.provider];
    tooltipName.textContent = actor.agent.name;
    tooltipProvider.textContent = provider.name + " · " + actor.agent.role;
    tooltipStatus.textContent = actorStatus(actor);
    tooltip.style.borderTopColor = provider.color;
    const anchor = new T.Vector3(actor.resident.x, 2.15, actor.resident.z).project(camera);
    const half = tooltip.offsetWidth / 2;
    tooltip.style.left = Math.max(half + 8, Math.min(width - half - 8, ((anchor.x + 1) * width) / 2)) + "px";
    tooltip.style.top = Math.max(tooltip.offsetHeight + 8, Math.min(height - 8, ((1 - anchor.y) * height) / 2)) + "px";
  }
''' +s[end:]
s=s.replace('// Keep small name badges readable when perspective brings people together.', '// Keep the compact identity buttons apart without stacking full cards.')
s=s.replace('Math.abs(other.x - lx) < 105 && Math.abs(other.y - ly) < 42','Math.abs(other.x - lx) < 42 && Math.abs(other.y - ly) < 25').replace('ly = other.y + 43','ly = other.y + 26')
s=s.replace('      a.label.style.left = lx + "px";', '      a.label.style.left = Math.max(24, Math.min(width - 24, lx)) + "px";')
s=s.replace('      a.label.style.top = ly + "px";', '      a.label.style.top = Math.min(height - 25, ly) + "px";')
s=s.replace('    renderer.render(scene, camera);', '    positionTooltip();\n    renderer.render(scene, camera);')
p.write_text(s)
p=root/'src/style.css';s=p.read_text();start=s.index('.agent-label {');end=s.index('.monitor-target {',start)
s=s[:start]+'''.agent-label {
  position: absolute;
  pointer-events: auto;
  transform: translate(-50%, 0);
  background: #ffffffdf;
  border: 1px solid #dce4d5;
  border-radius: 12px;
  height: 24px;
  min-width: 30px;
  max-width: 46px;
  display: inline-flex;
  gap: 4px;
  padding: 3px 6px;
  box-shadow: 0 2px 5px #31412b08;
  z-index: 3;
}
.agent-initials { font-size: 9px; font-weight: 550; letter-spacing: .02em; }
.agent-dot { width: 5px; height: 5px; border-radius: 50%; flex: none; }
.agent-label[aria-pressed="true"] { border-color: #688565; box-shadow: 0 0 0 1px #688565; }
.agent-label:hover, .agent-label:focus-visible { background: #fff; }
.agent-tooltip {
  position: absolute;
  transform: translate(-50%, -100%);
  pointer-events: none;
  background: #fffffff5;
  border: 1px solid #dce4d5;
  border-top: 3px solid #688565;
  border-radius: 10px;
  padding: 10px 13px;
  width: max-content;
  max-width: 230px;
  box-shadow: 0 6px 20px #31412b1a;
  z-index: 20;
  overflow-wrap: anywhere;
}
.agent-tooltip strong { display: block; font-size: 13px; font-weight: 550; }
.agent-tooltip span, .agent-tooltip small { display: block; font-size: 10px; margin-top: 4px; color: #6b7c61; }
''' +s[end:]
s=s.replace('.agent-label small.agent-provider-label { font-size: 9px; }','').replace('.agent-provider-label { font-size: 9px; font-weight: 400; margin-left: 6px; color: #788374; }','')
p.write_text(s)
p=root/'src/main.ts';s=p.read_text().replace('Click a monitor to open the real browser.', 'Hover a character for details. Click a monitor to open its browser.').replace('· 0.3</span>', '· 0.3.1</span>');p.write_text(s)
import json
for name in ['package.json','package-lock.json','src-tauri/tauri.conf.json']:
 p=root/name;d=json.loads(p.read_text());d['version']='0.3.1'
 if 'packages' in d:d['packages']['']['version']='0.3.1'
 p.write_text(json.dumps(d,indent=2)+'\n')
p=root/'src-tauri/Cargo.toml';p.write_text(p.read_text().replace('version = "0.3.0"','version = "0.3.1"',1))
p=root/'README.md';s=p.read_text().replace('# Worklive 0.3','# Worklive 0.3.1',1);s=s.replace('Your original agents and task briefs', 'The office now uses compact initial badges. Hover a character or badge, or focus a badge with the keyboard, to see the full name, provider, role, and status. Click to select it in the side panel; Escape dismisses the detail tooltip. Provider shirt colors are unchanged.\n\nYour original agents and task briefs');p.write_text(s)
