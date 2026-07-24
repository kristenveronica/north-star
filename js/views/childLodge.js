/* ============================================================
   childLodge.js — The Living Lodge (child home).
   Slice 1: the room + a real greeting + Today's Plan on the wall
   board, wired to the child's live milestones (tap to complete).
   Guides, pets, seasons and atmosphere arrive in later slices —
   see docs/living-lodge-vision.md.

   Flagged OFF by default so `main` stays shippable. Enable per
   device in a browser console with:
       localStorage.setItem('ns_lodge','1')
   ============================================================ */

import {
  getChildStats, getActiveMilestonesForChild, getState, getProject,
  completeMilestone,
} from "../store.js";
import { handleMilestoneTap } from "./childPortal.js";
import { recordChildCompletion } from "../lib/childPortalCloud.js";
import { celebrateMilestone } from "../components/celebrate.js";
import { esc, toast } from "../components/ui.js";

export function nsLodgeEnabled() {
  try { return localStorage.getItem("ns_lodge") === "1"; }
  catch { return false; }
}

const ROOM_IMG = "assets/images/lodge/room.jpg";
// Natural size of The Lodge Final.png, and the painted board's rectangle as
// fractions of that image. Used to anchor the plan overlay to the board no
// matter the window size (so text never drifts off it). Keep OBJECT_POS in
// sync with the .lg-bg `object-position` below.
const ROOM_W = 1536, ROOM_H = 1024;
const BOARD_RECT = { l: 0.363, r: 0.651, t: 0.205, b: 0.420 };
const OBJECT_POS = { x: 0.5, y: 0.40 };
// Fireplace opening + the two windows, as fractions of the room image.
const FIRE_RECT = { l: 0.17, r: 0.25, t: 0.42, b: 0.515 };
const WIN_L = { l: 0.02, r: 0.14, t: 0.10, b: 0.55 };
const WIN_R = { l: 0.85, r: 0.99, t: 0.10, b: 0.55 };

// The eight guides. Art lives at assets/images/guides/{band}/{id}.png.
const GUIDES = [
  { id: "joe",    name: "Joe",    title: "The Coach" },
  { id: "kai",    name: "Kai",    title: "The Maker" },
  { id: "scott",  name: "Scott",  title: "The Founder" },
  { id: "jacob",  name: "Jacob",  title: "The Pathfinder" },
  { id: "alex",   name: "Alex",   title: "The Adventurer" },
  { id: "tahlia", name: "Tahlia", title: "The Creator" },
  { id: "mira",   name: "Mira",   title: "The Naturalist" },
  { id: "eve",    name: "Eve",    title: "The Hearthkeeper" },
];
// The guide grows a little older than the child (big-brother/sister energy).
function ageBand(child) {
  const a = Number(child?.age);
  if (!a || isNaN(a)) return "13";
  if (a <= 7) return "7";
  if (a <= 11) return "13";
  if (a <= 15) return "16";
  return "20";
}
// Placement of each guide in the room: x = % from left, y = % from bottom,
// h = height (vh), flip = mirror. Tune live with Edit mode, then paste back here.
const LAYOUT = {
  scott:  { x: 0,  y: 1,  h: 38, flip: false },
  alex:   { x: 12, y: 7,  h: 33, flip: false },
  eve:    { x: 24, y: 11, h: 29, flip: false },
  joe:    { x: 37, y: 12, h: 30, flip: false },
  mira:   { x: 53, y: 11, h: 29, flip: true  },
  jacob:  { x: 66, y: 8,  h: 31, flip: false },
  tahlia: { x: 78, y: 4,  h: 33, flip: false },
  kai:    { x: 89, y: 1,  h: 38, flip: true  },
};
function lodgeEditOn() {
  try { return localStorage.getItem("ns_lodge_edit") === "1"; } catch { return false; }
}
// Guides are OFF until we find a natural way to place them in the room.
// Re-enable per device with: localStorage.setItem('ns_lodge_guides','1')
function lodgeGuidesOn() {
  try { return localStorage.getItem("ns_lodge_guides") === "1"; } catch { return false; }
}
// hand-drawn underline for the board heading (inline, no network)
const RULE_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 7'%3E%3Cpath d='M2 4 C 30 1.5, 60 6, 90 3.5 S 140 2, 148 4' fill='none' stroke='%23b79a5f' stroke-width='2.2' stroke-linecap='round'/%3E%3C/svg%3E";
const TICK_SVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Time-of-day wash over the room — morning warmth, midday clarity, golden
// evening, cool moonlit night. Subtle by design (Living Lodge: calm, not busy).
function timeOfDay() {
  const h = new Date().getHours();
  if (h < 6)  return { k: "night",   grad: "linear-gradient(180deg, rgba(44,58,102,.30), rgba(22,28,54,.34))",  fire: .8 };
  if (h < 11) return { k: "morning", grad: "linear-gradient(180deg, rgba(255,228,176,.16), rgba(255,204,140,.08))", fire: .32 };
  if (h < 16) return { k: "midday",  grad: "linear-gradient(180deg, rgba(255,255,246,.04), rgba(255,242,214,.04))", fire: .26 };
  if (h < 20) return { k: "evening", grad: "linear-gradient(180deg, rgba(255,198,132,.15), rgba(228,150,92,.09))",  fire: .55 };
  return { k: "night", grad: "linear-gradient(180deg, rgba(44,58,102,.30), rgba(22,28,54,.34))", fire: .8 };
}

function greeting(name) {
  const who = esc(name || "friend");
  const h = new Date().getHours();
  if (h < 5)  return `The stars are still out, ${who}.`;
  if (h < 12) return `Good morning, ${who}.`;
  if (h < 17) return `Good afternoon, ${who}.`;
  if (h < 20) return `Good evening, ${who}.`;
  return `Evening, ${who}.`;
}

