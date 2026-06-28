/* ============================================================
   platformDiscovery.js — "Platform Discovery Framework" ghost page.

   An unlinked public page (#/discover) we send to potential white-label
   clients. They answer a guided set of questions — one window (accordion
   section) per header — with large, dictation-enabled, scrollable text
   boxes. Sections unfold sequentially as each is completed. Everything
   auto-saves to localStorage (resume in stages), and they can download a
   .txt of all answers to take into a strategy chat.

   No auth / no backend — this is a public, browser-local form.
   ============================================================ */

import { esc, toast } from "../components/ui.js";
import { autosize } from "./familyVision.js";
import { logoLockup } from "../components/logo.js";

const STORE_KEY = "northstar::discovery";

// One entry per header in The Platform Discovery Framework. `questions` are
// shown as a guiding list above a single large answer box for the section.
const SECTIONS = [
  { id: "org", title: "Organisation Overview", intro: "Start here — tell us about your organisation.",
    questions: ["Who are you?", "What does your organisation do?", "What industry are you in?", "How long have you existed?", "How many customers or members do you currently serve?", "What does success currently look like?", "What problem are you solving?", "What transformation do you ultimately provide?"] },
  { id: "users", title: "Who Are Your Users?", intro: "Tell us about the people who will use this platform.",
    questions: ["Who are they?", "Age?", "Demographics?", "Technical confidence?", "Income?", "Education?", "Motivation?", "Pain points?", "What keeps them awake at night?", "What are they trying to achieve?", "Why do they buy from you?", "What do they value?"] },
  { id: "northstar", title: "What Is Their North Star?", intro: "This becomes the equivalent of the Family North Star — the destination your customers are reaching for.",
    questions: ["What destination are you helping your customers reach?", "If they completed your program perfectly — who would they become?", "How would their life change?", "What capabilities would they possess?", "How would they feel?", "How would someone else describe them?", "What identity transformation occurs?", "What values are most important?"] },
  { id: "personalisation", title: "Personalisation Inputs", intro: "What information should we gather before building someone's personalised journey? (The examples below are prompts — add anything relevant.)",
    questions: ["Goals", "Current experience", "Strengths", "Weaknesses", "Learning preferences", "Personality", "Budget", "Available time", "Values", "Beliefs", "Interests", "Health", "Lifestyle", "Anything unique?"] },
  { id: "framework", title: "The Framework", intro: "This is one of the biggest sections — how your method actually works.",
    questions: ["What framework do you currently use?", "How do you teach it?", "What stages exist?", "Milestones?", "Modules?", "Lessons?", "Projects?", "Challenges?", "Assessments?", "What order do they happen in?", "What absolutely cannot change?", "Where is flexibility allowed?"] },
  { id: "content", title: "Content", intro: "What kinds of content exist (or should exist)?",
    questions: ["Video?", "PDF?", "Audio?", "Books?", "Courses?", "Live events?", "Downloads?", "Templates?", "Checklists?", "Coaching?", "Community?", "External links?", "Resources?"] },
  { id: "ai", title: "AI", intro: "Where should AI help — and where should it NOT intervene?",
    questions: ["Personalised plans", "Summaries", "Recommendations", "Projects", "Feedback", "Role-playing", "Simulations", "Reports", "Assessments", "Progress reviews", "Celebrations", "Accountability", "Where should AI NOT intervene?"] },
  { id: "community", title: "Community", intro: "Is there a community? If so, how should members interact?",
    questions: ["Should members meet?", "Chat?", "Collaborate?", "Compete?", "Mentor?", "Teach?", "Create together?", "Rate projects?", "Find accountability partners?", "Local groups?", "Events?", "Leaderboards?"] },
  { id: "business", title: "Business Model", intro: "How will the platform make money?",
    questions: ["Subscriptions?", "Courses?", "Licensing?", "One-off purchase?", "Membership?", "Corporate?", "Schools?", "White label?", "Consultants?", "Agencies?", "Churches?", "Franchises?", "What does pricing look like?"] },
  { id: "brand", title: "Brand", intro: "This is often forgotten. How should the platform feel? (Three words.)",
    questions: ["Three words for how it should feel (e.g. Premium, Elegant, Playful, Scientific, Grounded, Luxurious, Friendly, Warm, Minimal, Modern, Professional, Inspirational)", "What emotions should users experience?", "What should they NEVER experience?"] },
  { id: "voice", title: "Brand Voice", intro: "How do you communicate?",
    questions: ["Formal?", "Conversational?", "Teacher?", "Coach?", "Guide?", "Mentor?", "Friend?", "Expert?"] },
  { id: "visual", title: "Visual Style", intro: "How should the platform look?",
    questions: ["Colours?", "Typography?", "Photography?", "Illustrations?", "Minimal?", "Bold?", "Organic?", "Luxury?"] },
  { id: "metrics", title: "Success Metrics", intro: "How will you know the platform is succeeding?",
    questions: ["Completion?", "Retention?", "Revenue?", "Behaviour change?", "Confidence?", "Income?", "Relationships?", "Health?", "Engagement?"] },
  { id: "future", title: "Future", intro: "If there were no technical limitations — dream big.",
    questions: ["What would this platform become over the next 10 years?"] },
];

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null") || {}; }
  catch { return {}; }
}
function persist(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() })); }
  catch { /* private mode / quota */ }
}
const num = (i) => String(i + 1).padStart(2, "0");
const firstIncomplete = (answers) => {
  const idx = SECTIONS.findIndex(s => !(answers[s.id] || "").trim());
  return idx === -1 ? 0 : idx;
};

