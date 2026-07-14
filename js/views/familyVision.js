/* ============================================================
   familyVision.js — The Family North Star page.
   Two states:
     • Guided (not yet complete): a calm, ordered sequence —
       Identity + Relationship Map → Deeper Vision → Desired
       Outcomes → Motto / Mission / Core Word.
     • Compass (saved): a clean "family constitution" — blue hero
       summary + collapsed accordions you can expand to edit.
   Right-side preview reflects Core Word + meanings + motto + mission.
   ============================================================ */

import { getState, setFamily } from "../store.js";
import { esc, toast, nsIcon } from "../components/ui.js";
import { rerender } from "../app.js";
import { aiSuggestCoreWord, aiSuggestVision, aiTidyText } from "../lib/ai.js";
import { accSection, accToolbar, wireAccordion } from "../components/accordion.js";

// The six "Deeper Vision" questions (new set).
export const VISION_QS = [
  { id: "adultsHoping", label: "What kind of adults are you hoping to raise? How would you hope others describe them when they are 25?",
    ph: "e.g. Curious. Capable. Generous. Courageous. Self-led. Kind and grounded. Compassionate." },
  { id: "values", label: "What are the 6–8 values that matter most to your family?",
    ph: "e.g. Integrity, kindness, courage, freedom, responsibility, generosity and humility." },
  { id: "successLooksLike", label: "What does educational success look like for your family?",
    ph: "e.g. A love of learning. Confidence. Independence. Real-world capability. Strong relationships." },
  { id: "capableByEighteen", label: "What capabilities do you hope your child or children have by age 18?",
    ph: "e.g. Reading, writing, financial literacy, entrepreneurship, communication, problem solving and practical life skills." },
  { id: "selfAndOthers", label: "How do you hope your child or children feel about themselves and treat others as adults?",
    ph: "e.g. Confident without arrogance. Compassionate. Curious. Responsible." },
  { id: "experiences", label: "What do you want your child or children to spend more time experiencing during childhood?",
    ph: "e.g. Nature, books, creativity, travel, sports and adventure." },
];

/* Tap-to-add sparks for each Deeper Vision question. The "e.g." placeholders
   vanish the moment a parent starts typing — these stay, giving a wide,
   evocative palette for anyone who finds it hard to put words to what they
   value. Kept relevant to each question so a tap always makes sense in place. */
export const VISION_CHIPS = {
  adultsHoping: ["Curious", "Kind", "Resilient", "Confident", "Generous", "Hardworking",
    "Independent", "Compassionate", "Courageous", "Honest", "Creative", "Grounded", "Wise", "Joyful"],
  values: ["Integrity", "Kindness", "Courage", "Faith", "Generosity", "Responsibility",
    "Humility", "Respect", "Honesty", "Perseverance", "Gratitude", "Freedom", "Curiosity", "Service"],
  successLooksLike: ["A love of learning", "Confidence", "Independence", "Strong relationships",
    "Real-world capability", "Resilience", "Good character", "Joy in the everyday",
    "Financial wisdom", "Knowing who they are", "Contributing to others", "Following their curiosity"],
  capableByEighteen: ["Financial literacy", "Entrepreneurship", "Clear communication", "Problem-solving",
    "Cooking & home skills", "Reading widely", "Writing well", "Critical thinking",
    "A trade or craft", "Digital skills", "Public speaking", "Managing money", "Practical life skills", "Leadership"],
  selfAndOthers: ["Confident, not arrogant", "Compassionate", "Respectful", "Secure in who they are",
    "Empathetic", "Generous", "Honest", "Calm under pressure", "Welcoming to others",
    "Quick to forgive", "A good listener", "Standing up for others"],
  experiences: ["Nature", "Books", "Travel", "Creativity", "Sport", "Adventure", "Real work",
    "Community & service", "Music", "Building & making", "Time with family", "Quiet & rest",
    "Faith & wonder", "Different cultures"],
};

/* Render + wire a row of tap-to-add "spark" chips beneath a textarea.
   Appends the chip text to the field (comma-separated), fires an input event so
   autosize / autosave / previews all update, then dims the used chip. Generic —
   reused by the guided onboarding and the Family North Star editor. */