/* Persistent left navigation — the same on every child page. */
function sidebarHTML(child, activeKey) {
  const code = child.accessCode || "";
  const done = getChildStats(child.id)?.completedMilestones ?? 0;
  const item = (key, label, ic, href) => {
    if (key === activeKey)
      return `<div class="lg-nav active" aria-current="page"><span class="lg-nav-ic">${ic}</span><span>${esc(label)}</span></div>`;
    const attrs = href ? `href="${href}"` : `href="#" data-todo="1"`;
    return `<a class="lg-nav" ${attrs}><span class="lg-nav-ic">${ic}</span><span>${esc(label)}</span></a>`;
  };
  return `
    <aside class="lg-sidebar">
      <div class="lg-brand"><span class="lg-mark">✦</span><span class="lg-wm">North Star<small>Guide Lodge</small></span></div>
      <nav class="lg-navlist">
        ${item("Lodge", "Lodge", IC.lodge, `#/kid/${code}`)}
        ${item("Today's Plan", "Today's Plan", IC.plan, null)}
        ${item("Calendar", "Calendar", IC.cal, `#/kid/${code}/calendar`)}
        ${item("Projects", "Projects", IC.proj, null)}
        ${item("Settings", "Settings", IC.set, null)}
      </nav>
      <div class="lg-foot">
        <span class="lg-ava">${esc((child.name || "?").slice(0, 1).toUpperCase())}</span>
        <span><span class="lg-foot-n">${esc(child.name || "Explorer")}</span><span class="lg-foot-s">✦ ${done} star${done === 1 ? "" : "s"}</span></span>
      </div>
    </aside>`;
}

/* Renders the persistent shell (sidebar + content region) and returns the
   content element for the caller to fill. mode "room" = immersive lodge photo;
   mode "page" = a scrolling light page (calendar, projects, …). */
export function lodgeShell(container, child, activeKey, mode = "page") {
  injectStyles();
  container.innerHTML =
    `<div class="lg-stage">${sidebarHTML(child, activeKey)}` +
    `<div class="lg-main ${mode === "room" ? "lg-room" : "lg-page"}" id="lg-main"></div></div>`;
  container.querySelectorAll("[data-todo]").forEach(a =>
    a.addEventListener("click", e => { e.preventDefault(); toast("Coming soon ✦"); }));
  return container.querySelector("#lg-main");
}

const IC = {
  lodge: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  plan:  `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 10h8M8 14h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  cal:   `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  proj:  `<svg viewBox="0 0 24 24" fill="none"><path d="M4 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  set:   `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.8 5.8l1.8 1.8M16.4 16.4l1.8 1.8M18.2 5.8l-1.8 1.8M7.6 16.4l-1.8 1.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
};

export function renderLodge(container, child) {
  const main = lodgeShell(container, child, "Lodge", "room");
  const band = ageBand(child);

  function build() {
    const stats = getChildStats(child.id) || {};
    const allUpcoming = (getActiveMilestonesForChild(child.id) || []).filter(m => !m.completed);
    const upcoming = allUpcoming.slice(0, 4);
    const moreCount = allUpcoming.length - upcoming.length;
    const total = stats.totalMilestones ?? stats.total ?? 0;
    const pct = total ? Math.round((stats.completedMilestones ?? 0) / total * 100) : 0;

    const planItems = upcoming.length
      ? upcoming.map((m, i) => `
          <li class="lg-step" data-id="${m.id}">
            <span class="lg-num">${i + 1}</span>
            <span class="lg-step-t">${esc(m.title)}</span>
            ${m.dueDate ? `<span class="lg-step-due">${esc(fmtShort(m.dueDate))}</span>` : ""}
            <span class="lg-tick" aria-hidden="true"></span>
          </li>`).join("")
        + (moreCount > 0 ? `<li class="lg-more">+${moreCount} more in your plan</li>` : "")
      : `<li class="lg-empty">All caught up ✦<span>Nothing due right now — enjoy the fire.</span></li>`;

    const tod = timeOfDay();

    // Only the room content rebuilds; the persistent sidebar stays untouched.
    main.innerHTML = `
      <img class="lg-bg" src="${ROOM_IMG}" alt="The Guide Lodge" />
      <div class="lg-scrim"></div>
      <div class="lg-tod lg-tod--${tod.k}" style="background:${tod.grad}"></div>
      <div class="lg-fireglow" id="lg-fireglow" style="opacity:${tod.fire}"></div>
      <canvas class="lg-fx" id="lg-fx" aria-hidden="true"></canvas>
      <header class="lg-topbar">
        <div class="lg-greet">
          <h1>${greeting(child.name)}</h1>
          <p>Your sky is growing brighter.</p>
        </div>
      </header>
      <section class="lg-board" id="lg-board" aria-label="Today's plan">
        <h2>Today's Plan</h2>
        <div class="lg-rule" aria-hidden="true"></div>
        ${total ? `<div class="lg-prog"><span style="width:${pct}%"></span></div>` : ""}
        <ul class="lg-plan">${planItems}</ul>
      </section>`;

    // tap a step → a parchment close-up of that mission (with its details)
    main.querySelectorAll(".lg-step").forEach(li => {
      li.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = li.getAttribute("data-id");
        const m = getState().milestones.find(x => x.id === id);
        if (m) openStepDetail(m, li, container, build);
      });
    });

    // place the guide cutouts in the room (off for now — see lodgeGuidesOn)
    if (lodgeGuidesOn()) renderGuides(main, child, band, build);

    // anchor the plan to the board, seat the fireplace glow, start the living fire
    requestAnimationFrame(() => {
      layoutBoard(container);
      positionFire(main, tod.fire);
      startLodgeFx(main);
    });
  }

  // keep the board + fire aligned when the window changes
  if (!window.__lgResizeBound) {
    window.__lgResizeBound = true;
    let raf = 0;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        document.querySelectorAll(".child-portal").forEach(cp => {
          layoutBoard(cp);
          const m = cp.querySelector("#lg-main");
          if (m) positionFire(m);
        });
      });
    });
  }

  build();
}

