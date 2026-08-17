// Layout checks in a real browser. jsdom computes no layout, so clipping bugs
// (a squashed header, a footer sliced off, a toast covering the buttons) sail
// straight through test/run.mjs — every one of those shipped at least once.
//
//   npm run test:visual        (needs: npm i -D playwright && npx playwright install chromium)
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:8080";
const SHOTS = fileURLToPath(new URL("../dist/shots/", import.meta.url));

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("playwright not installed — skipping visual checks.");
  console.log("  npm i -D playwright && npx playwright install chromium");
  process.exit(0);
}

let child = null;
if (!(await reachable())) {
  child = spawn(process.execPath, [fileURLToPath(new URL("../dev-server.mjs", import.meta.url))], { stdio: "ignore" });
  for (let i = 0; i < 40 && !(await reachable()); i += 1) await new Promise((r) => setTimeout(r, 100));
}
process.on("exit", () => child?.kill());

async function reachable() {
  try {
    await fetch(`${BASE}/sandbox`);
    return true;
  } catch {
    return false;
  }
}

const fail = [];
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : " FAIL "} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) fail.push(name);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });

const badRequests = [];
page.on("requestfailed", (r) => badRequests.push(r.url().slice(0, 80)));
page.on("response", (r) => r.status() >= 400 && badRequests.push(`${r.status()} ${r.url().slice(0, 80)}`));

await page.goto(`${BASE}/sandbox`, { waitUntil: "networkidle" });
await page.waitForFunction(() => document.getElementById("sonar-host")?.shadowRoot?.querySelector(".panel"));

// Everything measured inside the shadow root, as rendered.
const measure = () =>
  page.evaluate(() => {
    const root = document.getElementById("sonar-host").shadowRoot;
    const box = (sel) => {
      const el = root.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, h: r.height, scrollH: el.scrollHeight, clientH: el.clientHeight };
    };
    const imgs = [...root.querySelectorAll("img")];
    return {
      panel: box(".panel"),
      header: box("header"),
      footer: box("footer"),
      toast: box(".toast"),
      images: imgs.length,
      brokenImages: imgs.filter((i) => !i.complete || i.naturalWidth === 0).length
    };
  });

const clipped = (b) => !b || b.scrollH > b.clientH + 1;
const within = (inner, outer) => inner && outer && inner.bottom <= outer.bottom + 1 && inner.top >= outer.top - 1;

console.log("\n== idle ==");
let m = await measure();
await page.locator("#sonar-host .panel").screenshot({ path: `${SHOTS}idle.png` }).catch(() => {});
check("no images in the panel", m.images === 0, `${m.images} found`);
check("header not clipped", !clipped(m.header), `content ${m.header.scrollH}px in ${m.header.clientH}px`);

console.log("\n== after a scan ==");
await page.evaluate(() => document.getElementById("sonar-host").shadowRoot.querySelector('[data-act="scan"]').click());
await page.waitForFunction(() => document.getElementById("sonar-host").shadowRoot.querySelector("[data-rows]"), null, { timeout: 30000 });
await page.waitForTimeout(300);

m = await measure();
await page.locator("#sonar-host .panel").screenshot({ path: `${SHOTS}results.png` }).catch(() => {});

check("still no images once rows are listed", m.images === 0 && m.brokenImages === 0, `${m.images} images`);
// Regression: header and footer used to shrink once the list hit max-height.
check("header keeps its full height", !clipped(m.header), `content ${m.header.scrollH}px in ${m.header.clientH}px`);
check("header sits inside the panel", within(m.header, m.panel));
check("footer fully visible", m.footer && within(m.footer, m.panel), m.footer ? `footer ${Math.round(m.footer.bottom)} vs panel ${Math.round(m.panel.bottom)}` : "no footer");
check("footer keeps its full height", !clipped(m.footer), m.footer && `content ${m.footer.scrollH}px in ${m.footer.clientH}px`);
// Regression: the toast used to sit on top of the footer buttons.
check("toast clear of the footer", !m.toast || m.toast.bottom <= m.footer.top + 1, m.toast ? `toast ends ${Math.round(m.toast.bottom)}, footer starts ${Math.round(m.footer.top)}` : "no toast up");
check("no failed requests", badRequests.length === 0, badRequests.join(", ") || "none");

console.log(`\nscreenshots: dist/shots/`);
console.log(`${fail.length ? `${fail.length} FAILING: ${fail.join(", ")}` : "all visual checks passed"}\n`);
await browser.close();
process.exit(fail.length ? 1 : 0);
