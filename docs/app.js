// ADR Calendar — vanilla JS app.
// Loads manifest.json, renders Month/Week/Day/List views, and a markdown viewer
// with Mermaid + highlight.js support.

import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs";

mermaid.initialize({
  startOnLoad: false,
  theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default",
  securityLevel: "loose",
});

// ----- marked configuration -----
// One renderer that:
//   - emits a placeholder div for ```mermaid blocks (post-processed after DOM insert)
//   - syntax-highlights everything else with highlight.js
const renderer = {
  // marked v12 calls `code(text, infostring, escaped)`; v13+ passes a token
  // object. Accept both.
  code(codeOrToken, info) {
    let text, lang;
    if (codeOrToken && typeof codeOrToken === "object") {
      text = codeOrToken.text ?? "";
      lang = codeOrToken.lang ?? "";
    } else {
      text = codeOrToken ?? "";
      lang = info ?? "";
    }
    const language = String(lang).trim().split(/\s+/)[0] || "";
    if (language === "mermaid") {
      return `<div class="mermaid-block" data-mermaid="${encodeURIComponent(text)}"></div>`;
    }
    const hljs = window.hljs;
    let highlighted;
    try {
      if (hljs && language && hljs.getLanguage(language)) {
        highlighted = hljs.highlight(text, { language }).value;
      } else if (hljs && hljs.highlightAuto) {
        highlighted = hljs.highlightAuto(text).value;
      } else {
        highlighted = escapeHtml(text);
      }
    } catch {
      highlighted = escapeHtml(text);
    }
    const cls = language ? ` language-${language}` : "";
    return `<pre><code class="hljs${cls}">${highlighted}</code></pre>`;
  },
  // Rewrite relative image paths so they resolve against ./adrs/ (where
  // build.sh stages the assets), not the SPA's URL root. Without this,
  // `![](foo.png)` in an ADR points at /foo.png and 404s.
  image(hrefOrToken, title, text) {
    let href, t, alt;
    if (hrefOrToken && typeof hrefOrToken === "object") {
      href = hrefOrToken.href ?? "";
      t = hrefOrToken.title ?? "";
      alt = hrefOrToken.text ?? "";
    } else {
      href = hrefOrToken ?? "";
      t = title ?? "";
      alt = text ?? "";
    }
    const isAbsolute = /^([a-z]+:)?\/\//i.test(href) || href.startsWith("/") || href.startsWith("./") || href.startsWith("../");
    const src = isAbsolute ? href : `adrs/${href}`;
    const titleAttr = t ? ` title="${escapeHtml(t)}"` : "";
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr}>`;
  },
};

window.marked.use({ gfm: true, breaks: false, renderer });

// ----- State -----
const state = {
  view: "month",
  cursor: new Date(),
  manifest: null,
  filterProject: "",
  byDay: new Map(), // 'YYYY-MM-DD' -> [entries]
  projectColors: new Map(),
};

// ----- Load -----
async function loadManifest() {
  const res = await fetch(`./manifest.json?v=${Date.now()}`);
  state.manifest = await res.json();
  state.byDay.clear();
  for (const e of state.manifest.entries) {
    const d = new Date(e.date);
    const key = isoDay(d);
    if (!state.byDay.has(key)) state.byDay.set(key, []);
    state.byDay.get(key).push({ ...e, _date: d });
  }
  for (const arr of state.byDay.values()) {
    arr.sort((a, b) => b._date - a._date);
  }
  assignProjectColors();
  populateProjectFilter();
  document.getElementById("entry-count").textContent =
    `${state.manifest.count} ADR${state.manifest.count === 1 ? "" : "s"}`;
}

function assignProjectColors() {
  const palette = [
    "var(--p1)", "var(--p2)", "var(--p3)", "var(--p4)",
    "var(--p5)", "var(--p6)", "var(--p7)", "var(--p8)",
    "var(--p9)", "var(--p10)", "var(--p11)", "var(--p12)",
  ];
  const projects = [...new Set(state.manifest.entries.map((e) => e.project))].sort();
  projects.forEach((p, i) => state.projectColors.set(p, palette[i % palette.length]));
}

function populateProjectFilter() {
  const sel = document.getElementById("project-filter");
  const projects = [...new Set(state.manifest.entries.map((e) => e.project))].sort();
  while (sel.options.length > 1) sel.remove(1);
  for (const p of projects) {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  }
}

// ----- Date helpers -----
function isoDay(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfWeek(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a, b) { return isoDay(a) === isoDay(b); }
function fmtMonthYear(d) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function fmtRange(a, b) {
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  if (sameMonth) {
    return `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${b.getDate()}, ${a.getFullYear()}`;
  }
  if (sameYear) {
    return `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${b.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${a.getFullYear()}`;
  }
  return `${a.toLocaleDateString()} – ${b.toLocaleDateString()}`;
}
function fmtFullDay(d) {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function entriesFor(day) {
  const list = state.byDay.get(isoDay(day)) || [];
  return state.filterProject ? list.filter((e) => e.project === state.filterProject) : list;
}

// ----- Render dispatch -----
function render() {
  const root = document.getElementById("calendar");
  root.innerHTML = "";
  const periodEl = document.getElementById("period-label");

  switch (state.view) {
    case "month":
      renderMonth(root);
      periodEl.textContent = fmtMonthYear(state.cursor);
      break;
    case "week": {
      renderWeek(root);
      const ws = startOfWeek(state.cursor);
      periodEl.textContent = fmtRange(ws, addDays(ws, 6));
      break;
    }
    case "day":
      renderDay(root);
      periodEl.textContent = fmtFullDay(state.cursor);
      break;
    case "list":
      renderList(root);
      periodEl.textContent = "All entries";
      break;
  }
}

function renderMonth(root) {
  const grid = document.createElement("div");
  grid.className = "month-grid";
  for (const dow of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
    const c = document.createElement("div");
    c.className = "dow-cell";
    c.textContent = dow;
    grid.appendChild(c);
  }

  const monthStart = startOfMonth(state.cursor);
  const gridStart = startOfWeek(monthStart);
  const today = new Date();

  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    const cell = document.createElement("div");
    cell.className = "day-cell";
    if (d.getMonth() !== monthStart.getMonth()) cell.classList.add("outside");
    if (d.getDay() === 0 || d.getDay() === 6) cell.classList.add("weekend");
    if (sameDay(d, today)) cell.classList.add("today");

    const head = document.createElement("div");
    head.className = "daynum";
    const items = entriesFor(d);
    head.innerHTML = `<span>${d.getDate()}</span>`;
    cell.appendChild(head);

    appendPills(cell, items, 4, { compact: true });
    cell.addEventListener("click", (ev) => {
      if (ev.target.closest(".pill")) return;
      navigate({ view: "day", cursor: new Date(d) });
    });
    grid.appendChild(cell);
  }
  root.appendChild(grid);
}

function renderWeek(root) {
  const grid = document.createElement("div");
  grid.className = "week-grid";
  const ws = startOfWeek(state.cursor);
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    const cell = document.createElement("div");
    cell.className = "day-cell";
    if (d.getDay() === 0 || d.getDay() === 6) cell.classList.add("weekend");
    if (sameDay(d, today)) cell.classList.add("today");

    const head = document.createElement("div");
    head.className = "daynum";
    const dow = d.toLocaleDateString(undefined, { weekday: "short" });
    const month = d.toLocaleDateString(undefined, { month: "short" });
    head.innerHTML = `
      <span class="dow-name">${dow}</span>
      <span class="daynum-big">${d.getDate()}</span>
      <span class="muted"> ${month}</span>
    `;
    cell.appendChild(head);

    const pills = document.createElement("div");
    pills.className = "day-pills";
    appendPills(pills, entriesFor(d), 100);
    cell.appendChild(pills);

    grid.appendChild(cell);
  }
  root.appendChild(grid);
}

function renderDay(root) {
  const wrap = document.createElement("div");
  wrap.className = "day-view";
  const items = entriesFor(state.cursor);
  if (!items.length) {
    wrap.innerHTML = `<h2>${fmtFullDay(state.cursor)}</h2><p class="muted">No ADRs on this day.</p>`;
  } else {
    wrap.innerHTML = `<h2>${fmtFullDay(state.cursor)}</h2><p class="muted">${items.length} entr${items.length === 1 ? "y" : "ies"}</p>`;
    appendPills(wrap, items, 100);
  }
  root.appendChild(wrap);
}

function renderList(root) {
  const wrap = document.createElement("div");
  wrap.className = "list-view";
  const filtered = state.filterProject
    ? state.manifest.entries.filter((e) => e.project === state.filterProject)
    : state.manifest.entries;

  const groups = new Map();
  for (const e of filtered) {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...e, _date: d });
  }
  const keys = [...groups.keys()].sort().reverse();
  for (const k of keys) {
    const [y, m] = k.split("-").map(Number);
    const block = document.createElement("div");
    block.className = "list-month";
    const heading = document.createElement("h2");
    heading.textContent = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    block.appendChild(heading);
    const items = groups.get(k).sort((a, b) => b._date - a._date);
    for (const e of items) {
      const row = document.createElement("div");
      row.className = "list-row";
      const when = document.createElement("div");
      when.className = "when";
      when.textContent = e._date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const what = document.createElement("div");
      what.className = "what";
      const a = document.createElement("a");
      a.href = "#";
      a.innerHTML = `<span class="proj" style="--pill-color:${state.projectColors.get(e.project)}">${e.project}</span>${escapeHtml(stripProjectPrefix(e.title, e.project))}`;
      a.addEventListener("click", (ev) => { ev.preventDefault(); openEntry(e); });
      what.appendChild(a);
      if (e.summary) {
        const s = document.createElement("div");
        s.className = "muted";
        s.textContent = e.summary;
        what.appendChild(s);
      }
      row.appendChild(when);
      row.appendChild(what);
      block.appendChild(row);
    }
    wrap.appendChild(block);
  }
  if (!keys.length) wrap.innerHTML = `<p class="muted">No entries.</p>`;
  root.appendChild(wrap);
}

function stripProjectPrefix(title, project) {
  if (!project) return title;
  const escaped = project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}(?:\\s*[:—–]|\\s+-)?\\s+`, "i");
  return title.replace(re, "") || title;
}

