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
  currentEntry: null, // entry open in the viewer, null when closed
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
    // Phone-width month cells can't fit a readable pill; CSS swaps the pills
    // for this plain per-day count on narrow screens.
    if (items.length) {
      const count = document.createElement("div");
      count.className = "day-count";
      count.textContent = items.length;
      cell.appendChild(count);
    }
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
    let prevDay = "";
    for (const e of items) {
      // One date label per day, above that day's first article, instead of a
      // date column repeated on every row.
      const dayKey = isoDay(e._date);
      if (dayKey !== prevDay) {
        prevDay = dayKey;
        const label = document.createElement("div");
        label.className = "list-day-label";
        label.textContent = e._date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        block.appendChild(label);
      }
      const row = document.createElement("div");
      row.className = "list-row";
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
// Prev/next navigate the same list the calendar shows: manifest order
// (newest first), narrowed by the active project filter.
function viewerSiblings(entry) {
  const list = state.filterProject
    ? state.manifest.entries.filter((e) => e.project === state.filterProject)
    : state.manifest.entries;
  const i = list.findIndex((e) => e.slug === entry.slug);
  return {
    older: i >= 0 && i + 1 < list.length ? list[i + 1] : null,
    newer: i > 0 ? list[i - 1] : null,
  };
}

function syncViewerNav() {
  const { older, newer } = state.currentEntry
    ? viewerSiblings(state.currentEntry)
    : { older: null, newer: null };
  const sync = (sel, target) => {
    document.querySelectorAll(sel).forEach((btn) => {
      btn.disabled = !target;
      if (target) btn.dataset.tip = `${target.project} — ${stripProjectPrefix(target.title, target.project)}`;
      else delete btn.dataset.tip;
    });
  };
  sync(".viewer-prev", older);
  sync(".viewer-next", newer);
}

function openSibling(which) {
  if (!state.currentEntry) return;
  const target = viewerSiblings(state.currentEntry)[which];
  if (target) openEntry(target);
}

async function openEntry(entry) {
  const viewer = document.getElementById("viewer");
  const body = document.getElementById("viewer-body");
  state.currentEntry = entry;
  syncViewerNav();
  document.getElementById("viewer-project").textContent = entry.project;
  document.getElementById("viewer-project").style.color = state.projectColors.get(entry.project);
  document.getElementById("viewer-date").textContent = new Date(entry.date).toLocaleString();
  document.getElementById("viewer-raw").href = `./adrs/${entry.slug}`;
  body.innerHTML = `<p class="muted">Loading…</p>`;
  body.scrollTop = 0;
  viewer.classList.remove("hidden");
  // Keep aria-hidden in sync with visibility: consumers like screen readers and
  // browser reader modes (Readability) discard aria-hidden="true" subtrees, so a
  // stale value makes the open article invisible to them.
  viewer.setAttribute("aria-hidden", "false");
  document.getElementById("viewer-backdrop").classList.remove("hidden");
  document.body.style.overflow = "hidden";

  history.replaceState(null, "", `#${encodeURIComponent(entry.slug)}`);

  try {
    const res = await fetch(`./adrs/${entry.slug}?v=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    // A faster prev/next click may have superseded this fetch.
    if (state.currentEntry !== entry) return;
    body.innerHTML = window.marked.parse(md);
    await renderMermaidIn(body);
  } catch (err) {
    if (state.currentEntry !== entry) return;
    body.innerHTML = `<div class="mermaid-error">Failed to load: ${escapeHtml(err.message)}</div>`;
  }
}

function closeViewer() {
  state.currentEntry = null;
  const viewer = document.getElementById("viewer");
  viewer.classList.add("hidden");
  viewer.setAttribute("aria-hidden", "true");
  document.getElementById("viewer-backdrop").classList.add("hidden");
  document.body.style.overflow = "";
  // openEntry replaced the hash with the entry slug; restore the view+filter URL.
  history.replaceState(null, "", buildHash());
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
      block.classList.add("mmd-zoomable");
      block.dataset.tip = "Click to zoom";
      block.addEventListener("click", () => openLightbox(src));
    } catch (err) {
      block.innerHTML = `<div class="mermaid-error">Mermaid render error: ${escapeHtml(err.message || String(err))}\n\n${escapeHtml(src)}</div>`;
    }
  }
}

// ----- Mermaid lightbox (click a diagram to zoom/pan) -----
// Diagrams shrink to fit the 900px viewer panel (mermaid caps the SVG at
// max-width: 100%), so wide flowcharts become unreadable. Clicking one opens
// it fullscreen: wheel / pinch to zoom, drag to pan, double-click to toggle
// fit vs. enlarged, Escape or ✕ to close.
const lightbox = {
  el: null, stage: null, wrap: null, label: null,
  open: false, scale: 1, tx: 0, ty: 0, nw: 0, nh: 0,
  pointers: new Map(), pinchDist: 0,
  hadPinch: false, lastTap: 0, lastTapX: 0, lastTapY: 0, lastTouchUp: -1000,
};

function lightboxApply() {
  lightbox.wrap.style.transform = `translate(${lightbox.tx}px, ${lightbox.ty}px) scale(${lightbox.scale})`;
  lightbox.label.textContent = `${Math.round(lightbox.scale * 100)}%`;
}

function lightboxZoomTo(newScale, cx, cy) {
  const s = Math.min(10, Math.max(0.1, newScale));
  const k = s / lightbox.scale;
  lightbox.tx = cx - k * (cx - lightbox.tx);
  lightbox.ty = cy - k * (cy - lightbox.ty);
  lightbox.scale = s;
  lightboxApply();
}

function lightboxFitScale() {
  const r = lightbox.stage.getBoundingClientRect();
  return Math.min(10, Math.max(0.1,
    Math.min((r.width - 48) / lightbox.nw, (r.height - 48) / lightbox.nh)));
}

function lightboxFit() {
  const r = lightbox.stage.getBoundingClientRect();
  lightbox.scale = lightboxFitScale();
  lightbox.tx = (r.width - lightbox.nw * lightbox.scale) / 2;
  lightbox.ty = (r.height - lightbox.nh * lightbox.scale) / 2;
  lightboxApply();
}

// Double-click / double-tap: toggle between fit and enlarged at the point.
function lightboxToggleZoom(clientX, clientY) {
  const r = lightbox.stage.getBoundingClientRect();
  const fit = lightboxFitScale();
  if (Math.abs(lightbox.scale - fit) < 0.01) {
    lightboxZoomTo(Math.max(1, fit * 2), clientX - r.left, clientY - r.top);
  } else {
    lightboxFit();
  }
}

function setupLightbox() {
  const el = document.createElement("div");
  el.className = "mmd-lightbox hidden";
  el.innerHTML = `
    <div class="mmd-stage"></div>
    <div class="mmd-controls">
      <button data-act="out" data-tip="Zoom out">−</button>
      <span class="mmd-zoom-label">100%</span>
      <button data-act="in" data-tip="Zoom in">+</button>
      <button data-act="one" data-tip="Actual size">1:1</button>
      <button data-act="fit" data-tip="Fit to screen">Fit</button>
      <button data-act="close" data-tip="Close (Esc)">×</button>
    </div>`;
  document.body.appendChild(el);
  lightbox.el = el;
  lightbox.stage = el.querySelector(".mmd-stage");
  lightbox.label = el.querySelector(".mmd-zoom-label");

  el.querySelector(".mmd-controls").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    const r = lightbox.stage.getBoundingClientRect();
    const cx = r.width / 2, cy = r.height / 2;
    switch (btn.dataset.act) {
      case "in": lightboxZoomTo(lightbox.scale * 1.25, cx, cy); break;
      case "out": lightboxZoomTo(lightbox.scale / 1.25, cx, cy); break;
      case "one": lightboxZoomTo(1, cx, cy); break;
      case "fit": lightboxFit(); break;
      case "close": closeLightbox(); break;
    }
  });

  // Wheel zoom, centered on the cursor. macOS trackpad pinch also arrives
  // here (as ctrl+wheel), so it zooms too.
  lightbox.stage.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const r = lightbox.stage.getBoundingClientRect();
    lightboxZoomTo(lightbox.scale * Math.exp(-ev.deltaY * 0.002),
      ev.clientX - r.left, ev.clientY - r.top);
  }, { passive: false });

  // One pointer drags to pan; two pinch to zoom (touch).
  lightbox.stage.addEventListener("pointerdown", (ev) => {
    lightbox.stage.setPointerCapture(ev.pointerId);
    lightbox.pointers.set(ev.pointerId, {
      x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY,
    });
    if (lightbox.pointers.size === 2) {
      lightbox.hadPinch = true;
      const [a, b] = [...lightbox.pointers.values()];
      lightbox.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  lightbox.stage.addEventListener("pointermove", (ev) => {
    const p = lightbox.pointers.get(ev.pointerId);
    if (!p) return;
    if (lightbox.pointers.size === 1) {
      lightbox.tx += ev.clientX - p.x;
      lightbox.ty += ev.clientY - p.y;
      lightboxApply();
    }
    p.x = ev.clientX;
    p.y = ev.clientY;
    if (lightbox.pointers.size === 2) {
      const [a, b] = [...lightbox.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (lightbox.pinchDist > 0) {
        const r = lightbox.stage.getBoundingClientRect();
        lightboxZoomTo(lightbox.scale * (d / lightbox.pinchDist),
          (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      }
      lightbox.pinchDist = d;
    }
  });
  // Mobile Safari/Chrome don't deliver dblclick for touch when
  // touch-action: none, so detect double-tap by hand on pointerup.
  const endPointer = (ev) => {
    const p = lightbox.pointers.get(ev.pointerId);
    lightbox.pointers.delete(ev.pointerId);
    lightbox.pinchDist = 0;
    if (lightbox.pointers.size > 0) return;
    const pinched = lightbox.hadPinch;
    lightbox.hadPinch = false;
    if (ev.type !== "pointerup" || ev.pointerType !== "touch" || pinched || !p) return;
    lightbox.lastTouchUp = ev.timeStamp;
    const moved = Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0);
    if (moved >= 12) { lightbox.lastTap = 0; return; }
    if (ev.timeStamp - lightbox.lastTap < 350 &&
        Math.hypot(ev.clientX - lightbox.lastTapX, ev.clientY - lightbox.lastTapY) < 40) {
      lightbox.lastTap = 0;
      lightboxToggleZoom(ev.clientX, ev.clientY);
    } else {
      lightbox.lastTap = ev.timeStamp;
      lightbox.lastTapX = ev.clientX;
      lightbox.lastTapY = ev.clientY;
    }
  };
  lightbox.stage.addEventListener("pointerup", endPointer);
  lightbox.stage.addEventListener("pointercancel", endPointer);

  lightbox.stage.addEventListener("dblclick", (ev) => {
    // Browsers may synthesize dblclick from touch taps too; the pointerup
    // double-tap path owns touch, so ignore dblclick near a touch pointerup.
    if (ev.timeStamp - lightbox.lastTouchUp < 700) return;
    lightboxToggleZoom(ev.clientX, ev.clientY);
  });
}

async function openLightbox(src) {
  if (!lightbox.el) setupLightbox();
  const wrap = document.createElement("div");
  wrap.className = "mmd-zoom-wrap";
  lightbox.stage.innerHTML = "";
  lightbox.stage.appendChild(wrap);
  lightbox.wrap = wrap;
  lightbox.el.classList.remove("hidden");
  lightbox.open = true;
  try {
    const { svg } = await mermaid.render(`mmd-zoom-${Date.now()}`, src);
    wrap.innerHTML = svg;
  } catch {
    closeLightbox();
    return;
  }
  const svgEl = wrap.querySelector("svg");
  // Undo mermaid's responsive sizing (width:100%; max-width) so the CSS
  // transform is the only thing controlling scale.
  const vb = svgEl.viewBox.baseVal;
  lightbox.nw = vb && vb.width ? vb.width : svgEl.getBoundingClientRect().width;
  lightbox.nh = vb && vb.height ? vb.height : svgEl.getBoundingClientRect().height;
  svgEl.style.maxWidth = "none";
  svgEl.style.width = `${lightbox.nw}px`;
  svgEl.style.height = `${lightbox.nh}px`;
  wrap.style.width = `${lightbox.nw}px`;
  wrap.style.height = `${lightbox.nh}px`;
  lightboxFit();
}

function closeLightbox() {
  lightbox.open = false;
  lightbox.el.classList.add("hidden");
  lightbox.stage.innerHTML = "";
  lightbox.pointers.clear();
  lightbox.pinchDist = 0;
}

// ----- Routing (hash-based) -----
function buildHash() {
  let base;
  if (state.view === "list") {
    base = "#/list";
  } else if (state.view === "month") {
    const y = state.cursor.getFullYear();
    const m = String(state.cursor.getMonth() + 1).padStart(2, "0");
    base = `#/month/${y}-${m}`;
  } else {
    base = `#/${state.view}/${isoDay(state.cursor)}`;
  }
  // Fold the project filter into the URL so a shared link restores it too.
  if (state.filterProject) {
    base += `?project=${encodeURIComponent(state.filterProject)}`;
  }
  return base;
}

function parseHash() {
  const raw = location.hash.slice(1);
  if (!raw) return null;
  // Split an optional `?project=…` query off the path part.
  const qi = raw.indexOf("?");
  const path = qi >= 0 ? raw.slice(0, qi) : raw;
  const project = qi >= 0 ? (new URLSearchParams(raw.slice(qi + 1)).get("project") || "") : "";
  if (!path.startsWith("/")) return { entry: decodeURIComponent(path) };
  const [view, param] = path.slice(1).split("/").filter(Boolean);
  if (view === "list") return { view: "list", project };
  if (view === "month") {
    const m = param && param.match(/^(\d{4})-(\d{2})$/);
    if (m) return { view, cursor: new Date(+m[1], +m[2] - 1, 1), project };
  }
  if (view === "week" || view === "day") {
    const m = param && param.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return { view, cursor: new Date(+m[1], +m[2] - 1, +m[3]), project };
  }
  return null;
}

function syncViewButtons() {
  document.querySelectorAll(".view-switch button").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === state.view);
  });
}

