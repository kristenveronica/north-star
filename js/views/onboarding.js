/* ============================================================
   onboarding.js — First-run guided sequence for the Family North Star.
   Order: Identity + Relationship Map → Deeper Vision → Desired
   Outcomes → Motto / Mission / Core Word → Done.
   ============================================================ */

import { getState, update, uid } from "../store.js";
import { DOMAIN_CATALOG } from "../seed.js";
import { navigate } from "../router.js";
import { esc, toast } from "../components/ui.js";
import { aiSuggestCoreWord, aiSuggestVision } from "../lib/ai.js";
import { VISION_QS, VISION_CHIPS, attachPromptChips, autosize, attachTidy } from "./familyVision.js";
import { REL_OPTIONS } from "./familySettings.js";
import { saveDraft, loadDraft, clearDraft } from "../lib/drafts.js";
import { setOnboardingParked } from "../lib/repo.js";
import { logoStacked } from "../components/logo.js";

const STEPS = ["welcome", "vision", "core-word", "done"];

let _step = 0;
let _chose = false;   // has the family picked Quick Start vs Full Setup yet?
let _draft = {
  parentName: "",
  familyName: "",
  relationships: [],
  adultsHoping: "", values: "", successLooksLike: "",
  capableByEighteen: "", selfAndOthers: "", experiences: "",
  faithEnabled: false, faithTradition: "",
  desiredOutcomes: "",
  mission: "", motto: "",
  coreWord: "",
  acronym: [],
};

/* ---------- Draft auto-save: a safety net for the lengthy onboarding ----------
   Onboarding can span more than one sitting. We persist the in-progress draft
   (and which step they're on) to localStorage on every edit, restore it on
   return, and clear it only once they finish. Nothing typed is ever lost. */
const ONBOARDING_DRAFT = "onboarding";
function persistDraft() { saveDraft(ONBOARDING_DRAFT, { step: _step, draft: _draft }); }
function dropDraft() { clearDraft(ONBOARDING_DRAFT); }
// Pull whatever fields are currently on screen into the draft, then persist.
function captureDraft(card) {
  const g = (id) => card.querySelector("#" + id);
  const text = (id, key) => { const el = g(id); if (el) _draft[key] = el.value; };
  text("parentName", "parentName");
  text("familyName", "familyName");
  VISION_QS.forEach(q => { const el = g(q.id); if (el) _draft[q.id] = el.value; });
  const faith = g("faithEnabled"); if (faith) _draft.faithEnabled = faith.checked;
  text("faithTradition", "faithTradition");
  text("mission", "mission");
  text("motto", "motto");
  const cw = g("coreWord"); if (cw) _draft.coreWord = cw.value.toUpperCase().slice(0, 12);
  persistDraft();
}