function appendPills(container, items, max, opts = {}) {
  const compact = !!opts.compact;
  const visible = items.slice(0, max);
  for (const e of visible) {
    const btn = document.createElement("button");
    btn.className = compact ? "pill pill-compact" : "pill";
    btn.style.setProperty("--pill-color", state.projectColors.get(e.project));
    btn.dataset.tip = compact ? `${e.project} — ${e.title}` : e.title;
    const label = stripProjectPrefix(e.title, e.project);
    btn.innerHTML = compact
      ? escapeHtml(label)
      : `<span class="proj">${e.project}</span>${escapeHtml(label)}`;
    btn.addEventListener("click", () => openEntry(e));
    container.appendChild(btn);
  }
  if (items.length > max) {
    const more = document.createElement("div");
    more.className = "muted";
    more.textContent = `+${items.length - max} more`;
    container.appendChild(more);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ----- Viewer -----
async function openEntry(entry) {
  const viewer = document.getElementById("viewer");
  const body = document.getElementById("viewer-body");
  document.getElementById("viewer-project").textContent = entry.project;
  document.getElementById("viewer-project").style.color = state.projectColors.get(entry.project);
  document.getElementById("viewer-date").textContent = new Date(entry.date).toLocaleString();
  document.getElementById("viewer-raw").href = `./adrs/${entry.slug}`;
  body.innerHTML = `<p class="muted">Loading…</p>`;
  viewer.classList.remove("hidden");
  document.getElementById("viewer-backdrop").classList.remove("hidden");
  document.body.style.overflow = "hidden";

  history.replaceState(null, "", `#${encodeURIComponent(entry.slug)}`);

  try {
    const res = await fetch(`./adrs/${entry.slug}?v=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    body.innerHTML = window.marked.parse(md);
    await renderMermaidIn(body);
  } catch (err) {
    body.innerHTML = `<div class="mermaid-error">Failed to load: ${escapeHtml(err.message)}</div>`;
  }
}

function closeViewer() {
  document.getElementById("viewer").classList.add("hidden");
  document.getElementById("viewer-backdrop").classList.add("hidden");
  document.body.style.overflow = "";
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}

async function renderMermaidIn(container) {
  const blocks = container.querySelectorAll(".mermaid-block[data-mermaid]");
  let i = 0;
  for (const block of blocks) {
    const src = decodeURIComponent(block.getAttribute("data-mermaid"));
    block.removeAttribute("data-mermaid");
    const id = `mmd-${Date.now()}-${i++}`;
    try {
      const { svg } = await mermaid.render(id, src);
      block.innerHTML = svg;
    } catch (err) {
      block.innerHTML = `<div class="mermaid-error">Mermaid render error: ${escapeHtml(err.message || String(err))}\n\n${escapeHtml(src)}</div>`;
    }
  }
}

// ----- Routing (hash-based) -----
function buildHash() {
  if (state.view === "list") return "#/list";
  if (state.view === "month") {
    const y = state.cursor.getFullYear();
    const m = String(state.cursor.getMonth() + 1).padStart(2, "0");
    return `#/month/${y}-${m}`;
  }
  return `#/${state.view}/${isoDay(state.cursor)}`;
}

function parseHash() {
  const h = location.hash.slice(1);
  if (!h) return null;
  if (!h.startsWith("/")) return { entry: decodeURIComponent(h) };
  const [view, param] = h.slice(1).split("/").filter(Boolean);
  if (view === "list") return { view: "list" };
  if (view === "month") {
    const m = param && param.match(/^(\d{4})-(\d{2})$/);
    if (m) return { view, cursor: new Date(+m[1], +m[2] - 1, 1) };
  }
  if (view === "week" || view === "day") {
    const m = param && param.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return { view, cursor: new Date(+m[1], +m[2] - 1, +m[3]) };
  }
  return null;
}

function syncViewButtons() {
  document.querySelectorAll(".view-switch button").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === state.view);
  });
}

