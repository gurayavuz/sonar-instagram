// Runs the real script inside jsdom against a fake Instagram API.
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

const SRC = new URL("../src/sonar.js", import.meta.url);
const code = readFileSync(SRC, "utf8");

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://www.instagram.com/",
  runScripts: "outside-only",
  pretendToBeVisual: true
});
const { window } = dom;

window.document.cookie = "ds_user_id=555";
window.document.cookie = "csrftoken=tok123";

// ---- fake Instagram -------------------------------------------------
const FOLLOWING_TOTAL = 53; // 3 pages of 24
const following = Array.from({ length: FOLLOWING_TOTAL }, (_, i) => ({
  id: String(1000 + i),
  username: `user${i}`,
  full_name: `User ${i}`,
  profile_pic_url: i % 7 === 0 ? "https://x/44884218_345707102882519_x.jpg" : "https://x/pic.jpg",
  is_verified: i % 11 === 0,
  is_private: i % 5 === 0,
  follows_viewer: i % 3 !== 0 // 1/3 don't follow back
}));
// Enough fans-only accounts that the followers list spans more than one page,
// so the second pass is long enough to actually observe.
const FANS_ONLY = 21;
const followers = following
  .filter((u) => u.follows_viewer)
  .concat(
    Array.from({ length: FANS_ONLY }, (_, i) => ({
      id: String(9000 + i),
      username: `fan${i}`,
      full_name: `Fan ${i}`,
      profile_pic_url: "",
      is_verified: false,
      is_private: false
    }))
  );

const calls = { gql: 0, rest: 0, unfollow: 0 };
const unfollowed = [];

function page(list, after, key, count) {
  const start = after ? Number(after) : 0;
  const slice = list.slice(start, start + 24);
  const end = start + slice.length;
  return {
    data: {
      user: {
        [key]: {
          count,
          edges: slice.map((node) => ({ node })),
          page_info: { has_next_page: end < list.length, end_cursor: end < list.length ? String(end) : null }
        }
      }
    }
  };
}

window.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith("/graphql/query/")) {
    calls.gql += 1;
    const vars = JSON.parse(decodeURIComponent(new URL(u, "https://www.instagram.com").searchParams.get("variables")));
    const isFollowing = u.includes("3dec7e2c57367ef3da3d987d89f9dbc8");
    const body = isFollowing
      ? page(following, vars.after, "edge_follow", following.length)
      : page(followers, vars.after, "edge_followed_by", followers.length);
    return { ok: true, status: 200, json: async () => body, headers: { get: () => null } };
  }
  if (u.startsWith("/api/v1/friendships/destroy/")) {
    calls.unfollow += 1;
    unfollowed.push(u.split("/")[5]);
    if (init.headers?.["x-csrftoken"] !== "tok123") throw new Error("missing csrf!");
    return { ok: true, status: 200, text: async () => JSON.stringify({ status: "ok" }) };
  }
  if (u.includes("/api/v1/friendships/")) {
    calls.rest += 1;
    // The real v1 endpoints do not return follows_viewer — strip it — and they
    // paginate with max_id rather than returning the whole list at once.
    const strip = (list) => list.map(({ follows_viewer, ...rest }) => ({ ...rest, pk: rest.id }));
    const list = u.includes("/followers/") ? followers : following;
    const params = new URL(u, "https://www.instagram.com").searchParams;
    const size = Number(params.get("count")) || 50;
    const start = Number(params.get("max_id")) || 0;
    const slice = list.slice(start, start + size);
    const end = start + slice.length;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ users: strip(slice), next_max_id: end < list.length ? String(end) : null })
    };
  }
  throw new Error("unexpected url " + u);
};

// ---- run ------------------------------------------------------------
window.eval(code);

const host = window.document.getElementById("sonar-host");
const root = host.shadowRoot;
const $ = (sel) => root.querySelector(sel);
const $$ = (sel) => [...root.querySelectorAll(sel)];
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const fail = [];
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : " FAIL "} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) fail.push(name);
};

