// Screenshots of the hire flow: dialog with customiser open, then the walk-in after clicking Hire.
import { chromium } from "playwright";
const base = process.argv[2] || "http://127.0.0.1:8765/?style=comic&snap&nohires";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", e => console.log("[pageerror]", e.message));
page.on("console", m => { if (m.type() === "error") console.log("[error]", m.text()); });
await page.goto(base); await page.waitForTimeout(6000);
await page.click("#hire-btn"); await page.waitForTimeout(3000);
await page.click(".hire summary"); await page.fill(".hire [name=name]", "Noor"); await page.fill(".hire [name=role]", "Researcher"); await page.click(".hire [data-ai=description]"); await page.waitForTimeout(1500);
await page.click(".hire [data-k=traits] .chip2 >> nth=0"); await page.click(".hire [data-k=traits] .chip2 >> nth=4");
await page.waitForTimeout(3000);
await page.screenshot({ path: "shots/hire-dialog.png" }); console.log("saved shots/hire-dialog.png");
await page.click(".hire [data-act=reroll]"); await page.waitForTimeout(3000);
await page.screenshot({ path: "shots/hire-dialog-reroll.png" }); console.log("saved shots/hire-dialog-reroll.png");
await page.click(".hire [data-act=hire]"); await page.waitForTimeout(9000);
await page.screenshot({ path: "shots/hire-walkin.png" }); console.log("saved shots/hire-walkin.png");
await page.evaluate(() => localStorage.removeItem("worklive-mock-hires"));
await browser.close();
