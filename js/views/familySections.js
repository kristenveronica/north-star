/* ============================================================
   familySections.js — Shared, reusable "Set up your family" sections.

   Single source of truth for the practical family-context sections
   (Home Location · Family Members & Support People · Travel /
   Worldschool · Faith Integration · Family Rhythm). Composed by BOTH:
     • the Parent Portal  → js/views/familySettings.js  (accordions)
     • the Full Setup onboarding → js/views/onboarding.js (one step each)

   Each section exposes { id, icon, title, blurb, body(st), wire(root, st, ctx) }:
     • body(st)          → HTML string, reads from the working-copy state
     • wire(root, st,ctx)→ attaches listeners scoped to `root`, mutating `st`
                           and calling ctx.onChange() on edits.
   All IDs are unique within any single host (portal = one page; onboarding =
   one section per step), so scoping queries to `root` is always safe.

   State + persistence helpers (makeFamilyState / gatherFamilyPatch) keep the
   two hosts perfectly in sync — edit a field here and both update.
   ============================================================ */

import { getState } from "../store.js";
import { esc, toast, confirmDialog } from "../components/ui.js";
import { autosize } from "./familyVision.js";
import { attachLocationAutocomplete } from "../lib/cities.js";
import { defaultRhythm, reflectionSchedule, monthName, MONTHS } from "../lib/schoolYear.js";
import { weeklyLearningBudgetHours } from "../lib/learningCapacity.js";
import { CONTRIBUTION_PERMS, VIEW_PERMS, DEFAULT_CONTRIBUTOR_PERMS } from "../lib/permissions.js";
import { createInvite } from "../lib/invites.js";

/* ---------------- Constants ---------------- */
const HOURS_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8];
const WINDOWS = ["Morning", "Afternoon", "Evening", "Flexible"];
const fmtDateShort = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

export const REL_OPTIONS = [
  "Mother", "Father", "Sibling", "Grandparent", "Step-parent",
  "Co-parent", "Mentor", "Coach", "Caregiver", "Family friend", "Other",
];

const TRAVEL_MODES = [
  { v: "off", label: "Off" },
  { v: "short", label: "Short Trip" },
  { v: "long", label: "Long Stay" },
  { v: "fulltime", label: "Full-Time Worldschooling" },
];
const TRAVEL_PREFS = [
  { v: "local", label: "Local educational things to do only" },
  { v: "projects", label: "Destination-based projects only" },
  { v: "both", label: "Both local experiences and projects" },
];

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "d-" + Math.random().toString(16).slice(2));
const normalizeTravel = (t) => ({
  mode: t?.mode || "off",
  destinations: Array.isArray(t?.destinations) ? t.destinations.map(d => ({ ...d })) : [],
});

/* ---------------- Working state + persistence ----------------
   makeFamilyState()  → mutable working copies for the section bodies/wiring.
   gatherFamilyPatch()→ the exact family patch to hand setFamily(). */
export function makeFamilyState(fam = {}) {
  const loc = { ...(fam.location || {}) };
  const rel = (Array.isArray(fam.relationships) ? fam.relationships : []).map(r => ({
    accessLevel: "contributor", permissions: [], ...r, id: r.id || uid(),
  }));
  const travel = normalizeTravel(fam.travel);
  const faith = {
    enabled: !!fam.faithEnabled,
    tradition: fam.faithTradition || "",
    denomination: fam.faith?.denomination || "",
    churchName: fam.faith?.churchName || "",
    churchWebsite: fam.faith?.churchWebsite || "",
    notes: fam.faith?.notes || "",
  };
  const rhythm = { ...defaultRhythm(loc.country || fam.location?.country), ...(fam.rhythm || {}) };
  return { loc, rel, travel, faith, rhythm };
}

