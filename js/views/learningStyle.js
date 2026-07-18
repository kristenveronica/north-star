/* ============================================================
   learningStyle.js — "Learning Profile" page.

   A calm, capability-based profile that gives North Star just enough
   to personalise dramatically without overwhelming the parent. Keeps
   the Learning Style slider (Explorer ↔ Traditional) + DIY slider, and
   adds five lightweight cards. Core principle: teach the child in front
   of you, not the average child of the same age.
   ============================================================ */

import { getState, updateChild, setTechAgreement } from "../store.js";
import { describeLearningStyle, describeDIY } from "../ai/suggestions.js";
import { domainShort } from "../seed.js";
import { esc, toast } from "../components/ui.js";
import { rerender } from "../app.js";
import { navigate } from "../router.js";
import { autosize } from "./familyVision.js";
import { accSection, accToolbar, wireAccordion } from "../components/accordion.js";
import {
  childTechAgreement, isTechStarted, techProgress, techReviewSuggestion, normalizeTechAgreement,
} from "../lib/techAgreement.js";
import { generateTechAgreementPdf } from "../lib/pdf/agreement.js";

const PAGE = "learning-profile";

let _selectedChildId = null;

const LEVEL_FIELDS = [
  { key: "reading", label: "Reading", hint: "reading words & pages" },
  { key: "spelling", label: "Spelling", hint: "spelling words correctly" },
  { key: "writing", label: "Writing", hint: "forming & composing writing" },
  { key: "mathematics", label: "Mathematics", hint: "" },
  { key: "practicalLife", label: "Practical Life Skills", hint: "" },
];
const LEVEL_OPTIONS = ["", "Not applicable yet", "Below age level", "At age level", "Above age level", "Well above age level"];

// Map earlier option wording onto the new age-relative set so prior answers
// aren't silently cleared when the dropdown changes.
const OLD_LEVEL_MAP = {
  "Needs extra support": "Below age level",
  "Developing": "Below age level",
  "Age appropriate": "At age level",
  "Advanced": "Above age level",
  "Highly advanced": "Well above age level",
};
const mapLevel = (v) => (LEVEL_OPTIONS.includes(v) ? v : (OLD_LEVEL_MAP[v] || ""));

/* "Understanding Your Child" — guided prompt categories. These are conversation
   starters, NOT diagnostic labels. Tapping one reveals example phrases a parent
   can tap to add to their free-text description. */
const UNDERSTANDING_PROMPTS = [
  { key: "attention", label: "Attention & Focus", examples: ["Focuses deeply on interests", "Benefits from movement breaks", "Finds long sitting difficult", "Easily distracted", "Loves timers and routines"] },
  { key: "reading", label: "Reading", examples: ["Reads well above age", "Struggles with decoding", "Loves being read to", "Prefers audiobooks", "Avoids reading"] },
  { key: "writing", label: "Writing", examples: ["Handwriting is tiring", "Fantastic storyteller", "Strong spelling", "Weak spelling", "Prefers typing", "Loves journalling"] },
  { key: "maths", label: "Maths", examples: ["Loves numbers", "Learns visually", "Needs repetition", "Strong conceptual thinker", "Maths confidence fluctuates"] },
  { key: "communication", label: "Communication", examples: ["Expresses themselves better verbally", "Quiet around new people", "Loves presentations", "Needs thinking time before answering"] },
  { key: "executive", label: "Executive Function", examples: ["Needs help getting started", "Excellent organisation", "Easily loses track of time", "Needs reminders", "Loves checklists"] },
  { key: "sensory", label: "Sensory Needs", examples: ["Sensitive to noise", "Sensitive to clothing textures", "Loves movement", "Needs quiet spaces", "Concentrates better outdoors"] },
  { key: "emotional", label: "Emotional Regulation", examples: ["Frustrates easily", "Perseveres through challenges", "Needs reassurance", "Highly empathetic", "Handles change well"] },
  { key: "confidence", label: "Confidence", examples: ["Confident trying new things", "Cautious with new challenges", "Thrives on encouragement", "Afraid of making mistakes"] },
  { key: "motivation", label: "Motivation", examples: ["Driven by real-world purpose", "Loves goals and rewards", "Self-motivated on passions", "Needs help staying motivated"] },
  { key: "social", label: "Social Learning", examples: ["Loves learning with others", "Prefers working alone", "Learns well by teaching others", "Enjoys group projects"] },
  { key: "giftedness", label: "Giftedness", examples: ["Learns new concepts very quickly", "Deep expertise in a passion", "Asks big, abstract questions", "Needs extra challenge"] },
  { key: "physical", label: "Physical Development", examples: ["Strong fine-motor skills", "Developing fine-motor skills", "Highly active and physical", "Great coordination", "Still building coordination"] },
  { key: "other", label: "Other", examples: ["Learns best when it feels real", "Loves visual learning", "Remembers everything they hear", "Prefers hands-on activities"] },
];