function navigate({ view, cursor } = {}, { push = true } = {}) {
  if (view) state.view = view;
  if (cursor) state.cursor = cursor;
  syncViewButtons();
  const h = buildHash();
  if (location.hash !== h) {
    if (push) history.pushState(null, "", h);
    else history.replaceState(null, "", h);
  }
  render();
}

// ----- Wiring -----
function wire() {
  document.querySelectorAll(".view-switch button").forEach((btn) => {
    btn.addEventListener("click", () => navigate({ view: btn.dataset.view }));
  });
  document.getElementById("prev").addEventListener("click", () => {
    let c = state.cursor;
    if (state.view === "month") c = addMonths(c, -1);
    else if (state.view === "week") c = addDays(c, -7);
    else if (state.view === "day") c = addDays(c, -1);
    navigate({ cursor: c });
  });
  document.getElementById("next").addEventListener("click", () => {
    let c = state.cursor;
    if (state.view === "month") c = addMonths(c, 1);
    else if (state.view === "week") c = addDays(c, 7);
    else if (state.view === "day") c = addDays(c, 1);
    navigate({ cursor: c });
  });
  document.getElementById("today").addEventListener("click", () => {
    navigate({ cursor: new Date() });
  });
  window.addEventListener("popstate", () => {
    const parsed = parseHash();
    if (parsed && parsed.view) navigate({ view: parsed.view, cursor: parsed.cursor }, { push: false });
  });
  window.addEventListener("hashchange", () => {
    const parsed = parseHash();
    if (parsed && parsed.view) navigate({ view: parsed.view, cursor: parsed.cursor }, { push: false });
  });
  document.getElementById("project-filter").addEventListener("change", (ev) => {
    state.filterProject = ev.target.value;
    render();
  });
  document.getElementById("viewer-close").addEventListener("click", closeViewer);
  document.getElementById("viewer-backdrop").addEventListener("click", closeViewer);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeViewer();
  });
}

