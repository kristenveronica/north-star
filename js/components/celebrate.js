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

/* ============================================================
   Sound — "cha-ching" coin pickup style.

   Layered synthesis (no audio files) that gives a bright,
   slightly metallic ring with a short percussive attack and a
   short ringing decay. Tasteful, not arcade-y.

   Architecture per note:
     1. A short high-passed noise burst → the percussive "cha"
     2. Two triangle waves an octave apart, slightly detuned → the body
     3. A sine harmonic on top → the metallic "ching" shimmer
     All routed through a master gain so the overall mix sits well.
   ============================================================ */

let _audioCtx = null;
function audioCtx() {
  if (_audioCtx) return _audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  _audioCtx = new AC();
  return _audioCtx;
}

/** A single bright coin "ching" tone at `freq` Hz, starting at `when`. */
function coinTone(ctx, master, freq, when, { vol = 1, dur = 0.45, percussive = true } = {}) {
  // 1) Percussive attack — short high-passed noise burst (only on the first hit
  //    of a phrase by default, so a chord doesn't sound like a snare drum).
  if (percussive) {
    const noiseLen = 0.035;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * noiseLen), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 3500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18 * vol, when);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + noiseLen);
    noise.connect(hp).connect(ng).connect(master);
    noise.start(when);
    noise.stop(when + noiseLen + 0.02);
  }

  // 2) Triangle body — main tone + slight detune for richness
  const layers = [
    { type: "triangle", freq: freq,         detune: -4, gain: 0.18 * vol, decay: dur     },
    { type: "triangle", freq: freq,         detune: +4, gain: 0.16 * vol, decay: dur     },
    // 3) Sine octave shimmer (the "ching" ring)
    { type: "sine",     freq: freq * 2,     detune: 0,  gain: 0.10 * vol, decay: dur * 1.2 },
    // 4) A very quiet sine two octaves up — adds airy sparkle without being shrill
    { type: "sine",     freq: freq * 3.01,  detune: 0,  gain: 0.04 * vol, decay: dur * 1.4 },
  ];
  layers.forEach(({ type, freq, detune, gain, decay }) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const g = ctx.createGain();
    osc.connect(g).connect(master);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.004);   // sharp attack
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.start(when);
    osc.stop(when + decay + 0.03);
  });
}

/** Standard "cha-ching" — two ascending notes, the second one ringing longer. */
export function playChime() {
  if (!isSoundOn()) return;
  const ctx = audioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  // Master gain + a touch of low-shelf cut so it doesn't feel boomy on laptop speakers.
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const ls = ctx.createBiquadFilter();
  ls.type = "lowshelf"; ls.frequency.value = 350; ls.gain.value = -6;
  master.connect(ls).connect(ctx.destination);

  // Classic "cha-ching" cadence: B5 → E6.
  // Bright and rewarding, but the second note lingers (the "ching") so it
  // doesn't feel like a videogame "ping-ping".
  const t = ctx.currentTime + 0.005;
  coinTone(ctx, master, 987.77,  t,        { vol: 1.0, dur: 0.35, percussive: true  }); // B5  — "cha"
  coinTone(ctx, master, 1318.51, t + 0.07, { vol: 1.0, dur: 0.70, percussive: false }); // E6  — "ching"
}

/** Bigger version — used when a child finishes the LAST milestone of a project. */
export function playBigChime() {
  if (!isSoundOn()) return;
  const ctx = audioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const master = ctx.createGain();
  master.gain.value = 0.85;
  const ls = ctx.createBiquadFilter();
  ls.type = "lowshelf"; ls.frequency.value = 350; ls.gain.value = -6;
  master.connect(ls).connect(ctx.destination);

  // Triumphant cha-ching: arpeggio up to a sustained shimmering top note.
  // B5 → E6 → G#6 → B6 (held). Major-feeling, satisfying, finished.
  const t = ctx.currentTime + 0.005;
  coinTone(ctx, master, 987.77,  t,        { vol: 1.0, dur: 0.28, percussive: true  }); // B5
  coinTone(ctx, master, 1318.51, t + 0.08, { vol: 1.0, dur: 0.30, percussive: false }); // E6
  coinTone(ctx, master, 1661.22, t + 0.18, { vol: 1.0, dur: 0.35, percussive: false }); // G#6
  coinTone(ctx, master, 1975.53, t + 0.30, { vol: 1.1, dur: 1.10, percussive: false }); // B6 (held shimmer)
  // A soft sub-octave hit below the arpeggio for body — feels like a coin
  // landing on something solid rather than hovering in mid-air.
  coinTone(ctx, master, 329.63,  t + 0.02, { vol: 0.55, dur: 0.45, percussive: false }); // E4
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
