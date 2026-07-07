/* ============================================================
   quickstart.js — the 5-minute quick-start onboarding.

   An express lane alongside the full onboarding: three quick questions
   (or one "just talk" ramble), all dictatable, → AI extracts a structured
   starting point → we auto-populate the family + children → generate a real
   first project → reveal it. Depth is earned later, never demanded.

   Engine: aiQuickstartExtract (edge action quickstart-extract) + the existing
   aiGenerateProject; the parent's dream becomes constraints.intent.
   ============================================================ */

import { getState, setFamily, addChild, update } from "../store.js";
import { aiQuickstartExtract, aiGenerateProject } from "../lib/ai.js";
import { createProjectFromTemplate } from "./projects.js";
import { setOnboardingParked } from "../lib/repo.js";
import { isLoggedIn } from "../auth.js";
import { esc, toast, icon } from "../components/ui.js";
import { navigate } from "../router.js";

let _c = null;                 // container
let S = null;                  // flow state

const AV_COLORS = [
  "linear-gradient(140deg,var(--primary),#a85f38)",
  "linear-gradient(140deg,#5b83a8,#3f5f86)",
  "linear-gradient(140deg,var(--sage),#4d7a5c)",
  "linear-gradient(140deg,#b07bb5,#7d4f86)",
];
const initial = (n) => (n || "?").trim().charAt(0).toUpperCase() || "?";

export function renderQuickstart(container) {
  if (!isLoggedIn()) { location.hash = "#/signup"; return; }
  _c = container;
  S = { screen: "welcome", answers: { a1: "", a2: "", a3: "", freeform: "" }, extracted: null, kids: [], busy: false };
  paint();
}

/* ---------- render ---------- */
function paint() {
  const s = SCREENS[S.screen]();
  _c.innerHTML = `<div class="qs">${s.html}</div>`;
  s.wire?.(_c.querySelector(".qs"));
  window.scrollTo(0, 0);
}
const go = (screen) => { S.screen = screen; paint(); };

// stash the current textarea answers before leaving a screen
function grab() {
  const t = _c.querySelector("textarea");
  if (!t) return;
  if (S.screen === "talk") S.answers.freeform = t.value;
  else if (S.screen === "q1") S.answers.a1 = t.value;
  else if (S.screen === "q2") S.answers.a2 = t.value;
  else if (S.screen === "q3") S.answers.a3 = t.value;
}

function questionScreen({ n, eyebrow, title, lede, key, placeholder, examples }) {
  return {
    html: `
      ${topbar(n)}
      <div class="qs-body">
        <div class="qs-eyebrow">${esc(eyebrow)}</div>
        <h1>${esc(title)}</h1>
        <p class="qs-lede">${esc(lede)}</p>
        <div class="field" style="margin:0">
          <textarea class="qs-input" data-voice data-voice-label="Speak your answer" placeholder="${esc(placeholder)}">${esc(S.answers[key] || "")}</textarea>
        </div>
        <div class="qs-cap">${icon("mic")} Tap the mic and talk — your words appear as you speak.</div>
        <div class="qs-examples">
          <div class="qs-examples__cap">Or tap a few to get started:</div>
          <div class="qs-chips">
            ${examples.map(x => `<button type="button" class="qs-chip" data-ex="${esc(x)}">${esc(x)}</button>`).join("")}
          </div>
        </div>
      </div>
      <div class="qs-foot">
        <button class="btn btn-primary btn-lg" data-next>${n === 3 ? "Create our first project ✦" : "Next →"}</button>
      </div>`,
    wire(root) {
      root.querySelectorAll("[data-ex]").forEach(b => b.addEventListener("click", () => {
        const t = root.querySelector("textarea");
        t.value = (t.value.trim() ? t.value.replace(/\s*$/, "") + ", " : "") + b.dataset.ex.toLowerCase();
        b.style.opacity = ".4"; b.style.pointerEvents = "none";
        t.dispatchEvent(new Event("input", { bubbles: true }));
      }));
      root.querySelector("[data-next]").addEventListener("click", () => {
        grab();
        if (n === 3) return extract();
        go(n === 1 ? "q2" : "q3");
      });
    },
  };
}

