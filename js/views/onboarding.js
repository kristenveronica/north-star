/* ============================================================
   onboarding.js — First-run welcome + family vision capture.
   ============================================================ */

import { getState, update, uid } from "../store.js";
import { DOMAIN_CATALOG } from "../seed.js";
import { navigate } from "../router.js";
import { esc, toast } from "../components/ui.js";

const STEPS = ["welcome", "vision", "core-word", "done"];

let _step = 0;
let _draft = {
  parentName: "",
  familyName: "",
  adultsHoping: "",
  values: "",
  successLooksLike: "",
  skills: "",
  qualities: "",
  capableByEighteen: "",
  roles: "",
  faithEnabled: false,
  faithTradition: "",
  mission: "",
  motto: "",
  coreWord: "BRAVE",
  acronym: [
    { letter: "B", meaning: "Build" },
    { letter: "R", meaning: "Reason" },
    { letter: "A", meaning: "Articulate" },
    { letter: "V", meaning: "Value Hunt" },
    { letter: "E", meaning: "Embody" },
  ],
};

export function renderOnboarding(container) {
  // If a family already exists, prefill draft from it.
  const fam = getState().family;
  if (fam) {
    _draft = {
      ..._draft,
      parentName: fam.parentName || "",
      familyName: fam.familyName || "",
      ...(fam.vision || {}),
      faithEnabled: !!fam.faithEnabled,
      faithTradition: fam.faithTradition || "",
      mission: fam.mission || "",
      motto: fam.motto || "",
      coreWord: fam.coreWord || "BRAVE",
      acronym: fam.acronym || _draft.acronym,
    };
  }

  container.innerHTML = `<div class="welcome"><div class="welcome-card" id="welcome-card"></div></div>`;
  paint(container.querySelector("#welcome-card"));
}