export function gatherFamilyPatch(st) {
  const { loc, rel, travel, faith, rhythm } = st;
  return {
    location: loc.display ? loc : {},
    relationships: rel
      .map(r => ({
        id: r.id || uid(),
        name: (r.name || "").trim(),
        relationship: r.relationship === "Other" ? ((r.relationshipOther || "").trim() || "Other") : r.relationship,
        roleNote: (r.roleNote || "").trim(),
        notes: (r.notes || "").trim(),
        email: (r.email || "").trim(),
        accessLevel: r.accessLevel === "owner" ? "owner" : "contributor",
        permissions: r.accessLevel === "owner" ? [] : (Array.isArray(r.permissions) ? r.permissions : []),
        childIds: r.accessLevel === "owner" ? [] : (Array.isArray(r.childIds) ? r.childIds : []),
      }))
      .filter(r => r.name),
    travel: { mode: travel.mode, destinations: travel.destinations.filter(d => (d.city || "").trim()) },
    faithEnabled: faith.enabled,
    faithTradition: (faith.tradition || "").trim(),
    faith: {
      denomination: (faith.denomination || "").trim(),
      churchName: (faith.churchName || "").trim(),
      churchWebsite: (faith.churchWebsite || "").trim(),
      notes: (faith.notes || "").trim(),
    },
    rhythm: { ...rhythm },
  };
}

/* ============================================================
   Section: Home Location
   ============================================================ */
export const locationSection = {
  id: "location", icon: "📍", title: "Home Location",
  blurb: "Your general area, so North Star can suggest real-world learning near you.",
  body(st) {
    const loc = st.loc;
    return `
      <p class="ns-acc__intro">North Star can use your general location to suggest real-world learning experiences near you — parks, libraries, museums, trails, farms, local businesses and more.</p>
      <div class="field" style="position:relative">
        <label>Home Location</label>
        <input class="input" id="home-loc" autocomplete="off" value="${esc(loc.display || "")}" placeholder="Start typing your suburb, town or city…"/>
      </div>
      <div class="ns-acc__intro" id="loc-detail" style="margin:6px 0 0">${locDetailLine(loc)}</div>
      <div class="row mt-2" style="gap:10px">
        <button class="btn btn-sm" id="loc-clear" type="button">Remove location</button>
      </div>
      <p class="ns-acc__intro" style="margin-top:14px;font-size:12.5px">You choose whether to provide your location, and you can update or remove it at any time. North Star will only use this to personalise suggestions for your family.</p>`;
  },
  wire(root, st, ctx) {
    const loc = st.loc;
    const onChange = ctx.onChange || (() => {});
    const locInput = root.querySelector("#home-loc");
    const locDetail = root.querySelector("#loc-detail");
    attachLocationAutocomplete(locInput, (picked) => {
      Object.assign(loc, picked);
      locInput.value = picked.display;
      if (locDetail) locDetail.innerHTML = locDetailLine(loc);
      onChange();
    });
    locInput.addEventListener("input", () => {
      if (loc.display !== locInput.value) {
        loc.display = locInput.value;
        loc.city = loc.region = loc.country = loc.postcode = "";
        loc.lat = loc.lon = null;
        if (locDetail) locDetail.innerHTML = locDetailLine(loc);
      }
    });
    root.querySelector("#loc-clear").addEventListener("click", () => {
      Object.keys(loc).forEach(k => delete loc[k]);
      locInput.value = "";
      if (locDetail) locDetail.innerHTML = locDetailLine(loc);
      onChange();
    });
  },
};

/* ============================================================
   Section: Family Members & Support People
   ============================================================ */