// Heuristic phrasing for the "living profile" gentle observations, keyed by the
// capability domain a child gravitates toward.
const OBS_PHRASING = {
  nature: "learns best through nature, movement and hands-on experiences",
  sport: "learns best through movement and physical, hands-on experiences",
  creativity: "loves making, building and creative expression",
  music: "is drawn to music and performance",
  science: "is a curious investigator who loves figuring out how things work",
  enterprise: "is motivated by real-world, entrepreneurial challenges",
  literacy: "thrives through reading, story and language",
  maths: "enjoys logic, numbers and problem-solving",
  digital: "is energised by technology and digital creation",
  leadership: "comes alive when leading and contributing to others",
  practical: "loves practical, real-life hands-on tasks",
  relationships: "learns well through connection and working with others",
  health: "thrives with active movement and wellbeing",
};
const _dismissedObs = new Set(); // session-only: observation keys the parent set aside
const STRENGTH_CHIPS = [
  "Creativity", "Building", "Nature", "Animals", "Leadership", "Problem Solving",
  "Entrepreneurship", "Art", "Music", "Science", "Sport", "Cooking", "Gardening",
  "Helping Others", "Reading", "Storytelling", "Engineering", "Humour", "Organisation", "Persistence",
];
const GROWTH_CHIPS = [
  "Reading", "Writing", "Mathematics", "Confidence", "Organisation", "Focus",
  "Communication", "Friendships", "Financial Literacy", "Practical Life",
  "Resilience", "Responsibility", "Emotional Regulation", "Leadership",
];

const normProfile = (lp) => {
  lp = (lp && !Array.isArray(lp)) ? lp : {};
  return {
    levels: lp.levels || {},
    levelsNote: lp.levelsNote || "",
    differences: Array.isArray(lp.differences) ? [...lp.differences] : [],
    differencesNote: lp.differencesNote || "",
    // "Understanding Your Child" free text. Migrate legacy chips + note into it.
    understanding: lp.understanding
      || [Array.isArray(lp.differences) && lp.differences.length ? lp.differences.join(", ") : "", lp.differencesNote || ""].filter(Boolean).join(" — ")
      || "",
    about: lp.about || "",
    academics: (lp.academics && !Array.isArray(lp.academics)) ? lp.academics : {},
    tech: (lp.tech && !Array.isArray(lp.tech)) ? lp.tech : {},
  };
};

// Technology & Digital Learning — what resources North Star may recommend.
const TECH_PREFS = [
  { key: "youtube", label: "Educational YouTube videos" },
  { key: "ted", label: "TED Talks" },
  { key: "podcasts", label: "Podcasts" },
  { key: "audiobooks", label: "Audiobooks" },
  { key: "documentaries", label: "Documentaries" },
  { key: "courses", label: "Online courses" },
  { key: "websites", label: "Educational websites" },
  { key: "ai", label: "AI tools" },
  { key: "coding", label: "Coding platforms" },
  { key: "musicApps", label: "Music learning apps" },
  { key: "languageApps", label: "Language learning apps" },
];
function describeTechRole(v) {
  const n = Number(v) || 5;
  if (n <= 3) return "Mostly Hands-On — real materials and people first, minimal screens";
  if (n <= 7) return "Balanced — a healthy mix of hands-on and digital";
  return "Mostly Digital — embraces digital tools and online learning";
}

// Optional traditional-curriculum fields. North Star blends whatever the family
// already uses into projects rather than sitting it outside the platform.
const ACADEMIC_FIELDS = [
  { key: "maths", label: "Maths curriculum", placeholder: "e.g. Math-U-See Beta, or Khan Academy" },
  { key: "reading", label: "Reading curriculum", placeholder: "e.g. All About Reading Level 2" },
  { key: "language", label: "Language / spelling curriculum", placeholder: "e.g. All About Spelling, French via Duolingo" },
  { key: "science", label: "Science curriculum", placeholder: "e.g. Berean Builders, or unit studies" },
  { key: "requirements", label: "Province / state requirements", placeholder: "e.g. NSW outcomes, or Ontario Grade 4" },
  { key: "textbooks", label: "Textbooks in use", placeholder: "e.g. Saxon Math 5/4" },
  { key: "workbooks", label: "Workbooks in use", placeholder: "e.g. Spectrum Writing, weekly pages" },
  { key: "testing", label: "Testing schedule", placeholder: "e.g. termly NAPLAN-style check, none" },
];

