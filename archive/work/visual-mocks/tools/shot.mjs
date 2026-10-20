// Usage: node tools/shot.mjs "<url>" out.png [waitMs] [width] [height]
// Headless screenshot of the office mock (WebGL via SwiftShader/ANGLE). Prints console errors.
import { chromium } from "playwright";

const [url, out, wait = "4000", w = "1440", h = "900"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on("console", m => { if (m.type() === "error" || m.type() === "warning") console.log(`[${m.type()}]`, m.text()); });
page.on("pageerror", e => console.log("[pageerror]", e.message));
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
console.log("saved", out);
await browser.close();