/* Map a fractional rectangle of the room image to on-screen px (object-fit:cover).
   Shared by the board, the fireplace, and the window light so everything stays
   anchored to the painting at any window size. */
function projectImageRect(main, R) {
  const W = main.clientWidth, H = main.clientHeight;
  const scale = Math.max(W / ROOM_W, H / ROOM_H);
  const dw = ROOM_W * scale, dh = ROOM_H * scale;
  const offX = (W - dw) * OBJECT_POS.x, offY = (H - dh) * OBJECT_POS.y;
  return { x: offX + R.l * dw, y: offY + R.t * dh, w: (R.r - R.l) * dw, h: (R.b - R.t) * dh };
}

/* Anchor .lg-board to the board painted in the room photo, then auto-shrink
   its text so any number of missions always fits — no manual tuning, no drift. */
function layoutBoard(container) {
  const main = container.querySelector("#lg-main");
  const board = container.querySelector("#lg-board");
  if (!main || !board) return;
  const W = main.clientWidth, H = main.clientHeight;
  if (!W || !H) return;
  const bR = projectImageRect(main, BOARD_RECT);
  const bx = bR.x, by = bR.y, bw = bR.w, bh = bR.h;
  const padX = bw * 0.08, padTop = bh * 0.14, padBot = bh * 0.12;
  board.style.left = (bx + padX) + "px";
  board.style.top = (by + padTop) + "px";
  board.style.width = (bw - 2 * padX) + "px";
  board.style.height = (bh - padTop - padBot) + "px";
  board.style.right = "auto";
  board.style.margin = "0";
  fitBoard(board);
}

function fitBoard(board) {
  // Grow to the LARGEST size that still fits, so the plan fills the board
  // (never leaves it tiny) and never overflows (never drifts off it).
  let size = 22;
  board.style.fontSize = size + "px";
  let guard = 0;
  while (board.scrollHeight > board.clientHeight + 1 && size > 8 && guard < 60) {
    size -= 0.5; board.style.fontSize = size + "px"; guard++;
  }
}

/* Seat the ambient fireplace glow over the painted stove (base light +
   reduced-motion fallback). Intensity is set by time of day. */
function positionFire(main, fireOpacity) {
  const glow = main.querySelector("#lg-fireglow");
  if (!glow) return;
  const f = projectImageRect(main, FIRE_RECT);
  const cx = f.x + f.w / 2, cy = f.y + f.h * 0.5;
  const r = Math.max(f.w, f.h) * 1.9;
  glow.style.left = (cx - r / 2) + "px";
  glow.style.top = (cy - r / 2) + "px";
  glow.style.width = r + "px";
  glow.style.height = r + "px";
  if (fireOpacity != null) glow.style.opacity = fireOpacity;
}

/* ---------- Living Lodge Layer 2: the fire + dust motes ----------
   One lightweight canvas: a flickering fire core, rising embers, and slow dust
   motes in the window light. Self-terminating (stops when the canvas leaves the
   DOM — navigation/rebuild), and skipped entirely for reduced-motion. */
