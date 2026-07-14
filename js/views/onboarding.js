/* ============================================================
   onboarding.js — First-run guided sequence (Full Setup).

   Mirrors the Parent Portal exactly, so nothing drifts:
     1. Family & People      (identity + the shared Family Members section)
     2. Home Location        (shared)
     3. Deeper Vision        (the six reflections)
     4. Vision, Core Word & Credo
     5. Travel / Worldschool (shared)
     6. Faith Integration    (shared)
     7. Family Rhythm        (shared)
     8. Done

   The practical-context steps (location, people, travel, faith, rhythm)
   reuse the SAME section builders as /family-settings via familySections.js —
   edit a field once and both surfaces update.
   ============================================================ */

import { getState, update, setFamily, uid } from "../store.js";
import { DOMAIN_CATALOG } from "../seed.js";
import { navigate } from "../router.js";
import { esc, toast } from "../components/ui.js";
import { aiSuggestCoreWord, aiSuggestVision } from "../lib/ai.js";
import { VISION_QS, VISION_CHIPS, attachPromptChips, autosize, attachTidy } from "./familyVision.js";
import {
  makeFamilyState, gatherFamilyPatch,
  locationSection, relationshipsSection, travelSection, faithSection, rhythmSection,
} from "./familySections.js";
import { saveDraft, loadDraft, clearDraft } from "../lib/drafts.js";
import { setOnboardingParked } from "../lib/repo.js";
import { logoStacked } from "../components/logo.js";

const STEPS = ["welcome", "location", "vision", "core-word", "travel", "faith", "rhythm", "done"];
// Steps whose fields belong to the shared family-context sections (autosave to the family record).
const SECTION_STEPS = new Set(["welcome", "location", "travel", "faith", "rhythm"]);

let _step = 0;
let _chose = false;   // has the family picked Quick Start vs Full Setup yet?
let _fst = null;      // shared family-context working state (loc/rel/travel/faith/rhythm)
let _draft = {
  parentName: "",
  familyName: "",
  adultsHoping: "", values: "", successLooksLike: "",
  capableByEighteen: "", selfAndOthers: "", experiences: "",
  mission: "", motto: "",
  coreWord: "",
  acronym: [],
};

/* ---------- Draft auto-save (identity + vision + core word) ----------
   The practical sections persist straight to the family record; this draft
   only covers the vision/identity fields + which step you're on, so a long
   sitting can be resumed with nothing lost. */
const ONBOARDING_DRAFT = "onboarding";
function persistDraft() { saveDraft(ONBOARDING_DRAFT, { step: _step, draft: _draft }); }
function dropDraft() { clearDraft(ONBOARDING_DRAFT); }
function captureDraft(card) {
  const g = (id) => card.querySelector("#" + id);
  const text = (id, key) => { const el = g(id); if (el) _draft[key] = el.value; };
  text("parentName", "parentName");
  text("familyName", "familyName");
  VISION_QS.forEach(q => { const el = g(q.id); if (el) _draft[q.id] = el.value; });
  text("mission", "mission");
  text("motto", "motto");
  const cw = g("coreWord"); if (cw) _draft.coreWord = cw.value.toUpperCase().slice(0, 12);
  persistDraft();
}

/* Persist the shared family-context sections to the family record (debounced). */
function persistSections() {
  if (_fst) setFamily(gatherFamilyPatch(_fst));
}
function ensureFamilyRecord() {
  // A stable family id must exist before people can be invited from Step 1.
  update(s => { s.family = s.family || {}; if (!s.family.id) s.family.id = uid("fam"); });
}
const sectionCtx = () => ({
  onChange: persistSections,
  commit: persistSections,
  children: getState().children || [],
  fam: getState().family || {},
});