export function renderLearningStyle(container, opts = {}) {
  const s = getState();
  // `opts.childId` scopes this to one child (used when embedded as a Children-hub
  // tab); `opts.embedded` drops the page's own topbar + child picker.
  if (opts.childId) _selectedChildId = opts.childId;
  if (!_selectedChildId && s.children[0]) _selectedChildId = s.children[0].id;
  const child = s.children.find(c => c.id === _selectedChildId);
  const embedded = !!opts.embedded;

  container.innerHTML = `
    ${embedded ? "" : `
    <div class="topbar">
      <div>
        <h1>Learning Profile</h1>
        <div class="sub">Help North Star understand how your child learns today. These answers help personalise projects, recommendations and learning experiences. You can update this profile anytime as your child grows.</div>
      </div>
    </div>`}

    ${!embedded && s.children.length > 1 ? `
      <div class="row mb-2" style="gap:8px">
        ${s.children.map(c => `<button class="chip ${c.id === _selectedChildId ? "selected" : ""}" data-child="${c.id}">${esc(c.name)}</button>`).join("")}
      </div>
    ` : ""}

    ${child ? renderProfileCards(child) : `<div class="empty">Add a child first.</div>`}
  `;

  if (!embedded) {
    container.querySelectorAll("[data-child]").forEach(b => {
      b.addEventListener("click", () => { _selectedChildId = b.dataset.child; rerender(); });
    });
  }

  if (child) { wireSliders(container, child); wireProfileCards(container, child); wireAccordion(container, PAGE); }
}

/* ---------- Learning Style + DIY sliders (unchanged) ---------- */
function renderChildSliders(child) {
  const style = describeLearningStyle(child.learningStyle);
  const diy = describeDIY(child.diyMaterials);
  return `
    <div class="grid" style="grid-template-columns: 2fr 1fr; gap:18px">
      <div class="stack">
        <div class="card">
          <h3>Learning Style — ${esc(child.name)}</h3>
          <p class="text-muted small">Drag the slider from unschooling (1) to traditional academic (10). This tells North Star how to package learning.</p>
          <div class="slider-wrap">
            <input type="range" min="1" max="10" value="${child.learningStyle}" id="ls-slider" class="slider"/>
            <div class="slider-scale">
              <span>1 · Explorer</span><span>3 · Guided</span><span>5 · Hybrid</span><span>7 · Structured</span><span>10 · Traditional</span>
            </div>
          </div>
          <div class="card mt-2" style="background:var(--card-elev);padding:16px">
            <div class="row" style="gap:10px;align-items:center">
              <div class="brand-mark">${child.learningStyle}</div>
              <div>
                <div class="fw-700" id="ls-label">${esc(style.label)}</div>
                <div class="small text-muted" id="ls-summary">${esc(style.summary)}</div>
              </div>
            </div>
            <p class="mt-2" id="ls-flavour" style="font-style:italic;color:var(--text-muted)">${esc(style.flavour)}</p>
          </div>
        </div>

        <div class="card">
          <h3>DIY Materials Slider</h3>
          <p class="text-muted small">How much time and energy do you want to put into making your own materials?</p>
          <div class="slider-wrap">
            <input type="range" min="1" max="10" value="${child.diyMaterials}" id="diy-slider" class="slider"/>
            <div class="slider-scale">
              <span>1 · Make everything</span><span>5 · Balanced</span><span>10 · Buy everything</span>
            </div>
          </div>
          <div class="card mt-2" style="background:var(--card-elev);padding:16px">
            <div class="fw-700" id="diy-label">${esc(diy.label)}</div>
            <div class="small text-muted" id="diy-summary">${esc(diy.summary)}</div>
          </div>
        </div>
      </div>

      <div class="card" style="position:sticky;top:24px;height:fit-content">
        <h3 class="mb-2">Suggested resources at this level</h3>
        <ul id="ls-materials" style="padding-left:18px;margin:0;color:var(--text-muted)">
          ${style.materials.map(m => `<li>${esc(m)}</li>`).join("")}
        </ul>
        <div class="divider"></div>
        <a class="btn btn-primary btn-sm" href="#/materials">See all Learning Resources →</a>
      </div>
    </div>
  `;
}

/* ---------- Learning Profile — collapsible sections ----------
   Same calm visual language as Learning Resources. All load closed; opening one
   gently closes the others (with an "Expand all" override). The slider block
   leads as the first section, then the lightweight profile cards. */