console.log("\n== mount ==");
check("panel mounted in shadow DOM", !!$(".panel"));
check("idle view shows scan button", !!$('[data-act="scan"]'));
check("styles isolated", root.querySelector("style").textContent.includes(".panel"));
check("idle scope rendered, frozen", !!$(".scope.idle") && $$(".scope .blip").length === 5);
check("scope has range rings + crosshairs", $$(".scope svg circle").length === 3 && $$(".scope svg line").length === 2);

console.log("\n== scan (fast path) ==");
// Speed up the timings the same way a user would via settings.
const store = JSON.parse(window.localStorage.getItem("sonar_state_v1") || "{}");
window.localStorage.setItem(
  "sonar_state_v1",
  JSON.stringify({ ...store, timings: { scanDelayMin: 1, scanDelayMax: 1, scanRestEvery: 0, scanRestMs: 0, unfollowDelayMin: 1, unfollowDelayMax: 1, unfollowRestEvery: 0, unfollowRestMs: 0 } })
);
host.remove();
window.eval(code); // remount with fast timings
const root2 = host2Root();
function host2Root() {
  return window.document.getElementById("sonar-host").shadowRoot;
}
const q = (sel) => host2Root().querySelector(sel);
const qq = (sel) => [...host2Root().querySelectorAll(sel)];

// Watch what the readout actually shows while the scan runs.
const frames = [];
const sampler = setInterval(() => {
  const el = host2Root().querySelector("[data-counter]");
  if (!el) return;
  frames.push({
    readout: el.textContent.trim().replace(/\s+/g, " "),
    phase: host2Root().querySelector("[data-phase]")?.textContent.trim() || "",
    countdown: host2Root().querySelector("[data-countdown]")?.textContent.trim() || ""
  });
}, 10);

click(q('[data-act="scan"]'));
await wait(600);
clearInterval(sampler);

// Regression: sub-second waits used to render a permanent "Next one in 1s"
// that never counted down — a wait the user never actually saw happen.
check("no countdown shown for instant waits", frames.every((f) => f.countdown === ""),
  frames.find((f) => f.countdown)?.countdown || "none shown");

// Regression: the running total must never appear to slide backwards.
const counts = frames.map((f) => Number((f.readout.match(/^(\d+)/) || [])[1])).filter(Number.isFinite);
const wentBack = counts.some((n, i) => i > 0 && n < counts[i - 1]);
check("running count never goes backwards", !wentBack, counts.join(" → ").slice(0, 60));

const expectedNon = following.filter((u) => !u.follows_viewer).length;
check("paged all 3 GraphQL pages", calls.gql === 3, `gql calls: ${calls.gql}`);
check("did not hit REST fallback", calls.rest === 0);
check("results view rendered", !!q("[data-rows]"));
const stats = qq(".stat b").map((e) => e.textContent);
check("following count correct", stats[0] === String(FOLLOWING_TOTAL), stats.join(" / "));
check("followers not loaded on fast path", stats[1] === "—", stats.join(" / "));
check("non-follower count correct", stats[2] === String(expectedNon), `got ${stats[2]}, want ${expectedNon}`);
check("rows rendered", qq(".row").length === expectedNon, `${qq(".row").length} rows`);
check("rows numbered, zero-padded", qq(".row .idx")[0]?.textContent === "01" && qq(".row .idx")[9]?.textContent === "10");
// Instagram's CDN images render broken from here, so we draw monograms instead.
check("monogram avatars, no remote images", qq(".row img").length === 0 && /^[A-Z0-9?]$/.test(qq(".row .av")[0]?.textContent || ""),
  qq(".row .av")[0]?.textContent);
check("stats use tabular readout", host2Root().querySelector("style").textContent.includes("tabular-nums"));

console.log("\n== filters & search ==");
const beforeFilter = qq(".row").length;
click(qq("[data-filter]").find((c) => c.dataset.filter === "verified"));
await wait(50);
const afterFilter = qq(".row").length;
check("verified filter removes rows", afterFilter < beforeFilter, `${beforeFilter} → ${afterFilter}`);
click(qq("[data-filter]").find((c) => c.dataset.filter === "verified"));
await wait(50);

