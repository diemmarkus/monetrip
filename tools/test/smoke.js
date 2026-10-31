// Smoke test against a fake Firebase (tools/test/stubs): no network, no real data.
//   node tools/test/smoke.js            signed-in user
//   GUEST=1 node tools/test/smoke.js    guest account
// Needs Playwright with Chromium (require('playwright')). Screenshots go to tools/test/out/.
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const ROOT = path.resolve(__dirname, "../.."), STUBS = path.join(__dirname, "stubs"), OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route("https://www.gstatic.com/firebasejs/**", r => {
    const u = r.request().url();
    const f = u.includes("auth") ? (process.env.GUEST ? "firebase-auth-guest.js" : "firebase-auth.js") : u.includes("firestore") ? "firebase-firestore.js" : "firebase-app.js";
    r.fulfill({ path: path.join(STUBS, f), contentType: "text/javascript" });
  });
  await p.route(/frankfurter/, r => r.fulfill({ json: { date: "2026-10-27", rates: { GBP: 0.8382, USD: 1.1188 } } }));
  await p.route("http://mt.local/**", r => {
    const rel = new URL(r.request().url()).pathname.replace(/^\//, "") || "index.html";
    r.fulfill({ path: path.join(ROOT, rel) });
  });
  const ok = (name, cond) => { console.log((cond ? "ok   " : "FAIL ") + name); if (!cond) process.exitCode = 1; };

  await p.goto("http://mt.local/index.html#trip-t1"); await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(OUT, "trip.png") });
  ok("trip renders", await p.$(".ticket") !== null);

  if (!process.env.GUEST) {
    await p.click("#fab"); await p.waitForTimeout(400);
    ok("expense sheet opens", !(await p.$eval("#sheet", e => e.hidden)));
    await p.fill("#xdesc", "Taxi"); await p.fill("#xamt", "12,50");
    await p.screenshot({ path: path.join(OUT, "sheet.png") });
    await p.click(".xform button[type=submit]"); await p.waitForTimeout(1200);
    ok("expense saved and sheet closed", await p.$eval("#sheet", e => e.hidden) && (await p.$$(".swipe")).length === 2);
    await p.click("text=Settle up"); await p.waitForTimeout(400);
    ok("settle up shows a plan", (await p.$$(".pay")).length > 0);
  }
  if (!process.env.GUEST) {
    // Slow network: the sign-in check and the expense lists take seconds. The start page and trips
    // seen before must open at once from the phone's copy; a trip never opened shows a loading screen.
    await p.goto("http://mt.local/index.html"); await p.waitForTimeout(900); // save the start-up snapshot
    await p.addInitScript(() => { window.__authDelay = 2500; window.__dataDelay = 1500; });
    await p.reload(); await p.waitForTimeout(300);
    await p.click(".trip >> text=Edinburgh"); await p.waitForTimeout(200);
    ok("slow net: seen trip opens during sign-in", (await p.$(".ticket")) !== null && (await p.$$(".swipe")).length === 2);
    await p.click(".back"); await p.waitForTimeout(200);
    await p.click(".trip >> text=Vienna"); await p.waitForTimeout(200);
    ok("slow net: unseen trip shows loading screen", (await p.textContent(".trip-loading h1").catch(() => "")) === "Vienna");
    await p.screenshot({ path: path.join(OUT, "trip-loading.png") });
    await p.waitForTimeout(4500);
    ok("slow net: unseen trip loads", (await p.$(".ticket")) !== null && (await p.$$(".swipe")).length === 1);
  }
  ok("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