function renderProfileCards(child) {
  const p = normProfile(child.learningProfile);
  const tech = p.tech;
  const name = esc(child.name);
  const obs = observationPrompt(getState(), child);

  const levelsBody = `
    <p class="text-muted small">Where ${name} is working today — regardless of age. We teach the child in front of us, so reading, spelling, writing and maths can each sit at their own level. Choose "Not applicable yet" if it's too early (e.g. a young child not yet reading).</p>
    <div class="grid grid-2" style="gap:14px;margin-top:8px">
      ${LEVEL_FIELDS.map(f => `
        <div class="field" style="margin:0">
          <label>${f.label}${f.hint ? ` <span class="text-muted small" style="font-weight:400">— ${f.hint}</span>` : ""}</label>
          <select class="input" data-level="${f.key}">
            ${LEVEL_OPTIONS.map(o => `<option value="${esc(o)}" ${mapLevel(p.levels[f.key]) === o ? "selected" : ""}>${o || "— Not set —"}</option>`).join("")}
          </select>
        </div>`).join("")}
    </div>
    <div class="field" style="margin:16px 0 0">
      <label>Anything else you'd like North Star to know about your child's current learning?</label>
      <textarea class="textarea" id="lp-levels-note" data-voice data-voice-label="Speak your notes" placeholder="e.g. Reading is well above age level, but maths confidence is still developing.">${esc(p.levelsNote)}</textarea>
    </div>`;

  const understandingBody = `
    <p class="text-muted small">Help North Star understand how ${name} learns best. The more we understand their unique learning style, strengths and challenges, the more personalised every project, recommendation and report becomes. There are no right or wrong answers, and <strong>a diagnosis isn't required</strong> — your observations as a parent are often far more valuable than a clinical label.</p>

    ${obs ? `
      <div class="card" style="background:var(--primary-soft);border:none;margin:12px 0 0">
        <div class="small fw-700" style="margin-bottom:4px">💡 A gentle observation</div>
        <p class="small" style="margin:0 0 10px">${esc(obs.text)}</p>
        <div class="row" style="gap:8px">
          <button class="btn btn-sm btn-primary" data-obs-confirm="${esc(obs.confirmText)}" data-obs-key="${esc(obs.key)}">Yes, that's ${esc(name)}</button>
          <button class="btn btn-sm btn-ghost" data-obs-dismiss="${esc(obs.key)}">Not quite</button>
        </div>
      </div>` : ""}

    <div class="field" style="margin:14px 0 0">
      <textarea class="textarea" id="lp-understanding" rows="5" data-voice data-voice-label="Describe how your child learns" placeholder="Tell us anything that would help North Star better understand how ${name} learns — e.g. 'Suspected ADHD, reads well above age level, struggles with spelling, benefits from movement breaks, becomes overwhelmed in noisy environments, loves visual learning, prefers hands-on activities, remembers everything he hears but dislikes writing…'">${esc(p.understanding)}</textarea>
    </div>

    <div class="small text-muted" style="margin:14px 0 6px">Not sure what to share? Tap a topic for ideas — then tap any phrase to add it:</div>
    <div id="lp-prompts" class="stack" style="gap:8px">
      ${UNDERSTANDING_PROMPTS.map(pr => `
        <div data-prompt="${pr.key}">
          <button type="button" class="chip" data-prompt-toggle="${pr.key}" style="cursor:pointer">+ ${esc(pr.label)}</button>
          <div class="chip-group" data-prompt-ex="${pr.key}" style="display:none;margin-top:6px;padding-left:4px">
            ${pr.examples.map(ex => `<button type="button" class="chip" data-prompt-insert="${esc(ex)}" style="cursor:pointer;font-size:12px;background:var(--card)">${esc(ex)}</button>`).join("")}
          </div>
        </div>`).join("")}
    </div>`;

  const strengthsBody = `
    <p class="text-muted small">Tell North Star what already lights ${name} up. We'll intentionally build on these wherever possible.</p>
    <div id="lp-strength-chips" class="mt-1"></div>`;

  const growthBody = `
    <p class="text-muted small">Choose a few areas you'd love North Star to gently strengthen through projects and everyday learning.</p>
    <div id="lp-growth-chips" class="mt-1"></div>`;

  const academicBody = `
    <p class="text-muted small">Follow a more traditional pathway? Tell North Star what you use and it becomes another ingredient woven into projects — e.g. "complete pages 34–36 of your maths workbook", or a reflection tied to today's reading. Leave anything blank you don't use.</p>
    <div class="grid grid-2" style="margin-top:10px">
      ${ACADEMIC_FIELDS.map(fld => `
        <div class="field">
          <label>${fld.label}</label>
          <input class="input" data-acad="${fld.key}" value="${esc(p.academics[fld.key] || "")}" placeholder="${esc(fld.placeholder)}"/>
        </div>
      `).join("")}
    </div>`;

  const techBody = `
    <p class="text-muted small">North Star sits <em>above</em> your child's whole learning ecosystem — coaches, tutors, apps, courses — and connects it, rather than replacing what's already working. Tell us how you'd like technology to feature and it personalises every project accordingly. Editable anytime.</p>

    <div class="field" style="margin-top:14px">
      <label>Preferred role of technology</label>
      <div class="slider-wrap">
        <input type="range" min="1" max="10" value="${Number(tech.role) || 5}" id="tech-role" class="slider"/>
        <div class="slider-scale"><span>1 · Mostly Hands-On</span><span>5 · Balanced</span><span>10 · Mostly Digital</span></div>
      </div>
      <div class="small mt-1"><span class="fw-700" id="tech-role-label">${esc(describeTechRole(tech.role))}</span></div>
      <p class="small text-muted mt-2"><strong>This setting influences every project North Star creates.</strong> A family that prefers mostly hands-on learning will receive very different projects from one that's comfortable with more digital learning. North Star uses this preference when deciding whether to recommend books, real-world experiences, conversations, printable resources, documentaries, podcasts, educational apps, AI tools and other digital resources. You can update it any time as your child grows.</p>
    </div>

    <div class="field" style="margin-top:16px">
      <label>North Star may recommend…</label>
      <div class="row" style="flex-wrap:wrap;gap:9px;margin-top:8px">
        ${TECH_PREFS.map(o => `
          <label class="chip" style="cursor:pointer;display:inline-flex;align-items:center;gap:7px;${(tech.allow || []).includes(o.key) ? "background:var(--primary-soft);border-color:var(--primary)" : ""}">
            <input type="checkbox" data-techpref="${o.key}" ${(tech.allow || []).includes(o.key) ? "checked" : ""} style="margin:0"/> ${esc(o.label)}
          </label>`).join("")}
      </div>
      <div class="small text-muted mt-1">Every recommended resource is paired with reflection, application or creation — North Star never suggests passive watching.</div>
    </div>

    <div class="field" style="margin-top:16px">
      <label>Existing learning, mentors &amp; tools <span class="text-muted small" style="font-weight:400">(optional)</span></label>
      <textarea class="textarea" id="tech-ecosystem" data-voice data-voice-label="Speak your child's existing learning" placeholder="e.g. Weekly piano teacher (Mrs Lee), soccer club Tue/Thu, Duolingo Spanish, Khan Academy maths, swim squad. North Star extends and deepens these rather than replacing them.">${esc(tech.ecosystem || "")}</textarea>
    </div>

    ${techAgreementBox(child)}`;

  const aboutBody = `
    <p class="text-muted small">Imagine introducing ${name} to someone who'll be guiding their learning journey for the next year. What would you want them to understand?</p>
    <div class="field" style="margin:10px 0 0">
      <label>What makes your child uniquely them?</label>
      <textarea class="textarea" id="lp-about" rows="5" data-voice data-voice-label="Speak about your child" placeholder="e.g. Noah loves solving real-world problems, thrives outdoors and becomes deeply engaged when learning has a purpose. Repetitive worksheets quickly disengage him, but meaningful projects capture his full attention.">${esc(p.about)}</textarea>
    </div>`;

  const SECTIONS = [
    { id: "style", icon: "🎛️", title: "Learning Style & Approach", blurb: `How learning is best packaged for ${child.name}, and how much you'd like to make yourself.`, body: renderChildSliders(child) },
    { id: "levels", icon: "📊", title: "Current Learning Levels", blurb: `Where ${child.name} is working today — at their own level, regardless of age.`, body: levelsBody },
    { id: "understanding", icon: "💡", title: `Understanding ${child.name}`, blurb: "How they learn best — patterns, strengths and challenges (no diagnosis needed).", body: understandingBody },
    { id: "strengths", icon: "⭐", title: "Current Strengths", blurb: `What already lights ${child.name} up — we build on these.`, body: strengthsBody },
    { id: "growth", icon: "🌱", title: "Areas Ready For Growth", blurb: "A few areas to gently strengthen through everyday learning.", body: growthBody },
    { id: "academic", icon: "📚", title: "Academic & Curriculum", blurb: "Optional — any traditional curriculum you'd like woven into projects.", body: academicBody },
    { id: "tech", icon: "💻", title: "Technology & Digital Learning", blurb: `How you'd like technology — and existing mentors and tools — to feature for ${child.name}.`, body: techBody },
    { id: "about", icon: "💛", title: "Tell Us About Your Child", blurb: `The story behind who ${child.name} is.`, body: aboutBody },
  ];

  return `
    <div class="mt-3" style="max-width:980px">
      ${accToolbar(PAGE)}
      <div class="stack">
        ${SECTIONS.map(sec => accSection(PAGE, sec, sec.body, { cls: "lt-acc--form" })).join("")}
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:14px">
        <span class="small text-muted" id="lp-status" aria-live="polite"></span>
      </div>
    </div>
  `;
}