function paint(card) {
  const step = STEPS[_step];
  const indicator = `
    <div class="step-indicator">
      ${STEPS.map((_, i) => `<div class="dot ${i < _step ? "done" : i === _step ? "active" : ""}"></div>`).join("")}
    </div>`;

  if (step === "welcome") {
    card.innerHTML = `
      ${indicator}
      <h1>Welcome to your family's North Star.</h1>
      <p class="lede">This isn't a planner. It's a way to clarify your family's North Star, understand each child more deeply, and nurture who they are becoming.</p>
      <div class="grid grid-2 mt-2 mb-3" style="gap:14px">
        <div class="card" style="padding:18px">
          <h4>What we'll do together</h4>
          <ul class="text-muted" style="padding-left:18px;margin:6px 0">
            <li>Capture your family's vision</li>
            <li>Add each child's profile</li>
            <li>Choose your learning style</li>
            <li>Get personalised projects + materials</li>
          </ul>
        </div>
        <div class="card" style="padding:18px;background:var(--card-elev)">
          <h4>Then the kids get a portal too</h4>
          <p class="text-muted small">Each child gets their own access code. They see today's missions, click stars, earn Momentum Points, and write reflections.</p>
        </div>
      </div>
      <div class="field">
        <label>Your name</label>
        <input class="input" id="parentName" value="${esc(_draft.parentName)}" placeholder="e.g. Kristen" />
      </div>
      <div class="field">
        <label>Family name</label>
        <input class="input" id="familyName" value="${esc(_draft.familyName)}" placeholder="e.g. The Veronica Family" />
      </div>
      <div class="row-between mt-2">
        <span class="text-muted small">Step 1 of ${STEPS.length}</span>
        <button class="btn btn-primary btn-lg" id="next">Begin →</button>
      </div>
    `;
    card.querySelector("#next").addEventListener("click", () => {
      _draft.parentName = card.querySelector("#parentName").value.trim();
      _draft.familyName = card.querySelector("#familyName").value.trim();
      if (!_draft.familyName) { toast("Give your family a name to begin", { type: "warning" }); return; }
      _step++;
      paint(card);
    });
  }

  if (step === "vision") {
    card.innerHTML = `
      ${indicator}
      <h1>Your family vision.</h1>
      <p class="lede">A few honest answers here will shape every suggestion the app makes for your children.</p>
      ${textField("adultsHoping", "What kind of adults are you hoping to raise?", "Curious, brave, capable, generous…")}
      ${textField("values", "What values matter most to your family?", "Bravery, integrity, kindness, craftsmanship…")}
      ${textField("successLooksLike", "What does educational success look like for your family?")}
      ${textField("skills", "What skills do you want your children to develop?")}
      ${textField("qualities", "What qualities do you want them to embody?")}
      ${textField("capableByEighteen", "What do you want them to be capable of by age 18?")}
      ${textField("roles", "What role does faith, service, entrepreneurship, creativity, academics, life skills and community play in your family?")}
      <div class="field">
        <label class="checkbox">
          <input type="checkbox" id="faithEnabled" ${_draft.faithEnabled ? "checked" : ""}/>
          Include Faith Gigs in our family rhythm
        </label>
        <input class="input mt-1 ${_draft.faithEnabled ? "" : "hidden"}" id="faithTradition" placeholder="Which faith tradition?" value="${esc(_draft.faithTradition)}" />
      </div>
      <div class="row-between mt-2">
        <button class="btn" id="back">← Back</button>
        <button class="btn btn-primary btn-lg" id="next">Continue →</button>
      </div>
    `;
    const faithCb = card.querySelector("#faithEnabled");
    const faithIn = card.querySelector("#faithTradition");
    faithCb.addEventListener("change", () => {
      _draft.faithEnabled = faithCb.checked;
      faithIn.classList.toggle("hidden", !faithCb.checked);
    });
    card.querySelector("#back").addEventListener("click", () => { _step--; paint(card); });
    card.querySelector("#next").addEventListener("click", () => {
      ["adultsHoping","values","successLooksLike","skills","qualities","capableByEighteen","roles","faithTradition"]
        .forEach(k => { const i = card.querySelector("#" + k); if (i) _draft[k] = i.value.trim(); });
      _step++;
      paint(card);
    });
  }

  if (step === "core-word") {
    card.innerHTML = `
      ${indicator}
      <h1>Your family core word.</h1>
      <p class="lede">Pick a single word that captures the kind of children you're growing — then unpack each letter into a meaning. This becomes the lens for every project.</p>

      <div class="field">
        <label>Family motto (optional)</label>
        <input class="input" id="motto" value="${esc(_draft.motto)}" placeholder="e.g. Be brave. Be curious. Be useful." />
      </div>
      <div class="field">
        <label>Mission statement (optional)</label>
        <textarea class="textarea" id="mission" placeholder="One sentence about what your family is for.">${esc(_draft.mission)}</textarea>
      </div>

      <div class="field">
        <label>Core word</label>
        <input class="input" id="coreWord" value="${esc(_draft.coreWord)}" maxlength="12" />
        <span class="hint">Each letter will become an acronym below. Try: BRAVE, GROW, BUILD, LIGHT, ROOT.</span>
      </div>

      <div class="card mt-2" style="background:var(--card-elev)">
        <h4>Unpack each letter</h4>
        <div id="acronymRows" class="stack mt-1"></div>
      </div>

      <div class="row-between mt-2">
        <button class="btn" id="back">← Back</button>
        <button class="btn btn-primary btn-lg" id="next">Save vision →</button>
      </div>
    `;

    const renderAcronymRows = () => {
      const host = card.querySelector("#acronymRows");
      const word = (_draft.coreWord || "").toUpperCase().slice(0, 12);
      _draft.acronym = word.split("").map((L, i) => ({
        letter: L,
        meaning: _draft.acronym[i]?.letter === L ? (_draft.acronym[i]?.meaning || "") : "",
      }));
      host.innerHTML = _draft.acronym.map((row, i) => `
        <div class="row" style="gap:10px">
          <div class="brand-mark" style="width:36px;height:36px;font-size:18px">${row.letter}</div>
          <input class="input" data-i="${i}" placeholder="${row.letter}…" value="${esc(row.meaning)}" />
        </div>
      `).join("");
      host.querySelectorAll("input").forEach(inp => {
        inp.addEventListener("input", () => {
          const idx = +inp.dataset.i;
          _draft.acronym[idx].meaning = inp.value;
        });
      });
    };

    const wordInput = card.querySelector("#coreWord");
    wordInput.addEventListener("input", () => {
      _draft.coreWord = wordInput.value.toUpperCase().slice(0, 12);
      renderAcronymRows();
    });
    renderAcronymRows();

    card.querySelector("#back").addEventListener("click", () => { _step--; paint(card); });
    card.querySelector("#next").addEventListener("click", () => {
      _draft.mission = card.querySelector("#mission").value.trim();
      _draft.motto = card.querySelector("#motto").value.trim();
      // Save family
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
          desiredOutcomes: state.family?.desiredOutcomes || [],
          faithEnabled: _draft.faithEnabled,
          faithTradition: _draft.faithTradition,
          learningStyleDefault: state.family?.learningStyleDefault ?? 5,
          diyMaterialsPreference: state.family?.diyMaterialsPreference ?? 5,
          vision: {
            adultsHoping: _draft.adultsHoping,
            values: _draft.values,
            successLooksLike: _draft.successLooksLike,
            skills: _draft.skills,
            qualities: _draft.qualities,
            capableByEighteen: _draft.capableByEighteen,
            roles: _draft.roles,
          },
          createdAt: state.family?.createdAt || new Date().toISOString(),
        };
        state.meta.onboarded = true;
      });
      _step++;
      paint(card);
    });
  }

  if (step === "done") {
    card.innerHTML = `
      ${indicator}
      <h1>You're set.</h1>
      <p class="lede">Your family OS is alive. Two sample children — Noah and Jett — are already in the system to show you the full flow. You can edit, replace or delete them anytime in <span class="kbd">Children</span>.</p>
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

function textField(id, label, placeholder = "") {
  return `
    <div class="field">
      <label>${esc(label)}</label>
      <textarea class="textarea" id="${id}" data-voice data-voice-label="Speak your answer" placeholder="${esc(placeholder)}">${esc(_draft[id] || "")}</textarea>
    </div>`;
}