export function renderPlatformDiscovery(main) {
  const saved = load();
  const answers = { ...(saved.answers || {}) };
  let openIdx = Number.isInteger(saved.openIdx) ? saved.openIdx : firstIncomplete(answers);

  const panel = (sec, i) => {
    const done = !!(answers[sec.id] || "").trim();
    const open = i === openIdx;
    const isLast = i === SECTIONS.length - 1;
    return `
      <section class="disc-section ${open ? "is-open" : ""} ${done ? "is-done" : ""}" data-sec="${i}">
        <button class="disc-head" data-head="${i}" type="button">
          <span class="disc-num">${num(i)}</span>
          <span class="disc-title">${esc(sec.title)}</span>
          <span class="disc-state" data-state="${i}">${done ? "✓" : ""}</span>
          <span class="disc-chev">⌄</span>
        </button>
        <div class="disc-body">
          ${sec.intro ? `<p class="disc-intro">${esc(sec.intro)}</p>` : ""}
          <ul class="disc-qs">${sec.questions.map(q => `<li>${esc(q)}</li>`).join("")}</ul>
          <textarea class="disc-textarea" id="ans-${sec.id}" data-sec-input="${i}"
            data-voice data-voice-label="Speak your answer"
            placeholder="Type your answer here, or tap the microphone to speak it.">${esc(answers[sec.id] || "")}</textarea>
          <div class="disc-actions">
            ${isLast
              ? `<button class="btn btn-primary btn-lg" data-finish type="button">Finish &amp; download my answers ↓</button>`
              : `<button class="btn btn-primary" data-continue="${i}" type="button">Save &amp; continue →</button>`}
          </div>
        </div>
      </section>`;
  };

  main.innerHTML = `
    <div class="disc-page">
      <div class="disc-wrap">
        <div class="disc-brand">${logoLockup({ size: 48, variant: "dark", href: null, showTagline: false })}</div>

        <div class="disc-hero">
          <div class="disc-eyebrow">Platform Discovery</div>
          <h1 class="disc-h1">Tell us about your business.</h1>
          <div class="disc-lede">
            <p>A few guided questions about your organisation, your people and your vision — so we can understand your world and explore whether North Star is the right foundation to build on for you.</p>
            <p>Answer in your own words. You can <strong>type, or tap the microphone and speak</strong> — say "new line", "new paragraph" or "period" to punctuate as you go.</p>
            <p>Your progress saves automatically, so you can leave and come back anytime.</p>
            <p>When you're done, download your answers to share with us.</p>
          </div>
        </div>

        <div class="disc-stack">
          ${SECTIONS.map(panel).join("")}
        </div>

        <div class="disc-bar">
          <span class="disc-saved small text-muted" id="disc-saved" aria-live="polite"></span>
          <div class="row" style="gap:10px">
            <button class="btn" id="disc-download" type="button">Download answers (.txt)</button>
            <button class="btn btn-primary" id="disc-save" type="button">Save</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const stack = main.querySelector(".disc-stack");
  const savedEl = main.querySelector("#disc-saved");

  const state = () => ({ answers, openIdx });
  let saveT;
  const autosave = (label = "✓ Saved automatically") => {
    clearTimeout(saveT);
    if (savedEl) savedEl.textContent = "Saving…";
    saveT = setTimeout(() => { persist(state()); if (savedEl) savedEl.textContent = label; }, 600);
  };

  const fit = (i) => {
    const ta = main.querySelector(`[data-sec-input="${i}"]`);
    if (ta) ta.dispatchEvent(new Event("input", { bubbles: false }));
  };
  const setOpen = (i) => {
    openIdx = i;
    stack.querySelectorAll(".disc-section").forEach((el, idx) => el.classList.toggle("is-open", idx === i));
    if (i >= 0) {
      fit(i); // recompute height now that the box is visible
      const sec = stack.querySelector(`[data-sec="${i}"]`);
      sec?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    autosave();
  };
  // Headers: toggle open (accordion — one open at a time). All sections are
  // freely openable; later ones simply start folded up for a clean first view.
  stack.querySelectorAll("[data-head]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = +btn.dataset.head;
      setOpen(openIdx === i ? -1 : i);
    });
  });

  // Answer boxes: live capture + auto-save + done tick.
  stack.querySelectorAll("[data-sec-input]").forEach(ta => {
    const i = +ta.dataset.secInput;
    const sec = SECTIONS[i];
    autosize(ta, 360);
    ta.addEventListener("input", () => {
      answers[sec.id] = ta.value;
      const st = main.querySelector(`[data-state="${i}"]`);
      if (st) st.textContent = ta.value.trim() ? "✓" : "";
      autosave();
    });
  });

  // Save & continue → open the next section.
  stack.querySelectorAll("[data-continue]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = +btn.dataset.continue;
      persist(state());
      setOpen(i + 1);
    });
  });

  main.querySelector("#disc-save").addEventListener("click", () => {
    clearTimeout(saveT);
    persist(state());
    if (savedEl) savedEl.textContent = "✓ Saved";
    toast("Saved — you can close this and come back anytime.", { type: "success" });
  });

  main.querySelector("#disc-download").addEventListener("click", () => downloadAnswers(answers));
  main.querySelector("[data-finish]")?.addEventListener("click", () => {
    persist(state());
    downloadAnswers(answers);
    toast("Downloaded. Thank you — send this file over and we'll shape a plan.", { type: "success", duration: 4000 });
  });

  // Make sure the initially-open section is sized correctly.
  if (openIdx >= 0) requestAnimationFrame(() => fit(openIdx));
}

/* Build + download a readable .txt of every section's guiding questions + answer. */
function downloadAnswers(answers) {
  const lines = [
    "NORTH STAR — PLATFORM DISCOVERY",
    `Generated: ${new Date().toLocaleString()}`,
    "",
  ];
  SECTIONS.forEach((s, i) => {
    lines.push(`${num(i)}. ${s.title.toUpperCase()}`);
    if (s.intro) lines.push(s.intro);
    lines.push("Guiding questions:");
    s.questions.forEach(q => lines.push(`  - ${q}`));
    lines.push("");
    lines.push("Answer:");
    lines.push((answers[s.id] || "").trim() || "(not answered yet)");
    lines.push("");
    lines.push("────────────────────────────────────────");
    lines.push("");
  });
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "platform-discovery.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