/* The Technology Agreement entry box — lives at the bottom of the Technology &
   Digital Learning section. Per child (children differ by age). Offers to start
   from a sibling's agreement (like "same as billing address"). */
function techAgreementBox(child) {
  const started = isTechStarted(childTechAgreement(child));
  const prog = techProgress(childTechAgreement(child));
  const name = esc(child.name);

  if (started) {
    const nudge = techReviewSuggestion(child);
    return `
      <div class="card" style="margin-top:18px;border:1px solid var(--primary-soft);background:var(--card-elev)">
        <div class="row-between" style="align-items:flex-start;gap:10px">
          <h4 style="margin:0">📋 ${name}'s Technology Agreement</h4>
          <span class="tag">${prog.addressed}/${prog.total} sections</span>
        </div>
        <p class="small text-muted" style="margin:6px 0 0">A living agreement that shapes how North Star designs ${name}'s learning — and a PDF you can print and sign together.</p>
        ${nudge && nudge.kind !== "setup" ? `<p class="small" style="margin:8px 0 0;color:var(--primary-ink)">💡 ${esc(nudge.text)}</p>` : ""}
        <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="btn btn-sm btn-primary" data-ta-edit>Edit agreement</button>
          <button class="btn btn-sm" data-ta-pdf>⬇ Generate PDF</button>
        </div>
      </div>`;
  }

  // Not started — siblings who already have one can seed it.
  const siblings = getState().children.filter(c => c.id !== child.id && isTechStarted(childTechAgreement(c)));
  return `
    <div class="card" style="margin-top:18px;border:1px dashed var(--border);background:var(--card-elev)">
      <h4 style="margin:0">📋 Create a Technology Agreement for ${name}</h4>
      <p class="small text-muted" style="margin:6px 0 0">Every family approaches technology differently. Think through your digital values together — devices, internet, YouTube, AI, gaming, social media, communication, privacy, screen time and online safety — and North Star will respect them in every project it designs for ${name}. You can print a beautiful agreement to sign together.</p>
      ${siblings.length ? `
        <div class="field" style="margin:12px 0 0;max-width:360px">
          <label class="small">Same as another child? Start from their agreement:</label>
          <select class="input" data-ta-copy-from>
            <option value="">— Start from scratch —</option>
            ${siblings.map(c => `<option value="${esc(c.id)}">Use ${esc(c.name)}'s agreement</option>`).join("")}
          </select>
          <span class="hint">You'll be able to edit everything before saving or printing.</span>
        </div>` : ""}
      <div class="row" style="margin-top:12px">
        <button class="btn btn-sm btn-primary" data-ta-create>Create agreement →</button>
      </div>
    </div>`;
}

