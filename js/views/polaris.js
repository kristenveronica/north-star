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
        <button class="mentor-reset" id="m-reset" title="Start over">Start over</button>
      </div>

      <div class="mentor-thread" id="m-thread" aria-live="polite"></div>

      <div class="mentor-chips" id="m-chips"></div>

      <form class="mentor-compose" id="m-form">
        <textarea id="m-input" class="mentor-input" rows="1"
          placeholder="Ask ${esc(mentor.name)} anything…" autocomplete="off"></textarea>
        <button type="submit" class="mentor-send" id="m-send" aria-label="Send">Send</button>
      </form>
    </div>
  `;

  const threadEl = container.querySelector("#m-thread");
  const chipsEl = container.querySelector("#m-chips");
  const inputEl = container.querySelector("#m-input");
  const sendBtn = container.querySelector("#m-send");
  const formEl = container.querySelector("#m-form");
  let busy = false;

  const scrollDown = () => { threadEl.scrollTop = threadEl.scrollHeight; };

  function bubble(turn) {
    const who = turn.role === "mentor" ? "mentor" : "child";
    const avatar = turn.role === "mentor"
      ? `<span class="mentor-mark sm">${POLARIS_MARK}</span>`
      : `<span class="mentor-childav avatar-${child.avatarIndex}">${initials(child.name)}</span>`;
    return `<div class="mbubble mbubble--${who}">${avatar}<div class="mbubble-text">${esc(turn.text)}</div></div>`;
  }

  function paintThread() {
    threadEl.innerHTML = convo.turns.map(bubble).join("");
    scrollDown();
  }

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
      addMentorTurn(convo.id, {
        role: "mentor",
        text: (res?.reply || "Hmm, let me think about that one differently — can you say a bit more?").trim(),
        suggestions: Array.isArray(res?.suggestions) ? res.suggestions : [],
      });
      paintThread();
      paintChips();
    } catch (e) {
      clearTyping();
      toast(e.message || "Polaris couldn't reply just now. Try again in a moment.", { type: "warning" });
      paintChips();
    } finally {
      setBusy(false);
      inputEl.focus();
    }
  }

  function autoGrow() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
  }

  /* wiring */
  container.querySelector("#m-back").addEventListener("click", () => navigate(`/kid/${child.accessCode}`));
  container.querySelector("#m-reset").addEventListener("click", () => {
    resetMentorConversation(convo.id);
    addMentorTurn(convo.id, { role: "mentor", text: mentor.greeting(child), suggestions: mentor.starters(child) });
    paintThread(); paintChips();
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