export const relationshipsSection = {
  id: "relationships", icon: "👪", title: "Family Members & Support People",
  blurb: "The real people in your child's world — North Star only ever refers to those you add.",
  body() {
    return `
      <p class="ns-acc__intro">The trusted adults in your child's world — parents, grandparents, tutors, mentors, coaches. North Star only ever refers to people you add here. For each person you can set an <strong>Access Level</strong> and customise exactly what they can see and do. You are the Owner; everyone else's portal is generated from the permissions you grant.</p>
      <div id="rel-list" class="stack"></div>
      <button class="btn btn-sm mt-2" id="rel-add" type="button">+ Add Person</button>`;
  },
  wire(root, st, ctx) {
    const rel = st.rel;
    const onChange = ctx.onChange || (() => {});
    const children = ctx.children || [];
    const relList = root.querySelector("#rel-list");
    const renderRel = () => {
      relList.innerHTML = rel.length ? rel.map((r, i) => relRow(r, i, children)).join("")
        : `<p class="ns-acc__intro" style="margin:0">No people added yet.</p>`;
      relList.querySelectorAll("[data-rel]").forEach(row => {
        const i = +row.dataset.rel;
        const otherWrap = row.querySelector("[data-other]");
        row.querySelector('[data-rk="name"]').addEventListener("input", e => { rel[i].name = e.target.value; });
        row.querySelector('[data-rk="relationship"]').addEventListener("change", e => {
          rel[i].relationship = e.target.value;
          otherWrap.classList.toggle("hidden", e.target.value !== "Other");
        });
        row.querySelector('[data-rk="relationshipOther"]')?.addEventListener("input", e => { rel[i].relationshipOther = e.target.value; });
        row.querySelector('[data-rk="roleNote"]').addEventListener("input", e => { rel[i].roleNote = e.target.value; });
        row.querySelector('[data-rk="notes"]').addEventListener("input", e => { rel[i].notes = e.target.value; });
        row.querySelector('[data-rk="remove"]').addEventListener("click", () => { rel.splice(i, 1); renderRel(); onChange(); });

        // Access Level — Owner vs Contributor. Owner needs an explicit confirm.
        const permsWrap = row.querySelector(`[data-perms="${i}"]`);
        const hint = row.querySelector(`[data-acc-hint="${i}"]`);
        row.querySelectorAll(`[data-acc-level="${i}"]`).forEach(radio => {
          radio.addEventListener("change", async () => {
            if (!radio.checked) return;
            if (radio.value === "owner") {
              const ok = await confirmDialog({
                title: "Grant Full Owner Access?",
                message: "Owners have complete editing access across your family's educational environment, including Family North Star, Family Settings, Learning Profiles, Child Profiles, permissions and AI configuration. They will have the same authority as you to modify your family's educational experience. Only grant Owner access to someone you trust to jointly manage your child's education.",
                confirmLabel: "Grant Owner Access",
              });
              if (!ok) {
                row.querySelector(`[data-acc-level="${i}"][value="contributor"]`).checked = true;
                return;
              }
              rel[i].accessLevel = "owner";
              permsWrap?.classList.add("hidden");
              if (hint) hint.textContent = "Full editing access across your family's educational environment.";
            } else {
              rel[i].accessLevel = "contributor";
              permsWrap?.classList.remove("hidden");
              if (hint) hint.textContent = "Customise exactly what this person can access below.";
            }
            onChange();
          });
        });

        // Email + invitation.
        row.querySelector('[data-rk="email"]')?.addEventListener("input", e => { rel[i].email = e.target.value; });
        row.querySelector(`[data-invite="${i}"]`)?.addEventListener("click", async () => {
          const statusEl = row.querySelector(`[data-invite-status="${i}"]`);
          const btn = row.querySelector(`[data-invite="${i}"]`);
          if (!(rel[i].email || "").trim()) { statusEl.textContent = "Add an email address first."; return; }
          btn.disabled = true; statusEl.textContent = "Creating invitation…";
          try {
            ctx.commit?.();   // persist the person's access settings before inviting
            const fam = getState().family || {};
            const allIds = (getState().children || []).map(c => c.id);
            const childIds = (rel[i].childIds && rel[i].childIds.length) ? rel[i].childIds : allIds;
            const { link, emailed } = await createInvite({ familyId: fam.id, familyName: fam.familyName, person: { ...rel[i], childIds } });
            statusEl.innerHTML = `${emailed ? "✓ Invite emailed. " : ""}Share this link: <a href="${esc(link)}">${esc(link)}</a> <button class="btn btn-ghost btn-sm" data-copy-link type="button">Copy</button>`;
            statusEl.querySelector("[data-copy-link]")?.addEventListener("click", () => { navigator.clipboard?.writeText(link); toast("Invite link copied", { type: "success" }); });
          } catch (e) {
            statusEl.textContent = e.message || "Couldn't create the invitation.";
          } finally { btn.disabled = false; }
        });

        // Permission toggles (Contribution + View).
        row.querySelectorAll(`[data-perm="${i}"]`).forEach(cb => {
          cb.addEventListener("change", () => {
            rel[i].permissions = rel[i].permissions || [];
            if (cb.checked) { if (!rel[i].permissions.includes(cb.value)) rel[i].permissions.push(cb.value); }
            else rel[i].permissions = rel[i].permissions.filter(k => k !== cb.value);
            cb.closest(".chip")?.classList.toggle("selected", cb.checked);
            onChange();
          });
        });

        // Per-child scope. Store the explicit subset; all-selected = [] (every child).
        row.querySelectorAll(`[data-childacc="${i}"]`).forEach(cb => {
          cb.addEventListener("change", () => {
            const boxes = [...row.querySelectorAll(`[data-childacc="${i}"]`)];
            const checked = boxes.filter(x => x.checked).map(x => x.value);
            rel[i].childIds = (checked.length === boxes.length) ? [] : checked;
            cb.closest(".chip")?.classList.toggle("selected", cb.checked);
            onChange();
          });
        });
      });
    };
    root.querySelector("#rel-add").addEventListener("click", () => {
      rel.push({ id: uid(), name: "", relationship: "Mother", roleNote: "", notes: "", accessLevel: "contributor", permissions: [...DEFAULT_CONTRIBUTOR_PERMS] });
      renderRel();
    });
    renderRel();
  },
};

