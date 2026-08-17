#!/usr/bin/env node
// Local dev server: serves the landing page, plus a mock Instagram that speaks
// the same endpoints the real one does, so the panel can be driven end to end
// in a real browser without touching Meta's servers or your account.
//
//   node dev-server.mjs        ->  http://localhost:8080

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);

const FOLLOWING_COUNT = 137;
const FANS_COUNT = 24;
const VIEWER_ID = "17841400000000000";

/* -------------------------------------------------------------------- *
 * Fake population — deterministic, so reloads give the same list
 * -------------------------------------------------------------------- */

const FIRST = ["ada", "kerem", "mila", "onur", "juno", "selin", "arda", "nova", "deniz", "kaan", "iris", "berk"];
const LAST = ["yilmaz", "kaya", "demir", "sahin", "aydin", "koc", "arslan", "dogan"];
const HUES = [340, 20, 45, 160, 200, 260, 300];

function avatar(seed, blank) {
  if (blank) return "https://instagram.example/44884218_345707102882519_default.jpg";
  const hue = HUES[seed % HUES.length];
  const letter = String.fromCharCode(65 + (seed % 26));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="hsl(${hue} 45% 32%)"/><text x="32" y="42" font-family="sans-serif" font-size="28" fill="hsl(${hue} 70% 82%)" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function makeUser(seed, { followsViewer }) {
  const first = FIRST[seed % FIRST.length];
  const last = LAST[Math.floor(seed / FIRST.length) % LAST.length];
  return {
    id: String(2000000 + seed),
    pk: String(2000000 + seed),
    username: `${first}.${last}${seed}`,
    full_name: `${cap(first)} ${cap(last)}`,
    profile_pic_url: avatar(seed, seed % 9 === 0),
    is_verified: seed % 13 === 0,
    is_private: seed % 5 === 0,
    follows_viewer: followsViewer
  };
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

// Roughly a third of the people you follow don't follow back.
const following = Array.from({ length: FOLLOWING_COUNT }, (_, i) => makeUser(i, { followsViewer: i % 3 !== 0 }));
const fansOnly = Array.from({ length: FANS_COUNT }, (_, i) => makeUser(500 + i, { followsViewer: true }));
const followers = following.filter((u) => u.follows_viewer).concat(fansOnly);

const state = {
  living: new Set(following.map((u) => u.id)), // shrinks as you unfollow
  failGraphQL: false,
  rateLimitOnce: false,
  blockAfter: 0,
  unfollowCount: 0,
  log: []
};

const livingFollowing = () => following.filter((u) => state.living.has(u.id));

/* -------------------------------------------------------------------- *
 * Endpoint handlers
 * -------------------------------------------------------------------- */

function paginate(list, after, size) {
  const start = after ? Number(after) || 0 : 0;
  const slice = list.slice(start, start + size);
  const end = start + slice.length;
  return { slice, hasNext: end < list.length, cursor: end < list.length ? String(end) : null };
}

function graphql(url, res) {
  if (state.failGraphQL) return send(res, 404, "text/plain", "not found (mock: GraphQL disabled)");
  if (state.rateLimitOnce) {
    state.rateLimitOnce = false;
    res.writeHead(429, { "content-type": "application/json", "retry-after": "3" });
    return res.end(JSON.stringify({ message: "rate limited" }));
  }

  let vars = {};
  try {
    vars = JSON.parse(url.searchParams.get("variables") || "{}");
  } catch {}

  const hash = url.searchParams.get("query_hash") || "";
  const isFollowing = hash.startsWith("3dec7e2c");
  const source = isFollowing ? livingFollowing() : followers;
  const key = isFollowing ? "edge_follow" : "edge_followed_by";
  const { slice, hasNext, cursor } = paginate(source, vars.after, Number(vars.first) || 24);

  send(res, 200, "application/json", {
    data: {
      user: {
        [key]: {
          count: source.length,
          page_info: { has_next_page: hasNext, end_cursor: cursor },
          // GraphQL nodes carry follows_viewer — this is the fast path.
          edges: slice.map((node) => ({ node }))
        }
      }
    }
  });
}

function restList(url, kind, res) {
  const source = kind === "followers" ? followers : livingFollowing();
  const { slice, hasNext, cursor } = paginate(source, url.searchParams.get("max_id"), Number(url.searchParams.get("count")) || 50);
  send(res, 200, "application/json", {
    // The real v1 endpoints omit follows_viewer, which forces the followers
    // pass and the set-difference path.
    users: slice.map(({ follows_viewer, ...rest }) => rest),
    next_max_id: hasNext ? cursor : null,
    status: "ok"
  });
}

function destroy(id, req, res) {
  if (req.headers["x-csrftoken"] !== "mockcsrftoken") {
    return send(res, 403, "application/json", { message: "CSRF token missing or incorrect", status: "fail" });
  }
  state.unfollowCount += 1;
  if (state.blockAfter && state.unfollowCount > state.blockAfter) {
    state.log.push(`BLOCKED ${id}`);
    return send(res, 400, "application/json", { message: "feedback_required", spam: true, feedback_required: true, status: "fail" });
  }
  state.living.delete(id);
  state.log.push(`unfollowed ${id}`);
  send(res, 200, "application/json", { status: "ok", friendship_status: { following: false, followed_by: false } });
}

/* -------------------------------------------------------------------- *
 * Sandbox page
 * -------------------------------------------------------------------- */

function sandbox() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Mock Instagram — Sonar sandbox</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#fff;color:#0b0b1f;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;padding:40px 24px}
  .shell{width:min(720px,100%);margin:0 auto}
  h1{font-size:24px;font-weight:600;letter-spacing:-.025em;margin-bottom:6px;color:#000080}
  .warn{display:inline-block;background:#000080;color:#fff;border-radius:3px;padding:4px 12px;font-size:10.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;margin-bottom:16px}
  p.dim{color:#5a5f80;margin-bottom:24px;max-width:62ch}
  fieldset{border:1px solid #c9cde6;border-top:3px solid #000080;padding:16px 18px;margin-bottom:14px}
  legend{padding:0 8px;font-size:10px;text-transform:uppercase;letter-spacing:.11em;color:#000080;font-weight:700}
  label{display:flex;gap:10px;align-items:center;padding:6px 0;font-size:13.5px;cursor:pointer}
  label input{accent-color:#000080}
  label small{color:#5a5f80}
  input[type=number]{width:70px;background:#fff;border:1px solid #c9cde6;color:#0b0b1f;border-radius:3px;padding:4px 8px;font:inherit;font-size:13px}
  input[type=number]:focus{outline:none;border-color:#000080}
  .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  button{background:#fff;border:1px solid #000080;color:#000080;border-radius:3px;padding:9px 15px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
  button:hover{background:#eef0fa}
  button.pink{background:#000080;border-color:#000080;color:#fff}
  button.pink:hover{background:#0000a8}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;background:#eef0fa;border:1px solid #dfe3f4;border-radius:2px;padding:1px 6px;color:#000080}
  .stats{display:flex;gap:26px;flex-wrap:wrap;color:#5a5f80;font-size:12px;margin-top:4px}
  .stats b{color:#000080;font-size:19px;display:block;font-weight:600;letter-spacing:-.01em}
</style></head>
<body><div class="shell">
  <span class="warn">Pretend Instagram — your real account isn't involved</span>
  <h1>Somewhere safe to try it</h1>
  <p class="dim">This page is dressed up as <code>instagram.com</code> so the panel in the corner will run.
  That panel is the real <code>src/sonar.js</code>, not a copy — it's just talking to a made-up Instagram
  living on this server. Unfollowing here only edits numbers in memory, so restart the server whenever you
  want everything back.</p>

  <fieldset><legend>Who's in here</legend>
    <div class="stats">
      <span><b>${FOLLOWING_COUNT}</b>you follow</span>
      <span><b>${followers.length}</b>follow you</span>
      <span><b>${following.filter((u) => !u.follows_viewer).length}</b>never followed back</span>
      <span><b>${FANS_COUNT}</b>fans only</span>
    </div>
  </fieldset>

  <fieldset><legend>Make something go wrong</legend>
    <label><input type="checkbox" id="failGraphQL"> Break the fast route <small>— so you can watch it fall back to the older API and load followers instead</small></label>
    <label><input type="checkbox" id="rateLimitOnce"> Say "slow down" once <small>— a 429, to see it wait and try again on its own</small></label>
    <label><input type="checkbox" id="useBlock"> Step in after <input type="number" id="blockAfter" value="3" min="1"> unfollows <small>— the block Instagram really sends; the queue should stop dead</small></label>
    <div class="row"><button id="apply" class="pink">Apply these</button><button id="reset">Put it all back</button></div>
  </fieldset>

  <fieldset><legend>The panel itself</legend>
    <div class="row">
      <button id="reload">Load it again</button>
      <button id="fast">Hurry it up</button>
      <button id="real">Real-world speed</button>
      <button id="wipe">Forget my settings</button>
    </div>
  </fieldset>
</div>

<script>
  // The script reads these exactly as it would on the real site.
  document.cookie = "ds_user_id=${VIEWER_ID}; path=/";
  document.cookie = "csrftoken=mockcsrftoken; path=/";

  const KEY = "sonar_state_v1";
  const seed = (timings) => {
    const cur = JSON.parse(localStorage.getItem(KEY) || "{}");
    localStorage.setItem(KEY, JSON.stringify({ ...cur, timings }));
    location.reload();
  };
  const FAST = { scanDelayMin: 60, scanDelayMax: 160, scanRestEvery: 0, scanRestMs: 0,
                 unfollowDelayMin: 250, unfollowDelayMax: 600, unfollowRestEvery: 0, unfollowRestMs: 0 };

  document.getElementById("fast").onclick = () => seed(FAST);
  document.getElementById("real").onclick = () => {
    const cur = JSON.parse(localStorage.getItem(KEY) || "{}");
    delete cur.timings;
    localStorage.setItem(KEY, JSON.stringify(cur));
    location.reload();
  };
  document.getElementById("wipe").onclick = () => { localStorage.removeItem(KEY); location.reload(); };
  document.getElementById("reload").onclick = () => {
    document.getElementById("sonar-host")?.remove();
    const s = document.createElement("script");
    s.src = "/dist/sonar.js?t=" + Date.now();
    document.body.appendChild(s);
  };

  const apply = async () => {
    await fetch("/__config", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        failGraphQL: failGraphQL.checked,
        rateLimitOnce: rateLimitOnce.checked,
        blockAfter: useBlock.checked ? Number(blockAfter.value) : 0
      })
    });
  };
  document.getElementById("apply").onclick = apply;
  document.getElementById("reset").onclick = async () => {
    failGraphQL.checked = rateLimitOnce.checked = useBlock.checked = false;
    await apply();
    location.reload();
  };

  // Seed fast timings on first visit so the demo isn't a two-minute wait.
  if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify({ timings: FAST }));
</script>
<script src="/dist/sonar.js"></script>
</body></html>`;
}

/* -------------------------------------------------------------------- *
 * Server
 * -------------------------------------------------------------------- */

function send(res, status, type, body) {
  const payload = type === "application/json" && typeof body !== "string" ? JSON.stringify(body) : body;
  res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store" });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === "/__config" && req.method === "POST") {
    Object.assign(state, await readBody(req));
    state.unfollowCount = 0;
    console.log("  config:", { failGraphQL: state.failGraphQL, rateLimitOnce: state.rateLimitOnce, blockAfter: state.blockAfter });
    return send(res, 200, "application/json", { ok: true });
  }

  if (path === "/graphql/query/") return graphql(url, res);

  const rest = path.match(/^\/api\/v1\/friendships\/\d+\/(following|followers)\/$/);
  if (rest) return restList(url, rest[1], res);

  const kill = path.match(/^\/api\/v1\/friendships\/destroy\/(\d+)\/$/) || path.match(/^\/web\/friendships\/(\d+)\/unfollow\/$/);
  if (kill && req.method === "POST") return destroy(kill[1], req, res);

  if (path === "/sandbox" || path === "/sandbox/") return send(res, 200, "text/html", sandbox());

  // Served straight from src so edits show up on reload — no rebuild needed.
  if (path === "/dist/sonar.js") {
    return send(res, 200, "application/javascript", readFileSync(join(here, "src", "sonar.js"), "utf8"));
  }

  if (path === "/" || path === "/index.html") {
    const page = join(here, "dist", "index.html");
    if (!existsSync(page)) return send(res, 200, "text/html", `<p style="font-family:sans-serif;padding:40px">Run <code>npm run build</code> first, or go to <a href="/sandbox">/sandbox</a>.</p>`);
    return send(res, 200, "text/html", readFileSync(page, "utf8"));
  }

  send(res, 404, "text/plain", "not found");
});

server.listen(PORT, () => {
  console.log(`\n  Landing page   http://localhost:${PORT}/`);
  console.log(`  Mock Instagram http://localhost:${PORT}/sandbox\n`);
  console.log(`  ${FOLLOWING_COUNT} following · ${followers.length} followers · ${following.filter((u) => !u.follows_viewer).length} non-followers\n`);
});
