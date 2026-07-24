/* ============================================================
   voice.js — "Read to me" narration.

   Prefers a warm AI voice (OpenAI gpt-4o-mini-tts via the child-portal
   edge function), falling back to the browser's built-in speechSynthesis
   only if the AI voice is unavailable. Plays an ordered list of chunks
   ([{ id, text }]) and calls back as each begins, so the mission page can
   highlight the line being read.
   ============================================================ */

import { speak as browserSpeak, stopSpeaking as browserStop, speechAvailable } from "./readAloud.js";
import { fetchTts } from "./childPortalCloud.js";

let _audio = null;
let _active = false;

export function stopVoice() {
  _active = false;
  if (_audio) { try { _audio.pause(); } catch { /* ignore */ } _audio.src = ""; _audio = null; }
  browserStop();
}

/** Read `chunks` aloud. `code` = the child's access code (authorises the AI
 *  voice). Callbacks: onChunk(id) as each begins, onDone() at the end,
 *  onLoading(bool) around the initial fetch. Always resolves; never throws. */
export async function readAloudSmart(code, chunks, { onChunk, onDone, onLoading } = {}) {
  stopVoice();
  _active = true;
  const list = (chunks || []).filter((c) => c && c.text && c.text.trim());
  if (!list.length) { onDone?.(); return; }

  onLoading?.(true);
  let items = null;
  try { items = code ? await fetchTts(code, list) : null; } catch { items = null; }
  onLoading?.(false);
  if (!_active) return;                       // stopped during the fetch

  const byId = new Map((items || []).map((i) => [i.id, i && i.audio]));
  const haveAudio = list.some((c) => byId.get(c.id));
  if (!haveAudio) {                           // AI voice unavailable → browser voice
    browserSpeak(list, { onChunk, onDone });
    return;
  }

  let i = 0;
  const next = () => {
    if (!_active) return;
    if (i >= list.length) { _active = false; onDone?.(); return; }
    const chunk = list[i++];
    const audio = byId.get(chunk.id);
    if (!audio) { next(); return; }           // a chunk failed — skip it
    onChunk?.(chunk.id);
    _audio = new Audio("data:audio/mpeg;base64," + audio);
    _audio.onended = () => { if (_active) next(); };
    _audio.onerror = () => { if (_active) next(); };
    _audio.play().catch(() => { if (_active) next(); });
  };
  next();
}

export { speechAvailable };
