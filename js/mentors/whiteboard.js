/* ============================================================
   whiteboard.js — Polaris's visual whiteboard + voice (Phase-1 prototype).

   The mentor-turn AI action returns an optional structured "whiteboard" spec
   (fraction / numberline / array / groups). This module renders it as an
   animated SVG so a stuck child can SEE the maths, and speaks the reply aloud
   with the browser's built-in text-to-speech. No external services — the
   picture is drawn deterministically from the spec (always correct), and TTS
   is free + instant. A later layer can swap in a premium voice / avatar.
   ============================================================ */

const GOLD = "#E8B547";
const NAVY = "#2A3954";
const INK = "#2A221C";
const LIGHT = "#F3E7C9";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
const escText = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- SVG builders ---------- */

function fractionCircle(parts, shaded) {
  const cx = 110, cy = 110, r = 92, step = (Math.PI * 2) / parts;
  let out = "";
  for (let i = 0; i < parts; i++) {
    const a0 = -Math.PI / 2 + i * step, a1 = a0 + step;
    const x0 = (cx + r * Math.cos(a0)).toFixed(1), y0 = (cy + r * Math.sin(a0)).toFixed(1);
    const x1 = (cx + r * Math.cos(a1)).toFixed(1), y1 = (cy + r * Math.sin(a1)).toFixed(1);
    const large = step > Math.PI ? 1 : 0;
    const d = `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`;
    out += `<path d="${d}" fill="${i < shaded ? GOLD : LIGHT}" stroke="#fff" stroke-width="2" class="wb-pop" style="animation-delay:${(i * 0.12).toFixed(2)}s"/>`;
  }
  return `<svg viewBox="0 0 220 220" role="img" aria-hidden="true">${out}</svg>`;
}

function fractionBar(parts, shaded) {
  const W = 300, H = 66, x0 = 10, y0 = 12, w = W / parts;
  let out = "";
  for (let i = 0; i < parts; i++) {
    out += `<rect x="${(x0 + i * w).toFixed(1)}" y="${y0}" width="${(w - 3).toFixed(1)}" height="${H}" rx="4" fill="${i < shaded ? GOLD : LIGHT}" stroke="#fff" stroke-width="2" class="wb-pop" style="animation-delay:${(i * 0.1).toFixed(2)}s"/>`;
  }
  return `<svg viewBox="0 0 320 92">${out}</svg>`;
}

function numberLine(from, to, jumps) {
  let a = Math.round(from || 0), b = Math.round(to || 0);
  if (b < a) [a, b] = [b, a];
  if (b - a > 20) b = a + 20;
  const span = Math.max(1, b - a), x0 = 22, x1 = 298, y = 78;
  const X = (n) => x0 + (x1 - x0) * ((n - a) / span);
  let out = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${NAVY}" stroke-width="2"/>`;
  for (let n = a; n <= b; n++) {
    out += `<line x1="${X(n).toFixed(1)}" y1="${y - 5}" x2="${X(n).toFixed(1)}" y2="${y + 5}" stroke="${NAVY}" stroke-width="2"/>`;
    out += `<text x="${X(n).toFixed(1)}" y="${y + 22}" text-anchor="middle" font-size="12" fill="${INK}">${n}</text>`;
  }
  (jumps || []).forEach((j, idx) => {
    const xa = X(j.start), xb = X(j.end), mx = (xa + xb) / 2;
    const h = Math.min(46, 20 + Math.abs(xb - xa) * 0.3);
    out += `<path d="M${xa.toFixed(1)},${y} Q${mx.toFixed(1)},${(y - h * 2).toFixed(1)} ${xb.toFixed(1)},${y}" fill="none" stroke="${GOLD}" stroke-width="3" class="wb-pop" style="animation-delay:${(idx * 0.32).toFixed(2)}s"/>`;
    out += `<text x="${mx.toFixed(1)}" y="${(y - h * 1.5).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="600" fill="${INK}" class="wb-pop" style="animation-delay:${(idx * 0.32 + 0.1).toFixed(2)}s">${escText(j.label || "")}</text>`;
  });
  return `<svg viewBox="0 0 320 108">${out}</svg>`;
}

