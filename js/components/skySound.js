/* ============================================================
   skySound.js — the sound a star makes as it quietly joins the sky.

   ONE tone, played once as an earned light settles into the child's sky.
   Not reward audio. Not applause. Not a game "ding". A single soft glass
   bell with a long, warm decay — a struck singing bowl heard from across a
   quiet room. Whisper-low by design (peak ≈ 0.05 gain).

   Synthesised via WebAudio — no asset, no network. Triggered only by the
   child's own completion gesture, so it always satisfies autoplay policy.
   Respects the family's global sound preference (isSoundOn) and never
   speaks over a hidden tab. Silence is the default posture; this is the
   rare exception the moment earns.
   ============================================================ */

import { isSoundOn } from "./celebrate.js";

let _ctx = null;
function audioCtx() {
  if (_ctx) return _ctx;
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try { _ctx = new AC(); } catch { _ctx = null; }
  return _ctx;
}

// A gentle bell: a fundamental with a fifth and a faint octave shimmer above
// it — consonant and calm, never triumphant. [freq, peakGain, decaySeconds].
const PARTIALS = [
  [880, 0.05, 1.9],   // A5 — the body
  [1320, 0.028, 1.7], // E6 — the open fifth
  [1760, 0.014, 1.4], // A6 — a breath of shimmer
];

/** Play the settle tone once. No-ops if sound is off, unsupported, or hidden. */
export function playSettleTone() {
  if (!isSoundOn()) return;
  if (typeof document !== "undefined" && document.hidden) return;
  const ctx = audioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") { try { ctx.resume(); } catch { /* ignore */ } }

  const now = ctx.currentTime;
  // Soften the top end so the bell reads warm, not glassy-sharp.
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 5200;
  filter.Q.value = 0.3;
  filter.connect(ctx.destination);

  PARTIALS.forEach(([freq, peak, decay], i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.detune.value = i === 0 ? 0 : (i === 1 ? 4 : -4); // faint chorus warmth
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.018);   // soft strike, no click
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay); // long, still decay
    osc.connect(gain).connect(filter);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  });
}