function topbar(n) {
  const dots = n
    ? `<div class="qs-dots">${[1, 2, 3].map(i => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</div>`
    : `<div class="qs-dots" style="visibility:hidden"><i></i></div>`;
  const back = n ? `<button class="qs-back" data-back>←</button>` : `<span class="qs-back" style="visibility:hidden">←</span>`;
  return `<div class="qs-top">${back}${dots}<span class="qs-brand">North Star</span></div>`;
}

const SCREENS = {
  welcome: () => ({
    html: `
      <div class="qs-top"><span class="qs-back" style="visibility:hidden">←</span><div class="qs-dots" style="visibility:hidden"><i></i></div><span class="qs-brand">North Star</span></div>
      <div class="qs-body qs-welcome">
        <div class="qs-mark">✦</div>
        <h1>Let's build your child's first adventure.</h1>
        <p class="qs-lede" style="margin-inline:auto">Answer three quick questions — or just talk to me. In about five minutes you'll have a real project, made just for your child.</p>
        <div class="qs-meta"><span>~5 minutes</span><span>No setup forms</span><span>Edit anything later</span></div>
      </div>
      <div class="qs-foot">
        <button class="btn btn-primary btn-lg" data-type>Start — I'll type</button>
        <button class="btn btn-ghost" data-talk>${icon("mic")} I'd rather just talk</button>
        <button class="qs-skip" data-full>Prefer the full guided setup instead?</button>
      </div>`,
    wire(root) {
      root.querySelector("[data-type]").addEventListener("click", () => go("q1"));
      root.querySelector("[data-talk]").addEventListener("click", () => go("talk"));
      root.querySelector("[data-full]").addEventListener("click", () => navigate("/onboarding"));
    },
  }),

  talk: () => ({
    html: `
      <div class="qs-top"><button class="qs-back" data-back>←</button><div class="qs-dots" style="visibility:hidden"><i></i></div><span class="qs-brand">North Star</span></div>
      <div class="qs-body">
        <div class="qs-eyebrow">One quick chat</div>
        <h1>Tell me about your family — in your own words.</h1>
        <p class="qs-lede">Who you are and what matters to you, your kids and what they love — and one project you'd dream up for them. Just talk; I'll sort out the rest.</p>
        <div class="field" style="margin:0">
          <textarea class="qs-input qs-input--tall" data-voice data-voice-label="Tap and talk" placeholder="Tap the mic and just talk — about your family, your kids, and a project you'd love for them…">${esc(S.answers.freeform || "")}</textarea>
        </div>
        <div class="qs-cap">${icon("mic")} Your words appear here as you speak.</div>
      </div>
      <div class="qs-foot">
        <button class="btn btn-primary btn-lg" data-next>Looks right →</button>
      </div>`,
    wire(root) {
      root.querySelector("[data-back]")?.addEventListener("click", () => { grab(); go("welcome"); });
      root.querySelector("[data-next]").addEventListener("click", () => { grab(); extract(); });
    },
  }),

  q1: () => questionScreen({
    n: 1, eyebrow: "Question 1 of 3 · Your family", key: "a1",
    title: "Tell me about your family.",
    lede: "What matters to you, the values you're raising your kids around, the things you love doing together. However it comes out is perfect.",
    placeholder: "e.g. Faith is a big part of our life, we love being outdoors, and we want our kids to grow up kind and curious…",
    examples: ["Faith is important to us", "We love the outdoors", "Kind, curious kids", "Less screen time", "Hard work matters"],
  }),
  q2: () => questionScreen({
    n: 2, eyebrow: "Question 2 of 3 · Your kids", key: "a2",
    title: "Who are your kids — and how do they learn best?",
    lede: "Names and ages, what they're into, and anything about how they tick. Don't overthink it.",
    placeholder: "e.g. Maya's 9, obsessed with horses and drawing, learns by doing. Leo's 6, loves dinosaurs and Lego, can't sit still…",
    examples: ["loves animals", "very hands-on", "gets bored easily", "super creative", "asks big questions"],
  }),
  q3: () => questionScreen({
    n: 3, eyebrow: "Question 3 of 3 · The fun one", key: "a3",
    title: "Imagine one awesome project for your child. What's in it?",
    lede: "Dream a little. What would make their eyes light up? I'll turn it into a real, do-able adventure.",
    placeholder: "e.g. I'd love Maya to learn all about horses — how to care for them, the different breeds — and design her own dream stable…",
    examples: ["something with animals", "building something real", "a bit of adventure", "arts & crafts"],
  }),

  reading: () => ({
    html: craftingHtml("Reading your answers…"),
  }),

  confirm: () => ({
    html: `
      <div class="qs-top"><button class="qs-back" data-back>←</button><div class="qs-dots" style="visibility:hidden"><i></i></div><span class="qs-brand">North Star</span></div>
      <div class="qs-body">
        <div class="qs-eyebrow">Quick check</div>
        <h1>Did I get your kids right?</h1>
        <p class="qs-lede">Just so their project is addressed to the right child. Fix anything that's off.</p>
        <div id="kidRows">
          ${(S.kids.length ? S.kids : [{ name: "", age: "" }]).map((k, i) => kidRow(k, i)).join("")}
        </div>
        <button type="button" class="qs-addkid" data-addkid>＋ Add another child</button>
      </div>
      <div class="qs-foot">
        <button class="btn btn-primary btn-lg" data-build>That's right — build it ✦</button>
      </div>`,
    wire(root) {
      root.querySelector("[data-back]").addEventListener("click", () => go(S.answers.freeform ? "talk" : "q3"));
      root.querySelector("[data-addkid]").addEventListener("click", () => {
        readKidRows(root);
        S.kids.push({ name: "", age: "" });
        paint();
      });
      root.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => {
        readKidRows(root);
        S.kids.splice(+b.dataset.rm, 1);
        paint();
      }));
      root.querySelector("[data-build]").addEventListener("click", () => {
        readKidRows(root);
        if (!S.kids.some(k => k.name.trim())) { toast("Add at least one child's name", { type: "warning" }); return; }
        commitAndGenerate();
      });
    },
  }),

  crafting: () => ({ html: craftingHtml("Understanding your family…"), wire: runCraftingStatus }),

  reveal: () => {
    const p = S.template || {};
    const child = S.targetChild || {};
    return {
      html: `
        <div class="qs-top"><span class="qs-back" style="visibility:hidden">←</span><div class="qs-dots" style="visibility:hidden"><i></i></div><span class="qs-brand">Welcome to North Star</span></div>
        <div class="qs-body">
          <div class="qs-reveal-hero">
            <div class="m">✦</div>
            <div class="eyebrow">From ${S.answers.freeform ? "one chat" : "three answers"} · just now</div>
            <h1>${esc(child.name || "Your child")}'s first adventure is ready.</h1>
            ${S.understood ? `<p class="mirror">${esc(S.understood)}</p>` : ""}
          </div>
          <div class="qs-eyebrow" style="margin-top:22px">${esc(child.name || "")}'s first project</div>
          <div class="qs-proj">
            ${p.passionConnection ? `<div class="pe">✦ ${esc(shortPassion(p.passionConnection))}</div>` : ""}
            <h2>${esc(p.title || "Your project")}</h2>
            ${p.questRole ? `<div class="role">${esc(p.questRole)}</div>` : ""}
            ${p.description ? `<p class="pdesc">${esc(p.description)}</p>` : ""}
            ${(p.domains || []).length ? `<div class="qs-tags">${p.domains.slice(0, 6).map(d => `<span class="qs-tag">${esc(d)}</span>`).join("")}</div>` : ""}
            ${(p.milestones || []).length ? `<div class="qs-mcount">${p.milestones.length} missions inside</div>` : ""}
          </div>
        </div>
        <div class="qs-foot">
          <button class="btn btn-primary btn-lg" data-open>Start this with ${esc(child.name || "your child")} →</button>
          <button class="btn btn-ghost" data-home>Go to my dashboard</button>
        </div>`,
      wire(root) {
        root.querySelector("[data-open]").addEventListener("click", () =>
          navigate(S.savedProjectId ? `/projects/${S.savedProjectId}` : "/"));
        root.querySelector("[data-home]").addEventListener("click", () => navigate("/"));
      },
    };
  },

  error: () => ({
    html: `
      <div class="qs-top"><button class="qs-back" data-back>←</button><div class="qs-dots" style="visibility:hidden"><i></i></div><span class="qs-brand">North Star</span></div>
      <div class="qs-body qs-welcome">
        <div class="qs-mark" style="color:var(--primary)">✦</div>
        <h1>Let's try that again.</h1>
        <p class="qs-lede" style="margin-inline:auto">${esc(S.error || "Something interrupted the magic. Your answers are safe.")}</p>
      </div>
      <div class="qs-foot">
        <button class="btn btn-primary btn-lg" data-retry>Try again</button>
        <button class="btn btn-ghost" data-full>Use the full guided setup instead</button>
      </div>`,
    wire(root) {
      root.querySelector("[data-back]").addEventListener("click", () => go(S.answers.freeform ? "talk" : "q3"));
      root.querySelector("[data-retry]").addEventListener("click", () => (S.retry || extract)());
      root.querySelector("[data-full]").addEventListener("click", () => navigate("/onboarding"));
    },
  }),
};