function wireTechAgreementBox(container, child) {
  container.querySelector("[data-ta-edit]")?.addEventListener("click", () => navigate(`/technology/${child.id}`));

  container.querySelector("[data-ta-create]")?.addEventListener("click", () => {
    const fromId = container.querySelector("[data-ta-copy-from]")?.value || "";
    if (fromId) {
      const sib = getState().children.find(c => c.id === fromId);
      const clone = normalizeTechAgreement(childTechAgreement(sib));
      // A fresh agreement for THIS child — keep the content, reset review history.
      clone.lastReviewedAt = null;
      clone.reviewedAgeBands = [];
      setTechAgreement(child.id, clone);
    }
    navigate(`/technology/${child.id}`);
  });

  container.querySelector("[data-ta-pdf]")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget; const orig = btn.textContent;
    btn.disabled = true; btn.textContent = "Generating…";
    try {
      await generateTechAgreementPdf({ child: getState().children.find(c => c.id === child.id) || child, family: getState().family || {} });
      toast("Agreement PDF ready — check your downloads.", { type: "success" });
    } catch (err) {
      console.error("Tech agreement PDF failed", err);
      toast("Couldn't generate the PDF just now. Please try again.", { type: "error", duration: 3200 });
    } finally { btn.disabled = false; btn.textContent = orig; }
  });
}