function startLodgeFx(main) {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  const canvas = main.querySelector("#lg-fx");
  if (!canvas || canvas.dataset.on === "1") return;
  canvas.dataset.on = "1";
  const ctx = canvas.getContext("2d");
  let embers = [], motes = [], t = 0;

  const rand = (a, b) => a + Math.random() * (b - a);

  function frame() {
    if (!canvas.isConnected) return;           // rebuilt or navigated away → stop
    const W = main.clientWidth, H = main.clientHeight;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    t += 0.016;
    ctx.clearRect(0, 0, W, H);

    const f = projectImageRect(main, FIRE_RECT);
    // Anchor embers just above the log bed of the *baked* fire in the image.
    const fx = f.x + f.w / 2, fy = f.y + f.h * 0.72, fw = f.w;

    // A few embers drifting up from the fire — occasional, small, warm. We do
    // NOT draw a synthetic flame: the fire painted into the room is already
    // photoreal, so we only add life on top of it (embers + the soft CSS glow).
    ctx.globalCompositeOperation = "screen";
    if (embers.length < 10 && Math.random() < 0.28) {
      embers.push({ x: fx + rand(-fw * 0.22, fw * 0.22), y: fy, vx: rand(-0.18, 0.18), vy: rand(-1.0, -0.45), life: 1, size: rand(0.6, 1.6), hue: rand(22, 42) });
    }
    embers.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy -= 0.004; p.vx += rand(-0.03, 0.03); p.life -= 0.014; });
    embers = embers.filter(p => p.life > 0);
    embers.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life) * 0.7;
      ctx.fillStyle = `hsl(${p.hue},100%,${58 + p.life * 10}%)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.2832); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // dust motes drifting in the window light
    const cols = [projectImageRect(main, WIN_L), projectImageRect(main, WIN_R)];
    if (motes.length < 30 && Math.random() < 0.35) {
      const c = cols[Math.random() < 0.5 ? 0 : 1];
      motes.push({ x: c.x + Math.random() * c.w, y: c.y + Math.random() * c.h, vx: rand(-0.12, 0.12), vy: rand(0.06, 0.16), life: rand(0.6, 1), size: rand(0.6, 1.6), ph: rand(0, 6.28) });
    }
    motes.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.002; });
    motes = motes.filter(p => p.life > 0 && p.y < H + 10);
    motes.forEach(p => {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.4 + p.ph));
      ctx.globalAlpha = Math.min(1, p.life) * tw * 0.45;
      ctx.fillStyle = "rgba(255,246,224,1)";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.2832); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------- parchment close-up of a single mission ---------- */
function closeStepDetail() {
  document.getElementById("lg-veil")?.remove();
  document.removeEventListener("keydown", onDetailKey);
}
function onDetailKey(e) { if (e.key === "Escape") closeStepDetail(); }

function openStepDetail(m, targetEl, container, rebuild) {
  closeStepDetail();
  const project = getProject(m.projectId);
  const steps = m.instructions || [];
  const chips = [
    m.dueDate ? `<span class="lg-chip">Due ${esc(fmtShort(m.dueDate))}</span>` : "",
    m.momentumPoints ? `<span class="lg-chip">✦ ${m.momentumPoints} momentum</span>` : "",
    m.reflectionRequired ? `<span class="lg-chip">Reflection unlocks your star</span>` : "",
  ].filter(Boolean).join("");

  const veil = document.createElement("div");
  veil.className = "lg-veil";
  veil.id = "lg-veil";
  veil.innerHTML = `
    <div class="lg-sheet" role="dialog" aria-modal="true" aria-label="${esc(m.title)}">
      <button class="lg-x" id="lg-x" aria-label="Close">✕</button>
      ${project?.title ? `<div class="lg-sheet-eyebrow">${esc(project.questRole || project.title)}</div>` : ""}
      <h2>${esc(m.title)}</h2>
      <div class="lg-sheet-rule" aria-hidden="true"></div>
      ${m.description ? `<p>${esc(m.description)}</p>` : ""}
      ${steps.length ? `<div class="lg-sheet-sub">Your steps</div>
        <ol class="lg-steps">${steps.map(st => `<li>${esc(st)}</li>`).join("")}</ol>` : ""}
      ${chips ? `<div class="lg-meta">${chips}</div>` : ""}
      <div class="lg-sheet-actions">
        <button class="lg-btn" id="lg-done">I did it ✦</button>
        <button class="lg-btn ghost" id="lg-evidence">＋ Add a photo or note</button>
        <button class="lg-btn ghost" id="lg-later" style="margin-left:auto">Not yet</button>
      </div>
    </div>`;
  document.body.appendChild(veil);

  veil.addEventListener("click", (e) => { if (e.target === veil) closeStepDetail(); });
  veil.querySelector("#lg-x").addEventListener("click", closeStepDetail);
  veil.querySelector("#lg-later").addEventListener("click", closeStepDetail);
  veil.querySelector("#lg-done").addEventListener("click", () => completeStep(m, targetEl, container, rebuild));
  veil.querySelector("#lg-evidence").addEventListener("click", () => {
    closeStepDetail();
    handleMilestoneTap(m.id, targetEl, rebuild); // full submission flow (evidence → portfolio)
    // skin THIS modal instance as parchment (scoped; leaves other modals alone)
    const host = document.getElementById("modal-host");
    const backdrops = host ? host.querySelectorAll(".modal-backdrop") : [];
    const last = backdrops[backdrops.length - 1];
    if (!last) return;
    last.classList.add("lg-skin");
    // remove "Skip & mark done" — redundant with "I did it ✦" on the mission card
    last.querySelector("[data-skip]")?.remove();
    // add a Back button that returns to the mission card (instead of closing out)
    const foot = last.querySelector(".modal-foot");
    if (foot && !foot.querySelector("[data-lg-back]")) {
      const back = document.createElement("button");
      back.type = "button";
      back.className = "btn";
      back.setAttribute("data-lg-back", "1");
      back.innerHTML = "‹ Back";
      foot.insertBefore(back, foot.firstChild);
      back.addEventListener("click", () => {
        last.remove();
        openStepDetail(m, targetEl, container, rebuild);
      });
    }
  });
  document.addEventListener("keydown", onDetailKey);
}

function completeStep(m, targetEl, container, rebuild) {
  const s = getState();
  const portalCode = s.meta?.childPortalMode ? s.children[0]?.accessCode : null;
  completeMilestone(m.id);
  if (portalCode) recordChildCompletion(portalCode, m.id, true);
  closeStepDetail();
  celebrateMilestone(targetEl || container.querySelector("#lg-board"));
  const after = getState().milestones.find(x => x.id === m.id);
  toast(`Star earned! +${after?.momentumPoints || 0} ✦`, { type: "success", duration: 3000 });
  rebuild();
}

function fmtShort(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return ""; }
}

/* ---------- guide cutouts placed in the room ---------- */
function renderGuides(main, child, band, rebuild) {
  main.querySelectorAll(".lg-figure").forEach(n => n.remove());
  GUIDES.forEach(g => {
    const L = LAYOUT[g.id]; if (!L) return;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "lg-figure";
    el.dataset.id = g.id;
    el.style.left = L.x + "%";
    el.style.bottom = L.y + "%";
    el.style.height = L.h + "vh";
    el.innerHTML =
      `<img class="lg-figimg${L.flip ? " flip" : ""}" src="assets/images/guides/${band}/${g.id}.png" alt="${esc(g.name)}" draggable="false">` +
      `<span class="lg-figlabel">${esc(g.name)}</span>`;
    el.addEventListener("click", (e) => {
      if (lodgeEditOn()) { e.preventDefault(); return; }
      openGuideCard(g, band);
    });
    main.appendChild(el);
  });
  if (lodgeEditOn()) enableEdit(main);
}

/* parchment "meet your guide" card */
function openGuideCard(g, band) {
  closeStepDetail();
  const veil = document.createElement("div");
  veil.className = "lg-veil"; veil.id = "lg-veil";
  veil.innerHTML = `
    <div class="lg-sheet lg-guidecard" role="dialog" aria-modal="true" aria-label="${esc(g.name)}">
      <button class="lg-x" id="lg-x" aria-label="Close">✕</button>
      <div class="lg-guideportrait"><img src="assets/images/guides/${band}/${g.id}.png" alt="${esc(g.name)}"></div>
      <div class="lg-guideinfo">
        <div class="lg-sheet-eyebrow">Your guide</div>
        <h2>${esc(g.name)}</h2>
        <div class="lg-sheet-rule" aria-hidden="true"></div>
        <p>${esc(g.title)} — one of the eight guides who journey with you here at the Lodge.</p>
        <div class="lg-sheet-actions">
          <button class="lg-btn" id="lg-visit" type="button">Visit ${esc(g.name)} ✦</button>
          <button class="lg-btn ghost" id="lg-close2" type="button">Close</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(veil);
  veil.addEventListener("click", (e) => { if (e.target === veil) closeStepDetail(); });
  veil.querySelector("#lg-x").addEventListener("click", closeStepDetail);
  veil.querySelector("#lg-close2").addEventListener("click", closeStepDetail);
  veil.querySelector("#lg-visit").addEventListener("click", () => toast("Guide chats are coming soon ✦"));
  document.addEventListener("keydown", onDetailKey);
}