function arrayGrid(rows, cols) {
  rows = clamp(rows, 1, 10); cols = clamp(cols, 1, 10);
  const gap = 26, rad = 9, x0 = 18, y0 = 16;
  let out = "";
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const idx = r * cols + c;
    out += `<circle cx="${x0 + c * gap}" cy="${y0 + r * gap}" r="${rad}" fill="${GOLD}" class="wb-pop" style="animation-delay:${(idx * 0.05).toFixed(2)}s"/>`;
  }
  return `<svg viewBox="0 0 ${x0 * 2 + (cols - 1) * gap} ${y0 * 2 + (rows - 1) * gap}">${out}</svg>`;
}

function groupsView(groups, perGroup) {
  groups = clamp(groups, 1, 6); perGroup = clamp(perGroup, 1, 12);
  const box = 92, cols = Math.min(groups, 3), rows = Math.ceil(groups / cols);
  const pc = Math.ceil(Math.sqrt(perGroup));
  let out = "", idx = 0;
  for (let g = 0; g < groups; g++) {
    const gx = 12 + (g % cols) * box, gy = 12 + Math.floor(g / cols) * box;
    out += `<rect x="${gx}" y="${gy}" width="${box - 16}" height="${box - 16}" rx="12" fill="none" stroke="${NAVY}" stroke-width="2" opacity="0.45"/>`;
    for (let k = 0; k < perGroup; k++) {
      const px = gx + 16 + (k % pc) * 18, py = gy + 16 + Math.floor(k / pc) * 18;
      out += `<circle cx="${px}" cy="${py}" r="7" fill="${GOLD}" class="wb-pop" style="animation-delay:${(idx * 0.06).toFixed(2)}s"/>`;
      idx++;
    }
  }
  return `<svg viewBox="0 0 ${12 + cols * box} ${12 + rows * box}">${out}</svg>`;
}

/** Build an animated whiteboard element from a spec, or null if none. */
export function renderWhiteboard(wb) {
  if (!wb || !wb.type || wb.type === "none") return null;
  let svg = "";
  if (wb.type === "fraction") {
    const parts = clamp(wb.parts, 1, 12), shaded = clamp(wb.shaded, 0, parts);
    svg = wb.shape === "bar" ? fractionBar(parts, shaded) : fractionCircle(parts, shaded);
  } else if (wb.type === "numberline") {
    svg = numberLine(wb.from, wb.to, wb.jumps);
  } else if (wb.type === "array") {
    svg = arrayGrid(wb.rows, wb.cols);
  } else if (wb.type === "groups") {
    svg = groupsView(wb.groups, wb.perGroup);
  } else {
    return null;
  }
  const el = document.createElement("div");
  el.className = "mentor-wb";
  el.innerHTML =
    `<div class="mentor-wb-canvas">${svg}</div>` +
    (wb.caption ? `<div class="mentor-wb-cap">${escText(wb.caption)}</div>` : "");
  return el;
}

/* ---------- Voice (browser TTS) ---------- */

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
let _muted = (typeof localStorage !== "undefined" && localStorage.getItem("polaris-muted") === "1");

export function isMuted() { return _muted; }
export function toggleMute() {
  _muted = !_muted;
  try { localStorage.setItem("polaris-muted", _muted ? "1" : "0"); } catch { /* ignore */ }
  if (_muted) synth?.cancel();
  return _muted;
}
export function stopSpeaking() { synth?.cancel(); }

function pickVoice() {
  const voices = synth?.getVoices?.() || [];
  if (!voices.length) return null;
  const pref = ["Samantha", "Google UK English Female", "Google US English", "Karen", "Moira", "Female"];
  for (const name of pref) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return voices.find((v) => /^en(-|_)/i.test(v.lang)) || voices[0];
}

// Make maths read naturally aloud, and drop emoji/markdown noise.
function forSpeech(text) {
  return String(text || "")
    .replace(/\*/g, "")
    .replace(/(\d)\s*\/\s*(\d)/g, "$1 out of $2")
    .replace(/×/g, " times ")
    .replace(/÷/g, " divided by ")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .trim();
}

/** Speak a mentor reply aloud (no-op when muted or unsupported). */
export function speak(text) {
  if (_muted || !synth || !text) return;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(forSpeech(text));
    u.rate = 0.98; u.pitch = 1.12;
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; }
    synth.speak(u);
  } catch { /* ignore */ }
}