// Living Learning Profile — a gentle, heuristic observation North Star surfaces
// from the child's project patterns. The parent simply confirms or edits it, so
// the profile becomes more accurate over time. (AI-driven follow-ups can replace
// this heuristic later; the confirm/edit loop stays the same.)
function observationPrompt(state, child) {
  if (!child) return null;
  const counts = {};
  (state.projects || []).filter(pr => pr.childId === child.id)
    .forEach(pr => (pr.domains || []).forEach(d => { counts[d] = (counts[d] || 0) + 1; }));
  const ranked = Object.entries(counts).filter(([d]) => OBS_PHRASING[d]).sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < 2) return null;
  const [domain] = ranked[0];
  const key = `${child.id}:${domain}`;
  if (_dismissedObs.has(key)) return null;
  const nm = child.name || "your child";
  return {
    key,
    text: `We've noticed ${nm} often gravitates to ${domainShort(domain)} projects. Would you say ${nm} ${OBS_PHRASING[domain]}?`,
    confirmText: `${nm} ${OBS_PHRASING[domain]}.`,
  };
}

function wireProfileCards(container, child) {
  const p = normProfile(child.learningProfile);
  const strengths = [...(child.strengths || [])];
  const growth = [...(child.areasDeveloping || [])];
  const statusEl = container.querySelector("#lp-status");

  const gatherLevels = () => {
    const levels = {};
    container.querySelectorAll("[data-level]").forEach(sel => {
      if (sel.value) levels[sel.dataset.level] = sel.value;
    });
    return levels;
  };

  const gatherAcademics = () => {
    const academics = {};
    container.querySelectorAll("[data-acad]").forEach(inp => {
      const v = inp.value.trim();
      if (v) academics[inp.dataset.acad] = v;
    });
    return academics;
  };

  const gatherTech = () => {
    const roleEl = container.querySelector("#tech-role");
    const ecoEl = container.querySelector("#tech-ecosystem");
    // One measure only: the slider. The AI derives an approximate digital % from it.
    return {
      role: roleEl ? parseInt(roleEl.value, 10) : 5,
      allow: [...container.querySelectorAll("[data-techpref]:checked")].map(c => c.dataset.techpref),
      ecosystem: ecoEl ? ecoEl.value.trim() : "",
    };
  };

  let t;
  const persist = () => {
    clearTimeout(t);
    if (statusEl) statusEl.textContent = "Saving…";
    t = setTimeout(() => {
      const understanding = container.querySelector("#lp-understanding").value.trim();
      // Preserve the per-child Technology Agreement (authored on its own page) —
      // it lives in this same learning_profile blob and must not be clobbered.
      const live = getState().children.find(c => c.id === child.id);
      const techAgreement = live?.learningProfile?.techAgreement;
      updateChild(child.id, {
        strengths: [...strengths],
        areasDeveloping: [...growth],
        learningProfile: {
          levels: gatherLevels(),
          levelsNote: container.querySelector("#lp-levels-note").value.trim(),
          understanding,
          // Kept in sync so anything still reading differencesNote keeps working.
          differencesNote: understanding,
          about: container.querySelector("#lp-about").value.trim(),
          academics: gatherAcademics(),
          tech: gatherTech(),
          ...(techAgreement ? { techAgreement } : {}),
        },
      });
      if (statusEl) statusEl.textContent = "✓ Saved";
    }, 500);
  };

  // Levels dropdowns + notes + about
  container.querySelectorAll("[data-level]").forEach(sel => sel.addEventListener("change", persist));
  container.querySelectorAll("[data-acad]").forEach(inp => inp.addEventListener("input", persist));
  ["#lp-levels-note", "#lp-understanding", "#lp-about", "#tech-ecosystem"].forEach(id => {
    const el = container.querySelector(id);
    if (el) { autosize(el); el.addEventListener("input", persist); }
  });

  // Technology & Digital Learning controls
  const techRole = container.querySelector("#tech-role");
  if (techRole) techRole.addEventListener("input", () => {
    const lbl = container.querySelector("#tech-role-label");
    if (lbl) lbl.textContent = describeTechRole(techRole.value);
    persist();
  });
  container.querySelectorAll("[data-techpref]").forEach(c => c.addEventListener("change", persist));

  // Technology Agreement entry box (per child)
  wireTechAgreementBox(container, child);

  // Chip groups
  mountChips(container.querySelector("#lp-strength-chips"), STRENGTH_CHIPS, strengths, persist);
  mountChips(container.querySelector("#lp-growth-chips"), GROWTH_CHIPS, growth, persist);

  // "Understanding Your Child" — expandable prompt topics + tap-to-add phrases.
  const ta = container.querySelector("#lp-understanding");
  const appendPhrase = (phrase, joiner) => {
    const cur = ta.value.trim();
    const piece = cur ? phrase.charAt(0).toLowerCase() + phrase.slice(1) : phrase;
    ta.value = cur ? `${cur.replace(/[.,;\s]+$/, "")}${joiner}${piece}` : phrase;
    autosize(ta);
    persist();
  };
  container.querySelectorAll("[data-prompt-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const ex = container.querySelector(`[data-prompt-ex="${btn.dataset.promptToggle}"]`);
      if (!ex) return;
      const open = ex.style.display !== "none";
      ex.style.display = open ? "none" : "";
      btn.textContent = `${open ? "+" : "–"} ${btn.textContent.slice(2)}`;
    });
  });
  container.querySelectorAll("[data-prompt-insert]").forEach(btn => {
    btn.addEventListener("click", () => { appendPhrase(btn.dataset.promptInsert, ", "); toast("Added"); });
  });

  // Living profile: confirm or set aside the gentle observation.
  container.querySelector("[data-obs-confirm]")?.addEventListener("click", (e) => {
    appendPhrase(e.currentTarget.dataset.obsConfirm, ". ");
    _dismissedObs.add(e.currentTarget.dataset.obsKey);
    toast("Thanks — noted", { type: "success" });
    rerender();
  });
  container.querySelector("[data-obs-dismiss]")?.addEventListener("click", (e) => {
    _dismissedObs.add(e.currentTarget.dataset.obsDismiss);
    rerender();
  });
}