/* ---------- confirm-row helpers ---------- */
function kidRow(k, i) {
  return `
    <div class="qs-krow" data-krow>
      <div class="qs-kav" style="background:${AV_COLORS[i % AV_COLORS.length]}">${esc(initial(k.name))}</div>
      <input class="qs-kname" value="${esc(k.name || "")}" placeholder="Name" aria-label="Child name"/>
      <input class="qs-kage" value="${k.age ?? ""}" placeholder="Age" inputmode="numeric" aria-label="Age"/>
      <button type="button" class="qs-krm" data-rm="${i}" aria-label="Remove">✕</button>
    </div>`;
}
function readKidRows(root) {
  S.kids = [...root.querySelectorAll("[data-krow]")].map(r => ({
    name: r.querySelector(".qs-kname").value.trim(),
    age: r.querySelector(".qs-kage").value.trim(),
  }));
}

/* ---------- crafting beat ---------- */
function craftingHtml(first) {
  return `
    <div class="qs-craft">
      <div class="qs-orbit"><div class="r"></div><div class="core">✦</div></div>
      <div>
        <div class="qs-cstatus" id="cstatus">${esc(first)}</div>
        <div class="qs-csub">This usually takes a few seconds</div>
      </div>
    </div>`;
}
let _statusTimer = null;
function runCraftingStatus(root) {
  const name = S.targetChild?.name || "your child";
  const lines = ["Understanding your family…", `Getting to know ${name}…`, "Choosing the perfect theme…", `Designing ${name}'s first quest…`, "Adding the finishing touches…"];
  const el = root.querySelector("#cstatus");
  let i = 0;
  clearInterval(_statusTimer);
  _statusTimer = setInterval(() => {
    i = (i + 1) % lines.length;
    if (el) { el.style.opacity = 0; setTimeout(() => { el.textContent = lines[i]; el.style.opacity = 1; }, 220); }
  }, 1600);
}

