// Usage: node tools/eval.mjs "<url>" "<js expression>" [waitMs] — prints the expression's value after waiting.
import { chromium } from "playwright";
const [url, expr, wait = "6000"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", e => console.log("[pageerror]", e.message));
page.on("console", m => { if (m.type() === "error") console.log("[error]", m.text()); });
await page.goto(url); await page.waitForTimeout(+wait);
console.log(JSON.stringify(await page.evaluate(expr), null, 1));
await browser.close();