export function attachPromptChips(textareaEl, chips) {
  if (!textareaEl || !chips || !chips.length) return;
  const wrap = document.createElement("div");
  wrap.className = "prompt-chips";
  // Collapsed by default behind a "Need a spark?" dropdown, so the page stays
  // calm; the caption + chips reveal together when it's opened.
  wrap.innerHTML = `
    <button type="button" class="prompt-chips__toggle" aria-expanded="false">
      <span class="prompt-chips__chev" aria-hidden="true">&rsaquo;</span>
      <span>Need a spark?</span>
    </button>
    <div class="prompt-chips__panel" hidden>
      <div class="prompt-chips__cap">Tap any that fit — then make them yours:</div>
      <div class="prompt-chips__row">
        ${chips.map(c => `<button type="button" class="prompt-chip" data-chip="${esc(c)}">${esc(c)}</button>`).join("")}
      </div>
    </div>`;
  textareaEl.insertAdjacentElement("afterend", wrap);
  const toggle = wrap.querySelector(".prompt-chips__toggle");
  const panel = wrap.querySelector(".prompt-chips__panel");
  toggle.addEventListener("click", () => {
    const opening = panel.hasAttribute("hidden");
    if (opening) panel.removeAttribute("hidden"); else panel.setAttribute("hidden", "");
    toggle.setAttribute("aria-expanded", String(opening));
    toggle.classList.toggle("is-open", opening);
  });
  wrap.querySelectorAll("[data-chip]").forEach(b => b.addEventListener("click", () => {
    if (b.classList.contains("is-used")) return;
    const cur = textareaEl.value.replace(/\s*$/, "");
    textareaEl.value = (cur ? cur.replace(/,\s*$/, "") + ", " : "") + b.dataset.chip;
    b.classList.add("is-used");
    textareaEl.dispatchEvent(new Event("input", { bubbles: true }));
    textareaEl.focus();
  }));
}

