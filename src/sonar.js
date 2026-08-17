(() => {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Constants
   * ------------------------------------------------------------------ */

  const HOST_ID = "sonar-host";
  const STORAGE_KEY = "sonar_state_v1";

  const BASE_HEADERS = {
    "x-ig-app-id": "936619743392459",
    "x-asbd-id": "129",
    "x-requested-with": "XMLHttpRequest"
  };

  // Legacy GraphQL persisted queries. They return follows_viewer per node,
  // which is what lets us find non-followers in a single pass.
  const HASH_FOLLOWING = "3dec7e2c57367ef3da3d987d89f9dbc8";
  const HASH_FOLLOWERS = "c76146de99bb02f6415203be841dd25a";

  const GQL_PAGE = 24;
  const REST_PAGE = 50;
  const MAX_RETRIES = 4;
  const DEFAULT_AVATAR = /44884218_345707102882519|464760996_1254146839119862/;

  const DEFAULT_TIMINGS = {
    scanDelayMin: 800,
    scanDelayMax: 1800,
    scanRestEvery: 5,
    scanRestMs: 8000,
    unfollowDelayMin: 6000,
    unfollowDelayMax: 12000,
    unfollowRestEvery: 5,
    unfollowRestMs: 300000
  };

  const I18N = {
    en: {
      title: "Sonar",
      subtitle: "Who's not following you back",
      readyTitle: "Ready when you are",
      readyBody:
        "This reads through the people you follow and checks who follows you back. Nothing on your account changes while it looks, and none of it leaves this tab.",
      alsoFollowers: "Also load my followers — slower, but it opens up two more lists",
      scan: "Start looking",
      rescan: "Look again",
      scanning: "Looking",
      phaseFollowing: "Going through the people you follow",
      phaseFollowers: "Now checking your followers",
      counted: "{done} of {total}",
      stepOf: "Step {n} of {total}",
      countedUnknown: "{done} so far",
      pause: "Pause",
      resume: "Keep going",
      cancel: "Stop",
      paused: "Paused — take your time",
      waitNext: "Next one in {s}s",
      waitCooldown: "Taking a breather — {s}s",
      tabNon: "Not following back",
      tabFans: "Fans",
      tabMutual: "Mutuals",
      statFollowing: "You follow",
      statFollowers: "Follow you",
      statNon: "Not back",
      search: "Search a name or username",
      fVerified: "Verified",
      fPrivate: "Private",
      fNoAvatar: "No photo",
      fHidden: "Hidden",
      sortLabel: "Sort",
      sortDefault: "As found",
      sortUser: "By username",
      sortName: "By name",
      emptyNon: "Everyone you follow follows you back. That's rare — enjoy it.",
      emptyFans: "Nobody's following you that you haven't followed back.",
      emptyMutual: "No mutuals in here.",
      emptyFilter: "Nothing matches what you're looking for.",
      needFollowers: "Tick \"also load my followers\" and look again to fill this in.",
      hide: "Hide",
      unhide: "Show",
      selectAll: "Pick all",
      clear: "Clear",
      selected: "{n} picked",
      copy: "Copy",
      copied: "Copied {n} usernames",
      export: "Save",
      exportJson: "JSON",
      exportCsv: "CSV",
      unfollow: "Unfollow",
      confirmTitle: "Unfollow {n} accounts?",
      confirmBody:
        "This goes slowly on purpose — a wait between each one and a longer break every few, so Instagram doesn't flag you. Stop whenever you want. What's already gone can't be brought back from here.",
      confirmYes: "Yes, unfollow {n}",
      unfollowing: "Unfollowing",
      doneTitle: "All done",
      doneBody: "{ok} unfollowed, {fail} didn't go through",
      blocked: "Instagram put a stop to it, so {n} accounts were left alone. Give it a few hours before trying again.",
      settings: "Settings",
      settingsBody:
        "Faster isn't better here — short waits are exactly what gets accounts blocked. The defaults are slow for a reason.",
      gScan: "While looking",
      gUnfollow: "While unfollowing",
      sScanMin: "Shortest wait (ms)",
      sScanMax: "Longest wait (ms)",
      sScanEvery: "Longer break every N pages",
      sScanMs: "How long that break lasts (ms)",
      sUnMin: "Shortest wait (ms)",
      sUnMax: "Longest wait (ms)",
      sUnEvery: "Longer break every N accounts",
      sUnMs: "How long that break lasts (ms)",
      restore: "Back to defaults",
      save: "Save",
      savedToast: "Saved",
      back: "Back",
      errTitle: "That didn't work",
      errCookie: "Couldn't tell who you are — are you signed in to Instagram?",
      errCsrf: "Couldn't read the token Instagram needs. Try reloading the page.",
      errHttp: "Instagram said no ({status})",
      errRate: "Instagram wants us to slow down. Wait a while, or raise the delays in settings.",
      errShape: "Instagram answered with something we didn't expect — it may have changed how this works.",
      retry: "Try again",
      close: "Close",
      minimize: "Minimize",
      pillScan: "Looking — {done}/{total}",
      pillUnfollow: "Unfollowing {done}/{total}",
      pillResults: "{n} not following back",
      pillIdle: "Sonar"
    },
    tr: {
      title: "Sonar",
      subtitle: "Seni geri takip etmeyenler",
      readyTitle: "Hazır olduğunda başlayalım",
      readyBody:
        "Takip ettiğin hesapları tek tek gezip kimin seni geri takip ettiğine bakıyor. Bakarken hesabında hiçbir şey değişmiyor, hiçbir bilgi de bu sekmeden dışarı çıkmıyor.",
      alsoFollowers: "Takipçilerimi de yükle — daha yavaş ama iki liste daha açılıyor",
      scan: "Bakmaya başla",
      rescan: "Yeniden bak",
      scanning: "Bakılıyor",
      phaseFollowing: "Takip ettiklerin geziliyor",
      phaseFollowers: "Şimdi de takipçilerine bakılıyor",
      counted: "{total} kişiden {done} tanesi",
      stepOf: "Adım {n}/{total}",
      countedUnknown: "Şimdilik {done} kişi",
      pause: "Duraklat",
      resume: "Devam et",
      cancel: "Dur",
      paused: "Duraklattık — acelesi yok",
      waitNext: "Sıradaki {s} sn sonra",
      waitCooldown: "Biraz soluklanıyoruz — {s} sn",
      tabNon: "Geri takip etmeyenler",
      tabFans: "Hayranlar",
      tabMutual: "Karşılıklı",
      statFollowing: "Takip ettiğin",
      statFollowers: "Seni takip eden",
      statNon: "Geri etmeyen",
      search: "İsim ya da kullanıcı adı ara",
      fVerified: "Onaylı",
      fPrivate: "Gizli",
      fNoAvatar: "Fotoğrafsız",
      fHidden: "Gizlediklerin",
      sortLabel: "Sırala",
      sortDefault: "Bulunduğu gibi",
      sortUser: "Kullanıcı adına göre",
      sortName: "İsme göre",
      emptyNon: "Takip ettiğin herkes seni geri takip ediyor. Bu pek rastlanmaz, tadını çıkar.",
      emptyFans: "Seni takip edip de senin geri takip etmediğin kimse yok.",
      emptyMutual: "Burada karşılıklı takipleşen kimse yok.",
      emptyFilter: "Aradığına uyan kimse çıkmadı.",
      needFollowers: "Burayı doldurmak için \"takipçilerimi de yükle\" seçeneğini işaretleyip yeniden bak.",
      hide: "Gizle",
      unhide: "Göster",
      selectAll: "Hepsini seç",
      clear: "Seçimi bırak",
      selected: "{n} kişi seçildi",
      copy: "Kopyala",
      copied: "{n} kullanıcı adı kopyalandı",
      export: "Kaydet",
      exportJson: "JSON",
      exportCsv: "CSV",
      unfollow: "Takibi bırak",
      confirmTitle: "{n} hesabın takibi bırakılsın mı?",
      confirmBody:
        "Bu iş bilerek ağırdan alıyor — her hesabın arasında bekliyor, birkaç hesapta bir de uzun mola veriyor ki Instagram seni işaretlemesin. İstediğin an durdurabilirsin ama bırakılan takipleri buradan geri alamayız.",
      confirmYes: "Evet, {n} hesabı bırak",
      unfollowing: "Takipten çıkılıyor",
      doneTitle: "Bitti",
      doneBody: "{ok} tanesi oldu, {fail} tanesi olmadı",
      blocked: "Instagram araya girdi, kalan {n} hesaba hiç dokunmadık. Tekrar denemeden önce birkaç saat bekle.",
      settings: "Ayarlar",
      settingsBody:
        "Burada hızlı olmanın faydası yok — hesapların engellenmesinin sebebi zaten kısa beklemeler. Varsayılanlar boşuna yavaş değil.",
      gScan: "Bakarken",
      gUnfollow: "Takipten çıkarken",
      sScanMin: "En kısa bekleme (ms)",
      sScanMax: "En uzun bekleme (ms)",
      sScanEvery: "Her N sayfada uzun mola",
      sScanMs: "O mola ne kadar sürsün (ms)",
      sUnMin: "En kısa bekleme (ms)",
      sUnMax: "En uzun bekleme (ms)",
      sUnEvery: "Her N hesapta uzun mola",
      sUnMs: "O mola ne kadar sürsün (ms)",
      restore: "Varsayılanlara dön",
      save: "Kaydet",
      savedToast: "Kaydedildi",
      back: "Geri",
      errTitle: "Bu olmadı",
      errCookie: "Kim olduğunu anlayamadık — Instagram'a giriş yaptın mı?",
      errCsrf: "Instagram'ın istediği güvenlik anahtarı okunamadı. Sayfayı bir yenile.",
      errHttp: "Instagram kabul etmedi ({status})",
      errRate: "Instagram biraz yavaşlamamızı istiyor. Bir süre bekle ya da ayarlardan süreleri artır.",
      errShape: "Instagram beklemediğimiz bir cevap verdi — işleyişi değişmiş olabilir.",
      retry: "Tekrar dene",
      close: "Kapat",
      minimize: "Küçült",
      pillScan: "Bakılıyor — {done}/{total}",
      pillUnfollow: "Bırakılıyor {done}/{total}",
      pillResults: "{n} kişi geri takip etmiyor",
      pillIdle: "Sonar"
    }
  };

  /* ------------------------------------------------------------------ *
   * Guards
   * ------------------------------------------------------------------ */

  // localhost is allowed so the mock server in dev-server.mjs can drive the
  // real panel against a fake API. Everywhere else, insist on Instagram.
  const isDev = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);
  if (!isDev && !/(^|\.)instagram\.com$/i.test(location.hostname)) {
    alert("Open https://www.instagram.com, sign in, then run this script there.");
    return;
  }

  const existing = document.getElementById(HOST_ID);
  if (existing) existing.remove();

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */

  const saved = loadSaved();

  const state = {
    view: "idle", // idle | scanning | results | unfollowing | done | settings | error
    tab: "non", // non | fans | mutual
    scanFollowers: Boolean(saved.scanFollowers),
    hasFollowers: false,

    following: [],
    followers: [],
    followerIds: null,
    followingIds: null,

    progress: { done: 0, total: 0, phase: "phaseFollowing" },
    paused: false,
    cancelled: false,
    waitUntil: 0,
    waitKey: "",

    selected: new Set(),
    hidden: new Set(saved.hidden || []),
    search: "",
    filters: { verified: true, private: true, noAvatar: true, showHidden: false, ...(saved.filters || {}) },
    sort: saved.sort || "default",

    timings: { ...DEFAULT_TIMINGS, ...(saved.timings || {}) },
    log: [],
    blockedRemaining: 0,
    error: "",

    minimized: Boolean(saved.minimized),
    pos: saved.pos || null,
    lang: saved.lang === "tr" || saved.lang === "en" ? saved.lang : /^tr/i.test(navigator.language || "") ? "tr" : "en"
  };

  let tickTimer = null;
  let toastTimer = null;
  let closeDialog = null;

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          hidden: [...state.hidden],
          filters: state.filters,
          sort: state.sort,
          timings: state.timings,
          minimized: state.minimized,
          pos: state.pos,
          lang: state.lang,
          scanFollowers: state.scanFollowers
        })
      );
    } catch {
      /* storage can be disabled — not fatal */
    }
  }

  function t(key, vars) {
    const raw = I18N[state.lang][key] ?? I18N.en[key] ?? key;
    return vars ? raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : raw;
  }

  /* ------------------------------------------------------------------ *
   * Utilities
   * ------------------------------------------------------------------ */

  const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
  const jitter = (a, b) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  };

  function esc(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }

  function cookie(name) {
    const m = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[2]) : null;
  }

  async function waitWhile(predicate, step = 150) {
    while (predicate()) await sleep(step);
  }

  // Below this, a countdown would only ever read "1s" and vanish — announcing
  // a wait the user never sees happen. Short waits pass silently instead.
  const ANNOUNCE_WAIT_ABOVE = 1500;

  // Sleep that respects pause/cancel and drives the countdown label.
  async function waitWithCountdown(ms, key) {
    const announce = ms >= ANNOUNCE_WAIT_ABOVE;
    let left = Math.max(0, ms);

    if (announce) {
      state.waitKey = key;
      state.waitUntil = Date.now() + left;
      paintCountdown();
    }

    while (left > 0) {
      if (state.cancelled) break;
      if (state.paused) {
        await waitWhile(() => state.paused && !state.cancelled);
        if (announce) state.waitUntil = Date.now() + left;
        continue;
      }
      const before = Date.now();
      await sleep(Math.min(250, left));
      left -= Date.now() - before;
      if (announce) paintCountdown();
    }

    if (announce) {
      state.waitUntil = 0;
      state.waitKey = "";
      paintCountdown();
    }
  }

  function normalize(raw) {
    const hasFlag = "follows_viewer" in raw || raw.friendship_status?.followed_by !== undefined;
    return {
      id: String(raw.id ?? raw.pk ?? raw.pk_id ?? ""),
      username: String(raw.username || ""),
      fullName: String(raw.full_name || ""),
      avatar: String(raw.profile_pic_url || raw.profile_pic_url_hd || ""),
      verified: Boolean(raw.is_verified),
      private: Boolean(raw.is_private),
      followsViewer: hasFlag ? Boolean(raw.follows_viewer ?? raw.friendship_status?.followed_by) : null
    };
  }

  function dedupe(list) {
    const seen = new Set();
    return list.filter((u) => u.id && u.username && !seen.has(u.id) && seen.add(u.id));
  }

  const noAvatar = (u) => !u.avatar || DEFAULT_AVATAR.test(u.avatar);

  /* ------------------------------------------------------------------ *
   * Instagram API
   * ------------------------------------------------------------------ */

  async function igFetch(url, init = {}) {
    let attempt = 0;
    while (true) {
      const res = await fetch(url, {
        credentials: "include",
        headers: { ...BASE_HEADERS, ...(init.headers || {}) },
        ...init
      });
      if (res.ok) return res.json();

      const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
      if (!retryable || attempt >= MAX_RETRIES) {
        throw new Error(res.status === 429 ? t("errRate") : t("errHttp", { status: res.status }));
      }
      const header = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(header) && header > 0 ? header * 1000 : Math.min(60000, 4000 * 2 ** attempt);
      await waitWithCountdown(wait, "waitCooldown");
      attempt += 1;
    }
  }

  // Primary path: persisted GraphQL query. Nodes carry follows_viewer.
  async function pageGraphQL(viewerId, hash, edgeKey, onPage) {
    const out = [];
    let cursor = "";
    let page = 0;
    let total = 0;

    while (true) {
      await waitWhile(() => state.paused && !state.cancelled);
      if (state.cancelled) return { users: out, total };

      const vars = { id: viewerId, include_reel: false, fetch_mutual: false, first: GQL_PAGE };
      if (cursor) vars.after = cursor;

      const json = await igFetch(
        `/graphql/query/?query_hash=${hash}&variables=${encodeURIComponent(JSON.stringify(vars))}`
      );
      const edge = json?.data?.user?.[edgeKey];
      if (!edge || !Array.isArray(edge.edges)) throw new Error(t("errShape"));

      out.push(...edge.edges.map((e) => normalize(e.node)));
      if (!total && typeof edge.count === "number") total = edge.count;
      onPage(out.length, total);

      cursor = edge.page_info?.end_cursor || "";
      page += 1;
      if (!edge.page_info?.has_next_page || !cursor) break;

      await waitWithCountdown(jitter(state.timings.scanDelayMin, state.timings.scanDelayMax), "waitNext");
      if (state.timings.scanRestEvery > 0 && page % state.timings.scanRestEvery === 0) {
        await waitWithCountdown(state.timings.scanRestMs, "waitCooldown");
      }
    }
    return { users: dedupe(out), total };
  }

  // Fallback path: the v1 REST endpoints. These do NOT return follows_viewer,
  // so using them forces a followers pass and a set difference.
  async function pageRest(viewerId, kind, onPage) {
    const out = [];
    let maxId = "";
    let page = 0;

    while (true) {
      await waitWhile(() => state.paused && !state.cancelled);
      if (state.cancelled) return { users: out, total: 0 };

      const qs = `count=${REST_PAGE}${maxId ? `&max_id=${encodeURIComponent(maxId)}` : ""}`;
      const json = await igFetch(`/api/v1/friendships/${viewerId}/${kind}/?${qs}`);
      if (!Array.isArray(json?.users)) throw new Error(t("errShape"));

      out.push(...json.users.map(normalize));
      onPage(out.length, 0);

      maxId = json.next_max_id ? String(json.next_max_id) : "";
      page += 1;
      if (!maxId) break;

      await waitWithCountdown(jitter(state.timings.scanDelayMin, state.timings.scanDelayMax), "waitNext");
      if (state.timings.scanRestEvery > 0 && page % state.timings.scanRestEvery === 0) {
        await waitWithCountdown(state.timings.scanRestMs, "waitCooldown");
      }
    }
    return { users: dedupe(out), total: out.length };
  }

  async function loadList(viewerId, kind, onPage) {
    const hash = kind === "following" ? HASH_FOLLOWING : HASH_FOLLOWERS;
    const edgeKey = kind === "following" ? "edge_follow" : "edge_followed_by";
    try {
      const result = await pageGraphQL(viewerId, hash, edgeKey, onPage);
      if (result.users.length || result.total === 0) return result;
      throw new Error(t("errShape"));
    } catch (err) {
      if (state.cancelled) throw err;
      console.warn("[sonar] GraphQL path failed for", kind, "— falling back to REST:", err);
      return pageRest(viewerId, kind, onPage);
    }
  }

  async function unfollowOne(id, csrf) {
    const headers = { ...BASE_HEADERS, "content-type": "application/x-www-form-urlencoded", "x-csrftoken": csrf };
    const endpoints = [`/api/v1/friendships/destroy/${id}/`, `/web/friendships/${id}/unfollow/`];

    let result = { ok: false, blocked: false, reason: "" };
    for (let i = 0; i < endpoints.length; i += 1) {
      if (i > 0) await sleep(jitter(1200, 2500));
      let res;
      try {
        res = await fetch(endpoints[i], { method: "POST", credentials: "include", headers });
      } catch (err) {
        result = { ok: false, blocked: false, reason: err?.message || "network error" };
        continue;
      }
      const body = await res.text().catch(() => "");
      result = readUnfollowResult(res.status, body);
      if (result.ok || result.blocked) return result;
    }
    return result;
  }

  function readUnfollowResult(status, body) {
    let payload = null;
    try {
      payload = JSON.parse(body);
    } catch {
      /* HTML error pages land here */
    }
    const message = String(payload?.message || "");
    const blocked =
      payload?.feedback_required === true ||
      payload?.spam === true ||
      payload?.require_login === true ||
      /feedback_required|checkpoint_required|challenge_required|login_required/i.test(message);

    if (status === 401 || status === 403 || status === 429 || blocked) {
      return { ok: false, blocked: true, reason: message || `HTTP ${status}` };
    }
    if (status < 200 || status >= 300) return { ok: false, blocked: false, reason: message || `HTTP ${status}` };
    if (!payload) return { ok: false, blocked: false, reason: "unexpected response" };
    if (payload.status === "ok" || payload.friendship_status !== undefined) return { ok: true, blocked: false, reason: "" };
    return { ok: false, blocked: false, reason: message || String(payload.status || "rejected") };
  }

  /* ------------------------------------------------------------------ *
   * Scan
   * ------------------------------------------------------------------ */

  async function startScan() {
    state.view = "scanning";
    state.paused = false;
    state.cancelled = false;
    state.error = "";
    state.following = [];
    state.followers = [];
    state.followerIds = null;
    state.followingIds = null;
    state.hasFollowers = false;
    state.selected.clear();
    state.log = [];
    // Two passes means the count legitimately restarts partway through. Say so,
    // otherwise it just looks like the number is jumping backwards.
    state.progress = { done: 0, total: 0, phase: "phaseFollowing", step: 1, steps: state.scanFollowers ? 2 : 1 };
    render();

    try {
      const viewerId = cookie("ds_user_id");
      if (!viewerId) throw new Error(t("errCookie"));

      const onPage = (done, total) => {
        state.progress.done = done;
        state.progress.total = total;
        paintProgress();
      };

      const following = await loadList(viewerId, "following", onPage);
      if (state.cancelled) return toIdle();
      state.following = following.users;

      // If any node lacked the follow-back flag (REST fallback), we must diff
      // against the followers list to know who follows back.
      const flagMissing = state.following.some((u) => u.followsViewer === null);
      if (state.scanFollowers || flagMissing) {
        state.progress = { done: 0, total: 0, phase: "phaseFollowers", step: 2, steps: 2 };
        paintProgress();
        const followers = await loadList(viewerId, "followers", onPage);
        if (state.cancelled) return toIdle();
        state.followers = followers.users;
        state.followerIds = new Set(state.followers.map((u) => u.id));
        state.hasFollowers = true;
      }

      state.followingIds = new Set(state.following.map((u) => u.id));
      state.view = "results";
      state.tab = "non";
      render();
      toast(t("pillResults", { n: bucket("non").length }));
    } catch (err) {
      if (state.cancelled) return toIdle();
      console.error("[sonar] scan failed:", err);
      state.error = err?.message || String(err);
      state.view = "error";
      render();
    }
  }

  function toIdle() {
    state.view = "idle";
    state.cancelled = false;
    state.paused = false;
    state.waitUntil = 0;
    render();
  }

  function followsBack(user) {
    if (state.followerIds) return state.followerIds.has(user.id);
    return user.followsViewer === true;
  }

  function bucket(tab) {
    if (tab === "non") return state.following.filter((u) => !followsBack(u));
    if (tab === "mutual") return state.following.filter((u) => followsBack(u));
    if (tab === "fans") return state.followers.filter((u) => !state.followingIds?.has(u.id));
    return [];
  }

  function visibleUsers() {
    const query = state.search.trim().toLowerCase();
    let list = bucket(state.tab).filter((u) => {
      if (!state.filters.showHidden && state.hidden.has(u.id)) return false;
      if (!state.filters.verified && u.verified) return false;
      if (!state.filters.private && u.private) return false;
      if (!state.filters.noAvatar && noAvatar(u)) return false;
      if (query && !u.username.toLowerCase().includes(query) && !u.fullName.toLowerCase().includes(query)) return false;
      return true;
    });
    if (state.sort === "user") list = [...list].sort((a, b) => a.username.localeCompare(b.username));
    if (state.sort === "name") list = [...list].sort((a, b) => (a.fullName || a.username).localeCompare(b.fullName || b.username));
    return list;
  }

  /* ------------------------------------------------------------------ *
   * Unfollow
   * ------------------------------------------------------------------ */

  async function startUnfollow() {
    const targets = bucket("non").filter((u) => state.selected.has(u.id));
    if (!targets.length) return;

    const csrf = cookie("csrftoken");
    if (!csrf) return toast(t("errCsrf"));

    state.view = "unfollowing";
    state.paused = false;
    state.cancelled = false;
    state.blockedRemaining = 0;
    state.log = [];
    state.progress = { done: 0, total: targets.length, phase: "unfollowing" };
    render();

    const removed = new Set();

    for (let i = 0; i < targets.length; i += 1) {
      await waitWhile(() => state.paused && !state.cancelled);
      if (state.cancelled) break;

      const user = targets[i];
      let result;
      try {
        result = await unfollowOne(user.id, csrf);
      } catch (err) {
        result = { ok: false, blocked: false, reason: err?.message || "error" };
      }

      state.log.unshift({ user, ok: result.ok, reason: result.reason });
      if (result.ok) {
        removed.add(user.id);
        state.selected.delete(user.id);
      }
      state.progress.done = i + 1;
      paintProgress();
      paintLog();

      if (result.blocked) {
        state.blockedRemaining = targets.length - (i + 1);
        console.warn("[sonar] action blocked:", result.reason);
        break;
      }

      if (i < targets.length - 1) {
        await waitWithCountdown(jitter(state.timings.unfollowDelayMin, state.timings.unfollowDelayMax), "waitNext");
        if (state.timings.unfollowRestEvery > 0 && (i + 1) % state.timings.unfollowRestEvery === 0) {
          await waitWithCountdown(state.timings.unfollowRestMs, "waitCooldown");
        }
      }
    }

    state.following = state.following.filter((u) => !removed.has(u.id));
    state.followingIds = new Set(state.following.map((u) => u.id));
    state.view = "done";
    state.waitUntil = 0;
    render();
  }

  /* ------------------------------------------------------------------ *
   * Export helpers
   * ------------------------------------------------------------------ */

  async function copyUsernames() {
    const list = selectionOrAll();
    if (!list.length) return;
    const text = list.map((u) => u.username).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast(t("copied", { n: list.length }));
  }

  function selectionOrAll() {
    const list = visibleUsers();
    return state.selected.size ? list.filter((u) => state.selected.has(u.id)) : list;
  }

  function download(name, mime, content) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function exportAs(format) {
    const list = selectionOrAll();
    if (!list.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      download(`instagram-${state.tab}-${stamp}.json`, "application/json", JSON.stringify(list, null, 2));
      return;
    }
    const rows = [
      ["username", "full_name", "verified", "private", "profile_url"],
      ...list.map((u) => [u.username, u.fullName, u.verified, u.private, `https://www.instagram.com/${u.username}/`])
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    download(`instagram-${state.tab}-${stamp}.csv`, "text/csv", csv);
  }

  /* ------------------------------------------------------------------ *
   * Shell — shadow DOM so Instagram's stylesheet can't reach us
   * ------------------------------------------------------------------ */

  const host = document.createElement("div");
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${CSS()}</style><div class="wrap"><div class="pill" hidden></div><section class="panel"></section></div>`;
  document.documentElement.appendChild(host);

  const wrap = root.querySelector(".wrap");
  const panel = root.querySelector(".panel");
  const pill = root.querySelector(".pill");

  applyPosition();

  function applyPosition() {
    if (state.pos) {
      wrap.style.left = `${state.pos.x}px`;
      wrap.style.top = `${state.pos.y}px`;
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";
    }
  }

  function CSS() {
    return `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }

.wrap { position: fixed; right: 18px; bottom: 18px; z-index: 2147483647; width: 384px; max-width: calc(100vw - 24px); }
.panel { position: relative; display: flex; flex-direction: column; max-height: min(720px, calc(100vh - 40px));
  background: #ffffff; color: #0b0b1f; border: 1px solid #000080; border-radius: 4px; overflow: hidden;
  box-shadow: 0 0 0 1px rgba(0, 0, 128, .06), 0 20px 50px rgba(0, 0, 64, .3); font-size: 13px; line-height: 1.45; }
.panel[hidden], .pill[hidden] { display: none; }

.mono { font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }

/* ---- minimised pill ---- */
.pill { display: inline-flex; align-items: center; gap: 9px; float: right; cursor: pointer;
  background: #000080; color: #ffffff; border: 1px solid #000080; border-radius: 4px;
  padding: 10px 15px; font-size: 12px; font-weight: 600;
  box-shadow: 0 12px 30px rgba(0, 0, 64, .32); }
.pill .dot { width: 7px; height: 7px; border-radius: 50%; background: #ffffff; flex: none;
  animation: blink 1.6s ease-in-out infinite; }
@keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: .25 } }

/* ---- header: navy bar with scanline texture ---- */
header { position: relative; flex: none; display: flex; align-items: center; gap: 10px; padding: 11px 13px;
  background: #000080; color: #ffffff; cursor: grab; user-select: none; overflow: hidden; }
header::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(255, 255, 255, .05) 0 1px, transparent 1px 3px); }
header.drag { cursor: grabbing; }
.mark { position: relative; width: 14px; height: 14px; flex: none; }
.mark::before, .mark::after { content: ""; position: absolute; border: 1px solid #ffffff;
  border-radius: 50%; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.mark::before { width: 14px; height: 14px; opacity: .45; }
.mark::after { width: 6px; height: 6px; background: #ffffff; }
.htext { flex: 1; min-width: 0; }
.htext b { display: block; font-size: 12px; font-weight: 700; letter-spacing: .17em; text-transform: uppercase;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.htext span { display: block; font-size: 11px; color: rgba(255, 255, 255, .64);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.icon { position: relative; z-index: 1; display: grid; place-items: center; width: 24px; height: 24px;
  border: 0; border-radius: 2px; background: transparent; color: rgba(255, 255, 255, .8);
  cursor: pointer; font-size: 11px; font-weight: 600; }
.icon:hover { background: rgba(255, 255, 255, .18); color: #ffffff; }

.body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; background: #ffffff; }
.pad { padding: 16px 14px; }
.center { text-align: center; padding: 26px 20px 30px; }
.center h3 { font-size: 15.5px; font-weight: 600; color: #000080; margin-bottom: 7px; letter-spacing: -.015em; }
.center p { color: #5a5f80; font-size: 12.5px; line-height: 1.55; }

/* ---- the scope: range rings + rotating sweep + blips ---- */
.scope { position: relative; width: 156px; height: 156px; margin: 4px auto 18px; }
.scope svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.scope svg circle { fill: none; stroke: #dfe3f4; stroke-width: 1; }
.scope svg line { stroke: #e6e8f5; stroke-width: 1; }
.scope .sweep { position: absolute; inset: 0; border-radius: 50%; overflow: hidden;
  background: conic-gradient(from 0deg, rgba(0, 0, 128, .3), rgba(0, 0, 128, .07) 40deg, transparent 85deg);
  animation: spin 2.6s linear infinite; }
.scope .sweep::after { content: ""; position: absolute; left: 50%; top: 0; width: 1px; height: 50%;
  background: linear-gradient(#000080, rgba(0, 0, 128, 0)); }
@keyframes spin { to { transform: rotate(360deg) } }
.scope .blip { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: #000080;
  margin: -2.5px 0 0 -2.5px; opacity: 0; animation: blip 2.6s linear infinite; }
@keyframes blip { 0% { opacity: 0 } 4% { opacity: 1; transform: scale(1.5) } 12% { transform: scale(1) }
  70% { opacity: .2 } 100% { opacity: 0 } }
.scope.still .sweep, .scope.still .blip { animation-play-state: paused; }
.scope .core { position: absolute; left: 50%; top: 50%; width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px;
  border-radius: 50%; background: #000080; }

/* idle: same scope, no motion */
.scope.idle .sweep { animation: none; background: conic-gradient(from 0deg, rgba(0, 0, 128, .12), transparent 85deg); }
.scope.idle .blip { animation: none; opacity: .3; }

/* ---- buttons ---- */
button.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: 1px solid #000080; background: #ffffff; color: #000080; border-radius: 3px;
  padding: 9px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
button.btn:hover { background: #eef0fa; }
button.btn.primary { background: #000080; border-color: #000080; color: #ffffff; }
button.btn.primary:hover { background: #0000a8; }
button.btn.danger { background: #0b0b1f; border-color: #0b0b1f; color: #ffffff; }
button.btn.danger:hover { background: #1b1b3a; }
button.btn:disabled { opacity: .4; cursor: not-allowed; }
button.btn.wide { width: 100%; }

label.check { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; color: #5a5f80;
  cursor: pointer; text-align: left; }
label.check input { margin-top: 2px; accent-color: #000080; }

/* ---- stats readout ---- */
.stats { display: grid; grid-template-columns: repeat(3, 1fr); background: #ffffff; border-bottom: 1px solid #c9cde6; }
.stat { padding: 9px 8px 10px; text-align: center; border-right: 1px solid #e6e8f5; }
.stat:last-child { border-right: 0; }
.stat b { display: block; font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 600; color: #000080; letter-spacing: -.02em; }
.stat span { font-size: 8.5px; color: #5a5f80; text-transform: uppercase; letter-spacing: .12em; font-weight: 600; }

/* ---- segmented tabs ---- */
.tabs { display: flex; gap: 3px; margin: 11px 12px 0; padding: 3px; background: #eef0fa;
  border: 1px solid #dfe3f4; border-radius: 4px; }
.tab { flex: 1; border: 0; background: transparent; color: #5a5f80; border-radius: 3px;
  padding: 7px 4px; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.tab:hover:not(.on):not(:disabled) { color: #000080; }
.tab.on { background: #000080; color: #ffffff; }
.tab:disabled { opacity: .4; cursor: not-allowed; }

.tools { display: flex; flex-direction: column; gap: 8px; padding: 11px 12px; border-bottom: 1px solid #c9cde6; }
input.text, select.text { width: 100%; background: #ffffff; border: 1px solid #c9cde6; border-radius: 3px;
  color: #0b0b1f; padding: 8px 10px; font-size: 12px; }
input.text::placeholder { color: #7a80a0; }
input.text:focus, select.text:focus { outline: none; border-color: #000080; box-shadow: 0 0 0 2px rgba(0, 0, 128, .12); }
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
.chip { display: inline-flex; align-items: center; border: 1px solid #c9cde6; background: #ffffff;
  color: #5a5f80; border-radius: 3px; padding: 4px 10px; font-size: 11px; font-weight: 500; cursor: pointer; }
.chip:hover { border-color: #000080; color: #000080; }
.chip.on { background: #000080; border-color: #000080; color: #ffffff; }

/* ---- contact rows ---- */
.rows { padding: 0; }
.row { display: flex; align-items: center; gap: 9px; padding: 8px 12px; border-bottom: 1px solid #eef0fa; }
.row:last-child { border-bottom: 0; }
.row:hover { background: #f7f8fd; }
.row input[type=checkbox] { accent-color: #000080; flex: none; }
.idx { font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums; font-size: 9.5px; color: #9aa0bd; flex: none; width: 20px; text-align: right; }
.av { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%;
  background: #eef0fa; box-shadow: inset 0 0 0 1px #dfe3f4; color: #000080;
  font-size: 12px; font-weight: 600; flex: none; user-select: none; }
.meta { flex: 1; min-width: 0; }
.meta a { display: block; color: #000080; font-size: 12.5px; font-weight: 600; text-decoration: none;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta a:hover { text-decoration: underline; }
.meta small { display: block; color: #5a5f80; font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tags { display: flex; gap: 4px; flex: none; }
.tag { font-size: 8px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
  padding: 3px 5px; border-radius: 2px; background: #eef0fa; color: #000080; }
.tag.v { background: #000080; color: #ffffff; }
.row .icon { flex: none; color: #9aa0bd; }
.row .icon:hover { background: #eef0fa; color: #000080; }
.row.hidden { opacity: .42; }

/* ---- progress / readouts ---- */
.progress { padding: 20px 18px 22px; text-align: center; }
.readout { display: flex; align-items: baseline; justify-content: center; gap: 7px;
  font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace; font-variant-numeric: tabular-nums; }
.readout .big { font-size: 30px; font-weight: 600; color: #000080; letter-spacing: -.03em; line-height: 1; }
.readout .of { font-size: 15px; color: #9aa0bd; }
.readout .tot { font-size: 15px; color: #5a5f80; }
.pctline { display: flex; align-items: center; gap: 9px; margin: 14px 0 9px; }
.bar { position: relative; flex: 1; height: 6px; background: #eef0fa; border: 1px solid #dfe3f4; overflow: hidden; }
.bar i { display: block; height: 100%; background: #000080; transition: width .25s ease; }
.bar::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(90deg, transparent 0 11px, rgba(255, 255, 255, .85) 11px 12px); }
.pct { font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums; font-size: 10.5px; font-weight: 600; color: #000080; width: 34px; text-align: right; }
.pnote { font-size: 11.5px; color: #5a5f80; min-height: 16px; }

.log { margin-top: 15px; text-align: left; max-height: 190px; overflow-y: auto; border-top: 1px solid #c9cde6; }
.logrow { display: flex; gap: 8px; align-items: center; padding: 5px 2px; font-size: 11px;
  border-bottom: 1px solid #eef0fa;
  font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace; }
.logrow b { flex: 1; font-weight: 400; color: #0b0b1f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ok { color: #000080; font-weight: 700; }
.bad { color: #8b90ad; font-weight: 600; }

footer { flex: none; display: flex; align-items: center; gap: 8px; padding: 9px 12px;
  border-top: 1px solid #c9cde6; background: #f7f8fd; }
footer .grow { flex: 1; font-size: 11.5px; color: #5a5f80; }
.linkish { background: none; border: 0; color: #000080; font-size: 11.5px; font-weight: 600;
  cursor: pointer; padding: 2px 4px; text-decoration: underline; }
.linkish:hover { color: #0000a8; }

.field { display: flex; align-items: center; gap: 10px; padding: 5px 0; }
.field label { flex: 1; font-size: 11.5px; color: #5a5f80; }
.field input { width: 100px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums; font-size: 11.5px; }
.gh { font-size: 9px; text-transform: uppercase; letter-spacing: .14em; color: #000080;
  font-weight: 700; margin: 16px 0 6px; padding-bottom: 5px; border-bottom: 1px solid #e6e8f5; }

.mask { position: absolute; inset: 0; background: rgba(0, 0, 32, .55); display: grid; place-items: center; padding: 22px; }
.dialog { background: #ffffff; border: 1px solid #000080; border-top: 3px solid #000080;
  border-radius: 3px; padding: 17px; max-width: 320px; box-shadow: 0 14px 34px rgba(0, 0, 64, .34); }
.dialog h4 { font-size: 14.5px; font-weight: 600; margin-bottom: 9px; color: #000080; letter-spacing: -.01em; }
.dialog p { font-size: 12px; color: #5a5f80; margin-bottom: 15px; }
.dialog .btns { display: flex; gap: 8px; justify-content: flex-end; }

.toast { position: absolute; left: 12px; right: 12px; bottom: 58px; background: #000080;
  border-radius: 3px; padding: 10px 12px; font-size: 12px; font-weight: 500; color: #ffffff; text-align: center; }
.err { color: #0b0b1f; font-size: 12px; border-left: 3px solid #000080; padding-left: 10px; text-align: left; }
.stamp { display: inline-block; margin-top: 12px; padding: 4px 11px; border: 1px solid #000080;
  border-radius: 2px; font-size: 9.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
  color: #000080; }
`;
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  function render() {
    if (state.minimized) {
      panel.hidden = true;
      pill.hidden = false;
      pill.innerHTML = `<span class="dot"></span><span>${esc(pillLabel())}</span>`;
      return;
    }
    pill.hidden = true;
    panel.hidden = false;
    panel.innerHTML = header() + `<div class="body">${bodyHTML()}</div>` + footerHTML();
    bind();
    startTick();
  }

  function pillLabel() {
    if (state.view === "scanning") return t("pillScan", { done: state.progress.done, total: state.progress.total || "?" });
    if (state.view === "unfollowing") return t("pillUnfollow", { done: state.progress.done, total: state.progress.total });
    if (state.view === "results") return t("pillResults", { n: bucket("non").length });
    return t("pillIdle");
  }

  function header() {
    return `<header data-drag>
      <span class="mark"></span>
      <div class="htext"><b>${esc(t("title"))}</b><span>${esc(t("subtitle"))}</span></div>
      <button class="icon" data-act="lang" title="Language">${state.lang === "tr" ? "EN" : "TR"}</button>
      <button class="icon" data-act="settings" title="${esc(t("settings"))}">⚙</button>
      <button class="icon" data-act="min" title="${esc(t("minimize"))}">–</button>
      <button class="icon" data-act="close" title="${esc(t("close"))}">✕</button>
    </header>`;
  }

  function bodyHTML() {
    switch (state.view) {
      case "idle":
        return idleHTML();
      case "scanning":
      case "unfollowing":
        return progressHTML();
      case "results":
        return resultsHTML();
      case "done":
        return doneHTML();
      case "settings":
        return settingsHTML();
      case "error":
        return errorHTML();
      default:
        return "";
    }
  }

  // Range rings, crosshairs and a handful of contacts. Reused for the idle
  // state (frozen) and the live sweep (rotating).
  function scopeHTML(mode) {
    const blips = [
      [0.62, 0.3, 0.1],
      [0.34, 0.71, 0.7],
      [0.75, 0.62, 1.3],
      [0.28, 0.36, 1.9],
      [0.55, 0.84, 2.2]
    ]
      .map(([x, y, delay]) => `<span class="blip" style="left:${x * 100}%;top:${y * 100}%;animation-delay:${delay}s"></span>`)
      .join("");

    return `<div class="scope ${mode}">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="49"/><circle cx="50" cy="50" r="34"/><circle cx="50" cy="50" r="19"/>
        <line x1="50" y1="1" x2="50" y2="99"/><line x1="1" y1="50" x2="99" y2="50"/>
      </svg>
      <div class="sweep"></div>
      ${blips}
      <span class="core"></span>
    </div>`;
  }

  function idleHTML() {
    return `<div class="center">
      ${scopeHTML("idle")}
      <h3>${esc(t("readyTitle"))}</h3>
      <p>${esc(t("readyBody"))}</p>
      <div class="pad" style="padding:16px 0 14px">
        <label class="check"><input type="checkbox" data-act="togglefollowers" ${state.scanFollowers ? "checked" : ""}>
        <span>${esc(t("alsoFollowers"))}</span></label>
      </div>
      <button class="btn primary wide" data-act="scan">${esc(t("scan"))}</button>
    </div>`;
  }

  // Zero-padded so the digits don't jitter as the count climbs.
  function readoutHTML(done, total) {
    const width = Math.max(3, String(total || done).length);
    const pad = (n) => String(n).padStart(width, "0");
    return total
      ? `<span class="big">${pad(done)}</span><span class="of">/</span><span class="tot">${pad(total)}</span>`
      : `<span class="big">${pad(done)}</span><span class="of">·</span><span class="tot">${esc(t("scanning"))}</span>`;
  }

  // "Step 2 of 2 · Now checking your followers" — without this the count
  // restarting at zero looks like a glitch rather than a second pass.
  function phaseText() {
    if (state.paused) return t("paused");
    const { phase, step, steps } = state.progress;
    const label = t(phase);
    return steps > 1 ? `${t("stepOf", { n: step, total: steps })} · ${label}` : label;
  }

  function progressHTML() {
    const { done, total, phase } = state.progress;
    const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    const scanning = state.view === "scanning";
    const logHTML = scanning ? "" : `<div class="log" data-log>${logRows()}</div>`;

    return `<div class="progress">
      ${scanning ? scopeHTML(state.paused ? "still" : "live") : ""}
      <div class="readout" data-counter>${readoutHTML(done, total)}</div>
      <div class="pctline">
        <div class="bar"><i data-bar style="width:${pct}%"></i></div>
        <span class="pct" data-pct>${pct}%</span>
      </div>
      <div class="pnote" data-phase>${esc(phaseText())}</div>
      <div class="pnote" data-countdown></div>
      ${logHTML}
    </div>`;
  }

  function logRows() {
    const total = state.log.length;
    return state.log
      .slice(0, 60)
      .map((entry, i) => {
        const n = String(total - i).padStart(2, "0");
        return `<div class="logrow"><span class="idx">${n}</span><b>@${esc(entry.user.username)}</b><span class="${
          entry.ok ? "ok" : "bad"
        }">${entry.ok ? "✓" : esc(entry.reason || "✕")}</span></div>`;
      })
      .join("");
  }

  function resultsHTML() {
    const nonCount = bucket("non").length;
    const tabs = `<div class="tabs">
      <button class="tab ${state.tab === "non" ? "on" : ""}" data-tab="non">${esc(t("tabNon"))}</button>
      <button class="tab ${state.tab === "fans" ? "on" : ""}" data-tab="fans" ${state.hasFollowers ? "" : "disabled"}>${esc(t("tabFans"))}</button>
      <button class="tab ${state.tab === "mutual" ? "on" : ""}" data-tab="mutual">${esc(t("tabMutual"))}</button>
    </div>`;

    const stats = `<div class="stats">
      <div class="stat"><b>${state.following.length}</b><span>${esc(t("statFollowing"))}</span></div>
      <div class="stat"><b>${state.hasFollowers ? state.followers.length : "—"}</b><span>${esc(t("statFollowers"))}</span></div>
      <div class="stat"><b>${nonCount}</b><span>${esc(t("statNon"))}</span></div>
    </div>`;

    const chip = (key, label) =>
      `<button class="chip ${state.filters[key] ? "on" : ""}" data-filter="${key}">${esc(label)}</button>`;

    const tools = `<div class="tools">
      <input class="text" data-search placeholder="${esc(t("search"))}" value="${esc(state.search)}">
      <div class="chips">
        ${chip("verified", t("fVerified"))}
        ${chip("private", t("fPrivate"))}
        ${chip("noAvatar", t("fNoAvatar"))}
        ${chip("showHidden", t("fHidden"))}
      </div>
      <select class="text" data-sort>
        <option value="default" ${state.sort === "default" ? "selected" : ""}>${esc(t("sortDefault"))}</option>
        <option value="user" ${state.sort === "user" ? "selected" : ""}>${esc(t("sortUser"))}</option>
        <option value="name" ${state.sort === "name" ? "selected" : ""}>${esc(t("sortName"))}</option>
      </select>
    </div>`;

    return stats + tabs + tools + `<div class="rows" data-rows>${rowsHTML()}</div>`;
  }

  function rowsHTML() {
    if (state.tab === "fans" && !state.hasFollowers) return `<div class="center"><p>${esc(t("needFollowers"))}</p></div>`;

    const list = visibleUsers();
    if (!list.length) {
      const total = bucket(state.tab).length;
      const message = total
        ? t("emptyFilter")
        : state.tab === "non"
        ? t("emptyNon")
        : state.tab === "fans"
        ? t("emptyFans")
        : t("emptyMutual");
      return `<div class="center"><p>${esc(message)}</p></div>`;
    }

    const selectable = state.tab === "non";
    return list
      .map((u, i) => {
        const hidden = state.hidden.has(u.id);
        const index = String(i + 1).padStart(2, "0");
        const tags =
          (u.verified ? `<span class="tag v">✓</span>` : "") +
          (u.private ? `<span class="tag">${esc(t("fPrivate"))}</span>` : "");
        const box = selectable
          ? `<input type="checkbox" data-pick="${esc(u.id)}" ${state.selected.has(u.id) ? "checked" : ""}>`
          : "";
        // Instagram's CDN URLs are signed and referrer-checked, so they render
        // as broken images from here. A monogram needs no network at all.
        const initial = (u.username || "?").trim().charAt(0).toUpperCase();
        return `<div class="row ${hidden ? "hidden" : ""}">
          ${box}
          <span class="idx">${index}</span>
          <span class="av" aria-hidden="true">${esc(initial)}</span>
          <div class="meta">
            <a href="https://www.instagram.com/${esc(u.username)}/" target="_blank" rel="noreferrer">@${esc(u.username)}</a>
            <small>${esc(u.fullName || " ")}</small>
          </div>
          <div class="tags">${tags}</div>
          <button class="icon" data-hide="${esc(u.id)}" title="${esc(hidden ? t("unhide") : t("hide"))}">${hidden ? "◉" : "◌"}</button>
        </div>`;
      })
      .join("");
  }

  function doneHTML() {
    const ok = state.log.filter((l) => l.ok).length;
    const fail = state.log.length - ok;
    const blockedNote = state.blockedRemaining
      ? `<p class="err" style="margin-top:10px">${esc(t("blocked", { n: state.blockedRemaining }))}</p>`
      : "";
    return `<div class="progress">
      <div class="readout"><span class="big">${String(ok).padStart(3, "0")}</span><span class="of">/</span><span class="tot">${String(
      ok + fail
    ).padStart(3, "0")}</span></div>
      <div class="stamp">${esc(t("doneTitle"))}</div>
      <p class="pnote">${esc(t("doneBody", { ok, fail }))}</p>
      ${blockedNote}
      <div class="log">${logRows()}</div>
    </div>`;
  }

  function settingsHTML() {
    const field = (key, label) =>
      `<div class="field"><label>${esc(label)}</label><input class="text" type="number" min="0" data-timing="${key}" value="${state.timings[key]}"></div>`;
    return `<div class="pad">
      <p class="pnote" style="text-align:left">${esc(t("settingsBody"))}</p>
      <div class="gh">${esc(t("gScan"))}</div>
      ${field("scanDelayMin", t("sScanMin"))}
      ${field("scanDelayMax", t("sScanMax"))}
      ${field("scanRestEvery", t("sScanEvery"))}
      ${field("scanRestMs", t("sScanMs"))}
      <div class="gh">${esc(t("gUnfollow"))}</div>
      ${field("unfollowDelayMin", t("sUnMin"))}
      ${field("unfollowDelayMax", t("sUnMax"))}
      ${field("unfollowRestEvery", t("sUnEvery"))}
      ${field("unfollowRestMs", t("sUnMs"))}
    </div>`;
  }

  function errorHTML() {
    return `<div class="center">
      ${scopeHTML("still")}
      <div class="stamp">${esc(t("errTitle"))}</div>
      <p class="err" style="margin-top:10px">${esc(state.error)}</p>
    </div>`;
  }

  function footerHTML() {
    if (state.view === "scanning" || state.view === "unfollowing") {
      return `<footer>
        <span class="grow" data-countdown-foot></span>
        <button class="btn" data-act="pause">${esc(state.paused ? t("resume") : t("pause"))}</button>
        <button class="btn" data-act="cancel">${esc(t("cancel"))}</button>
      </footer>`;
    }
    if (state.view === "results") {
      const n = state.selected.size;
      const canUnfollow = state.tab === "non" && n > 0;
      return `<footer>
        <span class="grow">${n ? esc(t("selected", { n })) : ""}</span>
        ${state.tab === "non" ? `<button class="linkish" data-act="selall">${esc(n ? t("clear") : t("selectAll"))}</button>` : ""}
        <button class="btn" data-act="copy">${esc(t("copy"))}</button>
        <button class="btn" data-act="export">${esc(t("export"))}</button>
        ${canUnfollow ? `<button class="btn danger" data-act="unfollow">${esc(t("unfollow"))}</button>` : ""}
      </footer>`;
    }
    if (state.view === "settings") {
      return `<footer>
        <button class="linkish" data-act="restore">${esc(t("restore"))}</button>
        <span class="grow"></span>
        <button class="btn" data-act="back">${esc(t("back"))}</button>
        <button class="btn primary" data-act="savesettings">${esc(t("save"))}</button>
      </footer>`;
    }
    if (state.view === "done") {
      return `<footer><span class="grow"></span><button class="btn primary" data-act="back">${esc(t("back"))}</button></footer>`;
    }
    if (state.view === "error") {
      return `<footer><span class="grow"></span><button class="btn primary" data-act="scan">${esc(t("retry"))}</button></footer>`;
    }
    return "";
  }

  /* ------------------------------------------------------------------ *
   * Partial paints (avoid full re-render mid-run)
   * ------------------------------------------------------------------ */

  function paintProgress() {
    if (state.minimized) {
      pill.querySelector("span:last-child").textContent = pillLabel();
      return;
    }
    const { done, total, phase } = state.progress;
    const counter = panel.querySelector("[data-counter]");
    if (!counter) return;
    counter.innerHTML = readoutHTML(done, total);
    const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    const bar = panel.querySelector("[data-bar]");
    if (bar) bar.style.width = `${pct}%`;
    const pctLabel = panel.querySelector("[data-pct]");
    if (pctLabel) pctLabel.textContent = `${pct}%`;
    const label = panel.querySelector("[data-phase]");
    if (label) label.textContent = phaseText();
    // Freeze the sweep while paused rather than re-rendering the whole view.
    panel.querySelector(".scope")?.classList.toggle("still", state.paused);
  }

  function paintLog() {
    const box = panel.querySelector("[data-log]");
    if (box) box.innerHTML = logRows();
  }

  function paintCountdown() {
    const left = state.waitUntil - Date.now();
    const text = left > 0 && state.waitKey ? t(state.waitKey, { s: Math.ceil(left / 1000) }) : "";
    panel.querySelectorAll("[data-countdown], [data-countdown-foot]").forEach((el) => {
      el.textContent = text;
    });
  }

  function paintRows() {
    const box = panel.querySelector("[data-rows]");
    if (box) box.innerHTML = rowsHTML();
    const footer = panel.querySelector("footer");
    if (footer) {
      footer.outerHTML = footerHTML();
      bindFooter();
    }
  }

  function startTick() {
    clearInterval(tickTimer);
    tickTimer = setInterval(paintCountdown, 250);
  }

  function toast(message) {
    root.querySelector(".toast")?.remove();
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    panel.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2600);
  }

  function dialog({ title, body, confirmLabel, onConfirm }) {
    closeDialog?.();
    const mask = document.createElement("div");
    mask.className = "mask";
    mask.innerHTML = `<div class="dialog">
      <h4>${esc(title)}</h4><p>${esc(body)}</p>
      <div class="btns">
        <button class="btn" data-no>${esc(t("cancel"))}</button>
        <button class="btn danger" data-yes>${esc(confirmLabel)}</button>
      </div>
    </div>`;
    panel.appendChild(mask);
    closeDialog = () => {
      mask.remove();
      closeDialog = null;
    };
    mask.querySelector("[data-no]").onclick = closeDialog;
    mask.querySelector("[data-yes]").onclick = () => {
      closeDialog();
      onConfirm();
    };
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  pill.addEventListener("click", () => {
    state.minimized = false;
    save();
    render();
  });

  function bind() {
    bindHeader();
    bindBody();
    bindFooter();
  }

  function bindHeader() {
    const head = panel.querySelector("header");
    head.querySelector('[data-act="lang"]').onclick = () => {
      state.lang = state.lang === "tr" ? "en" : "tr";
      save();
      render();
    };
    head.querySelector('[data-act="settings"]').onclick = () => {
      state.view = state.view === "settings" ? "results" : "settings";
      if (state.view === "results" && !state.following.length) state.view = "idle";
      render();
    };
    head.querySelector('[data-act="min"]').onclick = () => {
      state.minimized = true;
      save();
      render();
    };
    head.querySelector('[data-act="close"]').onclick = () => {
      clearInterval(tickTimer);
      state.cancelled = true;
      host.remove();
    };
    makeDraggable(head);
  }

  function bindBody() {
    const body = panel.querySelector(".body");

    body.querySelector('[data-act="scan"]')?.addEventListener("click", startScan);
    body.querySelector('[data-act="togglefollowers"]')?.addEventListener("change", (e) => {
      state.scanFollowers = e.target.checked;
      save();
    });

    body.querySelectorAll("[data-tab]").forEach((el) => {
      el.onclick = () => {
        state.tab = el.dataset.tab;
        state.selected.clear();
        paintRows();
        panel.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === state.tab));
      };
    });

    const search = body.querySelector("[data-search]");
    if (search) {
      let debounce;
      search.oninput = () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          state.search = search.value;
          paintRows();
        }, 180);
      };
    }

    body.querySelectorAll("[data-filter]").forEach((el) => {
      el.onclick = () => {
        const key = el.dataset.filter;
        state.filters[key] = !state.filters[key];
        el.classList.toggle("on", state.filters[key]);
        save();
        paintRows();
      };
    });

    const sort = body.querySelector("[data-sort]");
    if (sort) {
      sort.onchange = () => {
        state.sort = sort.value;
        save();
        paintRows();
      };
    }

    body.addEventListener("change", (e) => {
      const id = e.target?.dataset?.pick;
      if (!id) return;
      if (e.target.checked) state.selected.add(id);
      else state.selected.delete(id);
      const footer = panel.querySelector("footer");
      if (footer) {
        footer.outerHTML = footerHTML();
        bindFooter();
      }
    });

    body.addEventListener("click", (e) => {
      const id = e.target?.closest?.("[data-hide]")?.dataset?.hide;
      if (!id) return;
      if (state.hidden.has(id)) state.hidden.delete(id);
      else {
        state.hidden.add(id);
        state.selected.delete(id);
      }
      save();
      paintRows();
    });
  }

  function bindFooter() {
    const footer = panel.querySelector("footer");
    if (!footer) return;
    const on = (act, fn) => footer.querySelector(`[data-act="${act}"]`)?.addEventListener("click", fn);

    on("pause", () => {
      state.paused = !state.paused;
      render();
    });
    on("cancel", () => {
      state.cancelled = true;
      state.paused = false;
      if (state.view === "scanning") toIdle();
    });
    on("selall", () => {
      if (state.selected.size) state.selected.clear();
      else visibleUsers().forEach((u) => state.selected.add(u.id));
      paintRows();
    });
    on("copy", copyUsernames);
    on("export", () => {
      dialog({
        title: t("export"),
        body: `${selectionOrAll().length} ${state.tab === "non" ? t("tabNon") : state.tab === "fans" ? t("tabFans") : t("tabMutual")}`,
        confirmLabel: t("exportCsv"),
        onConfirm: () => exportAs("csv")
      });
      // Offer JSON alongside CSV inside the same dialog.
      const btns = panel.querySelector(".dialog .btns");
      if (btns) {
        const json = document.createElement("button");
        json.className = "btn";
        json.textContent = t("exportJson");
        json.onclick = () => {
          closeDialog?.();
          exportAs("json");
        };
        btns.insertBefore(json, btns.lastElementChild);
      }
    });
    on("unfollow", () => {
      const n = state.selected.size;
      dialog({
        title: t("confirmTitle", { n }),
        body: t("confirmBody"),
        confirmLabel: t("confirmYes", { n }),
        onConfirm: startUnfollow
      });
    });
    on("back", () => {
      state.view = state.following.length ? "results" : "idle";
      render();
    });
    on("scan", startScan);
    on("restore", () => {
      state.timings = { ...DEFAULT_TIMINGS };
      save();
      render();
    });
    on("savesettings", () => {
      panel.querySelectorAll("[data-timing]").forEach((input) => {
        const value = Number(input.value);
        if (Number.isFinite(value) && value >= 0) state.timings[input.dataset.timing] = value;
      });
      save();
      state.view = state.following.length ? "results" : "idle";
      render();
      toast(t("savedToast"));
    });
  }

  function makeDraggable(handle) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      const rect = wrap.getBoundingClientRect();
      const dx = e.clientX - rect.left;
      const dy = e.clientY - rect.top;
      handle.classList.add("drag");
      handle.setPointerCapture(e.pointerId);

      const move = (ev) => {
        const x = Math.max(0, Math.min(window.innerWidth - rect.width, ev.clientX - dx));
        const y = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dy));
        state.pos = { x, y };
        applyPosition();
      };
      const up = () => {
        handle.classList.remove("drag");
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        save();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }

  render();
  console.log("%c[sonar] Ready — the panel is in the corner of the page.", "color:#000080;font-weight:600");
})();