/* ---------- AI steps ---------- */
async function extract() {
  const { a1, a2, a3, freeform } = S.answers;
  if (!freeform.trim() && !a1.trim() && !a2.trim() && !a3.trim()) {
    toast("Tell me a little about your family first", { type: "warning" });
    return;
  }
  S.retry = extract;
  go("reading");
  try {
    const res = await aiQuickstartExtract(freeform.trim()
      ? { freeform }
      : { family: a1, kids: a2, dream: a3 });
    S.extracted = res;
    S.understood = res.understood || "";
    S.kids = (res.children || []).map(c => ({ name: c.name || "", age: c.age ?? "" }));
    if (!S.kids.length) S.kids = [{ name: "", age: "" }];
    go("confirm");
  } catch (e) {
    S.error = e.message || "Couldn't read your answers just now.";
    go("error");
  }
}

async function commitAndGenerate() {
  const ex = S.extracted || { family: {}, children: [], project: {} };

  // 1) Family — values/passions in; the Core Word is only a *suggestion* (deferred, never forced).
  const fam = ex.family || {};
  setFamily({
    ...(fam.familyName ? { familyName: fam.familyName } : {}),
    values: Array.isArray(fam.values) ? fam.values.join(", ") : (fam.values || ""),
    passions: Array.isArray(fam.passions) ? fam.passions : [],
    ...(fam.suggestedCoreWord ? { coreWordSuggestion: fam.suggestedCoreWord } : {}),
    quickstartAt: new Date().toISOString(),
  });

  // 2) Children — create each confirmed child, enriched from the extraction by name.
  const exByName = {};
  (ex.children || []).forEach(c => { exByName[(c.name || "").toLowerCase()] = c; });
  const created = [];
  S.kids.filter(k => k.name.trim()).forEach(k => {
    const match = exByName[k.name.trim().toLowerCase()] || {};
    const ageNum = parseInt(k.age, 10);
    created.push(addChild({
      name: k.name.trim(),
      age: Number.isFinite(ageNum) ? ageNum : (match.age ?? null),
      passions: match.passions || [],
      strengths: match.strengths || [],
      learningStyle: match.learningStyle ?? 5,
      diyMaterials: 5,
    }));
  });

  // 3) Pick the child the dream is for (fall back to the first).
  const wantName = (ex.project?.forChildName || "").toLowerCase();
  S.targetChild = created.find(c => c.name.toLowerCase() === wantName) || created[0];

  // 4) Generate + save the first project (the dream becomes the generation spark).
  go("crafting");
  const started = Date.now();
  try {
    const family = getState().family || {};
    const intent = ex.project?.idea || S.answers.a3 || S.answers.freeform || "";
    const template = await aiGenerateProject(family, {
      name: S.targetChild.name,
      age: S.targetChild.age,
      passions: S.targetChild.passions,
      learningStyle: S.targetChild.learningStyle,
      strengths: S.targetChild.strengths,
      domains: [],
    }, { intent });
    // keep the crafting beat on screen for at least a moment so it reads as craft
    const wait = Math.max(0, 1400 - (Date.now() - started));
    if (wait) await new Promise(r => setTimeout(r, wait));
    S.template = template;
    const proj = createProjectFromTemplate(template, S.targetChild, "active");
    S.savedProjectId = proj.id;
    markOnboarded();
    clearInterval(_statusTimer);
    go("reveal");
  } catch (e) {
    clearInterval(_statusTimer);
    S.error = e.message || "Couldn't design the project just now — but your family and children are saved.";
    S.retry = () => commitAndGenerate();
    go("error");
  }
}

function markOnboarded() {
  // The family has a real starting point now — treat them as onboarded (depth is
  // earned later), and clear any "resume onboarding" banner.
  update(s => { s.meta = { ...(s.meta || {}), onboarded: true }; });
  try { setOnboardingParked(false); } catch { /* ignore */ }
}

function shortPassion(s) {
  // "Every mission connects to horses and art…" → a short tag for the eyebrow.
  const m = String(s).match(/connects?\s+(?:directly\s+)?to\s+([^,.—]+)/i);
  return (m ? m[1] : s).trim().slice(0, 40);
}

/* Internal seam for render tests: lets a harness set state + render a screen
   in isolation (no auth/AI). Not used by the app. */
export const __qsTest = {
  setState: (partial) => { S = { screen: "welcome", answers: { a1: "", a2: "", a3: "", freeform: "" }, extracted: null, kids: [], ...partial }; },
  screenHtml: (name) => SCREENS[name]().html,
  shortPassion,
};