export function renderOnboarding(container) {
  const fam = getState().family;
  if (fam) {
    _draft = {
      ..._draft,
      parentName: fam.parentName || "",
      familyName: fam.familyName || "",
      ...(fam.vision || {}),
      mission: fam.mission || "",
      motto: fam.motto || "",
      coreWord: fam.coreWord || "",
      acronym: fam.acronym || [],
    };
  }
  // Shared working copies for location / people / travel / faith / rhythm.
  _fst = makeFamilyState(getState().family || {});

  // Restore this account's in-progress draft (takes precedence) and resume the step.
  const saved = loadDraft(ONBOARDING_DRAFT);
  if (saved && saved.draft && typeof saved.draft === "object") {
    _draft = { ..._draft, ...saved.draft };
    if (typeof saved.step === "number" && saved.step >= 0 && saved.step < STEPS.length - 1) _step = saved.step;
  }
  // Resuming mid-way through Full Setup → they've already chosen; skip the fork.
  if (_step > 0) { _chose = true; ensureFamilyRecord(); }

  container.innerHTML = `
    <div class="welcome welcome--branded">
      <div class="onb-shell">
        <div class="onb-brand">${logoStacked({ size: 48, variant: "light" })}</div>
        <div class="welcome-card" id="welcome-card"></div>
      </div>
    </div>`;
  paint(container.querySelector("#welcome-card"));
}

/* ---------- Step 0: choose your on-ramp (Quick Start vs Full Setup) ---------- */
function renderChooser(card) {
  card.innerHTML = `
    <div class="center"><div class="qs-mark" style="font-size:34px">✦</div></div>
    <h1 style="text-align:center;margin-bottom:24px">How would you like to begin?</h1>
    <div class="onb-choose">
      <button type="button" class="onb-door" data-quick>
        <div class="onb-door__ico">✦</div>
        <div class="onb-door__t">Quick Start</div>
        <div class="onb-door__time">about 5 minutes</div>
        <p class="onb-door__d">Answer three quick questions — or just talk — and we'll generate your child's first project on the spot. Deepen everything later.</p>
        <span class="onb-door__cta">Start →</span>
      </button>
      <button type="button" class="onb-door" data-full>
        <div class="onb-door__ico">🌱</div>
        <div class="onb-door__t">Full Setup</div>
        <div class="onb-door__time">45 minutes to an hour</div>
        <p class="onb-door__d">Invest an hour now to multiply the return — for your children and your family — for years to come. Go deep on your vision, values and Core Word, and build out each child's profile; the more you pour in, the more North Star can shape a journey that's unmistakably theirs.</p>
        <span class="onb-door__cta">Begin →</span>
      </button>
    </div>`;
  card.querySelector("[data-quick]").addEventListener("click", () => navigate("/start"));
  card.querySelector("[data-full]").addEventListener("click", () => { ensureFamilyRecord(); _chose = true; paint(card); });
}

const visionForCtx = () => ({
  adultsHoping: _draft.adultsHoping, values: _draft.values,
  successLooksLike: _draft.successLooksLike, capableByEighteen: _draft.capableByEighteen,
  selfAndOthers: _draft.selfAndOthers, experiences: _draft.experiences,
});
const familyForCtx = () => ({ familyName: _draft.familyName, coreWord: _draft.coreWord, motto: _draft.motto });

