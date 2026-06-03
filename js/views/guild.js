/* ============================================================
   guild.js — The Learning Guild (Layer 15).
   A premium, opt-in, parent-controlled community surface.
   ============================================================ */

import {
  getState, setGuildConfig, toggleQuestTeam,
  addShowcase, celebrateShowcase, addShowcaseComment, removeShowcase,
  requestMentorship, approveMentorship, rejectMentorship, completeMentorship,
  joinChallenge, leaveChallenge, completeChallenge,
  setSkillExchange,
} from "../store.js";
import { QUEST_TEAMS, CHALLENGES, MENTORS, MENTORSHIP_CATEGORIES } from "../communityCatalogue.js";
import { esc, icon, toast, openModal, fmtDate, DOMAIN_COLOR_CLASS } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

const TABS = [
  { id: "quest-teams",   label: "Quest Teams",        icon: "🧭" },
  { id: "showcase",      label: "Project Showcase",   icon: "🏅" },
  { id: "mentorship",    label: "Mentorship",         icon: "🤝" },
  { id: "challenges",    label: "Community Challenges", icon: "🎯" },
  { id: "local",         label: "Local Families",     icon: "🏘" },
  { id: "skills",        label: "Skill Exchange",     icon: "🔁" },
  { id: "councils",      label: "Family Councils",    icon: "🪑" },
  { id: "spotlights",    label: "Family Spotlights",  icon: "✨" },
];

let _tab = "quest-teams";

/* ============================================================
   ROOT VIEW
   ============================================================ */
export function renderGuild(container, params = {}) {
  const s = getState();
  const cfg = s.guildConfig || {};
  if (!cfg.premiumEnabled) return renderGate(container);

  if (params.tab) _tab = params.tab;

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>The Learning Guild</h1>
        <div class="sub">A purpose-driven community — not a feed, not a comparison engine.</div>
      </div>
      <div class="btn-row">
        <button class="btn" data-go="/guild/settings">${icon("settings")} Community settings</button>
      </div>
    </div>

    <div class="guild-tabs">
      ${TABS.map(t => `<button class="guild-tab ${_tab === t.id ? "active" : ""}" data-tab="${t.id}">
        <span class="ico">${t.icon}</span>
        <span>${esc(t.label)}</span>
      </button>`).join("")}
    </div>

    <div id="guild-panel"></div>
  `;

  paintPanel(container.querySelector("#guild-panel"));

  container.querySelectorAll("[data-tab]").forEach(b => {
    b.addEventListener("click", () => { _tab = b.dataset.tab; rerender(); });
  });
  container.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.go)));
}

function paintPanel(panel) {
  const s = getState();
  const html = {
    "quest-teams":  questTeamsPanel(s),
    "showcase":     showcasePanel(s),
    "mentorship":   mentorshipPanel(s),
    "challenges":   challengesPanel(s),
    "local":        localPanel(s),
    "skills":       skillsPanel(s),
    "councils":     councilsPanel(s),
    "spotlights":   spotlightsPanel(s),
  }[_tab] || "";
  panel.innerHTML = html;
  wirePanel(panel);
}

/* ============================================================
   GATE — premium opt-in + parent safety controls
   ============================================================ */
function renderGate(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>The Learning Guild</h1>
        <div class="sub">A purpose-driven community for homeschool families.</div>
      </div>
    </div>

    <div class="card" style="max-width:780px;background:linear-gradient(135deg, var(--sage-soft), var(--card-elev));border-color:var(--sage-soft)">
      <h2 style="font-family:var(--font-serif)">A community designed not to feel like social media.</h2>
      <p class="text-muted">No follower counts. No vanity metrics. No infinite scroll. A purposeful space for projects, mentorship, service and meaningful connection.</p>

      <div class="grid grid-2 mt-2">
        ${[
          ["Quest Teams", "Kids join interest-based crews — Young Entrepreneurs, Storytellers, Outdoor Adventurers."],
          ["Project Showcase", "Celebrate finished work. Comments are about encouragement, not approval."],
          ["Mentorship", "Older kids mentor younger ones. Always parent-approved."],
          ["Community Challenges", "Grow Something. Interview an Elder. Start a Business. Badges, not prizes."],
          ["Local Families", "Find other homeschool families nearby — visibility you control."],
          ["Skill Exchange", "Kids teach what they know. Learning becomes contribution."],
          ["Family Councils", "Monthly ritual to celebrate, reflect and plan together."],
          ["Family Spotlights", "Inspiration from other families — never a popularity contest."],
        ].map(([t, b]) => `<div><div class="fw-700">${esc(t)}</div><div class="small text-muted">${esc(b)}</div></div>`).join("")}
      </div>

      <div class="divider"></div>
      <h4>Parents control everything</h4>
      <p class="small text-muted">Each child's participation, what's visible, who can interact, mentorship, messaging, local matching — all opt-in, all parent-approved.</p>

      <div class="row mt-2" style="gap:10px">
        <button class="btn btn-primary btn-lg" id="enable-guild">Enable The Learning Guild (free for MVP)</button>
        <a class="btn" href="#/">Maybe later</a>
      </div>
    </div>
  `;
  container.querySelector("#enable-guild").addEventListener("click", () => {
    setGuildConfig({ premiumEnabled: true });
    toast("Learning Guild enabled — visit Community settings to configure participation", { type: "success", duration: 3500 });
    rerender();
  });
}