function syncProjectFilter() {
  const sel = document.getElementById("project-filter");
  if (sel && sel.value !== state.filterProject) sel.value = state.filterProject;
}

function navigate({ view, cursor, project } = {}, { push = true } = {}) {
  if (view) state.view = view;
  if (cursor) state.cursor = cursor;
  if (project !== undefined) {
    // Ignore an unknown project (e.g. a stale shared link) — fall back to "All".
    state.filterProject =
      !project || state.projectColors.has(project) ? project : "";
  }
  syncViewButtons();
  syncProjectFilter();
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
    if (parsed && parsed.view) navigate({ view: parsed.view, cursor: parsed.cursor, project: parsed.project }, { push: false });
  });
  window.addEventListener("hashchange", () => {
    const parsed = parseHash();
    if (parsed && parsed.view) navigate({ view: parsed.view, cursor: parsed.cursor, project: parsed.project }, { push: false });
  });
  document.getElementById("project-filter").addEventListener("change", (ev) => {
    navigate({ project: ev.target.value });
  });
  document.getElementById("viewer-close").addEventListener("click", closeViewer);
  document.getElementById("viewer-backdrop").addEventListener("click", closeViewer);
  document.querySelectorAll(".viewer-prev").forEach((btn) => {
    btn.addEventListener("click", () => openSibling("older"));
  });
  document.querySelectorAll(".viewer-next").forEach((btn) => {
    btn.addEventListener("click", () => openSibling("newer"));
  });
  document.addEventListener("keydown", (ev) => {
    if (lightbox.open) {
      if (ev.key === "Escape") closeLightbox();
      return;
    }
    if (ev.key === "Escape") closeViewer();
    if (!state.currentEntry) return;
    if (ev.key === "ArrowLeft") openSibling("older");
    if (ev.key === "ArrowRight") openSibling("newer");
  });
}

function setupTooltip() {
  // Hover tooltips are meaningless on touch screens; a tap would only
  // flash one briefly before the click handler hides it.
  if (matchMedia("(hover: none)").matches) return;
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
    navigate({ view: parsed.view, cursor: parsed.cursor, project: parsed.project }, { push: false });
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
