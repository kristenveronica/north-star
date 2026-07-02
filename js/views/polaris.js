/* ============================================================
   polaris.js — Child-facing AI mentor chat (Phase 1 vertical slice).

   Proves the "one world, many mentors" pattern end-to-end:
   registry persona → mentor-turn edge action → child's real profile →
   a warm, guided conversation. One mentor for now: Polaris (maths).
   See docs/mentor-integration-map.md.
   ============================================================ */

import {
  getChildByCode,
  getOrCreateMentorConversation, addMentorTurn, resetMentorConversation,
} from "../store.js";
import { getMentor } from "../mentors/registry.js";
import {
  renderWhiteboard, speak, stopSpeaking, isMuted, toggleMute,
  speechInputSupported, newRecognition,
} from "../mentors/whiteboard.js";
import { aiMentorTurn } from "../lib/ai.js";
import { esc, toast } from "../components/ui.js";
import { navigate } from "../router.js";

const initials = (name) =>
  (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

// Star mark for Polaris — the guiding star the mentor is named after.
const POLARIS_MARK = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M12 2l1.9 6.6L20 10l-6.1 1.4L12 18l-1.9-6.6L4 10l6.1-1.4z"/>
</svg>`;

export function renderPolaris(container, params) {
  const child = getChildByCode((params.code || "").toUpperCase());
  const mentor = getMentor(params.mentorId || "polaris");

  if (!child) {
    container.innerHTML = `
      <div class="welcome"><div class="welcome-card center">
        <h1>Hmm — that code doesn't work.</h1>
        <p class="text-muted">Double-check the code with the parent in your household.</p>
        <a href="#/kid" class="btn btn-primary mt-2">Try again</a>
      </div></div>`;
    return;
  }

  const convo = getOrCreateMentorConversation(child.id, mentor.id);
  // Seed the opening greeting once so the conversation reads coherently and the
  // model sees its own first line as context. No AI call is spent on open.
  if (!convo.turns.length) {
    addMentorTurn(convo.id, {
      role: "mentor",
      text: mentor.greeting(child),
      suggestions: mentor.starters(child),
    });
  }

  container.innerHTML = `
    <div class="mentor-page accent-${mentor.accent}">
      <div class="mentor-bar">
        <button class="mentor-back" id="m-back" aria-label="Back to your portal">←</button>
        <span class="mentor-mark">${POLARIS_MARK}</span>
        <div class="mentor-id">
          <div class="mentor-name">${esc(mentor.name)}</div>
          <div class="mentor-role">${esc(mentor.role)}</div>
        </div>
        <button class="mentor-mute" id="m-mute" title="Voice on/off" aria-label="Voice on/off">${isMuted() ? "🔇" : "🔊"}</button>
        <button class="mentor-reset" id="m-reset" title="Start over">Start over</button>
      </div>

      <div class="mentor-thread" id="m-thread" aria-live="polite"></div>

      <div class="mentor-chips" id="m-chips"></div>

      <form class="mentor-compose" id="m-form">
        ${speechInputSupported() ? `<button type="button" class="mentor-mic" id="m-mic" aria-label="Talk to ${esc(mentor.name)}" title="Talk to ${esc(mentor.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>
        </button>` : ""}
        <textarea id="m-input" class="mentor-input" rows="1"
          placeholder="Ask ${esc(mentor.name)} anything…" autocomplete="off"></textarea>
        <button type="submit" class="mentor-send" id="m-send" aria-label="Send">Send</button>
      </form>
      <div class="mentor-live-hint" id="m-livehint" hidden></div>
    </div>
  `;

  const threadEl = container.querySelector("#m-thread");
  const chipsEl = container.querySelector("#m-chips");
  const inputEl = container.querySelector("#m-input");
  const sendBtn = container.querySelector("#m-send");
  const formEl = container.querySelector("#m-form");
  const micBtn = container.querySelector("#m-mic");
  const liveHint = container.querySelector("#m-livehint");
  let busy = false;
  let live = false;   // a hands-free voice session is running
  let rec = null;     // the active SpeechRecognition (one utterance at a time)

  const scrollDown = () => { threadEl.scrollTop = threadEl.scrollHeight; };

  // One conversation turn → a row (text bubble + optional animated whiteboard).
  function turnEl(turn) {
    const who = turn.role === "mentor" ? "mentor" : "child";
    const avatar = who === "mentor"
      ? `<span class="mentor-mark sm">${POLARIS_MARK}</span>`
      : `<span class="mentor-childav avatar-${child.avatarIndex}">${initials(child.name)}</span>`;
    const row = document.createElement("div");
    row.className = `mrow mrow--${who}`;
    row.innerHTML = `<div class="mbubble mbubble--${who}">${avatar}<div class="mbubble-text">${esc(turn.text)}</div></div>`;
    if (who === "mentor" && turn.whiteboard) {
      const wb = renderWhiteboard(turn.whiteboard);
      if (wb) row.appendChild(wb);
    }
    return row;
  }

  // Incremental append — only new turns render, so past whiteboards don't re-animate.
  let shown = 0;
  function paintThread() {
    for (; shown < convo.turns.length; shown++) threadEl.appendChild(turnEl(convo.turns[shown]));
    scrollDown();
  }
  function resetThread() { threadEl.innerHTML = ""; shown = 0; paintThread(); }

  function paintChips() {
    const last = convo.turns[convo.turns.length - 1];
    const chips = (last && last.role === "mentor" && Array.isArray(last.suggestions)) ? last.suggestions : [];
    chipsEl.innerHTML = chips.slice(0, 3)
      .map(c => `<button class="mentor-chip" data-chip="${esc(c)}">${esc(c)}</button>`).join("");
    chipsEl.querySelectorAll("[data-chip]").forEach(b =>
      b.addEventListener("click", () => send(b.dataset.chip)));
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "mbubble mbubble--mentor";
    el.id = "m-typing";
    el.innerHTML = `<span class="mentor-mark sm">${POLARIS_MARK}</span>
      <div class="mbubble-text"><span class="mentor-typing"><i></i><i></i><i></i></span></div>`;
    threadEl.appendChild(el);
    scrollDown();
  }
  function clearTyping() { container.querySelector("#m-typing")?.remove(); }

  function setBusy(on) {
    busy = on;
    sendBtn.disabled = on;
    inputEl.disabled = on;
    chipsEl.querySelectorAll("button").forEach(b => (b.disabled = on));
  }

  async function send(text) {
    const message = (text ?? inputEl.value).toString().trim();
    if (!message || busy) return;
    inputEl.value = "";
    autoGrow();

    addMentorTurn(convo.id, { role: "child", text: message });
    paintThread();
    chipsEl.innerHTML = "";
    setBusy(true);
    showTyping();

    // History EXCLUDING the child message we just added (it's sent separately).
    const history = convo.turns
      .slice(0, -1)
      .map(t => ({ role: t.role, text: t.text }));

    try {
      const res = await aiMentorTurn({
        mentor: { id: mentor.id, name: mentor.name, domains: mentor.domains, persona: mentor.persona, pedagogy: mentor.pedagogy },
        child: { name: child.name, age: child.age, passions: child.passions, learningStyle: child.learningStyle },
        history,
        message,
      });
      clearTyping();
      const reply = (res?.reply || "Hmm, let me think about that one differently — can you say a bit more?").trim();
      addMentorTurn(convo.id, {
        role: "mentor",
        text: reply,
        suggestions: Array.isArray(res?.suggestions) ? res.suggestions : [],
        whiteboard: res?.whiteboard || null,
      });
      paintThread();
      paintChips();
      setMic("speaking");
      // Read aloud (allowed: follows the mic/send gesture). In a live session,
      // re-open the mic as soon as Polaris finishes speaking → continuous chat.
      speak(reply, { onend: () => { setMic("idle"); if (live) listen(); } });
    } catch (e) {
      clearTyping();
      toast(e.message || "Polaris couldn't reply just now. Try again in a moment.", { type: "warning" });
      paintChips();
      setMic("idle");
      if (live) listen();
    } finally {
      setBusy(false);
      if (!live) inputEl.focus();
    }
  }

  /* ---- Live voice session (talk ↔ Polaris, hands-free) ---- */
  function setMic(state) {
    if (!micBtn) return;
    micBtn.classList.toggle("live", live);
    micBtn.classList.remove("listening", "thinking", "speaking");
    if (state && state !== "idle") micBtn.classList.add(state);
    if (liveHint) {
      const msg = !live ? "" :
        state === "listening" ? `Listening… speak to ${mentor.name}` :
        state === "thinking" ? `${mentor.name} is thinking…` :
        state === "speaking" ? `${mentor.name} is talking…` : "Tap the mic to talk";
      liveHint.textContent = msg;
      liveHint.hidden = !live;
    }
  }

  function listen() {
    if (!live || busy) return;
    rec = newRecognition();
    if (!rec) { endLive(); return; }
    let finalText = "";
    setMic("listening");
    inputEl.placeholder = "Listening…";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      inputEl.value = (finalText + interim).trim();
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast("Let me hear you — allow microphone access to talk to Polaris.", { type: "warning" });
        endLive();
      }
      // 'no-speech' / 'aborted' fall through to onend
    };
    rec.onend = () => {
      const said = (finalText || inputEl.value).trim();
      inputEl.value = "";
      inputEl.placeholder = `Ask ${mentor.name} anything…`;
      if (!live) { setMic("idle"); return; }
      if (said) { setMic("thinking"); send(said); }
      else { setMic("idle"); } // heard nothing → pause; tap mic to talk again
    };
    try { rec.start(); } catch { /* already running */ }
  }

  function startLive() {
    if (!speechInputSupported()) { toast("Voice chat needs Chrome or Safari.", { type: "warning" }); return; }
    live = true;
    listen();
  }
  function endLive() {
    live = false;
    try { rec?.abort(); } catch { /* ignore */ }
    rec = null;
    stopSpeaking();
    setMic("idle");
    inputEl.placeholder = `Ask ${mentor.name} anything…`;
  }
  function toggleLive() { live ? endLive() : startLive(); }

  function autoGrow() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
  }

  /* wiring */
  container.querySelector("#m-back").addEventListener("click", () => { endLive(); stopSpeaking(); navigate(`/kid/${child.accessCode}`); });
  const muteBtn = container.querySelector("#m-mute");
  muteBtn.addEventListener("click", () => { muteBtn.textContent = toggleMute() ? "🔇" : "🔊"; });
  micBtn?.addEventListener("click", toggleLive);
  container.querySelector("#m-reset").addEventListener("click", () => {
    endLive();
    resetMentorConversation(convo.id);
    addMentorTurn(convo.id, { role: "mentor", text: mentor.greeting(child), suggestions: mentor.starters(child) });
    resetThread(); paintChips();
  });
  formEl.addEventListener("submit", (e) => { e.preventDefault(); send(); });
  inputEl.addEventListener("input", autoGrow);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });

  paintThread();
  paintChips();
  setTimeout(() => inputEl.focus(), 60);
}