/* ---------- Edit mode (dev only): position/resize/flip guides, copy layout.
   Gated behind localStorage 'ns_lodge_edit' so children never see it. ---------- */
let lgEditBound = false, lgSel = null, lgDrag = null, lgOffX = 0, lgOffY = 0;
function currentMain() { return document.querySelector("#lg-main"); }
function selectFig(fig) { if (lgSel) lgSel.classList.remove("lg-sel"); lgSel = fig; if (fig) fig.classList.add("lg-sel"); }
function enableEdit(main) {
  main.classList.add("lg-editing");
  ensureEditBar();
  if (lgEditBound) return;
  lgEditBound = true;
  document.addEventListener("pointerdown", onEditDown, true);
  document.addEventListener("pointermove", onEditMove, true);
  document.addEventListener("pointerup", onEditUp, true);
  document.addEventListener("wheel", onEditWheel, { passive: false, capture: true });
  document.addEventListener("keydown", onEditKey);
}
function onEditDown(e) {
  if (!lodgeEditOn()) return;
  const fig = e.target.closest(".lg-figure"); if (!fig) return;
  e.preventDefault(); e.stopPropagation();
  selectFig(fig); lgDrag = fig; fig.classList.add("lg-drag");
  const r = currentMain().getBoundingClientRect(), er = fig.getBoundingClientRect();
  lgOffX = (e.clientX - er.left) / r.width * 100;
  lgOffY = (er.bottom - e.clientY) / r.height * 100;
  try { fig.setPointerCapture(e.pointerId); } catch {}
}
function onEditMove(e) {
  if (!lgDrag) return;
  const r = currentMain().getBoundingClientRect();
  const L = LAYOUT[lgDrag.dataset.id];
  L.x = Math.max(-6, Math.min(100, (e.clientX - r.left) / r.width * 100 - lgOffX));
  L.y = Math.max(-8, Math.min(80, (r.bottom - e.clientY) / r.height * 100 - lgOffY));
  lgDrag.style.left = L.x.toFixed(1) + "%"; lgDrag.style.bottom = L.y.toFixed(1) + "%";
  updateEditReadout();
}
function onEditUp() { if (lgDrag) { lgDrag.classList.remove("lg-drag"); lgDrag = null; } }
function onEditWheel(e) {
  if (!lodgeEditOn()) return;
  const fig = e.target.closest(".lg-figure"); if (!fig) return;
  e.preventDefault(); selectFig(fig);
  const L = LAYOUT[fig.dataset.id];
  L.h = Math.max(12, Math.min(70, L.h + (e.deltaY < 0 ? 1 : -1)));
  fig.style.height = L.h + "vh"; updateEditReadout();
}
function onEditKey(e) {
  if (!lodgeEditOn() || !lgSel) return;
  const L = LAYOUT[lgSel.dataset.id];
  if (e.key === "f" || e.key === "F") { L.flip = !L.flip; lgSel.querySelector(".lg-figimg").classList.toggle("flip", L.flip); }
  else if (e.key === "ArrowLeft") L.x -= 0.4;
  else if (e.key === "ArrowRight") L.x += 0.4;
  else if (e.key === "ArrowUp") L.y += 0.4;
  else if (e.key === "ArrowDown") L.y -= 0.4;
  else return;
  e.preventDefault();
  lgSel.style.left = L.x.toFixed(1) + "%"; lgSel.style.bottom = L.y.toFixed(1) + "%"; updateEditReadout();
}
function updateEditReadout() {
  const r = document.getElementById("lg-er");
  if (r && lgSel) { const L = LAYOUT[lgSel.dataset.id]; r.textContent = `${lgSel.dataset.id}  x:${L.x.toFixed(1)} y:${L.y.toFixed(1)} h:${Math.round(L.h)}${L.flip ? " ⇄" : ""}`; }
}
function layoutSnippet() {
  const lines = GUIDES.map(g => { const L = LAYOUT[g.id]; const pad = " ".repeat(Math.max(1, 7 - g.id.length)); return `  ${g.id}:${pad}{ x: ${+L.x.toFixed(1)}, y: ${+L.y.toFixed(1)}, h: ${Math.round(L.h)}, flip: ${L.flip} },`; });
  return "const LAYOUT = {\n" + lines.join("\n") + "\n};";
}
function ensureEditBar() {
  if (document.getElementById("lg-editbar")) return;
  const bar = document.createElement("div");
  bar.id = "lg-editbar"; bar.className = "lg-editbar";
  bar.innerHTML =
    `<span class="hintx">Edit: drag to move · scroll to resize · <b>F</b> flips · arrows nudge</span>` +
    `<span id="lg-er" class="er">—</span>` +
    `<button id="lg-copy" type="button">Copy layout</button>` +
    `<button id="lg-editoff" type="button">Done</button>`;
  document.body.appendChild(bar);
  bar.querySelector("#lg-copy").addEventListener("click", () => {
    const t = layoutSnippet();
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
      .then(() => toast("Layout copied — paste it to me ✎"), () => window.prompt("Copy layout:", t));
  });
  bar.querySelector("#lg-editoff").addEventListener("click", () => {
    try { localStorage.removeItem("ns_lodge_edit"); } catch {}
    bar.remove();
    document.querySelectorAll(".lg-figure").forEach(f => f.classList.remove("lg-sel", "lg-drag"));
    document.querySelectorAll("#lg-main").forEach(m => m.classList.remove("lg-editing"));
    toast("Edit mode off");
  });
}