const search = q("[data-search]");
search.value = "user1";
search.dispatchEvent(new window.Event("input"));
await wait(300);
const searched = qq(".row").length;
check("search narrows list", searched > 0 && searched < expectedNon, `${searched} matches`);
search.value = "";
search.dispatchEvent(new window.Event("input"));
await wait(300);

console.log("\n== hide / whitelist ==");
const firstHide = qq("[data-hide]")[0];
const hiddenId = firstHide.dataset.hide;
click(firstHide);
await wait(50);
check("hiding removes from list", qq(".row").length === expectedNon - 1);
check("hidden id persisted", (JSON.parse(window.localStorage.getItem("sonar_state_v1")).hidden || []).includes(hiddenId));

console.log("\n== select + unfollow ==");
click(qq('[data-act="selall"]')[0]);
await wait(50);
const selectedCount = qq("[data-pick]").filter((c) => c.checked).length;
check("select all checks every row", selectedCount === expectedNon - 1, `${selectedCount} selected`);
check("unfollow button appears", !!q('[data-act="unfollow"]'));

click(q('[data-act="unfollow"]'));
await wait(50);
check("confirm dialog shown", !!q(".dialog"));
click(q(".dialog [data-yes]"));
await wait(1500);

check("unfollow POSTed for each selection", calls.unfollow === selectedCount, `${calls.unfollow} posts`);
check("done view rendered", !!q('[data-act="back"]'));
check("summary counts successes", q(".pnote")?.textContent.includes(String(selectedCount)), q(".pnote")?.textContent);
click(q('[data-act="back"]'));
await wait(50);
const remaining = qq(".stat b")[0].textContent;
check("unfollowed users removed from list", Number(remaining) === FOLLOWING_TOTAL - selectedCount, `${remaining} left`);

console.log("\n== REST fallback + followers pass ==");
calls.gql = 0;
calls.rest = 0;
window.fetch = (() => {
  const original = window.fetch;
  return async (url, init) => {
    if (String(url).startsWith("/graphql/query/")) {
      calls.gql += 1;
      return { ok: false, status: 404, json: async () => ({}), headers: { get: () => null } };
    }
    return original(url, init);
  };
})();
window.document.getElementById("sonar-host").remove();
// Small but non-zero page delays, so the scanning view is actually on screen
// long enough to observe — with 1ms delays it finishes between samples.
window.localStorage.setItem(
  "sonar_state_v1",
  JSON.stringify({
    ...JSON.parse(window.localStorage.getItem("sonar_state_v1") || "{}"),
    timings: { scanDelayMin: 40, scanDelayMax: 60, scanRestEvery: 0, scanRestMs: 0, unfollowDelayMin: 1, unfollowDelayMax: 1, unfollowRestEvery: 0, unfollowRestMs: 0 }
  })
);
window.eval(code);

// The followers pass restarts the count from zero, so it has to say why.
const phases = new Set();
const phaseSampler = setInterval(() => {
  const p = host2Root().querySelector("[data-phase]")?.textContent.trim();
  if (p) phases.add(p);
}, 10);

click(q('[data-act="scan"]'));
await wait(1600);
clearInterval(phaseSampler);

const stepLabels = [...phases].filter((p) => /Step \d of 2/.test(p));
check("second pass is labelled as step 2 of 2", stepLabels.some((p) => p.startsWith("Step 2 of 2")),
  stepLabels.join(" / ") || [...phases].join(" / "));
check("fell back to REST", calls.rest > 0, `rest calls: ${calls.rest}`);
check("followers pass ran when flag missing", qq(".stat b")[1].textContent !== "—", qq(".stat b").map((e) => e.textContent).join(" / "));
check("fans tab enabled", !q('[data-tab="fans"]').disabled);

console.log(`\n${fail.length ? `${fail.length} FAILING: ${fail.join(", ")}` : "all checks passed"}\n`);
process.exit(fail.length ? 1 : 0);
