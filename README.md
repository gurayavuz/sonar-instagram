# Sonar

**Sonar** is a single-paste browser-console tool that lists the Instagram accounts you follow who don't
follow you back — with search, filters, a keep-list, CSV/JSON export, and a deliberately slow
bulk unfollow. Everything runs in your own tab; there is no backend.

Built as a from-scratch reimplementation of the approach used by
[instagram.cobanov.dev](https://instagram.cobanov.dev/) ([source](https://github.com/cobanov/instagram)).

## Layout

| Path | What it is |
| --- | --- |
| [src/sonar.js](src/sonar.js) | The whole tool — API layer, scan/unfollow engines, and UI |
| [site/index.template.html](site/index.template.html) | Landing page; `__PAYLOAD__` is replaced at build time |
| [build.mjs](build.mjs) | Writes `dist/` and inlines the script into the page |
| [dev-server.mjs](dev-server.mjs) | Landing page + a mock Instagram to test the panel locally |
| [test/run.mjs](test/run.mjs) | jsdom integration test against a stubbed API |
| [test/live.mjs](test/live.mjs) | Same panel, driven over real HTTP against the dev server |
| [test/visual.mjs](test/visual.mjs) | Layout checks in a real browser — jsdom computes none |

```bash
npm install       # jsdom, for the tests only
npm run build     # -> dist/sonar.js, dist/sonar.compact.js, dist/index.html
npm run dev       # http://localhost:8080
npm test          # 32 checks: scan, filters, unfollow, REST fallback
npm run test:live # 19 more against the running mock server
npm run test:visual # 9 layout checks in Chromium (optional; needs playwright)
```

`dist/index.html` has the script inlined, so it also works opened directly from disk.

## Testing on localhost

You can't point the tool at the real API from localhost — it needs your Instagram session
cookies, which are bound to `instagram.com`. So `npm run dev` serves two things:

- **`/`** — the landing page.
- **`/sandbox`** — a page that pretends to be Instagram. It sets `ds_user_id` and `csrftoken`
  cookies, then loads `src/sonar.js` **unmodified**. The panel appears in the corner and
  talks to a mock API on the same server: 137 following, 139 followers, 46 non-followers, 24
  fans-only. Unfollows really do mutate the server's list — restart to reset.

The sandbox has toggles for the paths that are otherwise hard to reach:

| Toggle | What it forces |
| --- | --- |
| Disable GraphQL | 404s the fast path, so you can watch the REST fallback and followers pass |
| Return one 429 | `Retry-After` backoff and the cooldown countdown |
| Block after N unfollows | `feedback_required`, so you can confirm the queue stops instead of grinding on |

It also seeds fast timings on first visit, with buttons to switch back to the real (slow) pacing.

The only concession the tool makes for this is its host guard, which allows `localhost` and
`127.0.0.1` alongside `instagram.com` — see the top of [src/sonar.js](src/sonar.js).
Everything else runs exactly as it does in production.

## How the scan works

The interesting part is that **you never need to fetch your followers list.**

Instagram's legacy persisted GraphQL query for *following* (`query_hash=3dec7e2c…`) returns a
`follows_viewer` boolean on every node. So the non-follower set is one linear pass over the
accounts you follow — no second list, no set intersection, roughly half the requests of the
naive approach:

```
GET /graphql/query/?query_hash=3dec7e2c…&variables={"id":<ds_user_id>,"first":24,"after":<cursor>}
    -> data.user.edge_follow.edges[].node.follows_viewer
```

Authentication is just the session you already have: `credentials: "include"` plus the
`x-ig-app-id: 936619743392459` header the web app itself sends. The viewer id comes from the
`ds_user_id` cookie, and unfollows send the `csrftoken` cookie back as `x-csrftoken`.

**Fallback.** Persisted query hashes get rotated, so if GraphQL fails the tool drops to the v1
REST endpoints (`/api/v1/friendships/<id>/following/?count=50&max_id=…`). Those don't carry
`follows_viewer`, so it detects the missing flag, pages the followers list too, and derives the
same answer by set difference. The test suite verifies both paths produce identical results.

Turning on *"also load your followers"* costs that second pass voluntarily, and in exchange
unlocks the **Fans** tab (people who follow you that you don't follow back) and **Mutuals**.

## Unfollowing

`POST /api/v1/friendships/destroy/<id>/`, falling back to `/web/friendships/<id>/unfollow/`.
The response is inspected for `feedback_required`, `spam`, `checkpoint_required` and friends —
any of those, or a 401/403/429, is treated as an action block and **stops the queue immediately**
rather than hammering through it.

Defaults, all editable in the panel's settings:

| | Delay | Long pause |
| --- | --- | --- |
| Scanning | 0.8–1.8 s per page | 8 s every 5 pages |
| Unfollowing | 6–12 s each | 5 min every 5 accounts |

429s trigger exponential backoff that honours `Retry-After`. Delays are randomised rather than
fixed, and every wait is pausable mid-countdown.

## The name

You ping your following list; the accounts that send no echo back are your non-followers.
The UI leans into it — a sweeping scope during the scan, range rings, monospace tabular
readouts, and zero-padded contact numbers, in navy `#000080` on white.

## Notes on the implementation

- **The sweep is pure CSS.** A `conic-gradient` rotated by one keyframe, range rings in inline
  SVG, and blips on staggered `animation-delay`. No canvas, no rAF loop, nothing to clean up —
  and it honours `prefers-reduced-motion`.
- **Shadow DOM.** The panel mounts in a closed-off shadow root with `:host { all: initial }`, so
  Instagram's stylesheet can't reach in and the panel can't leak styles out.
- **Targeted repaints.** Full re-render only happens on view changes; progress ticks, the log,
  and the countdown patch single nodes, so the search box never loses focus mid-scan.
- **Persistence is preferences only.** localStorage holds your keep-list, filters, timings, panel
  position and language. Scan results are never written to disk — close the tab and they're gone.
- **`normalize()` treats a missing flag as `null`, not `false`,** which is what makes the fallback
  detection reliable; a user genuinely followed by nobody would otherwise look like a broken scan.

## Deploying

The site is static and the build has no dependencies, so Vercel is configured to skip
`npm install` entirely and just run `node build.mjs`:

```bash
vercel --prod        # or push to main, which redeploys automatically
```

`vercel.json` sets `outputDirectory` to `dist/`, which is gitignored — every deploy builds
the landing page fresh, so the copy button can never serve a stale script.

## Caveats

Automating Instagram is against its Terms of Use. Reading your own following list is low risk;
bulk unfollowing is what gets accounts action-blocked. Keep the default pacing, export the list
before you unfollow anything (it's your only record — the tool can't undo), and stop for a few
hours if you see a block. Use on your own account, at your own risk.

The endpoints are private and undocumented; Meta can change or kill them at any time.

MIT. Not affiliated with Instagram or Meta.