/* ---------- scoped styles (injected once) ---------- */
function injectStyles() {
  if (document.getElementById("lg-css")) return;
  const el = document.createElement("style");
  el.id = "lg-css";
  el.textContent = LODGE_CSS;
  document.head.appendChild(el);
}

const LODGE_CSS = `
.child-portal:has(.lg-stage){min-height:100vh}
.lg-stage{--lg-side:220px;--lg-serif:"Cormorant Garamond",Georgia,serif;--lg-sans:"Mulish",system-ui,sans-serif;
  --lg-gold:#cba24c;--lg-ink:#f0e7d2;--lg-ink-soft:#c9bda0;--lg-edge:rgba(233,214,176,.16);
  position:fixed;inset:0;overflow:hidden;color:var(--lg-ink);font-family:var(--lg-sans);background:#15100a}
.lg-sidebar{position:absolute;z-index:6;left:0;top:0;bottom:0;width:var(--lg-side);
  background:linear-gradient(#171009,#120c06);border-right:1px solid var(--lg-edge);
  display:flex;flex-direction:column;padding:20px 14px;gap:22px}
.lg-brand{display:flex;align-items:center;gap:11px;padding:2px 6px}
.lg-mark{width:36px;height:36px;flex:none;display:grid;place-items:center;border-radius:50%;
  background:radial-gradient(circle at 40% 35%,#3a2c17,#211609);border:1px solid var(--lg-edge);color:var(--lg-gold);font-size:17px}
.lg-wm{font-family:var(--lg-serif);font-size:19px;line-height:1;display:flex;flex-direction:column;gap:3px}
.lg-wm small{font-family:var(--lg-sans);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--lg-ink-soft)}
.lg-navlist{display:flex;flex-direction:column;gap:4px}
.lg-nav{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:11px;color:var(--lg-ink-soft);
  text-decoration:none;font-size:14px;transition:background .15s,color .15s}
.lg-nav:hover{background:rgba(233,214,176,.06);color:var(--lg-ink)}
.lg-nav.active{background:rgba(203,162,76,.14);color:var(--lg-ink)}
.lg-nav-ic{width:20px;height:20px;flex:none}
.lg-nav-ic svg{width:20px;height:20px}
.lg-foot{margin-top:auto;display:flex;align-items:center;gap:11px;padding:11px;border-radius:14px;
  background:rgba(233,214,176,.05);border:1px solid var(--lg-edge)}
.lg-ava{width:34px;height:34px;flex:none;border-radius:50%;display:grid;place-items:center;font-family:var(--lg-serif);
  background:radial-gradient(circle at 35% 30%,#6aa0d8,#37589a);color:#fff;font-size:16px}
.lg-foot-n{font-family:var(--lg-serif);font-size:15px;display:block;line-height:1.1}
.lg-foot-s{font-size:11px;color:var(--lg-gold)}

.lg-main{position:absolute;z-index:1;left:var(--lg-side);right:0;top:0;bottom:0;isolation:isolate}
.lg-main.lg-room{overflow:hidden}
.lg-main.lg-page{overflow-y:auto;background:radial-gradient(ellipse at top right,#FBE3D0 0%,#FBF6EE 55%)}
/* light page content (calendar, etc.) rendered inside the shell */
.lg-page .lg-pagehead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  padding:14px 32px 0;max-width:1100px;margin:0 auto}
.lg-page .lg-pagehead h1{font-family:var(--lg-serif);font-size:30px;color:#3a2c17;margin:0}
/* lift the calendar onto the first fold: trim top whitespace + heading */
.lg-page .topbar-kid{padding:12px 32px 2px!important}
.lg-page .kid-content{padding-top:2px!important}
.lg-page .kid-content > .row{margin-bottom:8px!important}
.lg-page .kid-hello{font-size:29px}
.lg-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 40%;z-index:0;
  filter:brightness(1.12) saturate(1.03)}
.lg-scrim{position:absolute;inset:0;z-index:1;pointer-events:none;
  background:linear-gradient(180deg,rgba(12,8,4,.34) 0%,rgba(12,8,4,.05) 28%,rgba(12,8,4,.05) 56%,rgba(12,8,4,.52) 100%)}
/* Living Lodge — Layer 1: time-of-day wash + fireplace glow */
.lg-tod{position:absolute;inset:0;z-index:2;pointer-events:none;mix-blend-mode:soft-light;transition:background 1.2s ease}
/* soft firelight spilling from the (baked-in) fire — position/size set by JS
   (positionFire) to the stove. Deliberately soft + blurred so it reads as
   dancing light, never a hard disc. */
.lg-fireglow{position:absolute;z-index:2;pointer-events:none;border-radius:50%;
  background:radial-gradient(circle at 50% 50%,rgba(255,160,70,.30),rgba(255,120,40,.08) 45%,rgba(255,120,40,0) 72%);
  mix-blend-mode:screen;filter:blur(14px);animation:lgFlicker 5.5s ease-in-out infinite}
@keyframes lgFlicker{0%,100%{filter:blur(14px) brightness(1)}22%{filter:blur(13px) brightness(.9)}
  48%{filter:blur(16px) brightness(1.12)}72%{filter:blur(14px) brightness(1.03)}}
/* the living-fire + dust canvas */
.lg-fx{position:absolute;inset:0;z-index:2;pointer-events:none}
@media (prefers-reduced-motion:reduce){.lg-fireglow{animation:none;filter:blur(14px)}}

.lg-topbar{position:absolute;z-index:5;top:0;left:0;right:0;padding:26px 34px;display:flex;align-items:flex-start;justify-content:space-between}
.lg-greet h1{font-family:var(--lg-serif);font-weight:500;font-size:clamp(28px,3.4vw,44px);margin:0;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.5)}
.lg-greet p{margin:4px 0 0;font-size:14px;color:var(--lg-ink-soft);text-shadow:0 1px 8px rgba(0,0,0,.5)}

/* Today's plan sitting on the painted board.
   Position + size are set by JS (layoutBoard) to match the painted board;
   all inner sizing is in em so fitBoard() can shrink text to fit any count. */
.lg-board{position:absolute;z-index:3;top:20%;left:1%;width:22%;height:24vh;overflow:hidden;
  cursor:default;text-align:left;background:none;border:0;padding:0;color:#463819;font-size:15px;font-weight:500}
.lg-board h2{font-family:var(--lg-serif);font-size:1.35em;font-weight:700;margin:0 0 .1em;color:#54431f;text-align:center;line-height:1.05}
.lg-rule{height:.4em;margin:0 auto .5em;width:55%;background:no-repeat center/100% 100% url("${RULE_SVG}")}
.lg-prog{height:.42em;border-radius:999px;background:rgba(120,95,55,.22);overflow:hidden;margin:0 0 .6em}
.lg-prog span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#C98A34,#8fd6a6)}
.lg-plan{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.34em}
.lg-step{display:flex;align-items:center;gap:.55em;cursor:pointer;border-radius:.5em;padding:.1em .2em;transition:background .12s}
.lg-step:hover{background:rgba(120,95,55,.1)}
.lg-num{width:1.25em;height:1.25em;flex:none;border-radius:50%;background:rgba(120,95,55,.16);color:#7c5a34;
  font-family:var(--lg-serif);font-size:.78em;display:grid;place-items:center}
.lg-step-t{flex:1;min-width:0;font-family:var(--lg-serif);font-size:1em;font-weight:600;line-height:1.12;color:#463819;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lg-step-due{flex:none;font-size:.68em;color:#9a875f;white-space:nowrap}
.lg-tick{width:1.05em;height:1.05em;flex:none;border-radius:50%;border:.13em solid #c3b088}
.lg-step:hover .lg-tick{border-color:#C98A34;background:rgba(201,138,52,.18)}
.lg-more{list-style:none;text-align:center;font-size:.74em;color:#9a875f;margin-top:.15em;font-style:italic}
.lg-empty{font-family:var(--lg-serif);color:#5b4a2c;text-align:center;padding:.5em 0;display:flex;flex-direction:column;gap:.2em;font-size:1.1em}
.lg-empty span{font-family:var(--lg-sans);font-size:.7em;color:#9a875f}

/* guide cutouts standing in the room */
.lg-figure{position:absolute;z-index:4;height:32vh;border:0;background:none;padding:0;cursor:pointer;
  transition:filter .15s,transform .15s;filter:drop-shadow(0 14px 16px rgba(0,0,0,.55))}
.lg-figure:hover{transform:translateY(-5px);filter:drop-shadow(0 18px 20px rgba(0,0,0,.6)) brightness(1.05)}
.lg-figure:focus-visible{outline:none}
.lg-figimg{height:100%;width:auto;display:block;pointer-events:none;-webkit-user-drag:none}
.lg-figimg.flip{transform:scaleX(-1)}
.lg-figlabel{position:absolute;left:0;right:0;margin-inline:auto;bottom:7%;width:max-content;
  font-family:var(--lg-serif);font-size:13px;color:#fff;background:rgba(20,14,9,.72);border:1px solid var(--lg-edge);
  padding:3px 12px;border-radius:999px;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);pointer-events:none}
.lg-figure:hover .lg-figlabel{background:rgba(20,14,9,.9);border-color:var(--lg-gold)}
/* edit mode (dev) */
.lg-editing .lg-figure{outline:2px dashed rgba(203,162,76,.9);outline-offset:2px;cursor:grab;transition:none}
.lg-editing .lg-figure:hover{transform:none;filter:drop-shadow(0 14px 16px rgba(0,0,0,.55))}
.lg-editing .lg-figure.lg-sel{outline:3px solid var(--lg-gold);z-index:9}
.lg-editing .lg-figure.lg-drag{cursor:grabbing}
.lg-editbar{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:70;display:flex;gap:8px;align-items:center;
  background:rgba(18,12,7,.95);border:1px solid var(--lg-edge);padding:8px 12px;border-radius:12px;color:var(--lg-ink);
  font-size:12.5px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.lg-editbar .hintx{color:var(--lg-ink-soft);max-width:330px}
.lg-editbar .er{min-width:150px;font-family:monospace;color:#f4d99a}
.lg-editbar button{font:inherit;cursor:pointer;border:1px solid var(--lg-edge);background:#2a1f14;color:var(--lg-ink);padding:6px 11px;border-radius:8px}
/* meet-your-guide card */
.lg-guidecard{display:flex;gap:22px;align-items:stretch;max-width:560px}
.lg-guideportrait{flex:0 0 42%;min-height:250px;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;
  border-radius:10px;background:radial-gradient(120% 100% at 50% 12%,rgba(120,95,55,.16),transparent 62%)}
.lg-guideportrait img{height:280px;width:auto;filter:drop-shadow(0 10px 14px rgba(0,0,0,.4))}
.lg-guideinfo{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}
@media (max-width:560px){.lg-guidecard{flex-direction:column}.lg-guideportrait{min-height:200px}.lg-guideportrait img{height:210px}}

/* parchment close-up of a single mission (the step detail) */
.lg-veil{position:fixed;inset:0;z-index:60;background:rgba(10,7,3,.62);display:flex;align-items:center;justify-content:center;
  padding:24px;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
.lg-sheet{position:relative;width:min(520px,94vw);max-height:88vh;overflow:auto;color:#4a3d24;font-family:var(--lg-sans);
  background:radial-gradient(130% 90% at 22% 6%,rgba(255,252,244,.8),transparent 55%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E"),
    linear-gradient(168deg,#F3EAD2,#E4D4B0);
  border:1px solid #cbb98d;border-radius:10px;padding:28px 30px 24px;
  box-shadow:0 34px 64px -22px rgba(10,6,2,.75),inset 0 0 0 1px rgba(255,255,255,.5)}
.lg-sheet::before{content:"";position:absolute;inset:7px;border:1px solid rgba(120,95,55,.28);border-radius:6px;pointer-events:none}
.lg-sheet-eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a07d3e;font-weight:700}
.lg-sheet h2{font-family:var(--lg-serif);font-size:27px;margin:4px 0 2px;color:#4a3822;line-height:1.08}
.lg-sheet-rule{height:6px;width:130px;margin:6px 0 14px;background:no-repeat left/100% 6px url("${RULE_SVG}")}
.lg-sheet p{font-size:14.5px;line-height:1.55;color:#5b4a2c;margin:0 0 12px}
.lg-sheet-sub{font-family:var(--lg-serif);font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#a07d3e;margin:2px 0 6px}
.lg-steps{margin:0 0 14px;padding-left:20px;display:flex;flex-direction:column;gap:7px;font-size:14px;color:#5b4a2c;line-height:1.4}
.lg-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.lg-chip{font-size:12px;background:rgba(120,95,55,.12);color:#6b552f;border:1px solid rgba(120,95,55,.22);padding:4px 11px;border-radius:999px}
.lg-sheet-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.lg-btn{cursor:pointer;border:0;font-family:var(--lg-serif);font-size:16px;padding:11px 22px;border-radius:12px;
  background:linear-gradient(#F0A85A,#D07E2E);color:#2a1a0c;font-weight:600;box-shadow:0 8px 18px -7px rgba(200,110,40,.6)}
.lg-btn:hover{filter:brightness(1.04)}
.lg-btn.ghost{background:none;color:#7c5a34;border:1px solid rgba(120,95,55,.4);box-shadow:none;font-weight:600;font-size:13.5px;padding:9px 15px}
.lg-x{position:absolute;top:12px;right:14px;width:34px;height:34px;border-radius:50%;border:1px solid rgba(120,95,55,.3);
  background:rgba(255,255,255,.4);cursor:pointer;font-size:15px;color:#6b552f;line-height:1;z-index:2}

/* parchment skin for the shared submission modal, scoped to the Lodge's instance */
.lg-skin{background:rgba(10,7,3,.62)!important}
.lg-skin .modal{color:#463819!important;border:1px solid #cbb98d!important;border-radius:12px!important;
  background:radial-gradient(130% 90% at 22% 6%,rgba(255,252,244,.8),transparent 55%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E"),
    linear-gradient(168deg,#F3EAD2,#E4D4B0)!important;
  box-shadow:0 34px 64px -22px rgba(10,6,2,.75),inset 0 0 0 1px rgba(255,255,255,.5)!important;
  /* fit within the viewport: fixed panel, scrolling body, pinned footer */
  max-height:88vh!important;display:flex!important;flex-direction:column!important}
.lg-skin .modal-head{flex:0 0 auto!important;border-bottom:1px solid rgba(120,95,55,.2)!important}
.lg-skin .modal-head h2{font-family:var(--lg-serif)!important;color:#4a3822!important}
.lg-skin .modal-body{flex:1 1 auto!important;overflow-y:auto!important;min-height:0!important}
.lg-skin .modal-foot{flex:0 0 auto!important;border-top:1px solid rgba(120,95,55,.25)!important;
  gap:8px!important;flex-wrap:nowrap!important;background:linear-gradient(rgba(243,234,210,0),#EEE0C0 40%)!important}
.lg-skin .modal-foot .btn{white-space:nowrap!important;flex:0 0 auto!important}
.lg-skin .textarea{max-height:34vh!important;overflow-y:auto!important}
.lg-skin .upload-zone{padding:16px!important}
.lg-skin h3{color:#4a3822!important}
.lg-skin label{color:#5b4a2c!important}
.lg-skin .text-muted{color:#8a7550!important}
.lg-skin .textarea{background:rgba(255,255,255,.55)!important;border:1px solid rgba(120,95,55,.4)!important;color:#463819!important}
.lg-skin .upload-zone{background:rgba(255,255,255,.35)!important;border:1.5px dashed rgba(120,95,55,.45)!important;color:#5b4a2c!important}
.lg-skin .upload-zone-icon{color:#a07d3e!important}
.lg-skin .btn{background:rgba(120,95,55,.12)!important;color:#6b552f!important;border:1px solid rgba(120,95,55,.4)!important}
.lg-skin .btn:hover{background:rgba(120,95,55,.2)!important}
.lg-skin [data-close]{color:#6b552f!important;background:rgba(255,255,255,.4)!important;border:1px solid rgba(120,95,55,.3)!important}
.lg-skin .btn-primary{background:linear-gradient(#F0A85A,#D07E2E)!important;color:#2a1a0c!important;border:0!important;font-family:var(--lg-serif)!important;font-weight:600!important}

@media (max-width:820px){
  .lg-stage{position:relative;min-height:100vh}
  .lg-sidebar{position:sticky;top:0;left:0;width:100%;height:auto;flex-direction:row;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px}
  .lg-navlist{flex-direction:row;flex-wrap:wrap}
  .lg-foot{margin-top:0}
  .lg-main{position:relative;left:0;min-height:78vh}
}
`;