/* ============================================================
   Section: Travel / Worldschool Mode
   ============================================================ */
export const travelSection = {
  id: "travel", icon: "🌏", title: "Travel / Worldschool Mode",
  blurb: "Turn on when you're away, for local experiences or destination-based projects.",
  body(st) {
    const travel = st.travel;
    return `
      <p class="ns-acc__intro">Turn this on when your family is travelling and you'd like North Star to suggest local learning experiences or destination-based projects.</p>
      <div class="field">
        <label>Travel / Worldschool Mode</label>
        <select class="input" id="travel-mode" style="max-width:320px">
          ${TRAVEL_MODES.map(m => `<option value="${m.v}" ${travel.mode === m.v ? "selected" : ""}>${m.label}</option>`).join("")}
        </select>
      </div>
      <div id="travel-dest-wrap" class="${travel.mode === "off" ? "hidden" : ""}">
        <div id="dest-list" class="stack"></div>
        <button class="btn btn-sm mt-2" id="dest-add" type="button">+ Add Another Destination</button>
      </div>`;
  },
  wire(root, st, ctx) {
    const travel = st.travel;
    const onChange = ctx.onChange || (() => {});
    const modeSel = root.querySelector("#travel-mode");
    const destWrap = root.querySelector("#travel-dest-wrap");
    const destList = root.querySelector("#dest-list");
    const addDestination = () => {
      travel.destinations.push({ id: uid(), city: "", country: "", lat: null, lon: null, arrival: "", departure: "", preference: "both" });
    };
    const renderDest = () => {
      destList.innerHTML = travel.destinations.length
        ? travel.destinations.map((d, i) => destRow(d, i)).join("")
        : `<p class="ns-acc__intro" style="margin:0">Add the places you're heading to.</p>`;
      destList.querySelectorAll("[data-dest]").forEach(row => {
        const i = +row.dataset.dest;
        const cityInput = row.querySelector('[data-dk="city"]');
        attachLocationAutocomplete(cityInput, (picked) => {
          travel.destinations[i].city = picked.city || picked.display;
          travel.destinations[i].country = picked.country || "";
          travel.destinations[i].lat = picked.lat; travel.destinations[i].lon = picked.lon;
          cityInput.value = picked.city ? `${picked.city}${picked.country ? ", " + picked.country : ""}` : picked.display;
          onChange();
        });
        cityInput.addEventListener("input", e => { travel.destinations[i].city = e.target.value; });
        row.querySelector('[data-dk="arrival"]').addEventListener("change", e => { travel.destinations[i].arrival = e.target.value; });
        row.querySelector('[data-dk="departure"]').addEventListener("change", e => { travel.destinations[i].departure = e.target.value; });
        row.querySelector('[data-dk="pref"]').addEventListener("change", e => { travel.destinations[i].preference = e.target.value; });
        row.querySelector('[data-dk="remove"]').addEventListener("click", () => { travel.destinations.splice(i, 1); renderDest(); onChange(); });
      });
    };
    modeSel.addEventListener("change", () => {
      travel.mode = modeSel.value;
      destWrap.classList.toggle("hidden", travel.mode === "off");
      if (travel.mode !== "off" && travel.destinations.length === 0) addDestination();
      renderDest();
    });
    root.querySelector("#dest-add").addEventListener("click", () => { addDestination(); renderDest(); });
    renderDest();
  },
};

/* ============================================================
   Section: Faith Integration
   ============================================================ */