/* A selectable-chip group with custom add. `arr` is mutated in place. */
function mountChips(host, presets, arr, onChange) {
  if (!host) return;
  const render = () => {
    const customs = arr.filter(x => !presets.includes(x));
    host.innerHTML = `
      <div class="row" style="flex-wrap:wrap;gap:8px;align-items:center">
        ${presets.map(p => `<button class="chip ${arr.includes(p) ? "selected" : ""}" data-chip="${esc(p)}" type="button">${esc(p)}</button>`).join("")}
        ${customs.map(c => `<button class="chip selected" data-chip="${esc(c)}" type="button">${esc(c)} ✕</button>`).join("")}
        <input class="input chip-add" placeholder="+ Add your own" style="width:150px;height:34px;padding:5px 12px;font-size:13px"/>
      </div>`;
    host.querySelectorAll("[data-chip]").forEach(b => b.addEventListener("click", () => {
      const v = b.dataset.chip;
      const i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1); else arr.push(v);
      onChange(); render();
    }));
    const add = host.querySelector(".chip-add");
    add?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const v = add.value.trim();
      if (v && !arr.includes(v)) { arr.push(v); onChange(); render(); host.querySelector(".chip-add")?.focus(); }
    });
  };
  render();
}

/* ---------- Sliders (unchanged behaviour) ---------- */
function wireSliders(container, child) {
  const lsSlider = container.querySelector("#ls-slider");
  const diySlider = container.querySelector("#diy-slider");
  if (!lsSlider) return;

  const updateLS = (paintOnly = false) => {
    const v = parseInt(lsSlider.value, 10);
    const desc = describeLearningStyle(v);
    container.querySelector("#ls-label").textContent = desc.label;
    container.querySelector("#ls-summary").textContent = desc.summary;
    container.querySelector("#ls-flavour").textContent = desc.flavour;
    container.querySelector("#ls-materials").innerHTML =
      desc.materials.map(m => `<li>${esc(m)}</li>`).join("");
    container.querySelector(".brand-mark").textContent = v;
    if (!paintOnly) updateChild(child.id, { learningStyle: v });
  };
  const updateDIY = (paintOnly = false) => {
    const v = parseInt(diySlider.value, 10);
    const desc = describeDIY(v);
    container.querySelector("#diy-label").textContent = desc.label;
    container.querySelector("#diy-summary").textContent = desc.summary;
    if (!paintOnly) updateChild(child.id, { diyMaterials: v });
  };
  lsSlider.addEventListener("input", () => updateLS(true));
  lsSlider.addEventListener("change", () => { updateLS(false); toast("Style updated"); });
  diySlider.addEventListener("input", () => updateDIY(true));
  diySlider.addEventListener("change", () => { updateDIY(false); toast("Saved"); });
}
