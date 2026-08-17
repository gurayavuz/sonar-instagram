// Loads the real /sandbox page in jsdom and drives the panel against the
// live dev server over actual HTTP — no stubbed fetch anywhere.
//
//   npm run test:live      (starts dev-server.mjs itself if nothing is listening)
import { JSDOM } from "jsdom";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:8080";

let child = null;
if (!(await reachable())) {
  // fileURLToPath, not URL.pathname — the project path may contain spaces.
  child = spawn(process.execPath, [fileURLToPath(new URL("../dev-server.mjs", import.meta.url))], { stdio: "ignore" });
  for (let i = 0; i < 40 && !(await reachable()); i += 1) await new Promise((r) => setTimeout(r, 100));
  console.log("(started dev-server.mjs)");
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const html = await (await fetch(`${BASE}/sandbox`)).text();
const dom = new JSDOM(html, {
  url: `${BASE}/sandbox`,
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true
});
const { window } = dom;

// jsdom has no fetch; give the page the real one, resolving relative URLs.
window.fetch = (url, init) => fetch(new URL(url, BASE), init);

await wait(1200); // let the <script src> land

const root = () => window.document.getElementById("sonar-host")?.shadowRoot;
const q = (s) => root()?.querySelector(s);
const qq = (s) => [...(root()?.querySelectorAll(s) || [])];
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

console.log("\n== panel loads on the sandbox page ==");
check("script served and executed", !!root());
check("cookies readable by script", window.document.cookie.includes("ds_user_id"));
check("scan button present", !!q('[data-act="scan"]'));

console.log("\n== live scan over HTTP ==");
click(q('[data-act="scan"]'));
await wait(4000);

const stats = qq(".stat b").map((e) => e.textContent);
const server = await (await fetch(`${BASE}/graphql/query/?query_hash=3dec7e2c&variables=${encodeURIComponent(JSON.stringify({ id: "x", first: 1 }))}`)).json();
const serverFollowing = server.data.user.edge_follow.count;

check("results view rendered", !!q("[data-rows]"));
check("following count matches server", stats[0] === String(serverFollowing), `panel ${stats[0]} / server ${serverFollowing}`);
check("non-followers found", Number(stats[2]) > 0, `${stats[2]} non-followers`);
check("rows show monogram avatars", qq(".row .av").length > 0 && /^[A-Z0-9?]$/.test(qq(".row .av")[0].textContent), `${qq(".row").length} rows`);
check("usernames link to profiles", (q(".row .meta a")?.href || "").includes("instagram.com/"), q(".row .meta a")?.textContent);

console.log("\n== live unfollow over HTTP ==");
const before = Number(stats[0]);
qq("[data-pick]").slice(0, 3).forEach((cb) => {
  cb.checked = true;
  cb.dispatchEvent(new window.Event("change", { bubbles: true }));
});
check("selection reflected in footer", (q("footer .grow")?.textContent || "").includes("3"), q("footer .grow")?.textContent);

click(q('[data-act="unfollow"]'));
await wait(100);
check("confirm dialog", !!q(".dialog"));
click(q(".dialog [data-yes]"));
await wait(4000);

const after = await (await fetch(`${BASE}/graphql/query/?query_hash=3dec7e2c&variables=${encodeURIComponent(JSON.stringify({ id: "x", first: 1 }))}`)).json();
const serverAfter = after.data.user.edge_follow.count;
check("server actually processed unfollows", serverAfter === serverFollowing - 3, `server now ${serverAfter}, was ${serverFollowing}`);
check("done view shown", !!q('[data-act="back"]'));
check("summary reports 3 successes", (q(".pnote")?.textContent || "").includes("3"), q(".pnote")?.textContent);

click(q('[data-act="back"]'));
await wait(100);
check("panel list shrank too", Number(qq(".stat b")[0].textContent) === before - 3, `${qq(".stat b")[0].textContent} left`);

console.log("\n== REST fallback, live ==");
await fetch(`${BASE}/__config`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ failGraphQL: true }) });
window.document.getElementById("sonar-host").remove();
const src = await (await fetch(`${BASE}/dist/sonar.js`)).text();
window.eval(src);
click(q('[data-act="scan"]'));
await wait(5000);

const stats2 = qq(".stat b").map((e) => e.textContent);
check("scan succeeded without GraphQL", !!q("[data-rows]"), stats2.join(" / "));
check("followers pass ran automatically", stats2[1] !== "—", `followers: ${stats2[1]}`);
check("same non-follower count as fast path", stats2[2] === String(Number(stats[2]) - 3), `${stats2[2]} vs expected ${Number(stats[2]) - 3}`);
check("fans tab now enabled", !q('[data-tab="fans"]').disabled);

click(q('[data-tab="fans"]'));
await wait(150);
check("fans tab lists followers you don't follow", qq(".row").length === 24, `${qq(".row").length} fans`);

await fetch(`${BASE}/__config`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ failGraphQL: false }) });
console.log(`\n${fail.length ? `${fail.length} FAILING: ${fail.join(", ")}` : "all live checks passed"}\n`);
process.exit(fail.length ? 1 : 0);