export const faithSection = {
  id: "faith", icon: "🕊️", title: "Faith Integration",
  blurb: "Optional — weave your family's faith values into projects and reflections.",
  body(st) {
    const faith = st.faith;
    return `
      <p class="ns-acc__intro">Turn this on if you'd like North Star to weave your family's faith values into projects, reflections or learning suggestions. It's entirely optional and parent-controlled — no faith language is used unless this is on.</p>
      <label class="checkbox"><input type="checkbox" id="faith-on" ${faith.enabled ? "checked" : ""}/> Faith Integration</label>
      <div id="faith-fields" class="stack mt-2 ${faith.enabled ? "" : "hidden"}" style="gap:14px">
        <div class="grid grid-2">
          <div class="field"><label>Faith tradition</label><input class="input" id="faith-tradition" value="${esc(faith.tradition)}" placeholder="e.g. Christianity, Judaism, Islam…"/></div>
          <div class="field"><label>Denomination <span class="text-muted small">(optional)</span></label><input class="input" id="faith-denom" value="${esc(faith.denomination)}" placeholder="e.g. Baptist, Catholic…"/></div>
        </div>
        <div class="grid grid-2">
          <div class="field"><label>Church / community name <span class="text-muted small">(optional)</span></label><input class="input" id="faith-church" value="${esc(faith.churchName)}" placeholder="e.g. Grace Community Church"/></div>
          <div class="field"><label>Church website <span class="text-muted small">(optional)</span></label><input class="input" id="faith-web" value="${esc(faith.churchWebsite)}" placeholder="https://…"/></div>
        </div>
        <div class="field" style="margin:0">
          <label>How faith should be included <span class="text-muted small">(optional)</span></label>
          <textarea class="textarea fs-textarea" id="faith-notes" rows="3" data-voice data-voice-label="Speak your notes" placeholder="e.g. Gently weave in gratitude and service; keep it warm, never preachy.">${esc(faith.notes)}</textarea>
          <p class="ns-acc__intro" style="margin:6px 0 0;font-size:12.5px">If your church or faith community has a website, North Star may eventually use it to better understand your family's faith context.</p>
        </div>
      </div>`;
  },
  wire(root, st, ctx) {
    const faith = st.faith;
    const faithOn = root.querySelector("#faith-on");
    const faithFields = root.querySelector("#faith-fields");
    const refitFaith = () => root.querySelector("#faith-notes")?.dispatchEvent(new Event("input"));
    faithOn.addEventListener("change", () => {
      faith.enabled = faithOn.checked;
      faithFields.classList.toggle("hidden", !faith.enabled);
      refitFaith();
    });
    const bindFaith = (id, key) => root.querySelector(id)?.addEventListener("input", e => { faith[key] = e.target.value; });
    bindFaith("#faith-tradition", "tradition");
    bindFaith("#faith-denom", "denomination");
    bindFaith("#faith-church", "churchName");
    bindFaith("#faith-web", "churchWebsite");
    bindFaith("#faith-notes", "notes");
    // Re-size the notes box when its accordion opens (portal) and on first wire.
    root.querySelector('[data-acc="faith"]')?.addEventListener("acc:open", refitFaith);
    const notes = root.querySelector("#faith-notes");
    if (notes) autosize(notes, 220);
  },
};

/* ============================================================
   Section: Family Rhythm
   ============================================================ */
