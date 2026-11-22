"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const S = {
    data: null, view: null, lane: null, detail: null, talk: {}, offline: false,
    doneOpen: {}, earlier: {}, req: {}, lastNeeds: null, lastNeedsView: null,
    hover: null, order: {}, deferred: false, opener: null, hash: null, locked: false,
  };
  // The page key arrives once in the address Foreman reports; this origin's storage keeps it.
  const pageKey = (() => {
    const p = new URLSearchParams(location.hash.slice(1));
    const given = p.get("key");
    if (given) {
      try { localStorage.setItem("foreman-page-key", given); } catch {}
      p.delete("key");
      history.replaceState(null, "", p.toString() ? `#${p}` : location.pathname);
      return given;
    }
    try { return localStorage.getItem("foreman-page-key") || ""; } catch { return ""; }
  })();
  const api = (path) => fetch(path, { cache: "no-store", headers: { "x-foreman-key": pageKey } });
  const DAY = 86400000;
  const KINDS = {
    "blocked": ["Blocked", 0], "lane-failed": ["Lane failed", 0], "ci-failing": ["CI failing", 1],
    "service-down": ["Service down", 1], "decision": ["Decision", 2], "re-review": ["Re-review", 3],
  };
  const RED = new Set(["blocked", "lane-failed", "ci-failing"]);
  const STATES = {
    waiting: ["Waiting on you", 0], blocked: ["Blocked", 1], failed: ["Failed", 2],
    running: ["Running", 3], prepared: ["Prepared", 4], done: ["Done", 5],
  };
  const LANE_KINDS = { implementation: "Implementation", review: "Review", "review-stack": "Review stack", other: "Other" };
  const SOURCES = {
    git: "git", github: "GitHub", azuredevops: "Azure DevOps", jira: "Jira", memory: "Basic Memory",
    sessions: "Host session status", health: "Health check",
  };
  const UNAVAILABLE_NAMES = {
    git: "git", github: "GitHub", azuredevops: "Azure DevOps", jira: "Jira", memory: "Basic Memory checkpoints",
    sessions: "lane session status", health: "service health checks",
  };
  const TRIGGERS = { briefing: "briefing", poll: "poll", request: "your request", oversight: "lane state change" };
  const REMOVABLE = new Set(["superseded head", "PR merged, removable", "PR closed, removable"]);
  const CHECKPOINT_SECTIONS = [["next", "Next action"], ["blockers", "Blockers"], ["remaining", "Remaining work"], ["decisions", "Decisions"], ["verification", "Verification"]];

  // Building blocks. Every value from a status file goes in as text.
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") el.className = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "hidden" || k === "disabled") el[k] = true;
        else el.setAttribute(k, v === true ? "" : String(v));
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false || kid === "") continue;
      el.append(kid instanceof Node ? kid : String(kid));
    }
    return el;
  }
  const str = (v) => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;
  const human = (v) => str(v).toLowerCase().replace(/[_-]+/g, " ");
  const shortSha = (v) => str(v).slice(0, 7);
  const shaEq = (a, b) => { const x = str(a).toLowerCase(), y = str(b).toLowerCase(); return !!x && !!y && (x.startsWith(y) || y.startsWith(x)); };
  function safeUrl(url) {
    if (typeof url !== "string") return null;
    try { const u = new URL(url); return u.protocol === "http:" || u.protocol === "https:" ? u.href : null; } catch { return null; }
  }
  function link(url, text, attrs) {
    const u = safeUrl(url);
    return u ? h("a", { href: u, target: "_blank", rel: "noopener noreferrer", ...attrs }, text) : h("span", attrs ? { class: attrs.class } : null, text);
  }
  function linkify(text) {
    return str(text).split(/(https?:\/\/[^\s<>"]+)/g).map((part, i) => {
      if (i % 2 === 0) return part;
      const m = part.match(/^(.*?)([.,;:!?)\]]*)$/);
      return [link(m[1], m[1]), m[2]];
    });
  }

  // Times.
  const parse = (v) => { const t = typeof v === "string" ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : null; };
  const pad = (n) => String(n).padStart(2, "0");
  const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  function when(v) {
    const t = typeof v === "number" ? v : parse(v);
    if (t === null) return "";
    const d = new Date(t), now = new Date();
    if (d.toDateString() === now.toDateString()) return hm(d);
    if (now - d < 6 * DAY && now - d > 0) return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${hm(d)}`;
    const opts = { day: "numeric", month: "short" };
    if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString(undefined, opts);
  }
  function whenExact(v) {
    const t = parse(v);
    if (t === null) return "an unknown time";
    const d = new Date(t);
    const time = `${hm(d)}:${pad(d.getSeconds())}`;
    return d.toDateString() === new Date().toDateString() ? time : `${when(v)} ${time}`;
  }
  function duration(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m < 60) return `${m} min`;
    return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 60)} h`;
  }
  const isToday = (v) => { const t = parse(v); return t !== null && new Date(t).toDateString() === new Date().toDateString(); };

  // Repositories.
  const entries = () => (S.data && Array.isArray(S.data.repos) ? S.data.repos : []);
  const entry = (key) => entries().find((e) => e.key === key) || null;
  const fileOf = (key) => { const e = entry(key); return e && e.status === "ok" ? e.file : null; };
  const nameOf = (e) => (e && e.file && obj(e.file.repo) && str(e.file.repo.name)) || (e ? e.key : "");
  const briefAt = (e) => (e && e.file && obj(e.file.briefing) ? parse(e.file.briefing.at) : null);
  function sortedEntries() {
    const weekAgo = Date.now() - 7 * DAY;
    return [...entries()].sort((a, b) => {
      const ta = briefAt(a), tb = briefAt(b);
      const oa = ta === null || ta < weekAgo, ob = tb === null || tb < weekAgo;
      if (oa !== ob) return oa ? 1 : -1;
      return (tb ?? 0) - (ta ?? 0) || a.key.localeCompare(b.key);
    });
  }
  const isOld = (e) => { if (!e || e.status !== "ok") return false; const t = briefAt(e); return t === null || t < Date.now() - 7 * DAY; };
  function laneById(file, id) { return arr(file && file.lanes).find((l) => l.id === id) || null; }
  function hostPhrase(host) {
    const s = str(host);
    if (!s) return "";
    return /\bapp$/i.test(s) ? ` in the ${s}` : ` in ${s}`;
  }

  // Sources and markers.
  const srcKey = (s) => str(s).toLowerCase().replace(/[^a-z]/g, "");
  function sourceState(file, source) {
    const k = srcKey(source);
    const sources = obj(file && file.sources) || {};
    for (const [name, v] of Object.entries(sources)) if (srcKey(name) === k) return obj(v);
    return null;
  }
  const unavailable = (file, source) => { const s = sourceState(file, source); return !!s && s.state === "unavailable"; };
  function marker(file, source, at, tip) {
    const k = srcKey(source);
    let kind, text, label;
    if (!k || k === "recorded") {
      kind = "mk-rec"; text = "recorded"; label = "Recorded";
      tip = tip || `Recorded by Foreman at ${when(at) || "an unknown time"}${hostPhrase(file && obj(file.briefing) && file.briefing.host)}`;
    } else if (unavailable(file, source)) {
      const s = sourceState(file, source);
      kind = "mk-un"; text = "unavailable"; label = "Unavailable";
      tip = `${SOURCES[k] || source} was unavailable at Foreman's last refresh: ${str(s.reason) || "no reason given"}.${at ? ` Last read at ${when(at)}.` : ""}`;
    } else {
      kind = "mk-chk"; text = "checked"; label = "Checked";
      tip = tip || `${SOURCES[k] || source}, read by Foreman at ${whenExact(at)}`;
    }
    // The marker's shape carries the provenance and its text the time; the tooltip and label carry both in words.
    return h("span", { class: `mk ${kind} ms-1`, tabindex: "0", "data-bs-toggle": "tooltip", "data-bs-title": tip, "aria-label": `${label}. ${tip}` }, when(at) || text);
  }
  const trackerSource = (t) => ({ github: "github", "azure-devops": "azureDevOps", azuredevops: "azureDevOps", jira: "jira" }[str(t).toLowerCase()] || str(t));
  const trackerName = (t) => ({ github: "GitHub", "azure-devops": "Azure DevOps", azuredevops: "Azure DevOps", jira: "Jira" }[str(t).toLowerCase()] || str(t));
  const prSource = (pr) => (str(pr.source) || (/github\./i.test(str(pr.url)) ? "github" : "azureDevOps"));

  // Needs you.
  const kindOf = (item) => KINDS[item.kind] || [human(item.kind) || "Item", 4];
  const needs = (file) => arr(file && file.attention);
  function sortNeeds(list) {
    return [...list].sort((a, b) => kindOf(a.item)[1] - kindOf(b.item)[1]
      || (parse(a.item.since || a.item.at) ?? Infinity) - (parse(b.item.since || b.item.at) ?? Infinity));
  }
  const needKey = (repo, item) => `${repo}|${str(item.kind)}|${str(item.lane)}|${str(item.title)}`;
  function needsCount(view) {
    if (view === "all") return entries().reduce((n, e) => n + (e.status === "ok" ? needs(e.file).length : 0), 0);
    return needs(fileOf(view)).length;
  }

  // Staleness and polling.
  function pollingText(p, short) {
    const state = obj(p) ? p.state : null;
    if (state === "polling") return `${short ? "polls" : "Foreman polls"} every ${num(p.everyMin) ?? "?"} min`;
    if (state === "host-cannot-schedule") return "not polling on this host";
    if (state === "no-active-lanes") return "not polling: no active lanes";
    if (state === "existing-schedule") return "not polling: this session already has a schedule";
    return "polling state not recorded";
  }
  function staleness(file) {
    const refresh = obj(file.refresh) || {};
    const at = parse(refresh.at) ?? parse(obj(file.briefing) && file.briefing.at);
    if (at === null) return null;
    const p = obj(refresh.polling);
    const every = p && p.state === "polling" ? num(p.everyMin) : null;
    const limit = every && every > 0 ? 3 * every * 60000 : 2 * 3600000;
    const age = Date.now() - at;
    return age > limit ? { at, age } : null;
  }

  // Ordering that holds still under the pointer.
  function ordered(panel, items, keyOf) {
    const previous = S.order[panel];
    let out = items;
    if (S.hover === panel && previous) {
      const index = new Map(previous.map((k, i) => [k, i]));
      out = items.map((item, i) => [item, index.has(keyOf(item)) ? index.get(keyOf(item)) : 1e9 + i])
        .sort((a, b) => a[1] - b[1]).map((x) => x[0]);
      if (out.some((item, i) => item !== items[i])) S.deferred = true;
    }
    S.order[panel] = out.map(keyOf);
    return out;
  }

  // Requests to Foreman, through the bridge in its session.
  const talkOn = (repo) => !!(S.talk[repo] && S.talk[repo].connected);
  const reqKey = (body) => [body.request, body.repo, body.lane || "", body.path || ""].join("|");
  function reqState(body) {
    const st = S.req[reqKey(body)];
    if (!st) return null;
    if (st.until && st.until <= Date.now()) { delete S.req[reqKey(body)]; return null; }
    return st;
  }
  function reqButton(label, body) {
    if (!talkOn(body.repo)) return null;
    const st = reqState(body);
    const busy = st && st.until;
    return h("span", { class: "d-inline-flex flex-wrap align-items-center gap-2" },
      h("button", {
        type: "button", class: "btn btn-sm", "data-key": `req:${reqKey(body)}`, disabled: !!busy,
        onclick: (e) => { e.stopPropagation(); send(body); },
      }, busy ? st.text : label),
      st && st.kind === "error" ? h("span", { class: "small text-danger", role: "status" }, st.text) : null);
  }
  async function send(body) {
    const talk = S.talk[body.repo];
    const key = reqKey(body);
    if (!talk || !talk.connected || reqState(body)?.until) return false;
    S.req[key] = { kind: "sending", text: "Sending to Foreman", until: Date.now() + 15000 };
    render();
    let response = null, json = {};
    try {
      response = await fetch(`http://127.0.0.1:${talk.port}/request`, {
        method: "POST", cache: "no-store",
        headers: { "content-type": "application/json", "x-foreman-token": talk.token },
        body: JSON.stringify(body),
      });
      try { json = await response.json(); } catch {}
    } catch {
      response = null;
    }
    let ok = false;
    if (!response) {
      S.req[key] = { kind: "error", text: "Could not reach the Foreman session" };
      loadTalk(body.repo);
    } else if (response.status === 200) {
      const at = parse(json.at) ?? Date.now();
      S.req[key] = { kind: "sent", text: `Sent to Foreman ${hm(new Date(at))}`, until: Date.now() + 15000 };
      ok = true;
    } else if (response.status === 202) {
      S.req[key] = { kind: "waiting", text: "Waiting for Foreman to finish its current step", until: Date.now() + 15000 };
      ok = true;
    } else if (response.status === 409) {
      S.req[key] = { kind: "error", text: "The Foreman session for this repository is no longer running Foreman" };
      loadTalk(body.repo);
    } else {
      S.req[key] = { kind: "error", text: str(json.error) || `The Foreman session refused the request (HTTP ${response.status})` };
    }
    if (S.req[key].until) setTimeout(render, S.req[key].until - Date.now() + 50);
    render();
    return ok;
  }

  // Tabler building blocks.
  const STATE_COLORS = { waiting: "yellow", blocked: "red", failed: "red", running: "green", prepared: "blue", done: "secondary" };
  const TAG_COLORS = { "blocked": "red", "lane-failed": "red", "ci-failing": "red", "service-down": "orange", "decision": "blue", "re-review": "purple" };
  function stateBadge(state) {
    const label = (STATES[state] || [human(state) || "Unknown"])[0];
    return h("span", { class: `status status-${STATE_COLORS[state] || "secondary"}` },
      h("span", { class: `status-dot${state === "running" ? " status-dot-animated" : ""}`, "aria-hidden": "true" }), label);
  }
  const list = (items, cls) => h("ul", { class: `list-group list-group-flush${cls ? ` ${cls}` : ""}` }, items);
  const row = (...kids) => h("li", { class: "list-group-item d-flex flex-wrap align-items-start gap-2" }, ...kids);
  const empty = (...text) => h("p", { class: "text-secondary mb-0" }, ...text);
  const mono = (text) => h("span", { class: "font-monospace text-break-all" }, text);
  const note = (text, cls) => h("span", { class: `badge ${cls || "bg-secondary-lt"} ms-1` }, text);
  const flushKid = (k) => k instanceof Element && /\b(list-group|table-responsive|card-footer)\b/.test(k.className);

  // Header, sidebar and summary.
  const greeting = () => { const hr = new Date().getHours(); return hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening"; };
  const repoView = () => !S.locked && !!S.view && S.view !== "all" && !!fileOf(S.view);
  function talkReason(repo) {
    return [`Requests need Foreman running for ${nameOf(entry(repo))} in the Copilot app, or in Copilot CLI with `, h("code", null, "--experimental"), "."];
  }
  function connLines() {
    if (S.locked || !S.data) return [];
    const out = [h("div", null, h("span", { class: `dot ${S.offline ? "off" : "on"}`, "aria-hidden": "true" }), S.offline ? "Dashboard server offline" : "Live")];
    if (repoView()) {
      const on = talkOn(S.view);
      out.push(h("div", null, h("span", { class: `dot${on ? " on" : ""}`, "aria-hidden": "true" }), on ? "Foreman session connected" : "No Foreman session found"));
    }
    return out;
  }
  function renderHeader() {
    const tabs = $("tabs");
    const entriesList = sortedEntries();
    tabs.replaceChildren();
    if (entriesList.length && !S.locked) {
      const all = [{ key: "all", label: "All repositories" }, ...entriesList.map((e) => ({ key: e.key, label: nameOf(e), e }))];
      for (const t of all) {
        const selected = S.view === t.key;
        let extra = null;
        if (t.e && t.e.status !== "ok") extra = h("span", { class: "badge bg-orange text-orange-fg", title: t.e.status === "newer" ? "Needs a newer dashboard" : "Could not be read" }, "!");
        else {
          const items = t.e ? needs(t.e.file) : entries().flatMap((e) => (e.status === "ok" ? needs(e.file) : []));
          if (items.length) extra = h("span", { class: `badge ${items.some((i) => RED.has(i.kind)) ? "bg-red text-red-fg" : "bg-blue text-blue-fg"}`, "aria-label": `${items.length} need you` }, String(items.length));
        }
        tabs.append(h("button", {
          type: "button", role: "tab", id: `tab-${t.key}`, "aria-selected": selected ? "true" : "false", "aria-controls": "main",
          tabindex: selected ? "0" : "-1", "data-key": `tab:${t.key}`,
          class: `nav-link${selected ? " active" : ""}${t.e && isOld(t.e) ? " old" : ""}`,
          onclick: () => selectView(t.key),
        }, h("span", { class: "tab-name" }, t.label), extra));
      }
      if (S.view) $("main").setAttribute("aria-labelledby", `tab-${S.view}`);
    }
    $("conn").replaceChildren(...connLines());
    $("conn-mobile").replaceChildren(...connLines().slice(0, 1));
    document.querySelector(".side-label").hidden = !tabs.children.length;

    const pre = $("pretitle"), head = $("headline");
    const e = S.view && S.view !== "all" ? entry(S.view) : null;
    if (S.locked || !S.data) { pre.textContent = ""; head.textContent = "Foreman"; }
    else if (!entries().length) { pre.textContent = greeting(); head.textContent = "No Foreman briefings yet"; }
    else if (e && e.status !== "ok") { pre.textContent = `${greeting()} \u00b7 ${nameOf(e)}`; head.textContent = e.status === "newer" ? "Needs a newer dashboard" : "Status file could not be read"; }
    else {
      const count = needsCount(S.view);
      pre.textContent = `${greeting()} \u00b7 ${S.view === "all" ? "All repositories" : nameOf(e)}`;
      head.textContent = count ? `${plural(count, "thing needs", "things need")} you` : "Nothing needs you";
    }
    document.title = S.data && !S.locked && S.view && needsCount(S.view) ? `(${needsCount(S.view)}) Foreman` : "Foreman";

    const fresh = $("freshness");
    fresh.replaceChildren();
    const file = repoView() ? fileOf(S.view) : null;
    if (file) {
      const b = obj(file.briefing) || {};
      const r = obj(file.refresh) || {};
      fresh.append(h("div", null, "Briefing ", h("b", null, when(b.at) || "unknown"), hostPhrase(b.host)));
      const stale = staleness(file);
      fresh.append(h("div", { class: stale ? "c-yellow" : null },
        "Last refresh ", h("b", null, when(r.at) || "unknown"), r.trigger ? ` (${TRIGGERS[r.trigger] || human(r.trigger)})` : "",
        `, ${pollingText(r.polling, true)}`));
    } else if (S.view === "all" && !S.locked) {
      const weekAgo = Date.now() - 7 * DAY;
      const recent = entries().filter((x) => x.status === "ok" && (briefAt(x) ?? 0) >= weekAgo);
      const oldest = recent.sort((a, b) => briefAt(a) - briefAt(b))[0];
      if (oldest) {
        fresh.append(h("div", null, "Oldest briefing this week: ", h("b", null, when(oldest.file.briefing.at)),
          hostPhrase(oldest.file.briefing.host), ` (${nameOf(oldest)})`));
      }
    }

    // The ask box and Refresh all stay in place in every repository view; without a Foreman session they are disabled and say why.
    const on = file ? talkOn(S.view) : false;
    const rb = $("refresh-all");
    rb.hidden = !file;
    const refresh = { request: "refresh", repo: S.view };
    const rs = file ? reqState(refresh) : null;
    rb.disabled = !on || !!(rs && rs.until);
    rb.textContent = rs && rs.until ? rs.text : "Refresh all";
    $("refresh-status").textContent = rs && rs.kind === "error" ? rs.text : "";

    $("askcard").hidden = !file;
    if (file) {
      const as = reqState(askBody(""));
      const sb = $("ask-send");
      sb.disabled = !on || !!(as && as.until);
      sb.textContent = as && as.until ? as.text : "Send";
      const status = $("ask-status");
      if (!on) { status.className = "small mt-1 text-secondary"; status.replaceChildren(...talkReason(S.view)); }
      else if (as && as.kind === "error") { status.className = "small mt-1 text-danger"; status.replaceChildren(as.text, ". Your text is kept, so you can send it again."); }
      else { status.className = "small mt-1"; status.replaceChildren(); }
    }
  }
  const askBody = (text) => ({ request: "ask", repo: S.view, text });
  const laneAskBody = (text) => ({ request: "ask", repo: S.view, lane: S.lane, text });

  function renderKpis() {
    const box = $("kpis");
    const files = S.locked || !S.data ? []
      : S.view === "all" ? entries().filter((e) => e.status === "ok").map((e) => e.file)
      : fileOf(S.view) ? [fileOf(S.view)] : [];
    box.hidden = !files.length;
    if (!files.length) { box.replaceChildren(); return; }
    let need = 0, red = false, waiting = 0, blocked = 0, running = 0, failing = 0, down = 0;
    for (const f of files) {
      for (const i of needs(f)) { need++; if (RED.has(i.kind)) red = true; }
      for (const l of arr(f.lanes)) {
        if (l.state === "waiting") waiting++;
        else if (l.state === "blocked" || l.state === "failed") blocked++;
        else if (l.state === "running") running++;
        failing += arr(l.prs).filter((p) => num(obj(p.checks)?.failed)).length;
      }
      down += arr(f.environment).filter((x) => x.state === "down").length;
    }
    const tile = (label, n, color) => h("div", { class: "col" }, h("div", { class: "card kpi h-100" }, h("div", { class: "card-body" },
      h("div", { class: "kpi-label" }, label), h("div", { class: `kpi-value ${n ? `c-${color}` : "zero"}` }, String(n)))));
    box.replaceChildren(
      tile("Needs you", need, red ? "red" : "blue"), tile("Waiting on you", waiting, "yellow"), tile("Blocked or failed", blocked, "red"),
      tile("Running", running, "green"), tile("Failing PRs", failing, "red"), tile("Services down", down, "red"));
  }
  // Banners.
  function renderBanners() {
    const out = [];
    const banner = (danger, ...text) => h("div", { class: `alert ${danger ? "alert-danger" : "alert-warning"} mb-3`, role: "status" }, ...text);
    if (S.offline && !S.locked) out.push(banner(true, "The dashboard server stopped responding. This page reconnects on its own, and Foreman starts the server again at its next briefing."));
    const e = S.view && S.view !== "all" ? entry(S.view) : null;
    if (e && e.status === "error") {
      const msg = str(e.error).replace(/\.?$/, ".");
      out.push(banner(true, `The status file for ${e.key} could not be read: ${msg} Foreman rewrites it at its next briefing.`));
    } else if (e && e.status === "newer") {
      out.push(banner(false, "This status file was written by a newer Foreman. Update Promptlings to read it."));
    } else if (e && e.status === "ok") {
      const file = e.file;
      const stale = staleness(file);
      if (stale) {
        const p = obj(obj(file.refresh) && file.refresh.polling);
        const reason = !p ? "" : p.state === "no-active-lanes" ? " Polling stopped: no active lanes."
          : p.state === "host-cannot-schedule" ? " This host cannot schedule polls."
          : p.state === "existing-schedule" ? " Polling is off: this session already has a schedule." : "";
        const action = talkOn(e.key) ? " Press Refresh all." : " Ask Foreman to refresh, or select Foreman again.";
        out.push(banner(false, `Foreman last refreshed ${nameOf(e)} at ${when(stale.at)}, ${duration(stale.age)} ago.${reason}${action}`));
      }
      const sources = obj(file.sources) || {};
      const down = [], fine = [];
      for (const [name, s] of Object.entries(sources)) {
        const st = obj(s);
        if (!st) continue;
        const label = UNAVAILABLE_NAMES[srcKey(name)] || name;
        if (st.state === "unavailable") down.push({ label, reason: str(st.reason), at: st.at });
        else if (st.state === "ok") fine.push(label);
      }
      if (down.length) {
        const parts = down.map((d) => `${d.label} was unavailable in Foreman's last refresh${d.at ? ` (read ${when(d.at)})` : ""}: ${(d.reason || "no reason was given").replace(/\.+$/, "")}.`);
        out.push(banner(false, parts.join(" "), fine.length ? ` Read as usual: ${fine.join(", ")}.` : ""));
      }
    }
    $("banners").replaceChildren(...out);
  }

  // Panels. Each panel is a Tabler card; lists and tables sit flush, other content goes in a card body.
  function section(panel, title, count, action, ...body) {
    const kids = [];
    let pending = [];
    const flush = () => { if (pending.length) { kids.push(h("div", { class: "card-body" }, pending)); pending = []; } };
    for (const k of body.flat(Infinity)) {
      if (k === null || k === undefined || k === false || k === "") continue;
      if (flushKid(k)) { flush(); kids.push(k); } else pending.push(k);
    }
    flush();
    return h("div", { class: "card", "data-panel": panel, role: "region", "aria-label": title },
      h("div", { class: "card-header" },
        h("h2", { class: "card-title" }, title, count !== null && count !== undefined ? h("span", { class: "badge bg-secondary-lt ms-2" }, String(count)) : null),
        action ? h("div", { class: "card-actions" }, action) : null),
      ...kids);
  }
  function laneButton(repo, id, text, key) {
    return h("button", { type: "button", class: "linkish", "data-key": key, onclick: (e) => { e.stopPropagation(); openLane(repo, id, key); } }, text);
  }

  function needItem(repo, file, item, all) {
    const [label] = kindOf(item);
    const lane = item.lane ? laneById(file, item.lane) : null;
    const key = needKey(repo, item);
    let action = null;
    if (!all && lane) {
      if (item.kind === "decision" && lane.state === "prepared") action = reqButton("Launch this lane", { request: "launch-lane", repo, lane: lane.id });
      else if (item.kind === "re-review") action = reqButton("Review the new head", { request: "review-new-head", repo, lane: lane.id });
      else if (item.kind === "lane-failed") action = reqButton("Recover this lane", { request: "recover-lane", repo, lane: lane.id });
    }
    return h("li", { class: "list-group-item" },
      h("div", { class: "d-flex align-items-start gap-3" },
        h("span", { class: `badge bg-${TAG_COLORS[item.kind] || "secondary"}-lt flex-none mt-1` }, label),
        h("div", { class: "flex-fill min-w-0" },
          h("div", { class: "d-flex align-items-baseline gap-2" },
            h("span", { class: "row-title flex-fill min-w-0" }, all ? h("span", { class: "text-secondary fw-normal" }, `${nameOf(entry(repo))}: `) : null, str(item.title)),
            marker(file, item.source, item.since || item.at)),
          item.detail ? h("div", { class: "row-meta trunc", title: str(item.detail) }, linkify(item.detail)) : null,
          item.lane || action ? h("div", { class: "d-flex flex-wrap align-items-center gap-2 mt-1 small" },
            item.lane ? [h("span", { class: "text-secondary" }, "Lane"), lane ? laneButton(repo, lane.id, str(lane.title) || lane.id, `need:${key}`) : str(item.lane)] : null,
            action ? h("span", { class: "ms-auto" }, action) : null) : null)));
  }
  function needsSection(repo, file) {
    const items = ordered(`needs:${repo}`, sortNeeds(needs(file).map((item) => ({ repo, item }))), (x) => needKey(x.repo, x.item));
    const r = obj(file.refresh) || {};
    return section(`needs:${repo}`, "Needs you", items.length || null, null,
      items.length ? list(items.map((x) => needItem(repo, file, x.item, false)))
        : empty(`Nothing needs you. Lanes report in their own sessions. Last refresh ${when(r.at) || "unknown"}.`));
  }

  function activityText(activity) {
    const a = obj(activity);
    if (!a) return "";
    const since = parse(a.since);
    const s = str(a.state).toLowerCase();
    if (["busy", "working", "running"].includes(s)) return since ? `Working for ${duration(Date.now() - since)}` : "Working";
    if (["waiting", "awaiting-input", "input", "needs-input"].includes(s)) return `Idle, waiting for your input${since ? ` since ${when(since)}` : ""}`;
    if (s === "idle") return `Idle${since ? ` since ${when(since)}` : ""}`;
    if (["ended", "stopped", "closed", "archived"].includes(s)) return `Ended${since ? ` ${when(since)}` : ""}`;
    return human(s);
  }
  function headMoved(lane, pr) {
    return /review/.test(str(lane.kind)) && !!pr.reviewedHead && !!pr.head && !shaEq(pr.head, pr.reviewedHead);
  }
  function prLine(lane, pr) {
    const c = obj(pr.checks);
    const t = obj(pr.threads);
    const bits = [pr.draft ? "draft" : human(pr.state) || "state unknown"];
    if (c) bits.push(`checks ${num(c.passed) ?? 0} passed, ${num(c.failed) ?? 0} failed, ${num(c.pending) ?? 0} pending`);
    if (pr.reviewDecision) bits.push(human(pr.reviewDecision));
    if (t && num(t.unresolved) !== null) bits.push(plural(t.unresolved, "unresolved thread"));
    return [link(pr.url, `#${str(pr.number) || "?"}`), ` ${bits.join(", ")}`, headMoved(lane, pr) ? note("head moved", "bg-yellow-lt") : null];
  }
  const kvRows = (pairs) => h("dl", { class: "row mb-0" }, pairs.map(([k, v]) => [
    h("dt", { class: "col-sm-3 text-secondary fw-normal" }, k), h("dd", { class: "col-sm-9 mb-1" }, v)]));
  function laneCard(repo, file, lane, extraClass) {
    const session = obj(lane.session) || {};
    const wi = obj(lane.workItem);
    const wiItem = wi ? arr(file.workItems).find((w) => str(w.id) === str(wi.id)) : null;
    const meta = [LANE_KINDS[lane.kind] || human(lane.kind) || "Lane", str(lane.agent),
      session.name || session.url ? link(session.url, str(session.name) || "session") : null,
      wi ? (wiItem && wiItem.url ? link(wiItem.url, str(wi.id)) : str(wi.id)) : null,
      lane.launchedAt ? `launched ${when(lane.launchedAt)}` : null].filter(Boolean);
    const facts = [];
    const fact = (label, value, mk, title) => facts.push(h("span", { class: "fact", title: title || null },
      h("span", null, label), h("span", { class: "v" }, value), mk));
    if (obj(session.activity)) fact("Session", activityText(session.activity), marker(file, "sessions", session.activity.at));
    const cp = obj(lane.checkpoint);
    if (cp && !unavailable(file, "memory")) {
      const newer = parse(cp.at) !== null && parse(lane.at) !== null && parse(cp.at) > parse(lane.at);
      const text = str(cp.next) || str(cp.title);
      fact("Checkpoint", [text, newer ? " (newer than note)" : ""],
        marker(file, "memory", cp.read, `Basic Memory checkpoint saved ${when(cp.at)}, read by Foreman at ${whenExact(cp.read)}`), text);
    }
    const git = obj(lane.git);
    if (lane.branch) {
      const bits = [];
      if (git) {
        if (num(git.ahead) !== null) bits.push(`${git.ahead} ahead`);
        if (num(git.behind) !== null) bits.push(`${git.behind} behind`);
        if (num(git.uncommitted) !== null && git.uncommitted) bits.push(`${git.uncommitted} uncommitted`);
      }
      fact("Branch", [mono(str(lane.branch)), bits.length ? ` ${bits.join(", ")}` : ""], marker(file, "git", git && git.read), str(lane.branch));
    }
    for (const pr of arr(lane.prs)) fact("PR", prLine(lane, pr), marker(file, prSource(pr), pr.read));
    const id = lane.id;
    const signal = laneSignal(lane);
    return h("li", {
      class: `list-group-item list-group-item-action lane-row${extraClass ? ` ${extraClass}` : ""}`,
      onclick: (e) => { if (!e.target.closest("a,button,.mk")) openLane(repo, id, `lane:${repo}|${id}`); },
    },
      h("div", { class: "d-flex align-items-center gap-2" },
        h("span", { class: "flex-none" }, stateBadge(lane.state)),
        h("button", { type: "button", class: "linkish plain row-title trunc", "data-key": `lane:${repo}|${id}`, "aria-haspopup": "dialog", onclick: (e) => { e.stopPropagation(); openLane(repo, id, `lane:${repo}|${id}`); } }, str(lane.title) || id),
        h("span", { class: "ms-auto d-flex align-items-center gap-2 small flex-none" }, signal || null, marker(file, "recorded", lane.at))),
      lane.note ? h("div", { class: "row-meta trunc mt-1", title: str(lane.note) }, str(lane.note)) : null,
      h("div", { class: "row-meta dotted mt-1" }, meta.map((m) => h("span", null, m))),
      facts.length ? h("div", { class: "facts" }, facts) : null);
  }
  const laneSort = (a, b) => (STATES[a.state] || ["", 3.5])[1] - (STATES[b.state] || ["", 3.5])[1] || (parse(a.launchedAt) ?? 0) - (parse(b.launchedAt) ?? 0);
  function lanesSection(repo, file) {
    const lanes = arr(file.lanes).filter((l) => typeof l.id === "string");
    const active = ordered(`lanes:${repo}`, lanes.filter((l) => l.state !== "done").sort(laneSort), (l) => l.id);
    const done = lanes.filter((l) => l.state === "done").sort(laneSort);
    const open = !!S.doneOpen[repo];
    if (!lanes.length) return section(`lanes:${repo}`, "Lanes", null, null, empty("Foreman launched or recovered no lanes in its last briefing."));
    return section(`lanes:${repo}`, "Lanes", lanes.length, null, list([
      active.map((l) => laneCard(repo, file, l)),
      done.length ? h("li", { class: "list-group-item py-2" },
        h("button", { type: "button", class: "linkish text-secondary", "aria-expanded": open ? "true" : "false", "data-key": `done:${repo}`, onclick: () => { S.doneOpen[repo] = !open; render(); } },
          `${open ? "Hide" : "Show"} done lanes (${done.length})`)) : null,
      done.map((l) => { const li = laneCard(repo, file, l, "done-lane"); li.hidden = !open; return li; }),
    ]));
  }

  function environmentSection(repo, file) {
    const rank = (e) => ({ down: 0, healthy: 2 }[e.state] ?? 1);
    const items = ordered(`env:${repo}`, arr(file.environment).map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i), (x) => str(x.e.name));
    return section(`env:${repo}`, "Environment", null, reqButton("Recheck environment", { request: "recheck-environment", repo }),
      items.length ? list(items.map(({ e }) => {
        const checked = !!e.health && e.source !== "recorded";
        const state = e.state === "healthy" ? "healthy" : e.state === "down" ? "down" : "not checked";
        const color = state === "healthy" ? "green" : state === "down" ? "red" : "secondary";
        return row(
          h("div", { class: "flex-fill" }, h("div", { class: "fw-medium" }, str(e.name)),
            e.address ? h("div", { class: "small" }, mono(str(e.address))) : null,
            e.detail ? h("div", { class: "small text-secondary" }, linkify(e.detail)) : null),
          h("div", { class: "d-flex align-items-center gap-1" },
            h("span", { class: `status status-${color}` }, h("span", { class: "status-dot", "aria-hidden": "true" }), state),
            checked ? marker(file, "health", e.read) : marker(file, "recorded", e.read || obj(file.refresh)?.at, "Recorded by Foreman, no health URL")));
      })) : empty("Foreman recorded no services for this repository."));
  }

  function relPath(file, path) {
    const p = str(path).replace(/\\/g, "/");
    const main = str(obj(file.repo) && file.repo.mainCheckout).replace(/\\/g, "/").replace(/\/+$/, "");
    const base = main.includes("/") ? main.slice(0, main.lastIndexOf("/")) : "";
    if (base && p.toLowerCase().startsWith(`${base.toLowerCase()}/`)) return p.slice(base.length + 1);
    return p;
  }
  function worktreesSection(repo, file) {
    const lanes = arr(file.lanes);
    const laneIndex = (id) => { const i = lanes.findIndex((l) => l.id === id); return i < 0 ? 999 : i; };
    const rank = (w) => ({ main: 0, lane: 1, review: 2 }[w.kind] ?? 3);
    const items = ordered(`wt:${repo}`, arr(file.worktrees).map((w, i) => ({ w, i }))
      .sort((a, b) => rank(a.w) - rank(b.w) || (a.w.kind === "lane" ? laneIndex(a.w.lane) - laneIndex(b.w.lane) : 0) || a.i - b.i), (x) => str(x.w.path));
    return section(`wt:${repo}`, "Worktrees", items.length || null, null,
      items.length ? list(items.map(({ w }) => {
        const lane = w.lane ? laneById(file, w.lane) : null;
        const purpose = w.kind === "main" ? "main checkout"
          : lane ? laneButton(repo, lane.id, str(lane.title) || lane.id, `wt:${repo}|${str(w.path)}`)
          : str(w.purpose) || "not from Foreman";
        const where = w.branch ? str(w.branch) : w.head ? `detached ${shortSha(w.head)}` : "";
        const cond = [num(w.uncommitted) ? plural(w.uncommitted, "uncommitted file") : null, str(w.condition) || null].filter(Boolean).join(", ");
        const remove = REMOVABLE.has(str(w.condition)) ? reqButton("Remove worktree", { request: "remove-worktree", repo, path: str(w.path) }) : null;
        return row(
          h("div", { class: "flex-fill" }, mono(relPath(file, w.path)),
            h("div", { class: "small text-secondary" }, where ? mono(where) : null, where ? ", " : "", purpose)),
          h("div", { class: "d-flex flex-wrap align-items-center gap-1 small" },
            cond ? h("span", { class: /removable|superseded/.test(cond) ? "text-warning" : "text-secondary" }, cond) : null,
            marker(file, "git", sourceState(file, "git")?.at)),
          remove ? h("div", { class: "w-100" }, remove) : null);
      })) : empty("Foreman recorded no worktrees for this repository."));
  }

  function workItemsSection(repo, file) {
    const items = arr(file.workItems);
    return section(`wi:${repo}`, "Work items", items.length || null, null,
      items.length ? list(items.map((w) => {
        const lane = w.lane ? laneById(file, w.lane) : null;
        return row(
          link(w.url, str(w.id), { class: "font-monospace" }),
          h("div", { class: "flex-fill" }, str(w.title), h("div", { class: "small text-secondary" },
            [trackerName(w.tracker), str(w.state), w.assignee ? `assigned to ${str(w.assignee)}` : null].filter(Boolean).join(", "),
            lane ? [", lane ", laneButton(repo, lane.id, str(lane.title) || lane.id, `wi:${repo}|${str(w.id)}`)] : null)),
          marker(file, trackerSource(w.tracker), w.read));
      })) : empty("Foreman matched no work items to today's lanes."));
  }

  function eventRow(repo, file, ev, i) {
    const lane = ev.lane ? laneById(file, ev.lane) : null;
    return row(
      h("span", { class: "small text-secondary" }, when(ev.at)),
      marker(file, ev.source, ev.at),
      h("div", { class: "flex-fill small" }, linkify(ev.text),
        lane ? [" ", laneButton(repo, lane.id, str(lane.title) || lane.id, `ev:${repo}|${i}`)] : null));
  }
  function activitySection(repo, file) {
    const events = arr(file.events).sort((a, b) => (parse(b.at) ?? 0) - (parse(a.at) ?? 0));
    const showAll = !!S.earlier[repo];
    const today = events.filter((e) => isToday(e.at));
    const shown = (showAll ? events : today).slice(0, 100);
    const hasEarlier = !showAll && events.length > today.length;
    return section(`act:${repo}`, "Activity", null, null,
      shown.length ? list(shown.map((ev, i) => eventRow(repo, file, ev, i))) : empty("No activity recorded today."),
      hasEarlier ? h("div", { class: "card-footer" }, h("button", { type: "button", class: "linkish", "data-key": `earlier:${repo}`, onclick: () => { S.earlier[repo] = true; render(); } }, "Show earlier")) : null);
  }

  // All repositories.
  function laneSignal(lane) {
    for (const pr of arr(lane.prs)) {
      const failed = num(obj(pr.checks)?.failed);
      if (failed) return h("span", { class: "text-danger" }, `CI failing: ${plural(failed, "check")}`);
    }
    for (const pr of arr(lane.prs)) if (headMoved(lane, pr)) return h("span", { class: "text-warning" }, "head moved");
    const act = obj(obj(lane.session)?.activity);
    if (act && /wait|input/.test(str(act.state))) return activityText(act);
    for (const pr of arr(lane.prs)) {
      const unresolved = num(obj(pr.threads)?.unresolved);
      if (unresolved) return plural(unresolved, "unresolved thread");
    }
    for (const pr of arr(lane.prs)) {
      const pending = num(obj(pr.checks)?.pending);
      if (pending) return `${plural(pending, "check")} pending`;
    }
    return "";
  }
  function renderAllView(main) {
    const repos = sortedEntries();
    const col = (card) => h("div", { class: "col-12" }, card);
    const rows = ordered("all:repos", repos, (e) => e.key).map((e) => {
      const f = e.status === "ok" ? e.file : null;
      const lanes = f ? arr(f.lanes) : [];
      const counts = {};
      for (const l of lanes) counts[l.state] = (counts[l.state] || 0) + 1;
      const laneText = Object.keys(STATES).filter((s) => counts[s]).map((s) => `${counts[s]} ${STATES[s][0].toLowerCase()}`).join(", ") || "none";
      const failingPrs = lanes.reduce((n, l) => n + arr(l.prs).filter((p) => num(obj(p.checks)?.failed)).length, 0);
      const down = f ? arr(f.environment).filter((x) => x.state === "down").length : 0;
      const r = f ? obj(f.refresh) || {} : {};
      const stale = f ? staleness(f) : null;
      return h("tr", { class: `cursor-pointer${isOld(e) ? " old" : ""}`, onclick: (ev) => { if (!ev.target.closest("button")) selectView(e.key); } },
        h("td", null, h("button", { type: "button", class: "linkish fw-medium", "data-key": `allrepo:${e.key}`, onclick: () => selectView(e.key) }, nameOf(e))),
        f ? [
          h("td", null, `${when(obj(f.briefing)?.at)}${hostPhrase(obj(f.briefing)?.host)}`),
          h("td", null, String(needs(f).length)),
          h("td", null, laneText),
          h("td", { class: failingPrs ? "text-danger" : null }, String(failingPrs)),
          h("td", { class: down ? "text-danger" : null }, String(down)),
          h("td", { class: stale ? "text-warning" : null }, `${when(r.at)}, ${pollingText(r.polling, true)}`),
        ] : h("td", { colspan: "6", class: "text-warning" }, e.status === "newer" ? "Written by a newer Foreman. Update Promptlings to read it." : `Could not be read: ${str(e.error)}`));
    });
    main.append(col(section("all:repos", "Repositories", repos.length, null,
      h("div", { class: "table-responsive" }, h("table", { class: "table card-table table-vcenter table-hover" },
        h("thead", null, h("tr", null, ["Repository", "Briefing", "Needs you", "Lanes", "Failing PRs", "Services down", "Last refresh"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", null, rows))))));

    const merged = [];
    for (const e of repos) if (e.status === "ok") for (const item of needs(e.file)) merged.push({ repo: e.key, item });
    const items = ordered("all:needs", sortNeeds(merged), (x) => needKey(x.repo, x.item));
    main.append(col(section("all:needs", "Needs you", items.length || null, null,
      items.length ? list(items.map((x) => needItem(x.repo, fileOf(x.repo), x.item, true)))
        : empty("Nothing needs you. Lanes report in their own sessions."))));

    const lanes = [];
    for (const e of repos) if (e.status === "ok") for (const l of arr(e.file.lanes)) if (typeof l.id === "string") lanes.push({ repo: e.key, l });
    const sortedLanes = ordered("all:lanes", lanes.sort((a, b) => laneSort(a.l, b.l)), (x) => `${x.repo}|${x.l.id}`);
    main.append(col(section("all:lanes", "Lanes", lanes.length || null, null,
      lanes.length ? list(sortedLanes.map(({ repo, l }) => row(
        h("span", { class: "small text-secondary" }, nameOf(entry(repo))),
        stateBadge(l.state),
        h("div", { class: "flex-fill" }, laneButton(repo, l.id, str(l.title) || l.id, `alllane:${repo}|${l.id}`)),
        h("span", { class: "small" }, laneSignal(l)))))
        : empty("No lanes in any repository."))));
  }

  function renderMain() {
    const main = $("main");
    main.replaceChildren();
    if (S.locked) {
      main.append(h("div", { class: "col-12" }, h("div", { class: "card" }, h("div", { class: "card-body" },
        h("h2", { class: "card-title" }, "Open the dashboard from Foreman's address."),
        h("p", null, "This page shows your Foreman status only to you. Open the address from Foreman's latest briefing; this browser remembers it until the dashboard restarts.")))));
      return;
    }
    if (!S.data) return;
    if (!entries().length) {
      const s = obj(S.data.server) || {};
      main.append(h("div", { class: "col-12" }, h("div", { class: "card" }, h("div", { class: "card-body" },
        h("h2", { class: "card-title" }, "Start your first briefing"),
        h("p", null, "Select Foreman in your agent host, for example ", h("code", null, "copilot --agent foreman"), ". This page updates on its own when the first briefing is written."),
        kvRows([["Address", mono(str(s.url))], ["Version", str(s.version)], ["Status directory", mono(str(s.statusDir))]])))));
      return;
    }
    if (S.view === "all") { renderAllView(main); return; }
    const file = fileOf(S.view);
    if (!file) return;
    main.append(
      h("div", { class: "col-lg-8 d-flex flex-column gap-3" }, needsSection(S.view, file), lanesSection(S.view, file)),
      h("div", { class: "col-lg-4 d-flex flex-column gap-3" }, environmentSection(S.view, file), worktreesSection(S.view, file), workItemsSection(S.view, file), activitySection(S.view, file)));
  }

  function renderLegend() {
    const legend = $("legend");
    legend.hidden = !entries().length;
    const file = S.view && S.view !== "all" ? fileOf(S.view) : null;
    const key = (cls, word, text) => h("span", null, h("span", { class: `mk legend ${cls} me-1` }, word), text);
    legend.replaceChildren(
      key("mk-rec", "recorded", "Foreman's own record"),
      key("mk-chk", "checked", "read from its source at Foreman's last refresh"),
      key("mk-un", "unavailable", "Foreman could not read the source, so the last value read is shown"),
      h("span", null, "Each marker shows its time; hover or focus it for the source."),
      ...(file ? [h("span", null, `Polling: ${pollingText(obj(file.refresh)?.polling)}`)] : []));
  }

  // Lane detail, shown in a Tabler offcanvas.
  function part(title, mk, ...body) { return h("section", { class: "mb-4" }, h("h3", { class: "d-flex align-items-center gap-2 mb-2" }, title, mk), ...body); }
  const kv = (pairs) => h("dl", { class: "row mb-2" }, pairs.filter((p) => p && p[1] !== null && p[1] !== undefined && p[1] !== "").map(([k, v]) => [
    h("dt", { class: "col-sm-4 text-secondary fw-normal" }, k), h("dd", { class: "col-sm-8 mb-1" }, v)]));
  const cut = (text) => { const s = str(text); return s.length > 600 ? [s.slice(0, 600), h("span", { class: "text-secondary" }, " ... more in the note")] : s; };
  const remoteGithub = (file) => { const r = str(obj(file.repo)?.remote).replace(/\.git$/, ""); return /^https:\/\/github\.com\//i.test(r) ? r : null; };
  const plainList = (items) => h("ul", { class: "list-unstyled mb-2" }, items);
  const plainRow = (...kids) => h("li", { class: "d-flex flex-wrap align-items-start gap-2 py-1 border-bottom" }, ...kids);
  const unavailNote = (text) => h("p", { class: "text-warning small" }, text);
  function checkDuration(v) {
    if (typeof v === "string") return v;
    const s = num(v);
    if (s === null) return "";
    return s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`;
  }
  function detailBody(repo, file, d) {
    const lane = d.lane;
    const session = obj(lane.session) || {};
    const wi = obj(lane.workItem);
    const wiItem = wi ? arr(file.workItems).find((w) => str(w.id) === str(wi.id)) : null;
    const prs = arr(lane.prs);
    const moved = prs.some((pr) => headMoved(lane, pr));
    const acts = [reqButton("Refresh this lane", { request: "refresh-lane", repo, lane: lane.id })];
    if (lane.state === "failed" || lane.state === "blocked") acts.push(reqButton("Recover this lane", { request: "recover-lane", repo, lane: lane.id }));
    if (lane.state === "prepared") acts.push(reqButton("Launch this lane", { request: "launch-lane", repo, lane: lane.id }));
    if (moved) acts.push(reqButton("Review the new head", { request: "review-new-head", repo, lane: lane.id }));

    const out = [];
    out.push(part("Summary", marker(file, "recorded", lane.at),
      kv([
        ["Recorded", [str(lane.note), lane.at ? h("span", { class: "text-secondary" }, ` ${when(lane.at)}`) : null]],
        ["Agent", str(lane.agent)],
        ["Session", session.name || session.url ? [link(session.url, str(session.name) || "session"), obj(session.activity) ? h("span", { class: "text-secondary" }, `, ${activityText(session.activity)}`) : null] : null],
        ["Work item", wi ? [wiItem && wiItem.url ? link(wiItem.url, str(wi.id)) : str(wi.id), wiItem && wiItem.title ? ` ${str(wiItem.title)}` : ""] : null],
        ["Launched", lane.launchedAt ? `${when(lane.launchedAt)}${hostPhrase(obj(file.briefing)?.host)}` : null],
        ["Worktree", lane.worktree ? mono(str(lane.worktree)) : null],
      ]),
      talkOn(repo) ? h("div", { class: "d-flex flex-wrap gap-2" }, acts) : null));

    const cp = obj(lane.checkpoint);
    if (unavailable(file, "memory")) {
      out.push(part("Latest checkpoint", marker(file, "memory", cp && cp.read),
        unavailNote(`Checkpoints were unavailable at Foreman's last refresh: ${str(sourceState(file, "memory")?.reason) || "no reason given"}.`)));
    } else if (!cp) {
      out.push(part("Latest checkpoint", null, empty("No checkpoint saved for this lane yet. Lanes save one at decisions, verified outcomes and handoffs.")));
    } else {
      const sections = obj(cp.sections) || {};
      const before = cp.match === "branch" && parse(cp.at) !== null && parse(lane.launchedAt) !== null && parse(cp.at) < parse(lane.launchedAt);
      out.push(part("Latest checkpoint", marker(file, "memory", cp.read, `Basic Memory checkpoint saved ${when(cp.at)}, read by Foreman at ${whenExact(cp.read)}`),
        h("h4", null, str(cp.title) || "Untitled checkpoint"),
        kv([
          ["Saved", [when(cp.at), before ? note("saved before this lane launched", "bg-yellow-lt") : null]],
          ["Matched", cp.match ? `matched by ${str(cp.match)}` : null],
          ["Status", str(cp.status)],
        ]),
        CHECKPOINT_SECTIONS.filter(([k]) => str(sections[k])).map(([k, label]) => h("div", { class: "mb-2" }, h("div", { class: "fw-medium" }, label), cut(sections[k]))),
        cp.permalink ? h("div", { class: "mb-2" }, h("div", { class: "fw-medium" }, "Permalink"), mono(str(cp.permalink))) : null));
    }

    const git = obj(lane.git);
    if (lane.branch || git) {
      const commits = arr(git && git.commits).slice(0, 20);
      const paths = (git && Array.isArray(git.paths) ? git.paths.filter((p) => typeof p === "string") : []).slice(0, 20);
      const total = num(git && git.uncommitted) ?? paths.length;
      const gh = remoteGithub(file);
      out.push(part("Branch", marker(file, "git", git && git.read),
        unavailable(file, "git") ? unavailNote(`git was unavailable at Foreman's last refresh: ${str(sourceState(file, "git")?.reason)}. Values below are from the last read.`) : null,
        kv([
          ["Branch", lane.branch ? [mono(str(lane.branch)), lane.base ? [" from ", mono(str(lane.base))] : null] : null],
          ["Ahead, behind", git && (num(git.ahead) !== null || num(git.behind) !== null) ? `${num(git.ahead) ?? "?"} ahead, ${num(git.behind) ?? "?"} behind` : null],
          ["Last commit", git && git.lastCommitAt ? when(git.lastCommitAt) : null],
          ["Uncommitted", git && num(git.uncommitted) !== null ? plural(git.uncommitted, "file") : null],
        ]),
        commits.length ? [h("h4", null, "Commits since base"), plainList(commits.map((c) => plainRow(
          gh && /^[0-9a-f]{7,40}$/i.test(str(c.sha)) ? link(`${gh}/commit/${str(c.sha)}`, shortSha(c.sha), { class: "font-monospace" }) : mono(shortSha(c.sha)),
          h("span", { class: "flex-fill" }, str(c.subject)), h("span", { class: "text-secondary small" }, when(c.at)))))] : null,
        paths.length ? [h("h4", null, "Uncommitted files"), plainList([paths.map((p) => plainRow(mono(p))),
          total > paths.length ? plainRow(h("span", { class: "text-secondary" }, `and ${total - paths.length} more`)) : null])] : null));
    }

    if (prs.length) {
      out.push(part("Pull requests", null, prs.map((pr) => prDetail(file, lane, pr))));
    } else {
      out.push(part("Pull requests", null, empty("No pull request for this lane yet.")));
    }

    const timeline = arr(d.events).map((e) => ({ at: e.at, source: e.source, text: e.text }));
    if (cp && cp.at && !unavailable(file, "memory")) timeline.push({ at: cp.at, source: "memory", text: `Checkpoint saved: ${str(cp.title)}` });
    for (const c of arr(git && git.commits)) timeline.push({ at: c.at, source: "git", text: `Commit ${shortSha(c.sha)} ${str(c.subject)}` });
    timeline.sort((a, b) => (parse(b.at) ?? 0) - (parse(a.at) ?? 0));
    out.push(part("Timeline", null, timeline.length
      ? plainList(timeline.slice(0, 50).map((e) => plainRow(h("span", { class: "text-secondary small" }, when(e.at)), marker(file, e.source, e.at), h("span", { class: "flex-fill small" }, linkify(e.text)))))
      : empty("No events recorded for this lane.")));

    return { lane, body: out };
  }
  function prDetail(file, lane, pr) {
    const source = prSource(pr);
    const c = obj(pr.checks) || {};
    const t = obj(pr.threads);
    const failing = arr(c.failing);
    const passing = Array.isArray(c.passing) ? c.passing : [];
    const reviews = arr(pr.reviews);
    return h("div", { class: "mb-3" },
      h("h4", { class: "d-flex flex-wrap align-items-center gap-1" }, link(pr.url, `#${str(pr.number) || "?"} ${str(pr.title)}`), marker(file, source, pr.read)),
      unavailable(file, source) ? unavailNote(`Pull request details were unavailable at Foreman's last refresh: ${str(sourceState(file, source)?.reason)}. Values below are from the last read.`) : null,
      kv([
        ["State", [pr.draft ? "draft, " : "", human(pr.state)].join("")],
        ["Branches", pr.headRef || pr.base ? [mono(str(pr.headRef) || "?"), " into ", mono(str(pr.base) || "?")] : null],
        ["Diff", num(pr.additions) !== null ? `+${pr.additions} / -${num(pr.deletions) ?? 0} in ${plural(num(pr.files) ?? 0, "file")}` : null],
        ["Review", pr.reviewDecision ? human(pr.reviewDecision) : null],
        ["Reviews", reviews.length ? reviews.map((r, i) => [i ? ", " : "", `${str(r.author || r.reviewer) || "someone"}: ${human(r.state)}`]) : null],
        ["Threads", t ? `${num(t.unresolved) ?? 0} unresolved, ${num(t.outdated) ?? 0} outdated` : null],
        ["Merge", pr.mergeable || pr.mergeState ? [human(pr.mergeable), pr.mergeState ? `, ${human(pr.mergeState)}` : ""].join("") : null],
        ["Reviewed head", pr.reviewedHead ? [mono(shortSha(pr.reviewedHead)), ", current ", mono(shortSha(pr.head)),
          headMoved(lane, pr) ? note("head moved", "bg-yellow-lt") : h("span", { class: "text-success" }, ", matches")] : null],
        ["Checks", `${num(c.passed) ?? 0} passed, ${num(c.failed) ?? 0} failed, ${num(c.pending) ?? 0} pending`],
      ]),
      failing.map((f) => h("div", { class: "border rounded p-2 mb-2" },
        h("div", { class: "d-flex flex-wrap align-items-center gap-2" },
          h("span", { class: "fw-medium" }, str(f.name)), f.workflow ? h("span", { class: "text-secondary" }, str(f.workflow)) : null,
          h("span", { class: "text-danger" }, human(f.conclusion) || "failed"), f.duration !== undefined ? h("span", { class: "text-secondary" }, checkDuration(f.duration)) : null,
          f.url ? h("span", { class: "ms-auto" }, link(f.url, "log")) : null),
        arr(f.annotations).slice(0, 5).map((a) => h("div", { class: "small mt-1" },
          link(a.url, `${str(a.path)}${a.line ? `:${str(a.line)}` : ""}`, { class: "font-monospace" }), " ", str(a.message))))),
      passing.length ? h("details", null, h("summary", null, plural(passing.length, "passing check")),
        plainList(passing.map((p) => plainRow(typeof p === "string" ? p : [str(p.name), p.url ? [" ", link(p.url, "log")] : null])))) : null);
  }

  const offcanvas = () => window.tabler.Offcanvas.getOrCreateInstance($("detail"));
  function renderDetail() {
    const box = $("detail");
    if (!S.lane || !S.view || S.view === "all") {
      if (S.detailShown) { S.detailShown = false; offcanvas().hide(); }
      $("lane-askbox").hidden = true;
      return;
    }
    const file = fileOf(S.view);
    const body = $("detail-body");
    const scroll = body.scrollTop;
    if (!file || !S.detail || S.detail.lane?.id !== S.lane) {
      $("detail-kind").textContent = "";
      $("dtitle").textContent = "Loading lane detail";
      $("detail-state").replaceChildren();
      body.replaceChildren();
    } else {
      const { lane, body: parts } = detailBody(S.view, file, S.detail);
      $("detail-kind").textContent = LANE_KINDS[lane.kind] || human(lane.kind) || "Lane";
      $("dtitle").textContent = str(lane.title) || lane.id;
      $("detail-state").replaceChildren(stateBadge(lane.state));
      body.replaceChildren(...parts);
    }
    body.scrollTop = scroll;
    renderLaneAsk();
    if (!S.detailShown) { S.detailShown = true; offcanvas().show(); }
    box.setAttribute("aria-busy", S.detail ? "false" : "true");
  }
  // The lane ask form is static markup outside the re-rendered detail body, so a render never detaches it.
  function renderLaneAsk() {
    const on = talkOn(S.view);
    $("lane-askbox").hidden = false;
    const forLane = `${S.view}|${S.lane}`;
    if (S.laneAskFor !== forLane) { S.laneAskFor = forLane; $("lane-ask-text").value = ""; }
    $("lane-ask-text").placeholder = `Ask Foreman about ${S.detail?.lane?.title ? str(S.detail.lane.title) : "this lane"}`;
    const st = reqState(laneAskBody(""));
    const sb = $("lane-ask-send");
    sb.disabled = !on || !!(st && st.until);
    sb.textContent = st && st.until ? st.text : "Send";
    const status = $("lane-ask-status");
    if (!on) { status.className = "small mt-1 text-secondary"; status.replaceChildren(...talkReason(S.view)); }
    else if (st && st.kind === "error") { status.className = "small mt-1 text-danger"; status.replaceChildren(st.text, ". Your text is kept, so you can send it again."); }
    else { status.className = "small mt-1"; status.replaceChildren(); }
  }

  // Navigation.
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    return { view: p.get("view") === "all" ? "all" : p.get("repo"), lane: p.get("lane") };
  }
  function writeHash() {
    const p = new URLSearchParams();
    if (S.view === "all") p.set("view", "all");
    else if (S.view) p.set("repo", S.view);
    if (S.lane) p.set("lane", S.lane);
    const hash = p.toString() ? `#${p}` : "";
    S.hash = hash;
    if (location.hash !== hash) history.replaceState(null, "", hash || location.pathname);
  }
  function defaultView() {
    const ok = sortedEntries().filter((e) => e.status === "ok");
    if (!entries().length) return null;
    let best = null;
    for (const e of ok) if (needs(e.file).length && (!best || needs(e.file).length > needs(best.file).length)) best = e;
    return (best || ok[0] || sortedEntries()[0]).key;
  }
  function resolveView() {
    if (!entries().length) { S.view = null; S.lane = null; return; }
    if (S.view !== "all" && !entry(S.view)) { S.view = defaultView(); S.lane = null; }
    if (S.lane && !laneById(fileOf(S.view), S.lane)) { S.lane = null; S.detail = null; }
  }
  function selectView(key) {
    if (S.view !== key) { S.lastNeeds = null; S.order = {}; }
    S.view = key;
    S.lane = null;
    S.detail = null;
    writeHash();
    render();
    loadTalk(key);
    const menu = $("side-menu");
    if (menu.classList.contains("show")) window.tabler.Collapse?.getInstance?.(menu)?.hide();
  }
  async function openLane(repo, id, opener) {
    if (S.view !== repo) { S.view = repo; S.lastNeeds = null; S.order = {}; loadTalk(repo); }
    S.lane = id;
    S.detail = null;
    S.opener = opener || null;
    writeHash();
    render();
    await loadDetail();
    render();
  }
  function closeLane() {
    const opener = S.opener;
    S.lane = null;
    S.detail = null;
    S.opener = null;
    writeHash();
    render();
    const target = opener && document.querySelector(`[data-key="${CSS.escape(opener)}"]`);
    if (target) target.focus();
  }

  // Data.
  async function loadState() {
    try {
      const response = await api("/api/state");
      if (response.status === 401) { lock(); return; }
      if (!response.ok) return;
      S.data = await response.json();
    } catch { return; }
    if (S.view === null) {
      const hash = readHash();
      S.view = hash.view === "all" || (hash.view && entry(hash.view)) ? hash.view : defaultView();
      S.lane = hash.lane && S.view !== "all" && laneById(fileOf(S.view), hash.lane) ? hash.lane : null;
      writeHash();
      loadTalk(S.view);
    }
    resolveView();
    if (S.lane) await loadDetail();
    render();
  }
  async function loadDetail() {
    if (!S.lane || !S.view) return;
    try {
      const response = await api(`/api/lane?repo=${encodeURIComponent(S.view)}&lane=${encodeURIComponent(S.lane)}`);
      if (response.status === 404) { S.lane = null; S.detail = null; writeHash(); return; }
      if (response.ok) S.detail = await response.json();
    } catch {}
  }
  async function loadTalk(repo) {
    if (!repo || repo === "all") return;
    let talk = { connected: false };
    try {
      const response = await api(`/api/talk?repo=${encodeURIComponent(repo)}`);
      if (response.ok) { const json = await response.json(); if (json && json.connected) talk = json; }
    } catch { return; }
    const before = JSON.stringify(S.talk[repo] || null);
    S.talk[repo] = talk;
    if (JSON.stringify(talk) !== before) render();
  }
  let events = null;
  function lock() {
    S.locked = true;
    // Data from the previous server instance can no longer be verified, so the locked page shows none of it.
    S.data = null;
    S.detail = null;
    S.lane = null;
    if (events) { events.close(); events = null; }
    render();
  }
  function connect() {
    if (S.locked) return;
    events = new EventSource(`/events?key=${encodeURIComponent(pageKey)}`);
    events.addEventListener("hello", () => { setOffline(false); loadState(); loadTalk(S.view); });
    events.addEventListener("state", () => loadState());
    events.addEventListener("talk", () => loadTalk(S.view));
    events.onerror = () => {
      if (!events) return;
      setOffline(true);
      // A refused key also closes the stream; asking for the state tells the two apart.
      if (events.readyState === EventSource.CLOSED) { events.close(); events = null; loadState(); setTimeout(connect, 5000); }
    };
  }
  function setOffline(value) {
    if (S.offline === value) return;
    S.offline = value;
    document.body.classList.toggle("offline", value);
    render();
  }

  function announce() {
    if (!S.view) return;
    const count = needsCount(S.view);
    if (S.lastNeedsView === S.view && S.lastNeeds !== null && count !== S.lastNeeds) {
      $("live").textContent = `Needs you: ${count}, ${count > S.lastNeeds ? "up" : "down"} from ${S.lastNeeds}`;
    }
    S.lastNeeds = count;
    S.lastNeedsView = S.view;
  }

  // Tooltips are delegated from the body; instances on elements about to be replaced are disposed first.
  function disposeTips() {
    for (const el of document.querySelectorAll('[data-bs-toggle="tooltip"]')) window.tabler.Tooltip.getInstance(el)?.dispose();
  }

  function render() {
    const active = document.activeElement;
    const focusKey = active && active.dataset ? active.dataset.key : null;
    const selection = active && active.id === "ask-text" ? [active.selectionStart, active.selectionEnd] : null;
    const y = window.scrollY;
    S.deferred = false;
    disposeTips();
    renderHeader();
    renderBanners();
    renderKpis();
    renderMain();
    renderLegend();
    renderDetail();
    announce();
    if (focusKey && document.activeElement !== active) {
      const el = document.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        if (selection && el.setSelectionRange) el.setSelectionRange(selection[0], selection[1]);
      }
    }
    window.scrollTo(0, y);
  }

  // Events.
  new window.tabler.Tooltip(document.body, { selector: '[data-bs-toggle="tooltip"]' });
  document.addEventListener("pointerover", (e) => {
    const panel = e.target.closest ? e.target.closest("[data-panel]") : null;
    const next = panel ? panel.dataset.panel : null;
    if (next === S.hover) return;
    const pending = S.deferred;
    S.hover = next;
    if (pending) render();
  });
  document.documentElement.addEventListener("pointerleave", () => {
    const pending = S.deferred;
    S.hover = null;
    if (pending) render();
  });
  $("tabs").addEventListener("keydown", (e) => {
    const tabs = [...$("tabs").querySelectorAll("[role=tab]")];
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let j = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = tabs.length - 1;
    if (j !== null) { e.preventDefault(); tabs[j].focus(); }
  });
  $("home").addEventListener("click", (e) => {
    e.preventDefault();
    if (S.data) selectView(defaultView());
  });
  $("refresh-all").addEventListener("click", () => send({ request: "refresh", repo: S.view }));
  $("ask").addEventListener("submit", async (e) => {
    e.preventDefault();
    const box = $("ask-text");
    const text = box.value.trim();
    if (!text || !S.view || S.view === "all") return;
    if (await send(askBody(text))) box.value = "";
  });
  $("ask-text").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("ask").requestSubmit(); }
  });
  $("lane-ask").addEventListener("submit", async (e) => {
    e.preventDefault();
    const box = $("lane-ask-text");
    const text = box.value.trim();
    if (!text || !S.lane || !S.view || S.view === "all") return;
    if (await send(laneAskBody(text))) box.value = "";
  });
  $("lane-ask-text").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("lane-ask").requestSubmit(); }
  });
  $("detail-close").addEventListener("click", () => closeLane());
  // Escape, the backdrop and the close button all end here; the offcanvas owns the focus trap.
  $("detail").addEventListener("hidden.bs.offcanvas", () => { S.detailShown = false; if (S.lane) closeLane(); });
  $("detail").addEventListener("shown.bs.offcanvas", () => $("dtitle").focus());
  window.addEventListener("hashchange", () => {
    if (location.hash === S.hash) return;
    if (new URLSearchParams(location.hash.slice(1)).has("key")) { location.reload(); return; }
    const hash = readHash();
    const view = hash.view === "all" || (hash.view && entry(hash.view)) ? hash.view : defaultView();
    if (view !== S.view) selectView(view);
    if (hash.lane && view !== "all" && laneById(fileOf(view), hash.lane)) openLane(view, hash.lane, null);
    else if (S.lane) closeLane();
  });
  // Print on paper in Tabler's stock light theme; the dark overrides are scoped to data-bs-theme=dark.
  window.addEventListener("beforeprint", () => document.documentElement.setAttribute("data-bs-theme", "light"));
  window.addEventListener("afterprint", () => document.documentElement.setAttribute("data-bs-theme", "dark"));
  setInterval(() => { if (!S.locked) { loadTalk(S.view); render(); } }, 30000);

  if (!pageKey) lock();
  else { loadState(); connect(); }
})();