export function renderFamilyVision(container) {
  const fam = getState().family || {};
  const complete = !!(fam.coreWord && fam.mission);

  // Working copies (mutated by the dynamic bits, committed on Save).
  let coreWord = (fam.coreWord || "").toUpperCase().slice(0, 12);
  let acronym = (fam.acronym || []).map(a => ({ ...a }));

  const v = (id) => esc(fam.vision?.[id] || "");

  // -- Section bodies ---------------------------------------------------------
  const identityBody = `
    <div class="grid grid-2">
      <div class="field"><label>Parent name</label><input class="input" id="parentName" value="${esc(fam.parentName || "")}"/></div>
      <div class="field"><label>Family name</label><input class="input" id="familyName" value="${esc(fam.familyName || "")}"/></div>
    </div>`;

  const visionBody = `
    <p class="ns-acc__intro">These answers become the foundation for your family's learning journey.</p>
    ${VISION_QS.map(q => `
      <div class="field">
        <label>${esc(q.label)}</label>
        <textarea class="textarea" id="${q.id}" rows="2" data-voice data-voice-label="Speak your answer" placeholder="${esc(q.ph)}">${v(q.id)}</textarea>
      </div>`).join("")}`;

  const mmcBody = `
    <p class="ns-acc__intro" style="font-family:var(--font-serif);font-size:18px;font-style:italic;color:var(--text);border-left:2px solid var(--primary);padding-left:15px;margin:0 0 18px;max-width:46ch;line-height:1.4">If you don't intentionally instill your family's values in your children, the world will gladly do it for them.</p>
    <p class="ns-acc__intro" style="margin-bottom:8px">Most of us first met mission, vision and values at work — rarely at home. Yet the world's most enduring families share one thing: a clear set of values, deeply embedded in their children, that becomes a compass for life — clarity about who you are as a family, who each child is, and how you move through the world. This section is where you define that language and begin weaving it through their learning journey.</p>
    <p class="ns-acc__intro" style="font-style:italic;margin-bottom:10px">Big visions are remembered through small words — and small phrases, repeated often, become identity.</p>
    <p class="ns-acc__intro" style="margin-bottom:28px">North Star can suggest these from your answers. Edit anything.</p>

    <div class="field">
      <label>Family Vision</label>
      <p class="ns-acc__intro" style="margin:4px 0 10px">The "why" behind your family's learning journey — who you are becoming together. It doesn't have to sound polished or formal — it simply captures what this education is designed to produce, and becomes a compass when hard decisions arise.</p>
      <textarea class="textarea" id="mission" rows="2" data-voice data-voice-label="Speak your family vision" placeholder="e.g. We are raising capable, thoughtful young people who love learning, solve problems and contribute wherever they go.">${esc(fam.mission || "")}</textarea>
      <p class="ns-acc__intro" style="margin:8px 0 0;font-size:12.5px">Write from identity — "We are…", "We believe…", "We cultivate…" — rather than "We want our children to…".</p>
      <div class="row mt-1" style="gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-suggest" id="suggest-mission" type="button">✨ Suggest Family Vision</button>
        <button class="btn btn-suggest hidden" id="regen-mission" type="button">Suggest Alternative</button>
        <span class="small text-muted" id="mission-status"></span>
      </div>
    </div>

    <div class="field" style="margin-top:30px">
      <label>Core Word</label>
      <p class="ns-acc__intro" style="margin:4px 0 10px">An acronym that gathers several of your family's values and character traits into one memorable, inspiring word — and the word itself is often a meaningful trait too. Children remember the word, and the quality each letter stands for.</p>
      <input class="input" id="coreWord" maxlength="12" style="max-width:240px;text-transform:uppercase" value="${esc(coreWord)}" placeholder="e.g. LIGHT"/>
      <div class="row mt-1" style="gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-suggest" id="suggest-word" type="button">✨ Suggest Core Word</button>
        <button class="btn btn-suggest hidden" id="regen-word" type="button">Suggest Alternative</button>
        <span class="small text-muted" id="word-status"></span>
      </div>
      <div id="acronymRows" class="stack mt-2"></div>
    </div>

    <div class="field" style="margin-top:30px">
      <label>Family Credo</label>
      <p class="ns-acc__intro" style="margin:4px 0 10px">A short phrase related to your children's learning journey that they can remember, repeat and grow up with. Children rarely remember lectures — they remember simple sayings woven into everyday conversation.</p>
      <input class="input" id="motto" value="${esc(fam.motto || "")}" placeholder="e.g. Love learning. Grow always. Leave the world better."/>
      <div class="row mt-1" style="gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-suggest" id="suggest-motto" type="button">✨ Suggest Family Credo</button>
        <button class="btn btn-suggest hidden" id="regen-motto" type="button">Suggest Alternative</button>
        <span class="small text-muted" id="motto-status"></span>
      </div>
    </div>

    <p class="ns-acc__intro" style="margin:30px 0 0;padding-top:18px;border-top:1px solid var(--divider);font-style:italic">The language children grow up with often becomes the voice they carry into adulthood.</p>`;

  // -- Page shell -------------------------------------------------------------
  const hero = complete ? `
    <div class="card mb-3" style="background:linear-gradient(135deg, var(--midnight-deep), var(--midnight));color:var(--starlight);border-color:transparent;padding:28px 32px">
      <div class="row" style="gap:18px;align-items:flex-start;flex-wrap:wrap">
        <span class="ns-icon-wrap" style="background:rgba(244,233,197,0.12);color:var(--starlight);border-color:rgba(244,233,197,0.25)">${nsIcon("compass", { size: 24 })}</span>
        <div style="flex:1;min-width:260px">
          <div class="t-eyebrow" style="color:var(--starlight);opacity:0.7">Your family's lens</div>
          <h2 class="t-headline" style="color:var(--starlight);margin:6px 0 8px">${esc(fam.coreWord || "")}${fam.motto ? ` · <span style="opacity:0.85;font-size:18px">${esc(fam.motto)}</span>` : ""}</h2>
          <p class="t-body" style="margin:0;color:var(--starlight);opacity:0.85;max-width:620px">${esc(fam.mission || "")}</p>
        </div>
      </div>
    </div>` : `
    <div class="card mb-3" style="background:var(--card-elev)">
      <h3 style="margin:0 0 4px">Let's set your family's North Star.</h3>
      <p class="text-muted small" style="margin:0">Pour a cup of tea. This is one of the most important conversations you'll have about your children's future — the destination everything else is shaped around. There are no wrong answers, and you can change anything later.</p>
    </div>`;

  // Collapsible sections — same calm visual language as Learning Resources.
  // All load closed; opening one gently closes the others.
  const PAGE = "vision";
  const SECTIONS = [
    { id: "identity", icon: "🏡", title: "Family Identity", blurb: "Your family's name and the parent guiding the journey.", body: identityBody },
    { id: "vision", icon: "🌅", title: "Deeper Vision", blurb: "Six reflections that become the foundation of everything North Star builds.", body: visionBody },
    { id: "mmc", icon: "🧭", title: "Vision, Core Word & Credo", blurb: "Your family's vision, an acronym Core Word, and a credo to grow up with.", body: mmcBody },
  ];

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Family North Star</h1>
        <div class="sub">The "why" behind everything North Star helps you build with your children.</div>
      </div>
    </div>

    ${hero}

    <div class="grid" style="grid-template-columns: 2fr 1fr; gap:18px">
      <div>
        ${accToolbar(PAGE)}
        <div class="stack">
          ${SECTIONS.map(sec => accSection(PAGE, sec, sec.body, { cls: "lt-acc--form" })).join("")}
        </div>
        <div class="row" style="justify-content:flex-end;align-items:center;gap:14px;margin-top:28px">
          <span class="small text-muted" id="autosave-status" aria-live="polite"></span>
          <button class="btn btn-primary btn-lg" id="save">${complete ? "Save changes" : "Save our North Star"}</button>
        </div>
      </div>

      <div class="card" style="align-self:start;height:fit-content;padding:26px 24px">
        <div class="t-eyebrow" style="margin-bottom:18px">Your family compass</div>
        <div id="preview"></div>
      </div>
    </div>
  `;


  /* ---------- Core word acronym + preview ---------- */
  const wordInput = container.querySelector("#coreWord");
  const acronymHost = container.querySelector("#acronymRows");

  const syncAcronymFromWord = () => {
    const word = coreWord;
    acronym = word.split("").map((L, i) => ({
      letter: L,
      meaning: acronym[i]?.letter === L ? (acronym[i].meaning || "") : (acronym[i]?.meaning || ""),
    }));
  };
  const renderAcronym = () => {
    acronymHost.innerHTML = acronym.map((r, i) => `
      <div class="row" style="gap:10px;align-items:center">
        <div class="brand-mark" style="width:36px;height:36px;font-size:18px">${esc(r.letter)}</div>
        <input class="input" data-ai="${i}" placeholder="${esc(r.letter)}…" value="${esc(r.meaning)}" style="flex:1"/>
        <button class="btn btn-sm" data-regen-letter="${i}" type="button" title="Suggest a meaning for ${esc(r.letter)}">↻</button>
      </div>`).join("");
    acronymHost.querySelectorAll("[data-ai]").forEach(inp => {
      inp.addEventListener("input", () => { acronym[+inp.dataset.ai].meaning = inp.value; paintPreview(); });
    });
    acronymHost.querySelectorAll("[data-regen-letter]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const i = +btn.dataset.regenLetter;
        btn.disabled = true; btn.textContent = "…";
        try {
          const out = await aiSuggestVision("letter", gatherVision(), { ...gatherCtx(), letter: acronym[i].letter });
          if (out?.value) { acronym[i].meaning = out.value; renderAcronym(); paintPreview(); }
        } catch (e) { toast(e.message || "Couldn't suggest just now", { type: "error" }); }
        finally { btn.disabled = false; btn.textContent = "↻"; }
      });
    });
    paintPreview();
  };

  const paintPreview = () => {
    const motto = container.querySelector("#motto").value.trim();
    const mission = container.querySelector("#mission").value.trim();
    container.querySelector("#preview").innerHTML = `
      <div class="t-eyebrow">Core word</div>
      <div style="font-family:var(--font-serif);font-size:46px;font-weight:600;color:var(--primary-ink);line-height:1.02;margin-top:4px">${esc(coreWord) || "—"}</div>
      <div class="stack" style="gap:11px;margin-top:20px">
        ${acronym.map(r => `<div class="row" style="gap:12px;align-items:center"><span style="display:grid;place-items:center;width:28px;height:28px;border-radius:7px;background:var(--primary);color:var(--starlight);font-family:var(--font-serif);font-weight:700;font-size:15px;flex-shrink:0;box-shadow:var(--shadow-sm)">${esc(r.letter)}</span><span class="t-body-sm" style="color:var(--text)">${esc(r.meaning || "…")}</span></div>`).join("")}
      </div>
      ${mission ? `<div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--divider)"><div class="t-eyebrow">Vision</div><div class="t-body-sm" style="margin-top:8px;max-width:32ch;overflow-wrap:anywhere">${esc(mission)}</div></div>` : ""}
      ${motto ? `<div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--divider)"><div class="t-eyebrow">Credo</div><div class="t-subhead" style="font-style:italic;margin-top:8px;line-height:1.45;overflow-wrap:anywhere">${esc(motto)}</div></div>` : ""}
    `;
  };

  wordInput.addEventListener("input", () => {
    coreWord = wordInput.value.toUpperCase().slice(0, 12);
    wordInput.value = coreWord;
    syncAcronymFromWord();
    renderAcronym();
  });
  container.querySelector("#motto").addEventListener("input", paintPreview);
  container.querySelector("#mission").addEventListener("input", paintPreview);
  syncAcronymFromWord();
  renderAcronym();

  /* ---------- Suggestion helpers ---------- */
  const gatherVision = () => {
    const out = {};
    VISION_QS.forEach(q => { const el = container.querySelector("#" + q.id); if (el) out[q.id] = el.value.trim(); });
    return out;
  };
  const gatherCtx = () => ({
    familyName: container.querySelector("#familyName").value.trim() || fam.familyName,
    coreWord,
    motto: container.querySelector("#motto").value.trim(),
  });
  const busy = (btn, status, msg) => { btn.disabled = true; if (status) status.textContent = msg; };
  const done = (btn, label) => { btn.disabled = false; btn.textContent = label; };

  // Family Vision + Family Credo (generic text suggest)
  const wireText = (kind, suggestId, regenId, statusId, fieldId) => {
    const sBtn = container.querySelector(suggestId);
    const rBtn = container.querySelector(regenId);
    const status = container.querySelector(statusId);
    const field = container.querySelector(fieldId);
    const run = async (btn) => {
      busy(btn, status, "North Star is shaping a suggestion…");
      const label = btn.textContent; btn.textContent = "Thinking…";
      try {
        const out = await aiSuggestVision(kind, gatherVision(), gatherCtx());
        if (out?.value) {
          field.value = out.value;
          status.textContent = "Suggested based on your answers — edit anything.";
          rBtn.classList.remove("hidden");
          paintPreview();
        } else status.textContent = "Couldn't shape one — add a little more above.";
      } catch (e) { status.textContent = e.message || "Couldn't suggest just now."; }
      finally { btn.disabled = false; btn.textContent = label; }
    };
    sBtn.addEventListener("click", () => run(sBtn));
    rBtn.addEventListener("click", () => run(rBtn));
  };
  wireText("motto", "#suggest-motto", "#regen-motto", "#motto-status", "#motto");
  wireText("mission", "#suggest-mission", "#regen-mission", "#mission-status", "#mission");

  // Core Word (reuses suggest-core-word; fills word + all letters)
  const cwBtn = container.querySelector("#suggest-word");
  const cwRegen = container.querySelector("#regen-word");
  const cwStatus = container.querySelector("#word-status");
  const runCoreWord = async (btn) => {
    busy(btn, cwStatus, "North Star is shaping a few from your vision…");
    const label = btn.textContent; btn.textContent = "Thinking…";
    try {
      const res = await aiSuggestCoreWord(gatherVision(), coreWord);
      const s = (res?.suggestions || [])[0];
      if (s?.coreWord) {
        coreWord = s.coreWord.toUpperCase().slice(0, 12);
        acronym = (s.acronym || []).map(a => ({ letter: (a.letter || "").toUpperCase(), meaning: a.meaning || "" }));
        wordInput.value = coreWord;
        renderAcronym();
        cwStatus.textContent = `Suggested "${coreWord}" — edit any letter, or regenerate.`;
        cwRegen.classList.remove("hidden");
      } else cwStatus.textContent = "Add a little more above, then try again.";
    } catch (e) { cwStatus.textContent = e.message || "Couldn't suggest just now."; }
    finally { btn.disabled = false; btn.textContent = label; }
  };
  cwBtn.addEventListener("click", () => runCoreWord(cwBtn));
  cwRegen.addEventListener("click", () => runCoreWord(cwRegen));

  /* ---------- Persistence: everything the family typed, as a family patch ----------
     (Family Members & Support People now live in Family Settings, not here.) */
  const gatherAll = () => {
    return {
      parentName: container.querySelector("#parentName").value.trim(),
      familyName: container.querySelector("#familyName").value.trim(),
      vision: { ...(fam.vision || {}), ...gatherVision() },
      motto: container.querySelector("#motto").value.trim(),
      mission: container.querySelector("#mission").value.trim(),
      coreWord,
      acronym: acronym.map(r => ({ letter: r.letter, meaning: (r.meaning || "").trim() })),
    };
  };

  /* ---------- Auto-save: a safety net so nothing typed is ever lost ----------
     Debounced write-behind on every edit. setFamily() persists to localStorage
     (and schedules cloud sync) without re-rendering, so typing is never
     interrupted. The Save button remains as an explicit, reassuring commit. */
  const autosaveStatus = container.querySelector("#autosave-status");
  let autosaveTimer;
  const autosave = () => {
    clearTimeout(autosaveTimer);
    if (autosaveStatus) autosaveStatus.textContent = "Saving…";
    autosaveTimer = setTimeout(() => {
      setFamily(gatherAll());
      if (autosaveStatus) autosaveStatus.textContent = "✓ All changes saved automatically";
    }, 700);
  };
  // Any edit to any field in the page (typing, selects, checkboxes) triggers it.
  container.addEventListener("input", autosave);
  container.addEventListener("change", autosave);

  /* ---------- Save (explicit commit → reflect the finished compass) ---------- */
  const saveBtn = container.querySelector("#save");
  saveBtn.addEventListener("click", () => {
    clearTimeout(autosaveTimer);
    setFamily(gatherAll());
    if (autosaveStatus) autosaveStatus.textContent = "";
    saveBtn.textContent = "✓ Saved";
    saveBtn.disabled = true;
    setTimeout(() => { rerender(); }, 2000);
  });

  /* ---------- Collapsible sections (calm, one-at-a-time) ---------- */
  wireAccordion(container, PAGE);

  /* ---------- Auto-size textareas (page scrolls, never the box) + gentle tidy ---------- */
  container.querySelectorAll(".lt-acc__body textarea").forEach(autosize);
  // Tidy formatting on the deeper-vision answers when the parent moves on, and
  // give each a palette of tap-to-add sparks for anyone short on words.
  VISION_QS.forEach(q => {
    const el = container.querySelector("#" + q.id);
    attachPromptChips(el, VISION_CHIPS[q.id]);
    attachTidy(el);
  });
}

/** Grow a textarea to fit its content, but never below a sensible minimum (so
    empty fields and their multi-line "e.g." placeholders stay fully visible),
    up to `maxHeight` — then scroll inside the box. Re-fits when its accordion
    opens so reopened fields size correctly too. */
export function autosize(el, maxHeight = 320) {
  if (!el) return;
  el.style.resize = "none";
  const rows = parseInt(el.getAttribute("rows"), 10);
  // ~26px per line + padding; floor of ~2.5 lines so placeholders aren't clipped.
  const minHeight = (rows && rows > 1) ? rows * 26 + 16 : 68;
  const fit = () => {
    el.style.height = "auto";
    const content = el.scrollHeight;            // 0 while hidden
    const h = content ? Math.max(minHeight, content) : minHeight;
    el.style.height = Math.min(h, maxHeight) + "px";
    el.style.overflowY = h > maxHeight ? "auto" : "hidden";
  };
  el.addEventListener("input", fit);
  el.closest("details")?.addEventListener("toggle", () => requestAnimationFrame(fit));
  // Refit when the textarea's collapsible section opens (so it sizes correctly
  // the first time it becomes visible).
  el.closest(".lt-acc")?.addEventListener("acc:open", () => requestAnimationFrame(fit));
  requestAnimationFrame(fit);
}

/** On blur, ask North Star to tidy ONLY the formatting (never the meaning). Graceful + non-intrusive. */
export function attachTidy(el, onTidied) {
  if (!el) return;
  el.addEventListener("blur", async () => {
    const original = el.value.trim();
    if (!original || el.dataset.tidied === original) return;
    try {
      const out = await aiTidyText(original);
      const tidy = (out?.value || "").trim();
      // Only apply if it actually improved and the parent hasn't edited since.
      if (tidy && tidy !== original && el.value.trim() === original) {
        el.value = tidy;
        el.dataset.tidied = tidy;
        el.dispatchEvent(new Event("input"));   // re-fit height + refresh preview
        onTidied && onTidied(tidy);
      } else {
        el.dataset.tidied = original;
      }
    } catch { /* leave exactly as the parent typed it */ }
  });
}