/* ============================================================
   PANEL: QUEST TEAMS
   ============================================================ */
function questTeamsPanel(s) {
  const memberships = s.questTeamMemberships || {};
  const child = activeChildOrFirst(s);
  return `
    ${childPicker(s, "qt")}
    ${child ? `
      <div class="grid grid-auto">
        ${QUEST_TEAMS.map(t => {
          const on = (memberships[child.id] || []).includes(t.id);
          return `
            <div class="card card-hover" data-toggle-team="${t.id}" style="cursor:pointer;border-color:${on ? "var(--primary)" : "var(--border)"};background:${on ? "linear-gradient(135deg, var(--primary-soft), var(--card-elev))" : "var(--card)"}">
              <div class="row" style="gap:12px;align-items:flex-start">
                <div style="font-size:30px">${t.icon}</div>
                <div style="flex:1">
                  <div class="fw-700" style="font-family:var(--font-serif);font-size:17px">${esc(t.name)}</div>
                  <div class="small text-muted">${esc(t.blurb)}</div>
                </div>
                <span class="tag ${on ? "tag-primary" : ""}">${on ? "Joined" : "Join"}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    ` : `<div class="empty">Add a child first.</div>`}
  `;
}

/* ============================================================
   PANEL: SHOWCASE
   ============================================================ */
function showcasePanel(s) {
  const showcases = (s.showcases || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const myShowcases = showcases.filter(x => !x.fromOtherFamily);
  const others = showcases.filter(x => x.fromOtherFamily);
  return `
    <div class="row-between mb-2">
      <h3>Showcase a finished project</h3>
      <button class="btn btn-primary" id="open-showcase">+ Showcase one of your projects</button>
    </div>

    ${myShowcases.length ? `
      <div class="grid grid-auto mb-3">
        ${myShowcases.map(showcaseCard).join("")}
      </div>
    ` : ""}

    <h3 class="mt-3 mb-2">From other families</h3>
    <p class="small text-muted mb-2">Real-feel sample showcases — in a live deployment this fills with other Learning Guild families.</p>
    <div class="grid grid-auto">
      ${others.map(showcaseCard).join("")}
    </div>
  `;
}

function showcaseCard(sc) {
  return `
    <div class="card">
      <div class="row" style="gap:10px;margin-bottom:8px;align-items:flex-start">
        <div style="font-size:24px">${sc.icon || "🏅"}</div>
        <div style="flex:1">
          <div class="fw-700" style="font-family:var(--font-serif);font-size:17px">${esc(sc.title)}</div>
          <div class="small text-muted">${esc(sc.childName || "Your project")} ${sc.family ? " · " + esc(sc.family) : ""}</div>
        </div>
      </div>
      <p class="small">${esc(sc.summary || "")}</p>
      ${sc.lessons ? `<div class="small text-muted mt-1"><b>What they learned:</b> ${esc(sc.lessons)}</div>` : ""}
      <div class="divider"></div>
      <div class="row-between">
        <span class="small text-muted">${sc.points ? `${sc.points} pts earned` : ""}</span>
        <div class="row" style="gap:6px">
          <button class="btn btn-sm" data-celebrate="${sc.id}">🎉 ${sc.celebrations || 0}</button>
          <button class="btn btn-sm" data-comment="${sc.id}">💬 ${(sc.comments || []).length}</button>
          ${sc.fromOtherFamily ? "" : `<button class="btn btn-ghost btn-sm" data-del-showcase="${sc.id}">Remove</button>`}
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   PANEL: MENTORSHIP
   ============================================================ */
function mentorshipPanel(s) {
  const requests = (s.mentorshipRequests || []).slice().reverse();
  const pending = requests.filter(r => r.status === "pending");
  return `
    ${pending.length ? `
      <div class="suggestion-banner">
        <div class="label">Awaiting parent approval (${pending.length})</div>
        <div class="stack mt-1">
          ${pending.map(r => {
            const mentor = MENTORS.find(m => m.id === r.mentorId);
            const mentee = s.children.find(c => c.id === r.menteeChildId);
            return `
              <div class="row" style="gap:10px;flex-wrap:wrap">
                <span style="flex:1">${esc(mentee?.name || "?")} → ${esc(mentor?.name || "?")} for <b>${esc(r.category)}</b></span>
                <button class="btn btn-sm btn-sage" data-approve-ment="${r.id}">Approve</button>
                <button class="btn btn-sm" data-reject-ment="${r.id}">Reject</button>
              </div>`;
          }).join("")}
        </div>
      </div>
    ` : ""}

    <h3 class="mb-2">Available mentors</h3>
    <p class="small text-muted mb-2">Older kids who have volunteered to mentor. All requests require parent approval.</p>
    <div class="grid grid-auto">
      ${MENTORS.map(m => `
        <div class="card">
          <div class="row" style="gap:12px;align-items:flex-start;margin-bottom:8px">
            <div class="child-card-avatar avatar-${m.avatarIndex}">${initials(m.name)}</div>
            <div style="flex:1">
              <div class="fw-700">${esc(m.name)}, ${m.age}</div>
              <div class="small text-muted">${esc(m.family)}</div>
            </div>
          </div>
          <div class="chip-group mb-2">
            ${m.categories.map(c => `<span class="chip" style="cursor:default">${esc(c)}</span>`).join("")}
          </div>
          <p class="small">${esc(m.bio)}</p>
          <div class="row mt-2" style="gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" data-request-mentor="${m.id}">Request mentorship →</button>
          </div>
        </div>
      `).join("")}
    </div>

    <h3 class="mt-3 mb-2">Active &amp; past mentorships</h3>
    ${requests.filter(r => r.status !== "pending").length === 0
      ? `<div class="small text-muted">None yet. Request a mentor above.</div>`
      : `<div class="stack">${requests.filter(r => r.status !== "pending").map(r => {
          const mentor = MENTORS.find(m => m.id === r.mentorId);
          const mentee = s.children.find(c => c.id === r.menteeChildId);
          return `
            <div class="row" style="gap:10px;padding:10px;border:1px solid var(--border);border-radius:var(--r-md)">
              <span class="fw-600" style="flex:1">${esc(mentee?.name || "?")} ↔ ${esc(mentor?.name || "?")} · ${esc(r.category)}</span>
              <span class="tag ${r.status === "active" ? "tag-sage" : r.status === "rejected" ? "" : "tag-primary"}">${esc(r.status)}</span>
              ${r.status === "active" ? `<button class="btn btn-sm" data-complete-ment="${r.id}">Mark complete</button>` : ""}
            </div>`;
        }).join("")}</div>`}
  `;
}

/* ============================================================
   PANEL: CHALLENGES
   ============================================================ */
function challengesPanel(s) {
  const participants = s.challengeParticipants || {};
  return `
    <p class="small text-muted mb-2">Pick one or two per month. Badges, not prizes. Recognition, not competition.</p>
    <div class="grid grid-auto">
      ${CHALLENGES.map(ch => {
        const joined = participants[ch.id] || [];
        const myKids = joined.filter(p => s.children.some(c => c.id === p.childId));
        return `
          <div class="card">
            <div class="row" style="gap:12px;align-items:flex-start;margin-bottom:8px">
              <div style="font-size:30px">${ch.icon}</div>
              <div style="flex:1">
                <div class="fw-700" style="font-family:var(--font-serif);font-size:17px">${esc(ch.name)}</div>
                <div class="small text-muted">${esc(ch.duration)} · ${esc(ch.period)} · 🏅 ${esc(ch.badge)}</div>
              </div>
            </div>
            <p class="small">${esc(ch.blurb)}</p>
            ${myKids.length ? `<div class="small text-sage fw-700 mt-1">${myKids.map(p => s.children.find(c => c.id === p.childId)?.name || "").join(", ")} joined</div>` : ""}
            <div class="divider"></div>
            <div class="chip-group">
              ${s.children.map(c => {
                const isIn = myKids.some(p => p.childId === c.id);
                return `<button class="chip ${isIn ? "selected" : ""}" data-toggle-challenge="${ch.id}::${c.id}">${esc(c.name)} ${isIn ? "✓" : "+"}</button>`;
              }).join("")}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* ============================================================
   PANEL: LOCAL FAMILIES
   ============================================================ */
function localPanel(s) {
  const cfg = s.guildConfig || {};
  const loc = cfg.location || {};
  // Sample local families (mock)
  const sampleLocal = cfg.localMatchingAllowed && loc.city ? sampleLocalFamilies(loc) : [];
  return `
    <div class="card mb-2" style="background:var(--card-elev)">
      <h3>Local family matching</h3>
      <p class="small text-muted">Optional. When enabled, the system can suggest nearby homeschool families with overlapping interests. You control visibility and whether any contact is allowed.</p>
      <label class="checkbox mt-1"><input type="checkbox" id="local-toggle" ${cfg.localMatchingAllowed ? "checked" : ""}/> Enable local matching for our family</label>
      <div class="grid grid-2 mt-2">
        <div class="field"><label>City</label><input class="input" id="loc-city" value="${esc(loc.city || "")}" placeholder="e.g. Wanaka"/></div>
        <div class="field"><label>Region / country</label><input class="input" id="loc-region" value="${esc(loc.region || "")}" placeholder="e.g. NZ"/></div>
      </div>
      <button class="btn btn-primary btn-sm" id="save-local">Save</button>
    </div>

    ${cfg.localMatchingAllowed && loc.city ? `
      <h3 class="mb-2">Sample local matches near ${esc(loc.city)}</h3>
      <p class="small text-muted mb-2">In a live deployment these are real families who have opted in to local matching.</p>
      <div class="grid grid-auto">
        ${sampleLocal.map(f => `
          <div class="card">
            <div class="fw-700">${esc(f.name)}</div>
            <div class="small text-muted">${esc(f.city)} · ${esc(f.kids)}</div>
            <div class="chip-group mt-1">
              ${f.interests.map(i => `<span class="chip" style="cursor:default">${esc(i)}</span>`).join("")}
            </div>
            <div class="divider"></div>
            <button class="btn btn-sm" data-connect-family="${esc(f.name)}">Request connection (parent-to-parent)</button>
          </div>
        `).join("")}
      </div>
    ` : `<div class="empty">Set your city and enable local matching to see suggestions.</div>`}
  `;
}
function sampleLocalFamilies(loc) {
  return [
    { name: "The Rivers Family", city: loc.city, kids: "3 kids · 7, 10, 13", interests: ["entrepreneurship", "skiing", "writing"] },
    { name: "The Henley Family", city: loc.city, kids: "2 kids · 8, 11", interests: ["outdoor", "art", "service"] },
    { name: "The Moana Family",  city: loc.city, kids: "4 kids · 5, 8, 11, 14", interests: ["coding", "AI", "music"] },
  ];
}

/* ============================================================
   PANEL: SKILL EXCHANGE
   ============================================================ */
function skillsPanel(s) {
  return `
    <p class="small text-muted mb-2">Every child has something to teach. Add what they know — and what they'd love to learn from another kid.</p>
    <div class="stack">
      ${s.children.map(c => {
        const x = (s.skillExchange || {})[c.id] || { teaches: [], wantsToLearn: [] };
        return `
          <div class="card">
            <div class="row" style="gap:12px;align-items:center;margin-bottom:10px">
              <div class="child-card-avatar avatar-${c.avatarIndex}">${initials(c.name)}</div>
              <h3 style="font-family:var(--font-serif);font-size:18px">${esc(c.name)}</h3>
            </div>
            <div class="grid grid-2">
              <div class="field">
                <label>I can teach</label>
                <input class="input" data-skills-teach="${c.id}" placeholder="comma separated" value="${esc((x.teaches || []).join(", "))}"/>
              </div>
              <div class="field">
                <label>I want to learn</label>
                <input class="input" data-skills-learn="${c.id}" placeholder="comma separated" value="${esc((x.wantsToLearn || []).join(", "))}"/>
              </div>
            </div>
            <div class="row" style="justify-content:flex-end">
              <button class="btn btn-primary btn-sm" data-save-skills="${c.id}">Save</button>
            </div>
          </div>
        `;
      }).join("") || `<div class="empty">Add a child first.</div>`}
    </div>

    <h3 class="mt-3 mb-2">Who's teaching what (sample directory)</h3>
    <p class="small text-muted mb-2">In a live deployment, kids across the Guild who match what your kids want to learn appear here.</p>
    <div class="grid grid-auto">
      ${[
        { name: "Maya R., 15", teaches: ["podcasting", "first-business basics"] },
        { name: "Eli M., 13", teaches: ["animation", "story structure"] },
        { name: "Iris K., 16", teaches: ["pottery", "market stall setup"] },
        { name: "Sol H., 14", teaches: ["organising group events"] },
      ].map(t => `
        <div class="card">
          <div class="fw-700">${esc(t.name)}</div>
          <div class="chip-group mt-1">${t.teaches.map(s => `<span class="chip" style="cursor:default">${esc(s)}</span>`).join("")}</div>
        </div>
      `).join("")}
    </div>
  `;
}

/* ============================================================
   PANEL: FAMILY COUNCILS (link out)
   ============================================================ */
function councilsPanel(s) {
  const recent = (s.familyCouncils || []).slice(-3).reverse();
  return `
    <div class="card" style="background:linear-gradient(135deg, var(--primary-soft), var(--card-elev));border-color:var(--primary-soft)">
      <h3 style="font-family:var(--font-serif);font-size:22px">Gather. Celebrate. Plan.</h3>
      <p>Once a month — or at the end of each term — generate a Family Council Guide. It pulls together wins, completed projects, emerging strengths, challenges, vision alignment, and a guided conversation. Sit around the table together and use it.</p>
      <div class="row mt-2" style="gap:10px">
        <a class="btn btn-primary" href="#/councils">Open Family Councils →</a>
      </div>
    </div>

    ${recent.length ? `
      <h3 class="mt-3 mb-2">Recent councils</h3>
      <div class="grid grid-auto">
        ${recent.map(c => `
          <div class="card card-hover" style="cursor:pointer" onclick="location.hash='#/councils/${c.id}'">
            <span class="tag tag-primary">${esc(c.periodLabel)}</span>
            <div class="fw-700 mt-1">${fmtDate(c.generatedAt, { short: false })}</div>
            <div class="small text-muted">${c.sections.projectsCompleted.length} projects · ${c.sections.momentumEarned.reduce((s, m) => s + m.points, 0)} pts</div>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;
}

/* ============================================================
   PANEL: FAMILY SPOTLIGHTS
   ============================================================ */
function spotlightsPanel(s) {
  // Top 4 most-celebrated showcases from other families
  const top = (s.showcases || []).filter(x => x.fromOtherFamily).slice().sort((a, b) => (b.celebrations || 0) - (a.celebrations || 0)).slice(0, 4);
  return `
    <p class="small text-muted mb-2">Curated each month from across the Guild. The aim is inspiration — not popularity.</p>
    <div class="grid grid-2">
      ${top.map(sc => `
        <div class="card" style="background:linear-gradient(135deg, var(--gold-soft), var(--card-elev));border-color:var(--gold-soft)">
          <div style="font-size:32px">${sc.icon || "✨"}</div>
          <div class="fw-700 mt-1" style="font-family:var(--font-serif);font-size:18px">${esc(sc.title)}</div>
          <div class="small text-muted">${esc(sc.childName)} · ${esc(sc.family)}</div>
          <p class="small mt-2">${esc(sc.summary)}</p>
          ${sc.lessons ? `<div class="small text-muted mt-1"><b>Lesson:</b> ${esc(sc.lessons)}</div>` : ""}
          <div class="divider"></div>
          <div class="small text-muted">🎉 ${sc.celebrations || 0} celebrations</div>
        </div>
      `).join("") || `<div class="empty">Spotlights surface as families showcase work.</div>`}
    </div>
  `;
}

/* ============================================================
   Settings sub-route /guild/settings
   ============================================================ */
export function renderGuildSettings(container) {
  const s = getState();
  const cfg = s.guildConfig || {};
  container.innerHTML = `
    <div class="topbar">
      <div>
        <a href="#/guild" class="small text-muted">← The Learning Guild</a>
        <h1>Community settings</h1>
        <div class="sub">Safety and privacy are foundational. Nothing is on by default.</div>
      </div>
    </div>

    <div class="card mb-2">
      <h3>Family-wide permissions</h3>
      <label class="checkbox mt-1"><input type="checkbox" id="g-showcase" ${cfg.showcaseAllowed ? "checked" : ""}/> Allow showcasing our family's completed projects</label>
      <label class="checkbox mt-1"><input type="checkbox" id="g-mentorship" ${cfg.mentorshipAllowed ? "checked" : ""}/> Allow mentorship participation (parent-approved each time)</label>
      <label class="checkbox mt-1"><input type="checkbox" id="g-messaging" ${cfg.messagingAllowed ? "checked" : ""}/> Allow parent-to-parent messaging</label>
      <label class="checkbox mt-1"><input type="checkbox" id="g-local" ${cfg.localMatchingAllowed ? "checked" : ""}/> Allow local family matching</label>
      <label class="checkbox mt-1"><input type="checkbox" id="g-challenges" ${cfg.challengesAllowed ? "checked" : ""}/> Participate in community challenges</label>
    </div>

    <div class="card mb-2">
      <h3>Per-child participation</h3>
      <p class="small text-muted">Each child opts in separately. Off by default.</p>
      ${s.children.map(c => {
        const p = (cfg.childParticipation || {})[c.id] || {};
        return `
          <div class="card mb-2" style="background:var(--card-elev);padding:14px" data-child="${c.id}">
            <div class="row" style="gap:12px;align-items:center;margin-bottom:8px">
              <div class="child-card-avatar avatar-${c.avatarIndex}" style="width:36px;height:36px;font-size:14px">${initials(c.name)}</div>
              <div class="fw-700">${esc(c.name)}</div>
            </div>
            <label class="checkbox"><input type="checkbox" data-cp="participates" ${p.participates ? "checked" : ""}/> Participate in the Guild</label>
            <label class="checkbox mt-1"><input type="checkbox" data-cp="showcaseOk" ${p.showcaseOk ? "checked" : ""}/> Their projects can be shown in our family's showcases</label>
            <label class="checkbox mt-1"><input type="checkbox" data-cp="mentorshipOk" ${p.mentorshipOk ? "checked" : ""}/> Can request mentors / become a mentor</label>
            <label class="checkbox mt-1"><input type="checkbox" data-cp="localOk" ${p.localOk ? "checked" : ""}/> Visible in local family matching</label>
          </div>
        `;
      }).join("")}
    </div>

    <div class="row" style="justify-content:flex-end">
      <button class="btn btn-primary btn-lg" id="save-settings">Save settings</button>
    </div>
  `;

  container.querySelector("#save-settings").addEventListener("click", () => {
    const patch = {
      showcaseAllowed: container.querySelector("#g-showcase").checked,
      mentorshipAllowed: container.querySelector("#g-mentorship").checked,
      messagingAllowed: container.querySelector("#g-messaging").checked,
      localMatchingAllowed: container.querySelector("#g-local").checked,
      challengesAllowed: container.querySelector("#g-challenges").checked,
      childParticipation: {},
    };
    container.querySelectorAll("[data-child]").forEach(card => {
      const id = card.dataset.child;
      patch.childParticipation[id] = {};
      card.querySelectorAll("[data-cp]").forEach(cb => {
        patch.childParticipation[id][cb.dataset.cp] = cb.checked;
      });
    });
    setGuildConfig(patch);
    toast("Community settings saved", { type: "success" });
    rerender();
  });
}

/* ============================================================
   PANEL WIRING
   ============================================================ */
function wirePanel(panel) {
  // Active child picker
  panel.querySelectorAll("[data-pick-child]").forEach(b => {
    b.addEventListener("click", () => {
      const s = getState();
      s.meta.activeChildId = b.dataset.pickChild;
      // ✱ Note: we intentionally don't persist meta change individually; rerender refreshes.
      rerender();
    });
  });

  // Quest teams
  panel.querySelectorAll("[data-toggle-team]").forEach(b => {
    b.addEventListener("click", () => {
      const child = activeChildOrFirst(getState());
      if (!child) return;
      toggleQuestTeam(child.id, b.dataset.toggleTeam);
      rerender();
    });
  });

  // Showcase
  panel.querySelector("#open-showcase")?.addEventListener("click", () => openShowcaseModal());
  panel.querySelectorAll("[data-celebrate]").forEach(b => b.addEventListener("click", () => { celebrateShowcase(b.dataset.celebrate); toast("🎉 Celebrated"); rerender(); }));
  panel.querySelectorAll("[data-comment]").forEach(b => b.addEventListener("click", () => openCommentModal(b.dataset.comment)));
  panel.querySelectorAll("[data-del-showcase]").forEach(b => b.addEventListener("click", () => { removeShowcase(b.dataset.delShowcase); toast("Removed"); rerender(); }));

  // Mentorship
  panel.querySelectorAll("[data-request-mentor]").forEach(b => b.addEventListener("click", () => openMentorshipRequestModal(b.dataset.requestMentor)));
  panel.querySelectorAll("[data-approve-ment]").forEach(b => b.addEventListener("click", () => { approveMentorship(b.dataset.approveMent); toast("Mentorship approved", { type: "success" }); rerender(); }));
  panel.querySelectorAll("[data-reject-ment]").forEach(b => b.addEventListener("click", () => { rejectMentorship(b.dataset.rejectMent); toast("Mentorship declined"); rerender(); }));
  panel.querySelectorAll("[data-complete-ment]").forEach(b => b.addEventListener("click", () => { completeMentorship(b.dataset.completeMent); toast("Marked complete"); rerender(); }));

  // Challenges
  panel.querySelectorAll("[data-toggle-challenge]").forEach(b => {
    b.addEventListener("click", () => {
      const [challengeId, childId] = b.dataset.toggleChallenge.split("::");
      const s = getState();
      const participants = (s.challengeParticipants?.[challengeId]) || [];
      if (participants.some(p => p.childId === childId)) leaveChallenge(challengeId, childId);
      else joinChallenge(challengeId, childId);
      rerender();
    });
  });

  // Local
  panel.querySelector("#save-local")?.addEventListener("click", () => {
    setGuildConfig({
      localMatchingAllowed: panel.querySelector("#local-toggle").checked,
      location: {
        city: panel.querySelector("#loc-city").value.trim(),
        region: panel.querySelector("#loc-region").value.trim(),
      },
    });
    toast("Saved", { type: "success" });
    rerender();
  });
  panel.querySelectorAll("[data-connect-family]").forEach(b => {
    b.addEventListener("click", () => toast(`Connection request sent to ${b.dataset.connectFamily} (mock — real messaging coming in a future release).`, { duration: 3500 }));
  });

  // Skills
  panel.querySelectorAll("[data-save-skills]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.dataset.saveSkills;
      const teachInput = panel.querySelector(`[data-skills-teach="${id}"]`);
      const learnInput = panel.querySelector(`[data-skills-learn="${id}"]`);
      const teaches = teachInput.value.split(",").map(s => s.trim()).filter(Boolean);
      const wantsToLearn = learnInput.value.split(",").map(s => s.trim()).filter(Boolean);
      setSkillExchange(id, { teaches, wantsToLearn });
      toast("Saved", { type: "success" });
    });
  });
}

/* ============================================================
   MODALS
   ============================================================ */
function openShowcaseModal() {
  const s = getState();
  const completed = s.projects.filter(p => p.status === "completed");
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="small text-muted">Showcase one of your family's completed projects. This appears in the Guild — celebrating, never competing.</p>
    <div class="field">
      <label>Pick a project</label>
      <select class="select" id="sc-proj">
        <option value="">— Start from scratch —</option>
        ${completed.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>Showcase title</label><input class="input" id="sc-title"/></div>
    <div class="field"><label>Summary</label><textarea class="textarea" id="sc-summary" data-voice data-voice-label="Tell the story" rows="3"></textarea></div>
    <div class="field"><label>What did you learn?</label><textarea class="textarea" id="sc-lessons" data-voice data-voice-label="Speak the lessons" rows="3"></textarea></div>
    <div class="small text-muted">Photo upload comes when the backend is wired. For now, the showcase lives as text + emoji.</div>
  `;
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end";
  foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="sc-save">Publish to Guild</button>`;
  const m = openModal({ title: "New showcase", body, footer: foot });

  body.querySelector("#sc-proj").addEventListener("change", (e) => {
    const p = completed.find(p => p.id === e.target.value);
    if (p) {
      body.querySelector("#sc-title").value = p.title;
      body.querySelector("#sc-summary").value = p.description || "";
    }
  });
  foot.querySelector("#sc-save").addEventListener("click", () => {
    const title = body.querySelector("#sc-title").value.trim();
    if (!title) { toast("Title needed", { type: "warning" }); return; }
    const projId = body.querySelector("#sc-proj").value;
    const proj = completed.find(p => p.id === projId);
    addShowcase({
      title,
      summary: body.querySelector("#sc-summary").value.trim(),
      lessons: body.querySelector("#sc-lessons").value.trim(),
      projectId: projId || null,
      childId: proj?.childId || null,
      childName: s.children.find(c => c.id === proj?.childId)?.name || "Your family",
      family: s.family?.familyName || "",
      points: proj?.momentumPointsEarned || 0,
      icon: "🏅",
    });
    toast("Published — celebrating!", { type: "success" });
    m.close();
    rerender();
  });
}

function openCommentModal(showcaseId) {
  const body = document.createElement("div");
  const s = getState();
  const sc = (s.showcases || []).find(x => x.id === showcaseId);
  if (!sc) return;
  body.innerHTML = `
    <div class="stack mb-2">
      ${(sc.comments || []).map(c => `
        <div class="card" style="background:var(--card-elev);padding:10px">
          <div class="small text-muted">${fmtDate(c.at, { short: false })} · ${esc(c.from || "Your family")}</div>
          <div>${esc(c.text)}</div>
        </div>
      `).join("") || `<div class="small text-muted">Be the first to encourage them.</div>`}
    </div>
    <div class="field"><label>Add a kind comment</label><textarea class="textarea" id="c-text" data-voice rows="3" placeholder="Encouragement, not critique."></textarea></div>
  `;
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end";
  foot.innerHTML = `<button class="btn" data-close>Done</button><button class="btn btn-primary" id="c-save">Post</button>`;
  const m = openModal({ title: sc.title, body, footer: foot });
  foot.querySelector("#c-save").addEventListener("click", () => {
    const text = body.querySelector("#c-text").value.trim();
    if (!text) { m.close(); return; }
    addShowcaseComment(showcaseId, { text, from: s.family?.familyName || "Your family" });
    toast("Posted", { type: "success" });
    m.close();
    rerender();
  });
}

function openMentorshipRequestModal(mentorId) {
  const s = getState();
  const mentor = MENTORS.find(m => m.id === mentorId);
  if (!mentor) return;
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="text-muted">${esc(mentor.name)}, ${mentor.age} · ${esc(mentor.family)}</p>
    <p>${esc(mentor.bio)}</p>
    <div class="field">
      <label>Which child is requesting?</label>
      <div class="chip-group" id="rm-child">
        ${s.children.map(c => `<button class="chip" data-c="${c.id}">${esc(c.name)}</button>`).join("")}
      </div>
    </div>
    <div class="field">
      <label>Category</label>
      <div class="chip-group" id="rm-cat">
        ${mentor.categories.map(c => `<button class="chip" data-c="${c}">${esc(c)}</button>`).join("")}
      </div>
    </div>
    <p class="small text-muted">Your approval is required before any contact happens.</p>
  `;
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end";
  foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="rm-save">Request →</button>`;
  const m = openModal({ title: "Request mentorship", body, footer: foot });

  let pickedChild = null, pickedCat = null;
  body.querySelectorAll("#rm-child [data-c]").forEach(b => {
    b.addEventListener("click", () => {
      body.querySelectorAll("#rm-child [data-c]").forEach(x => x.classList.remove("selected"));
      b.classList.add("selected"); pickedChild = b.dataset.c;
    });
  });
  body.querySelectorAll("#rm-cat [data-c]").forEach(b => {
    b.addEventListener("click", () => {
      body.querySelectorAll("#rm-cat [data-c]").forEach(x => x.classList.remove("selected"));
      b.classList.add("selected"); pickedCat = b.dataset.c;
    });
  });
  foot.querySelector("#rm-save").addEventListener("click", () => {
    if (!pickedChild || !pickedCat) { toast("Pick a child and category", { type: "warning" }); return; }
    requestMentorship({ mentorId: mentor.id, menteeChildId: pickedChild, category: pickedCat });
    toast("Request submitted — awaiting your parent approval", { type: "success", duration: 3500 });
    m.close();
    rerender();
  });
}

/* ---------- helpers ---------- */
function activeChildOrFirst(s) {
  return s.children.find(c => c.id === s.meta.activeChildId) || s.children[0];
}
function childPicker(s, prefix) {
  if (s.children.length <= 1) return "";
  const active = activeChildOrFirst(s);
  return `
    <div class="row mb-2" style="gap:8px">
      ${s.children.map(c => `<button class="chip ${active?.id === c.id ? "selected" : ""}" data-pick-child="${c.id}">${esc(c.name)}</button>`).join("")}
    </div>`;
}
function initials(name) { return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase(); }