export const rhythmSection = {
  id: "rhythm", icon: "🗓️", title: "Family Rhythm",
  blurb: "Your school year, days and hours — so North Star scales to your week, never overfills it.",
  body(st, ctx = {}) {
    const rhythm = st.rhythm;
    const fam = ctx.fam || {};
    const monthOpts = (sel) => MONTHS.map((m, i) => `<option value="${i + 1}" ${(+sel) === (i + 1) ? "selected" : ""}>${m}</option>`).join("");
    return `
      <p class="ns-acc__intro">How learning naturally fits into your family's life. North Star uses this to time reflections, shape the calendar and (soon) scale project workload to your week — never to overfill it. You're not scheduling lessons; you're telling North Star your family's capacity.</p>
      <div class="grid grid-2" style="gap:14px">
        <div class="field" style="margin:0"><label>School year starts</label><select class="input" id="ry-start">${monthOpts(rhythm.schoolYearStartMonth)}</select></div>
        <div class="field" style="margin:0"><label>School year ends</label><select class="input" id="ry-end">${monthOpts(rhythm.schoolYearEndMonth)}</select></div>
        <div class="field" style="margin:0"><label>Hemisphere</label>
          <select class="input" id="ry-hemi">
            <option value="auto" ${!fam.rhythm?.hemisphere ? "selected" : ""}>Auto — from your location</option>
            <option value="northern" ${rhythm.hemisphere === "northern" && fam.rhythm?.hemisphere ? "selected" : ""}>Northern</option>
            <option value="southern" ${rhythm.hemisphere === "southern" && fam.rhythm?.hemisphere ? "selected" : ""}>Southern</option>
          </select>
        </div>
        <div class="field" style="margin:0"><label>Days per week</label>
          <select class="input" id="ry-days">${[1, 2, 3, 4, 5, 6, 7].map(d => `<option value="${d}" ${(+rhythm.daysPerWeek) === d ? "selected" : ""}>${d}</option>`).join("")}</select>
        </div>
        <div class="field" style="margin:0"><label>Learning hours per day</label>
          <select class="input" id="ry-hours">${HOURS_OPTIONS.map(h => `<option value="${h}" ${(+rhythm.hoursPerDay) === h ? "selected" : ""}>${h} ${h === 1 ? "hour" : "hours"}</option>`).join("")}</select>
        </div>
        <div class="field" style="margin:0"><label>Preferred learning window</label>
          <select class="input" id="ry-window">${WINDOWS.map(w => `<option value="${w.toLowerCase()}" ${(rhythm.learningWindow || "").toLowerCase() === w.toLowerCase() ? "selected" : ""}>${w}</option>`).join("")}</select>
        </div>
        <div class="field" style="margin:0"><label>Custom start time <span class="text-muted small">(optional)</span></label><input class="input" type="time" id="ry-start-time" value="${esc(rhythm.customStartTime || "")}"/></div>
        <div class="field" style="margin:0"><label>Custom end time <span class="text-muted small">(optional)</span></label><input class="input" type="time" id="ry-end-time" value="${esc(rhythm.customEndTime || "")}"/></div>
      </div>
      <div class="card" style="background:var(--card-elev);margin-top:14px">
        <div class="small text-muted">North Star organises the year into <strong>four quarters</strong> — its default rhythm of ~9–10 week terms with breaks between, matching the natural seasons. You can still think in semesters; reflections and celebrations follow the quarters.</div>
      </div>
      <div id="ry-preview" class="card" style="margin-top:12px"></div>`;
  },
  wire(root, st, ctx) {
    const rhythm = st.rhythm;
    const loc = st.loc;
    const fam = ctx.fam || {};
    const previewEl = root.querySelector("#ry-preview");
    const paintRhythm = () => {
      const sched = reflectionSchedule(rhythm, new Date());
      const weekly = weeklyLearningBudgetHours(rhythm);
      const lbl = "letter-spacing:0.04em;text-transform:uppercase;font-size:10.5px;color:var(--text-soft)";
      previewEl.innerHTML = `
        <div class="small" style="${lbl};margin-bottom:8px">North Star sees</div>
        <div class="grid grid-2" style="gap:10px">
          <div><div class="small text-muted">Weekly learning budget</div><div class="fw-700">${weekly} ${weekly === 1 ? "hour" : "hours"}/week</div></div>
          <div><div class="small text-muted">School year</div><div class="fw-700">${esc(sched.schoolYear.label)} · ${monthName(rhythm.schoolYearStartMonth)}–${monthName(rhythm.schoolYearEndMonth)}</div></div>
          <div><div class="small text-muted">Current quarter</div><div class="fw-700">${sched.currentQuarter ? sched.currentQuarter.label : "On a break"}</div></div>
          <div><div class="small text-muted">Annual celebration</div><div class="fw-700">${fmtDateShort(sched.annualCelebration)}</div></div>
        </div>
        <div class="small text-muted" style="margin-top:10px">Next reflections — Monthly: <strong>${fmtDateShort(sched.nextMonthly)}</strong> · Quarterly: <strong>${fmtDateShort(sched.nextQuarterly)}</strong> · Annual: <strong>${fmtDateShort(sched.nextAnnual)}</strong></div>`;
    };
    const bindRhythm = (id, key, transform = (v) => v) => {
      const el = root.querySelector(id);
      el?.addEventListener("change", () => { rhythm[key] = transform(el.value); paintRhythm(); });
    };
    root.querySelector("#ry-hemi")?.addEventListener("change", (e) => {
      if (e.target.value === "auto") {
        delete rhythm.hemisphere;
        const d = defaultRhythm(loc.country || fam.location?.country);
        rhythm.hemisphere = d.hemisphere;
      } else {
        rhythm.hemisphere = e.target.value;
      }
      paintRhythm();
    });
    bindRhythm("#ry-start", "schoolYearStartMonth", (v) => parseInt(v, 10));
    bindRhythm("#ry-end", "schoolYearEndMonth", (v) => parseInt(v, 10));
    bindRhythm("#ry-days", "daysPerWeek", (v) => parseInt(v, 10));
    bindRhythm("#ry-hours", "hoursPerDay", (v) => Number(v));
    bindRhythm("#ry-window", "learningWindow");
    bindRhythm("#ry-start-time", "customStartTime");
    bindRhythm("#ry-end-time", "customEndTime");
    paintRhythm();
  },
};

