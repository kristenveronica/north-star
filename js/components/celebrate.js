/* ============================================================
   celebrate.js — fan-fare for milestone + project completions.

   - Confetti burst (DOM-based, no canvas)
   - Web Audio chime (3-note synthesised; no audio file)
   - Sound on/off preference persisted in localStorage
   - Bigger sparkle burst centred on a target element
   ============================================================ */

const SOUND_KEY = "northstar::sound";
const COLORS = ["#E8B547", "#C97B4E", "#7FA68A", "#F4E9C5", "#9C7AB5", "#6FA9C4"];

export function isSoundOn() {
  // Default ON. Anything explicitly "off" turns it off.
  return localStorage.getItem(SOUND_KEY) !== "off";
}
export function setSoundOn(on) {
  localStorage.setItem(SOUND_KEY, on ? "on" : "off");
}
export function toggleSound() {
  const next = !isSoundOn();
  setSoundOn(next);
  return next;
}

/* ---------------- Confetti ---------------- */
export function confetti({ count = 80, duration = 2500, originEl = null } = {}) {
  const root = document.createElement("div");
  root.className = "confetti-root";
  document.body.appendChild(root);

  let originX = window.innerWidth / 2;
  let originY = -20;
  if (originEl) {
    const r = originEl.getBoundingClientRect();
    originX = r.left + r.width / 2;
    originY = r.top + r.height / 2;
  }

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 280;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance * 0.6 + Math.random() * 280; // bias downward + drift
    const rot = (Math.random() - 0.5) * 720;
    const dur = duration * (0.7 + Math.random() * 0.5);
    const delay = Math.random() * 120;
    const color = COLORS[i % COLORS.length];
    piece.style.cssText = `
      left:${originX}px; top:${originY}px;
      background:${color};
      --dx:${dx.toFixed(0)}px; --dy:${dy.toFixed(0)}px; --rot:${rot.toFixed(0)}deg;
      animation: confettiFly ${dur}ms ${delay}ms cubic-bezier(.2,.6,.6,1) forwards;
    `;
    root.appendChild(piece);
  }
  setTimeout(() => root.remove(), duration + 600);
}

/* ---------------- Sparkle burst (around an element) ---------------- */
export function sparkleBurst(el, { count = 14 } = {}) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const root = document.createElement("div");
  root.className = "sparkle-root";
  document.body.appendChild(root);
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    s.className = "sparkle-burst";
    s.textContent = "✦";
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 60 + Math.random() * 80;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    s.style.cssText = `
      left:${cx}px; top:${cy}px;
      --dx:${dx.toFixed(0)}px; --dy:${dy.toFixed(0)}px;
      animation-delay: ${(i * 30)}ms;
    `;
    root.appendChild(s);
  }
  setTimeout(() => root.remove(), 1400);
}

/* ---------------- Chime ---------------- */
let _audioCtx = null;
function audioCtx() {
  if (_audioCtx) return _audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  _audioCtx = new AC();
  return _audioCtx;
}

export function playChime() {
  if (!isSoundOn()) return;
  const ctx = audioCtx();
  if (!ctx) return;
  // Resume context if it's been suspended by autoplay policy
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  // 3-note ascending chime: C5, E5, G5
  const notes = [
    { freq: 523.25, when: 0,    dur: 0.55 },
    { freq: 659.25, when: 0.08, dur: 0.55 },
    { freq: 783.99, when: 0.16, dur: 0.7  },
  ];
  notes.forEach(({ freq, when, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain).connect(ctx.destination);
    const t0 = ctx.currentTime + when;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  });
}

export function playBigChime() {
  if (!isSoundOn()) return;
  const ctx = audioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  // Bigger 5-note phrase for project completion
  const notes = [
    { freq: 523.25, when: 0.00, dur: 0.4 },
    { freq: 659.25, when: 0.10, dur: 0.4 },
    { freq: 783.99, when: 0.20, dur: 0.4 },
    { freq: 1046.5, when: 0.30, dur: 0.55 },
    { freq: 1318.5, when: 0.45, dur: 1.0 },
  ];
  notes.forEach(({ freq, when, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain).connect(ctx.destination);
    const t0 = ctx.currentTime + when;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  });
}

/* ---------------- Convenience composite ---------------- */
export function celebrateMilestone(targetEl) {
  confetti({ originEl: targetEl, count: 60 });
  sparkleBurst(targetEl, { count: 12 });
  playChime();
}
export function celebrateProject(targetEl) {
  confetti({ originEl: targetEl, count: 140, duration: 3500 });
  sparkleBurst(targetEl, { count: 22 });
  playBigChime();
}