export function renderOnboarding(container) {
  const fam = getState().family;
  if (fam) {
    _draft = {
      ..._draft,
      parentName: fam.parentName || "",
      familyName: fam.familyName || "",
      relationships: Array.isArray(fam.relationships) ? fam.relationships.map(r => ({ ...r })) : [],
      ...(fam.vision || {}),
      faithEnabled: !!fam.faithEnabled,
      faithTradition: fam.faithTradition || "",
      desiredOutcomes: (fam.desiredOutcomes || []).join("\n"),
      mission: fam.mission || "",
      motto: fam.motto || "",
      coreWord: fam.coreWord || "",
      acronym: fam.acronym || [],
    };
  }
  // Restore this account's in-progress draft (takes precedence over committed data) and resume the step.
  const saved = loadDraft(ONBOARDING_DRAFT);
  if (saved && saved.draft && typeof saved.draft === "object") {
    _draft = { ..._draft, ...saved.draft };
    if (typeof saved.step === "number" && saved.step >= 0 && saved.step < STEPS.length - 1) _step = saved.step;
  }
  // Resuming mid-way through Full Setup → they've already chosen; skip the fork.
  if (_step > 0) _chose = true;
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
  card.querySelector("[data-full]").addEventListener("click", () => { _chose = true; paint(card); });
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
  // Bind the auto-save listener once; the card element persists across steps.
  if (!card._draftBound) {
    card.addEventListener("input", () => captureDraft(card));
    card.addEventListener("change", () => captureDraft(card));
    card._draftBound = true;
  }
  // Persist the current step + draft (or clear it once they've finished).
  if (step === "done") dropDraft(); else persistDraft();
  const indicator = `
    <div class="step-indicator">
      ${STEPS.map((_, i) => `<div class="dot ${i < _step ? "done" : i === _step ? "active" : ""}"></div>`).join("")}
    </div>`;

  /* ---------- Step 1: Family Identity + Relationship Map ---------- */
  if (step === "welcome") {
    card.innerHTML = `
      ${indicator}
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
        <h4 style="margin:0 0 4px">Family members & support people</h4>
        <p class="text-muted small" style="margin:0 0 10px">Add the important people in your child's life. This helps North Star reflect your real family in rewards, celebrations and projects — never assumptions.</p>
        <div id="rel-list" class="stack"></div>
        <button class="btn btn-sm mt-2" id="rel-add" type="button">+ Add person</button>
      </div>
      <div class="row-between mt-3">
        <span class="text-muted small">Step 1 of ${STEPS.length}</span>
        <button class="btn btn-primary btn-lg" id="next">Begin →</button>
      </div>
      <div class="center mt-2">
        <button class="btn btn-ghost btn-sm" id="park" type="button">I'll set this up later — take me to my dashboard →</button>
        <p class="text-muted small" style="margin:6px 0 0">Anything you've typed is saved. You can pick up right here whenever you're ready.</p>
      </div>
    `;
    wireRelList(card);
    card.querySelector("#next").addEventListener("click", () => {
      _draft.parentName = card.querySelector("#parentName").value.trim();
      _draft.familyName = card.querySelector("#familyName").value.trim();
      if (!_draft.familyName) { toast("Give your family a name to begin", { type: "warning" }); return; }
      _step++; paint(card);
    });
    card.querySelector("#park").addEventListener("click", () => {
      captureDraft(card);          // save whatever's on screen (draft persists)
      setOnboardingParked(true);   // let the guard pass us through to the dashboard
      toast("No rush — your setup is saved. Finish it anytime from your dashboard.", { type: "success", duration: 3500 });
      navigate("/");
    });
  }

  /* ---------- Step 2: Deeper Vision ---------- */
  if (step === "vision") {
    card.innerHTML = `
      ${indicator}
      <h1>Deeper Vision</h1>
      <p class="lede">Take a moment to reflect. Your answers become the foundation that shapes the learning journey, experiences and opportunities North Star will suggest for your children.</p>
      ${VISION_QS.map(q => `
        <div class="field">
          <label>${esc(q.label)}</label>
          <textarea class="textarea" id="${q.id}" data-voice data-voice-label="Speak your answer" placeholder="${esc(q.ph)}">${esc(_draft[q.id] || "")}</textarea>
        </div>`).join("")}
      <div class="field">
        <label class="checkbox">
          <input type="checkbox" id="faithEnabled" ${_draft.faithEnabled ? "checked" : ""}/>
          Include Faith Gigs in our family rhythm
        </label>
        <input class="input mt-1 ${_draft.faithEnabled ? "" : "hidden"}" id="faithTradition" placeholder="Which faith tradition?" value="${esc(_draft.faithTradition)}" />
        <span class="hint">A family-wide setting (you can change it later in Settings).</span>
      </div>
      <div class="row-between mt-2">
        <button class="btn" id="back">← Back</button>
        <button class="btn btn-primary btn-lg" id="next">Continue →</button>
      </div>
    `;
    VISION_QS.forEach(q => {
      const t = card.querySelector("#" + q.id);
      attachPromptChips(t, VISION_CHIPS[q.id]);
      autosize(t);
      attachTidy(t, val => { _draft[q.id] = val; });
    });
    const faithCb = card.querySelector("#faithEnabled");
    const faithIn = card.querySelector("#faithTradition");
    faithCb.addEventListener("change", () => {
      _draft.faithEnabled = faithCb.checked;
      faithIn.classList.toggle("hidden", !faithCb.checked);
    });
    card.querySelector("#back").addEventListener("click", () => { _step--; paint(card); });
    card.querySelector("#next").addEventListener("click", () => {
      VISION_QS.forEach(q => { const i = card.querySelector("#" + q.id); if (i) _draft[q.id] = i.value.trim(); });
      _draft.faithTradition = card.querySelector("#faithTradition").value.trim();
      _step++; paint(card);
    });
  }

  /* ---------- Step 3: Vision, Core Word & Credo ---------- */
  if (step === "core-word") {
    card.innerHTML = `
      ${indicator}
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
        <button class="btn" id="back">← Back</button>
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

    // Motto / Mission suggestions
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

    // Core word suggestion
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

    card.querySelector("#back").addEventListener("click", () => {
      _draft.motto = card.querySelector("#motto").value.trim();
      _draft.mission = card.querySelector("#mission").value.trim();
      _step--; paint(card);
    });
    card.querySelector("#next").addEventListener("click", () => {
      _draft.mission = card.querySelector("#mission").value.trim();
      _draft.motto = card.querySelector("#motto").value.trim();
      const cleanRel = (_draft.relationships || [])
        .map(r => ({
          name: (r.name || "").trim(),
          relationship: r.relationship === "Other" ? ((r.relationshipOther || "").trim() || "Other") : r.relationship,
          roleNote: (r.roleNote || "").trim(),
        }))
        .filter(r => r.name);
      update(state => {
        if (!state.domains.length) state.domains = DOMAIN_CATALOG;
        state.family = {
          ...(state.family || {}),
          id: state.family?.id || uid("fam"),
          parentName: _draft.parentName,
          familyName: _draft.familyName,
          relationships: cleanRel,
          mission: _draft.mission,
          motto: _draft.motto,
          coreWord: _draft.coreWord,
          acronym: _draft.acronym,
          faithEnabled: _draft.faithEnabled,
          faithTradition: _draft.faithTradition,
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

  /* ---------- Done ---------- */
  if (step === "done") {
    card.innerHTML = `
      ${indicator}
      <h1>You're set.</h1>
      <p class="lede">Your family's North Star is saved. Next, add each child's profile, choose your learning style, and we'll help shape their first projects.</p>
      <div class="card mt-2" style="background:linear-gradient(135deg, var(--primary-soft), var(--card-elev))">
        <h4>Where to go next</h4>
        <ol class="text-muted" style="padding-left:20px">
          <li>Add or edit a child profile</li>
          <li>Set your Learning Style slider</li>
          <li>Pick your domains for the term</li>
          <li>Review the suggested projects + materials</li>
        </ol>
      </div>
      <div class="row mt-3" style="gap:10px">
        <button class="btn btn-primary btn-lg" id="go-dash">Go to Dashboard</button>
        <button class="btn" id="go-children">Open Children</button>
      </div>
    `;
    card.querySelector("#go-dash").addEventListener("click", () => navigate("/"));
    card.querySelector("#go-children").addEventListener("click", () => navigate("/children"));
  }
}

/* ---------- Relationship Map (compact, onboarding step 1) ---------- */
function wireRelList(card) {
  const list = card.querySelector("#rel-list");
  const render = () => {
    if (!_draft.relationships.length) {
      list.innerHTML = `<p class="text-muted small" style="margin:0">No one added yet.</p>`;
      return;
    }
    list.innerHTML = _draft.relationships.map((r, i) => {
      const isOther = !REL_OPTIONS.includes(r.relationship) || r.relationship === "Other";
      const sel = isOther ? "Other" : r.relationship;
      return `
      <div class="card" style="background:var(--card);padding:10px" data-rel="${i}">
        <div class="row" style="gap:8px;flex-wrap:wrap;align-items:flex-end">
          <div class="field" style="flex:1;min-width:130px;margin:0"><label class="small">Name</label><input class="input" data-rk="name" value="${esc(r.name || "")}" placeholder="e.g. Grandma Jo"/></div>
          <div class="field" style="flex:1;min-width:130px;margin:0"><label class="small">Relationship</label>
            <select class="input" data-rk="relationship">${REL_OPTIONS.map(o => `<option ${o === sel ? "selected" : ""}>${o}</option>`).join("")}</select>
          </div>
          <button class="btn btn-sm" data-rk="remove" title="Remove" style="margin-bottom:2px">✕</button>
        </div>
        <div class="field ${isOther ? "" : "hidden"}" data-other style="margin:8px 0 0"><label class="small">Who are they to the child?</label><input class="input" data-rk="relationshipOther" value="${esc(isOther && r.relationship !== "Other" ? r.relationship : (r.relationshipOther || ""))}" placeholder="e.g. Godmother, neighbour"/></div>
        <div class="field" style="margin:8px 0 0"><label class="small">Role in their learning <span class="text-muted">(optional)</span></label><input class="input" data-rk="roleNote" value="${esc(r.roleNote || "")}" placeholder="e.g. teaches piano, business mentor"/></div>
      </div>`;
    }).join("");
    list.querySelectorAll("[data-rel]").forEach(row => {
      const i = +row.dataset.rel;
      const otherWrap = row.querySelector("[data-other]");
      row.querySelector('[data-rk="name"]').addEventListener("input", e => { _draft.relationships[i].name = e.target.value; });
      row.querySelector('[data-rk="relationship"]').addEventListener("change", e => { _draft.relationships[i].relationship = e.target.value; otherWrap.classList.toggle("hidden", e.target.value !== "Other"); });
      row.querySelector('[data-rk="relationshipOther"]')?.addEventListener("input", e => { _draft.relationships[i].relationshipOther = e.target.value; });
      row.querySelector('[data-rk="roleNote"]').addEventListener("input", e => { _draft.relationships[i].roleNote = e.target.value; });
      row.querySelector('[data-rk="remove"]').addEventListener("click", () => { _draft.relationships.splice(i, 1); render(); });
    });
  };
  card.querySelector("#rel-add").addEventListener("click", () => { _draft.relationships.push({ name: "", relationship: "Mother", roleNote: "" }); render(); });
  render();
}
