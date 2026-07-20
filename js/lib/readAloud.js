/* ============================================================
   readAloud.js — gentle "Read to me" for children who don't yet read.

   A thin wrapper over the browser's built-in SpeechSynthesis. Reads an
   ordered list of chunks (title, story, each step) one at a time and calls
   back as each begins, so the UI can highlight the line being spoken. No
   network, no dependency, no cost. Silent no-op where unsupported.
   ============================================================ */

export function speechAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

let _active = false;

export function isSpeaking() { return _active; }

/** Speak `chunks` ([{ id, text }]) in order.
 *  onChunk(id) fires as each begins; onDone() when the last finishes or it's
 *  stopped. Cancels anything already speaking first. */
export function speak(chunks, { onChunk, onDone, rate = 0.95, pitch = 1 } = {}) {
  if (!speechAvailable()) { onDone?.(); return; }
  stopSpeaking();
  const list = (chunks || []).filter((c) => c && c.text && c.text.trim());
  if (!list.length) { onDone?.(); return; }
  _active = true;

  let i = 0;
  const next = () => {
    if (!_active) return;                 // stopped
    if (i >= list.length) { _active = false; onDone?.(); return; }
    const chunk = list[i++];
    const u = new SpeechSynthesisUtterance(chunk.text);
    u.rate = rate; u.pitch = pitch;
    u.onstart = () => { if (_active) onChunk?.(chunk.id); };
    u.onend = () => { if (_active) next(); };
    u.onerror = () => { if (_active) next(); };
    window.speechSynthesis.speak(u);
  };
  next();
}

export function stopSpeaking() {
  _active = false;
  if (speechAvailable()) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
}
