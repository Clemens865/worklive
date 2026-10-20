// Usage: node ui-shots.mjs <outPrefix> [w] [h] [scheme] [which=main,hire,projects,work,context]
import { chromium } from "playwright";
const [prefix, w = "1440", h = "900", scheme = "light", which = "main,hire,projects"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, colorScheme: scheme });
page.on("pageerror", e => console.log("[pageerror]", e.message));
await page.goto("http://127.0.0.1:1432/"); await page.waitForTimeout(12000);
const shot = async n => { await page.screenshot({ path: `${prefix}-${n}.png` }); console.log("saved", `${prefix}-${n}.png`); };
const list = which.split(",");
if (list.includes("main")) await shot("main");
if (list.includes("overlays")) { await page.evaluate(() => {
  const host = document.querySelector(".office-labels"); if (!host) return;
  const mk = (x, y, ini, col, mood, sel) => { const b = document.createElement("button"); b.className = "agent-label"; b.setAttribute("aria-pressed", String(!!sel));
    b.innerHTML = `<span class="agent-dot" style="background:${col}"></span><span class="agent-initials">${ini}</span><span class="agent-state" data-mood="${mood}"></span>`; b.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`; host.append(b); };
  mk(420, 380, "AD", "#2D9D8F", "working", true); mk(560, 330, "NO", "#D97757", "needs"); mk(680, 420, "TO", "#2D9D8F", "idle"); mk(760, 300, "LE", "#D97757", "review");
  const t = document.createElement("div"); t.className = "agent-tooltip"; t.style.setProperty("--provider", "#D97757"); t.style.left = "560px"; t.style.top = "362px"; t.innerHTML = "<strong>Noor</strong><span>Claude Code · Researcher</span><small>Needs your input</small>"; host.append(t);
  const s = document.createElement("div"); s.className = "speech-bubble"; s.textContent = "Anyone else think the coffee got stronger?"; s.style.transform = "translate(700px,380px) translate(-50%,-100%)"; host.append(s);
}); await page.waitForTimeout(400); await shot("overlays"); }
if (list.includes("hover")) { const l = await page.$(".agent-label"); if (l) { await l.hover(); await page.waitForTimeout(600); } await shot("hover"); }
if (list.includes("hire")) { await page.click("#add-agent"); await page.waitForTimeout(3000); const s = await page.$(".hire summary"); if (s) await s.click(); await page.waitForTimeout(800); await shot("hire"); await page.keyboard.press("Escape"); await page.waitForTimeout(500); }
for (const [n, id] of [["projects", "#projects-open"], ["handoffs", "#project-handoffs"], ["context", "#company-context"], ["work", "#work-results"]]) {
  if (!list.includes(n)) continue;
  await page.evaluate(n => { const d = document.querySelector(`#${n}-dialog`); console.log(n, !!d); if (d && !d.open) d.showModal(); }, n); await page.waitForTimeout(900); await shot(n);
  await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach(d => d.close())); await page.waitForTimeout(300);
}
if (list.includes("toast")) { await page.evaluate(() => import("/src/motion/motion.ts").then(m => { m.toast("Task started", "Ada is researching the brief.", "success"); m.toast("Couldn't reach Codex", "Open the official tool to sign in.", "error"); })); await page.waitForTimeout(900); await shot("toast"); }
if (list.includes("browser")) { await page.evaluate(() => { document.querySelector("#office-view").hidden = true; document.querySelector("#browser-view").hidden = false; }); await page.waitForTimeout(500); await shot("browser"); }
await browser.close();
