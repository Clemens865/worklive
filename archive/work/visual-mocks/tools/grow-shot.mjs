// Hires 8 agents (6 fill the free desks, 2 trigger office growth) and screenshots the overview.
import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", e => console.log("[pageerror]", e.message));
page.on("console", m => { if (m.type() === "error") console.log("[error]", m.text()); });
await page.goto("http://127.0.0.1:8765/?style=comic&snap&nohires&helpers=0&cam=follow&agent=hire-t7"); await page.waitForTimeout(6000);
const r = await page.evaluate(async () => {
  const names = ["Noor", "Tomas", "Lena", "Ravi", "Ines", "Kofi", "Yuki", "Bea"];
  for (const [k, name] of names.entries()) {
    const free = window.__hireFreeDesk?.();
    await window.__hire({ id: "hire-t" + k, name, role: "Analyst", provider: k % 2 ? "codex" : "claude", status: "idle", traits: [], lookSeed: "t" + k + name, look: {}, desk: null });
  }
  return document.querySelectorAll(".chip").length;
});
console.log("chips", r);
await page.evaluate(() => localStorage.removeItem("worklive-mock-hires"));
await page.click('#cam-seg [data-cam="overview"]'); await page.waitForTimeout(12000); console.log(await page.evaluate(() => [document.querySelectorAll(".chip").length]));
await page.screenshot({ path: "shots/grow-overview.png" }); console.log("saved shots/grow-overview.png");
await browser.close();