/* The five practical family-context sections, in the portal's order. */
export const FAMILY_SECTIONS = [
  locationSection, relationshipsSection, travelSection, faithSection, rhythmSection,
];

/* ---------------- Small renderers ---------------- */
function locDetailLine(loc) {
  if (!loc.display) return "";
  const parts = [loc.city, loc.region, loc.country, loc.postcode].filter(Boolean);
  const coords = (loc.lat != null && loc.lon != null) ? ` · ${Number(loc.lat).toFixed(2)}, ${Number(loc.lon).toFixed(2)}` : "";
  return parts.length ? `<span class="text-muted">Saved as: ${esc(parts.join(", "))}${coords}</span>` : "";
}

function relRow(r, i, children = []) {
  const isOther = !REL_OPTIONS.includes(r.relationship) || r.relationship === "Other";
  const sel = isOther ? "Other" : r.relationship;
  const isOwner = r.accessLevel === "owner";
  const childIds = Array.isArray(r.childIds) ? r.childIds : [];
  const childOn = (id) => !childIds.length || childIds.includes(id);
  return `
  <div class="ns-person" data-rel="${i}">
    <div class="row" style="gap:12px;flex-wrap:wrap;align-items:flex-end">
      <div class="field" style="flex:2;min-width:150px;margin:0">
        <label class="small">Name</label>
        <input class="input" data-rk="name" value="${esc(r.name || "")}" placeholder="e.g. Grandma Jo"/>
      </div>
      <div class="field" style="flex:1;min-width:150px;margin:0">
        <label class="small">Relationship</label>
        <select class="input" data-rk="relationship">
          ${REL_OPTIONS.map(o => `<option ${o === sel ? "selected" : ""}>${o}</option>`).join("")}
        </select>
      </div>
      <button class="btn btn-ghost btn-sm" data-rk="remove" title="Remove" style="margin-bottom:2px">✕</button>
    </div>
    <div class="field ${isOther ? "" : "hidden"}" data-other style="margin:12px 0 0">
      <label class="small">Who are they to your child?</label>
      <input class="input" data-rk="relationshipOther" value="${esc(isOther && r.relationship !== "Other" ? r.relationship : (r.relationshipOther || ""))}" placeholder="e.g. Godmother, neighbour, business mentor"/>
    </div>
    <div class="grid grid-2" style="margin:12px 0 0">
      <div class="field" style="margin:0">
        <label class="small">Role in their learning journey <span class="text-muted">(optional)</span></label>
        <input class="input" data-rk="roleNote" value="${esc(r.roleNote || "")}" placeholder="e.g. teaches piano, takes them fishing"/>
      </div>
      <div class="field" style="margin:0">
        <label class="small">Notes <span class="text-muted">(optional)</span></label>
        <input class="input" data-rk="notes" value="${esc(r.notes || "")}" placeholder="anything helpful for North Star to know"/>
      </div>
    </div>

    <div class="divider" style="margin:16px 0 12px"></div>
    <div class="field" style="margin:0">
      <label class="small fw-700">Access Level</label>
      <div class="row" style="gap:18px;margin-top:5px">
        <label class="checkbox" style="cursor:pointer"><input type="radio" name="acc-${i}" data-acc-level="${i}" value="owner" ${isOwner ? "checked" : ""}/> Owner</label>
        <label class="checkbox" style="cursor:pointer"><input type="radio" name="acc-${i}" data-acc-level="${i}" value="contributor" ${isOwner ? "" : "checked"}/> Contributor</label>
      </div>
      <span class="hint" data-acc-hint="${i}">${isOwner ? "Full editing access across your family's educational environment." : "Customise exactly what this person can access below."}</span>
    </div>

    <div data-perms="${i}" class="${isOwner ? "hidden" : ""}" style="margin-top:14px">
      <div class="small fw-700 text-muted" style="margin-bottom:7px">Contribution — what they can do</div>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        ${CONTRIBUTION_PERMS.map(p => permChip(i, p, r)).join("")}
      </div>
      <p class="small text-muted" style="margin:6px 0 0">💳 Granting <em>Generate AI Projects</em> or <em>Request AI Reports</em> makes this a billable contributor seat once they accept (manage in Settings → Subscription).</p>
      <div class="small fw-700 text-muted" style="margin:14px 0 7px">View — what they can see</div>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        ${VIEW_PERMS.map(p => permChip(i, p, r)).join("")}
      </div>

      ${children.length ? `
        <div class="small fw-700 text-muted" style="margin:14px 0 7px">Which children can they support?</div>
        <div class="row" style="flex-wrap:wrap;gap:8px">
          ${children.map(c => `<label class="chip ${childOn(c.id) ? "selected" : ""}" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
            <input type="checkbox" data-childacc="${i}" value="${esc(c.id)}" ${childOn(c.id) ? "checked" : ""} style="margin:0"/> ${esc(c.name)}</label>`).join("")}
        </div>
        <span class="hint">All selected = every child (the default). Unselect to limit this person to specific children — e.g. one parent who only supports one child in a blended family.</span>
      ` : ""}

      <p class="small text-muted" style="margin:12px 0 0">Configuration — Family North Star, Family Settings, Learning Profile, child profile editing, capability setup, billing and permissions — is reserved for Owners and never appears in a Contributor's portal.</p>
    </div>

    <div class="field" style="margin:14px 0 0">
      <label class="small">Email <span class="text-muted">(to invite them to their own login)</span></label>
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <input class="input" data-rk="email" type="email" value="${esc(r.email || "")}" placeholder="name@email.com" style="flex:1;min-width:200px"/>
        <button class="btn btn-sm" data-invite="${i}" type="button">Send invite</button>
      </div>
      <div class="small text-muted" data-invite-status="${i}" style="margin-top:7px;word-break:break-all"></div>
    </div>
  </div>`;
}