function paint(card) {
  // First-run fork: choose Quick Start vs Full Setup before anything else.
  if (_step === 0 && !_chose) { renderChooser(card); return; }
  const step = STEPS[_step];
  // Bind persistence listeners once; the card element persists across steps.
  if (!card._draftBound) {
    card.addEventListener("input", () => captureDraft(card));
    card.addEventListener("change", () => captureDraft(card));
    let secTimer;
    const dp = () => { clearTimeout(secTimer); secTimer = setTimeout(() => { if (SECTION_STEPS.has(STEPS[_step])) persistSections(); }, 500); };
    card.addEventListener("input", dp);
    card.addEventListener("change", dp);
    card._draftBound = true;
  }
  if (step === "done") dropDraft(); else persistDraft();
  // Every step opens at the TOP — never half-way down the previous step's scroll.
  requestAnimationFrame(() => window.scrollTo(0, 0));
  const indicator = `
    <div class="step-indicator">
      ${STEPS.map((_, i) => `<div class="dot ${i < _step ? "done" : i === _step ? "active" : ""}"></div>`).join("")}
    </div>`;

  /* Shared helper: render one of the practical-context sections as a full step. */
  const renderSectionStep = (section, { eyebrow, title, lede }) => {
    card.innerHTML = `
      ${indicator}
      <button class="btn btn-ghost btn-sm onb-tochooser" id="back" type="button">← Back</button>
      <div class="t-eyebrow" style="margin-top:4px">${esc(eyebrow)}</div>
      <h1 style="margin-top:4px">${esc(title)}</h1>
      ${lede ? `<p class="lede">${esc(lede)}</p>` : ""}
      <div class="onb-section">${section.body(_fst, { fam: getState().family || {} })}</div>
      <div class="row-between mt-3">
        <span class="text-muted small">Step ${_step + 1} of ${STEPS.length}</span>
        <button class="btn btn-primary btn-lg" id="next">Continue →</button>
      </div>`;
    section.wire(card, _fst, sectionCtx());
    card.querySelectorAll(".onb-section textarea").forEach(el => autosize(el, 220));
    card.querySelector("#back").addEventListener("click", () => { persistSections(); _step--; paint(card); });
    card.querySelector("#next").addEventListener("click", () => { persistSections(); _step++; paint(card); });
  };

  /* ---------- Step 1: Family Identity + People ---------- */
  if (step === "welcome") {
    card.innerHTML = `
      ${indicator}
      <button class="btn btn-ghost btn-sm onb-tochooser" id="to-chooser" type="button">← Back to options</button>
      <h1>Welcome to your family's North Star.</h1>
      <p class="lede">This isn't a planner. The time you invest here is what North Star multiplies — the more it understands, the more it can shape every project, reward and milestone around your real family. Let's clarify the destination for your children's learning and growth, starting with who's in their world.</p>
      <div class="field">
        <label>Your name</label>
        <input class="input" id="parentName" value="${esc(_draft.parentName)}" placeholder="e.g. Kristen" />
      </div>
      <div class="field">
        <label>Family name</label>
        <input class="input" id="familyName" value="${esc(_draft.familyName)}" placeholder="e.g. The Veronica Family" />
      </div>
      <div class="card mt-2" style="background:var(--card-elev)">
        <h4 style="margin:0 0 10px">Family members & support people</h4>
        <div class="onb-section">${relationshipsSection.body()}</div>
      </div>
      <div class="row-between mt-3">
        <span class="text-muted small">Step 1 of ${STEPS.length}</span>
        <button class="btn btn-primary btn-lg" id="next">Continue →</button>
      </div>
      <div class="center mt-2">
        <button class="btn btn-ghost btn-sm" id="park" type="button">I'll set this up later — take me to my dashboard →</button>
        <p class="text-muted small" style="margin:6px 0 0">Anything you've typed is saved. You can pick up right here whenever you're ready.</p>
      </div>
    `;
    relationshipsSection.wire(card, _fst, sectionCtx());
    // Keep the family record's name current (so invites read the right family name).
    const persistIdentity = () => setFamily({
      parentName: card.querySelector("#parentName").value.trim(),
      familyName: card.querySelector("#familyName").value.trim(),
    });
    card.querySelector("#parentName").addEventListener("input", persistIdentity);
    card.querySelector("#familyName").addEventListener("input", persistIdentity);
    // Return to the Quick Start vs Full Setup fork (nothing typed is lost — the draft persists).
    card.querySelector("#to-chooser").addEventListener("click", () => {
      captureDraft(card); persistSections();
      _chose = false; _step = 0; paint(card);
    });
    card.querySelector("#next").addEventListener("click", () => {
      _draft.parentName = card.querySelector("#parentName").value.trim();
      _draft.familyName = card.querySelector("#familyName").value.trim();
      if (!_draft.familyName) { toast("Give your family a name to begin", { type: "warning" }); return; }
      persistSections(); _step++; paint(card);
    });
    card.querySelector("#park").addEventListener("click", () => {
      captureDraft(card); persistSections();
      setOnboardingParked(true);
      toast("No rush — your setup is saved. Finish it anytime from your dashboard.", { type: "success", duration: 3500 });
      navigate("/");
    });
  }

  /* ---------- Step 2: Home Location ---------- */
  if (step === "location") {
    renderSectionStep(locationSection, {
      eyebrow: "Your world",
      title: "Where's home?",
      lede: "This is optional — but if you share your general area, North Star can point you to real learning near you.",
    });
  }

  /* ---------- Step 3: Deeper Vision ---------- */
  if (step === "vision") {
    card.innerHTML = `
      ${indicator}
      <button class="btn btn-ghost btn-sm onb-tochooser" id="back" type="button">← Back</button>
      <h1>Deeper Vision</h1>
      <p class="lede">Take a moment to reflect. Your answers become the foundation that shapes the learning journey, experiences and opportunities North Star will suggest for your children.</p>
      ${VISION_QS.map(q => `
        <div class="field">
          <label>${esc(q.label)}</label>
          <textarea class="textarea" id="${q.id}" data-voice data-voice-label="Speak your answer" placeholder="${esc(q.ph)}">${esc(_draft[q.id] || "")}</textarea>
        </div>`).join("")}
      <div class="row-between mt-2">
        <button class="btn" id="back2">← Back</button>
        <button class="btn btn-primary btn-lg" id="next">Continue →</button>
      </div>
    `;
    VISION_QS.forEach(q => {
      const t = card.querySelector("#" + q.id);
      attachPromptChips(t, VISION_CHIPS[q.id]);
      autosize(t);
      attachTidy(t, val => { _draft[q.id] = val; });
    });
    const goBack = () => { VISION_QS.forEach(q => { const i = card.querySelector("#" + q.id); if (i) _draft[q.id] = i.value.trim(); }); _step--; paint(card); };
    card.querySelector("#back").addEventListener("click", goBack);
    card.querySelector("#back2").addEventListener("click", goBack);
    card.querySelector("#next").addEventListener("click", () => {
      VISION_QS.forEach(q => { const i = card.querySelector("#" + q.id); if (i) _draft[q.id] = i.value.trim(); });
      _step++; paint(card);
    });
  }

  /* ---------- Step 4: Vision, Core Word & Credo ---------- */
  if (step === "core-word") {
    card.innerHTML = `
      ${indicator}
      <button class="btn btn-ghost btn-sm onb-tochooser" id="back" type="button">← Back</button>
      <h1>Vision, Core Word & Credo.</h1>
      <p style="font-family:var(--font-serif);font-size:19px;font-style:italic;color:var(--text);border-left:2px solid var(--primary);padding-left:15px;margin:0 0 16px;max-width:48ch;line-height:1.4">If you don't intentionally instill your family's values in your children, the world will gladly do it for them.</p>
      <p class="lede">Most of us first met mission, vision and values at work — rarely at home. Yet the world's most enduring families share one thing: a clear set of values, deeply embedded in their children, that becomes a compass for life. This is where you define that language and begin weaving it through their learning journey. Big visions are remembered through small words — and small phrases, repeated often, become identity.</p>

      <div class="field">
        <label>Family Vision</label>
        <p class="text-muted small" style="margin:2px 0 6px">The "why" behind your family's learning journey — who you are becoming together. It doesn't have to sound polished or formal — it simply captures what this education is designed to produce, and becomes a compass when hard decisions arise.</p>
        <textarea class="textarea" id="mission" data-voice data-voice-label="Dictate your family vision" placeholder="e.g. We are raising capable, thoughtful young people who love learning, solve problems and contribute wherever they go.">${esc(_draft.mission)}</textarea>
        <p class="text-muted small" style="margin:6px 0 0;font-size:12.5px">Write from identity — "We are…", "We believe…", "We cultivate…" — rather than "We want our children to…".</p>
        <div class="row mt-1" style="gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-suggest" id="suggest-mission" type="button">✨ Suggest Family Vision</button>
          <button class="btn btn-suggest hidden" id="regen-mission" type="button">Suggest Alternative</button>
          <span class="small text-muted" id="mission-status"></span>
        </div>
      </div>

      <div class="field" style="margin-top:20px">
        <label>Core Word</label>
        <p class="text-muted small" style="margin:2px 0 6px">An acronym that gathers several of your family's values and character traits into one memorable, inspiring word — and the word itself is often a meaningful trait too. Children remember the word, and the quality each letter stands for.</p>
        <input class="input" id="coreWord" value="${esc(_draft.coreWord)}" maxlength="12" style="max-width:240px;text-transform:uppercase" placeholder="e.g. LIGHT" />
        <div class="row mt-1" style="gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-suggest" id="suggest-word" type="button">✨ Suggest Core Word</button>
          <button class="btn btn-suggest hidden" id="regen-word" type="button">Suggest Alternative</button>
          <span class="small text-muted" id="word-status"></span>
        </div>
        <div id="acronymRows" class="stack mt-2"></div>
      </div>

      <div class="field" style="margin-top:20px">
        <label>Family Credo</label>
        <p class="text-muted small" style="margin:2px 0 6px">A short phrase related to your children's learning journey that they can remember, repeat and grow up with. Children rarely remember lectures — they remember simple sayings woven into everyday conversation.</p>
        <input class="input" id="motto" value="${esc(_draft.motto)}" placeholder="e.g. Love learning. Grow always. Leave the world better." />
        <div class="row mt-1" style="gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-suggest" id="suggest-motto" type="button">✨ Suggest Family Credo</button>
          <button class="btn btn-suggest hidden" id="regen-motto" type="button">Suggest Alternative</button>
          <span class="small text-muted" id="motto-status"></span>
        </div>
      </div>

      <p class="text-muted small" style="margin:24px 0 0;padding-top:16px;border-top:1px solid var(--divider);font-style:italic">The language children grow up with often becomes the voice they carry into adulthood.</p>

      <div class="row-between mt-3">
        <button class="btn" id="back2">← Back</button>
        <button class="btn btn-primary btn-lg" id="next">Save our North Star →</button>
      </div>
    `;

    const wordInput = card.querySelector("#coreWord");
    const renderAcronymRows = () => {
      const host = card.querySelector("#acronymRows");
      const word = (_draft.coreWord || "").toUpperCase().slice(0, 12);
      _draft.acronym = word.split("").map((L, i) => ({
        letter: L,
        meaning: _draft.acronym[i]?.letter === L ? (_draft.acronym[i]?.meaning || "") : "",
      }));
      host.innerHTML = _draft.acronym.map((row, i) => `
        <div class="row" style="gap:10px;align-items:center">
          <div class="brand-mark" style="width:36px;height:36px;font-size:18px">${esc(row.letter)}</div>
          <input class="input" data-i="${i}" placeholder="${esc(row.letter)}…" value="${esc(row.meaning)}" style="flex:1"/>
          <button class="btn btn-sm" data-rl="${i}" type="button" title="Suggest a meaning for ${esc(row.letter)}">↻</button>
        </div>`).join("");
      host.querySelectorAll("input").forEach(inp => {
        inp.addEventListener("input", () => { _draft.acronym[+inp.dataset.i].meaning = inp.value; });
      });
      host.querySelectorAll("[data-rl]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const i = +btn.dataset.rl; btn.disabled = true; btn.textContent = "…";
          try {
            const out = await aiSuggestVision("letter", visionForCtx(), { ...familyForCtx(), letter: _draft.acronym[i].letter });
            if (out?.value) { _draft.acronym[i].meaning = out.value; renderAcronymRows(); }
          } catch (e) { toast(e.message || "Couldn't suggest", { type: "error" }); }
          finally { btn.disabled = false; btn.textContent = "↻"; }
        });
      });
    };
    wordInput.addEventListener("input", () => { _draft.coreWord = wordInput.value.toUpperCase().slice(0, 12); wordInput.value = _draft.coreWord; renderAcronymRows(); });
    renderAcronymRows();
    autosize(card.querySelector("#mission"));

    const wireText = (kind, sId, rId, stId, fId) => {
      const s = card.querySelector(sId), r = card.querySelector(rId), st = card.querySelector(stId), f = card.querySelector(fId);
      const run = async (btn) => {
        btn.disabled = true; const label = btn.textContent; btn.textContent = "Thinking…"; st.textContent = "North Star is shaping a suggestion…";
        _draft.motto = card.querySelector("#motto").value; _draft.mission = card.querySelector("#mission").value;
        try {
          const out = await aiSuggestVision(kind, visionForCtx(), familyForCtx());
          if (out?.value) { f.value = out.value; st.textContent = "Suggested from your answers — edit anything."; r.classList.remove("hidden"); }
          else st.textContent = "Couldn't shape one just now.";
        } catch (e) { st.textContent = e.message || "Couldn't suggest just now."; }
        finally { btn.disabled = false; btn.textContent = label; }
      };
      s.addEventListener("click", () => run(s));
      r.addEventListener("click", () => run(r));
    };
    wireText("motto", "#suggest-motto", "#regen-motto", "#motto-status", "#motto");
    wireText("mission", "#suggest-mission", "#regen-mission", "#mission-status", "#mission");

    const cwBtn = card.querySelector("#suggest-word"), cwRegen = card.querySelector("#regen-word"), cwStatus = card.querySelector("#word-status");
    const runCw = async (btn) => {
      btn.disabled = true; const label = btn.textContent; btn.textContent = "Thinking…"; cwStatus.textContent = "Shaping a few from your vision…";
      try {
        const res = await aiSuggestCoreWord(visionForCtx(), _draft.coreWord);
        const sg = (res?.suggestions || [])[0];
        if (sg?.coreWord) {
          _draft.coreWord = sg.coreWord.toUpperCase().slice(0, 12);
          _draft.acronym = (sg.acronym || []).map(a => ({ letter: (a.letter || "").toUpperCase(), meaning: a.meaning || "" }));
          wordInput.value = _draft.coreWord; renderAcronymRows();
          cwStatus.textContent = `Suggested "${_draft.coreWord}" — edit any letter, or regenerate.`; cwRegen.classList.remove("hidden");
        } else cwStatus.textContent = "Add a little more in Deeper Vision, then try again.";
      } catch (e) { cwStatus.textContent = e.message || "Couldn't suggest just now."; }
      finally { btn.disabled = false; btn.textContent = label; }
    };
    cwBtn.addEventListener("click", () => runCw(cwBtn));
    cwRegen.addEventListener("click", () => runCw(cwRegen));

    const goBack = () => {
      _draft.motto = card.querySelector("#motto").value.trim();
      _draft.mission = card.querySelector("#mission").value.trim();
      _step--; paint(card);
    };
    card.querySelector("#back").addEventListener("click", goBack);
    card.querySelector("#back2").addEventListener("click", goBack);
    card.querySelector("#next").addEventListener("click", () => {
      _draft.mission = card.querySelector("#mission").value.trim();
      _draft.motto = card.querySelector("#motto").value.trim();
      // Commit vision/identity/core-word. Practical sections already autosave
      // to the family record, so we merge — never overwrite — them here.
      update(state => {
        if (!state.domains.length) state.domains = DOMAIN_CATALOG;
        state.family = {
          ...(state.family || {}),
          id: state.family?.id || uid("fam"),
          parentName: _draft.parentName,
          familyName: _draft.familyName,
          mission: _draft.mission,
          motto: _draft.motto,
          coreWord: _draft.coreWord,
          acronym: _draft.acronym,
          learningStyleDefault: state.family?.learningStyleDefault ?? 5,
          diyMaterialsPreference: state.family?.diyMaterialsPreference ?? 5,
          vision: visionForCtx(),
          createdAt: state.family?.createdAt || new Date().toISOString(),
        };
        state.meta.onboarded = true;
      });
      setOnboardingParked(false);  // fully onboarded now — no resume banner needed
      _step++; paint(card);
    });
  }

  /* ---------- Step 5: Travel / Worldschool ---------- */
  if (step === "travel") {
    renderSectionStep(travelSection, {
      eyebrow: "Your world",
      title: "Are you on the move?",
      lede: "Turn this on if your family travels — North Star can suggest local experiences or destination-based projects. Leave it off if you're settled at home.",
    });
  }

  /* ---------- Step 6: Faith Integration ---------- */
  if (step === "faith") {
    renderSectionStep(faithSection, {
      eyebrow: "Your world",
      title: "Faith, if it's part of your family.",
      lede: "Entirely optional and parent-controlled. No faith language is ever used unless you turn this on.",
    });
  }

  /* ---------- Step 7: Family Rhythm ---------- */
  if (step === "rhythm") {
    renderSectionStep(rhythmSection, {
      eyebrow: "Your world",
      title: "Your family's rhythm.",
      lede: "Tell North Star your family's real capacity — the days and hours learning naturally fits into — so it scales to your week and never overfills it.",
    });
    // Last data step → the Continue button should read as completion.
    const next = card.querySelector("#next");
    if (next) next.textContent = "Finish setup →";
  }

  /* ---------- Done ---------- */
  if (step === "done") {
    card.innerHTML = `
      ${indicator}
      <h1>You're set.</h1>
      <p class="lede">Your family's North Star is saved. Next, add each child's profile, choose your learning style, and we'll help shape their first projects.</p>
      <div class="row mt-3">
        <button class="btn btn-primary btn-lg" id="go-children">Add a Child</button>
      </div>
    `;
    card.querySelector("#go-children").addEventListener("click", () => navigate("/children"));
  }
}