function setupTooltip() {
  const el = document.createElement("div");
  el.className = "tt";
  document.body.appendChild(el);
  let timer = null;
  let current = null;
  let lastEv = null;
  const SHOW_DELAY = 100;

  function position(ev) {
    const pad = 8;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = ev.clientX + 14;
    let y = ev.clientY + 18;
    if (x + w + pad > window.innerWidth) x = window.innerWidth - w - pad;
    if (y + h + pad > window.innerHeight) y = ev.clientY - h - 10;
    el.style.left = x + "px";
    el.style.top = y + "px";
  }
  function hide() {
    if (timer) { clearTimeout(timer); timer = null; }
    current = null;
    el.classList.remove("on");
  }
  document.addEventListener("mouseover", (ev) => {
    const t = ev.target.closest("[data-tip]");
    if (t === current) return;
    if (current) hide();
    if (!t) return;
    current = t;
    lastEv = ev;
    timer = setTimeout(() => {
      if (!current) return;
      el.textContent = current.getAttribute("data-tip");
      el.classList.add("on");
      position(lastEv);
    }, SHOW_DELAY);
  });
  document.addEventListener("mousemove", (ev) => {
    if (!current) return;
    lastEv = ev;
    if (el.classList.contains("on")) position(ev);
  });
  document.addEventListener("mouseout", (ev) => {
    if (!current) return;
    if (ev.relatedTarget && current.contains(ev.relatedTarget)) return;
    hide();
  });
  document.addEventListener("click", hide, true);
  window.addEventListener("scroll", hide, true);
}

async function init() {
  wire();
  setupTooltip();
  await loadManifest();
  if (state.manifest.entries.length) {
    state.cursor = new Date(state.manifest.entries[0].date);
  }
  const parsed = parseHash();
  if (parsed && parsed.view) {
    navigate({ view: parsed.view, cursor: parsed.cursor }, { push: false });
  } else {
    syncViewButtons();
    history.replaceState(null, "", buildHash());
    render();
    if (parsed && parsed.entry) {
      const entry = state.manifest.entries.find((e) => e.slug === parsed.entry);
      if (entry) openEntry(entry);
    }
  }
}

init();
