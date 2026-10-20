// Usage: node tests/pose-check.mjs [baseUrl] [recordSeconds]
// Loads the comic style with agents pinned into every spot type, records the worst penetration of body probes
// (spheres on hands, forearms, shins, knees, feet, head, torso) vs furniture collision boxes, the floor and the
// agent's own head/torso, then prints PASS/FAIL per agent and spot. Exit code 1 when anything fails.
import { chromium } from "../tools/node_modules/playwright/index.mjs";

const base = process.argv[2] || "http://127.0.0.1:8765/";
const record = +(process.argv[3] || 8);
const SCENES = [
  { name: "desks (type / needs / review) + walking", q: "cam=follow&agent=heiko" },
  { name: "sofa + armchairs", q: "place=sam:sofa0&place=juno:sofa1&place=ada:armchair0&place=milo:armchair1" },
  { name: "counter + cafe", q: "place=sam:counter0&place=juno:counter1&place=ada:counter2&place=milo:cafe-n&place=heiko:cafe-e" },
  { name: "window / books / plant", q: "place=sam:window0&place=juno:window1&place=ada:window2&place=milo:books&place=heiko:plant" },
  { name: "lounge swap (round + short builds)", q: "place=heiko:sofa0&place=mike:sofa1&place=sam:armchair0&place=juno:armchair1" },
  { name: "crowd variety", q: "crowd=8&place=guest-noor:sofa0&place=guest-tomas:armchair1&place=guest-lena:counter1&place=guest-ravi:window1" },
];

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let failed = 0, total = 0;
for (const s of SCENES) {
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${base}?style=comic&snap&posecheck=3&${s.q}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__worklive?.comic, null, { timeout: 60000 });
  await page.waitForTimeout((3 + record) * 1000);
  const rep = await page.evaluate(() => window.__worklive.comic.report());
  console.log(`\n== ${s.name}  (${rep.frames} frames sampled)`);
  for (const e of errors) console.log("  [page error]", e);
  for (const [id, a] of Object.entries(rep.agents)) {
    total++; if (!a.pass) failed++;
    const where = (a.spot || "walking") + "/" + a.pose;
    console.log(`  ${a.pass ? "PASS" : "FAIL"}  ${id.padEnd(12)} ${where.padEnd(22)} ${a.status}`);
    for (const f of a.fails.slice(0, 4)) console.log(`        ${f.probe} -> ${f.target}: ${f.depthCm} cm (tol ${f.tolCm})`);
  }
  if (!rep.frames) { console.log("  FAIL  no frames sampled"); failed++; }
  await page.close();
}
await browser.close();
console.log(`\n${total - failed}/${total} agent checks passed`);
process.exit(failed ? 1 : 0);