function permChip(i, p, r) {
  const on = (r.permissions || []).includes(p.key);
  return `<label class="chip ${on ? "selected" : ""}" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
    <input type="checkbox" data-perm="${i}" value="${esc(p.key)}" ${on ? "checked" : ""} style="margin:0"/> ${esc(p.label)}
  </label>`;
}

function destRow(d, i) {
  return `
  <div class="ns-person" data-dest="${i}">
    <div class="row" style="gap:12px;flex-wrap:wrap;align-items:flex-end">
      <div class="field" style="flex:2;min-width:200px;margin:0;position:relative">
        <label class="small">Destination (city, country)</label>
        <input class="input" data-dk="city" autocomplete="off" value="${esc(d.city ? `${d.city}${d.country ? ", " + d.country : ""}` : "")}" placeholder="Start typing a city…"/>
      </div>
      <button class="btn btn-ghost btn-sm" data-dk="remove" title="Remove" style="margin-bottom:2px">✕</button>
    </div>
    <div class="grid grid-2" style="margin:12px 0 0">
      <div class="field" style="margin:0"><label class="small">Arrival</label><input class="input" type="date" data-dk="arrival" value="${esc(d.arrival || "")}"/></div>
      <div class="field" style="margin:0"><label class="small">Departure</label><input class="input" type="date" data-dk="departure" value="${esc(d.departure || "")}"/></div>
    </div>
    <div class="field" style="margin:12px 0 0">
      <label class="small">Travel learning preference</label>
      <select class="input" data-dk="pref" style="max-width:420px">
        ${TRAVEL_PREFS.map(p => `<option value="${p.v}" ${d.preference === p.v ? "selected" : ""}>${p.label}</option>`).join("")}
      </select>
    </div>
  </div>`;
}
