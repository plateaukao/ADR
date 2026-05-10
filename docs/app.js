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
  code({ text, lang }) {
    const language = (lang || "").trim().split(/\s+/)[0] || "";
    if (language === "mermaid") {
      return `<div class="mermaid-block" data-mermaid="${encodeURIComponent(text)}"></div>`;
    }
    let highlighted;
    if (language && window.hljs.getLanguage(language)) {
      try {
        highlighted = window.hljs.highlight(text, { language }).value;
      } catch {
        highlighted = escapeHtml(text);
      }
    } else {
      highlighted = window.hljs.highlightAuto(text).value;
    }
    const cls = language ? ` language-${language}` : "";
    return `<pre><code class="hljs${cls}">${highlighted}</code></pre>`;
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
    head.innerHTML = `<span>${d.getDate()}</span>${items.length ? `<span class="count muted">${items.length}</span>` : ""}`;
    cell.appendChild(head);

    appendPills(cell, items, 4);
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
      a.innerHTML = `<span class="proj" style="--pill-color:${state.projectColors.get(e.project)}">${e.project}</span>${escapeHtml(e.title)}`;
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

function appendPills(container, items, max) {
  const visible = items.slice(0, max);
  for (const e of visible) {
    const btn = document.createElement("button");
    btn.className = "pill";
    btn.style.setProperty("--pill-color", state.projectColors.get(e.project));
    btn.title = e.title;
    btn.innerHTML = `<span class="proj">${e.project}</span>${escapeHtml(e.title)}`;
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

// ----- Wiring -----
function wire() {
  document.querySelectorAll(".view-switch button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".view-switch button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.view = btn.dataset.view;
      render();
    });
  });
  document.getElementById("prev").addEventListener("click", () => {
    if (state.view === "month") state.cursor = addMonths(state.cursor, -1);
    else if (state.view === "week") state.cursor = addDays(state.cursor, -7);
    else if (state.view === "day") state.cursor = addDays(state.cursor, -1);
    render();
  });
  document.getElementById("next").addEventListener("click", () => {
    if (state.view === "month") state.cursor = addMonths(state.cursor, 1);
    else if (state.view === "week") state.cursor = addDays(state.cursor, 7);
    else if (state.view === "day") state.cursor = addDays(state.cursor, 1);
    render();
  });
  document.getElementById("today").addEventListener("click", () => {
    state.cursor = new Date();
    render();
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

async function init() {
  wire();
  await loadManifest();
  if (state.manifest.entries.length) {
    state.cursor = new Date(state.manifest.entries[0].date);
  }
  render();
  if (location.hash.length > 1) {
    const slug = decodeURIComponent(location.hash.slice(1));
    const entry = state.manifest.entries.find((e) => e.slug === slug);
    if (entry) openEntry(entry);
  }
}

init();
