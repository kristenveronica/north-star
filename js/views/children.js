/* ============================================================
   children.js — List + detail/edit for each child.
   ============================================================ */

import { getState, addChild, updateChild, removeChild, getChild, getChildStats } from "../store.js";
import { esc, toast, icon, openModal, confirmDialog } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

export function renderChildren(container) {
  const s = getState();
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Children</h1>
        <div class="sub">Add each child. Each one gets their own profile, projects, and access code.</div>
      </div>
      <button class="btn btn-primary" id="add-child">${icon("plus")} Add child</button>
    </div>

    ${s.children.length === 0 ? `<div class="empty"><div class="emoji">👨‍👩‍👧‍👦</div><h3>No children yet</h3><p>Add your first child to start designing their learning path.</p></div>` : ""}

    <div class="grid grid-auto">
      ${s.children.map(c => childTile(c)).join("")}
    </div>
  `;

  container.querySelector("#add-child").addEventListener("click", () => openChildModal());

  container.querySelectorAll("[data-open-child]").forEach(b => {
    b.addEventListener("click", () => navigate("/children/" + b.dataset.openChild));
  });
  container.querySelectorAll("[data-edit-child]").forEach(b => {
    b.addEventListener("click", (e) => { e.stopPropagation(); openChildModal(b.dataset.editChild); });
  });
  container.querySelectorAll("[data-kid-link]").forEach(b => {
    b.addEventListener("click", (e) => { e.stopPropagation(); navigate("/kid/" + b.dataset.kidLink); });
  });
}

function childTile(c) {
  const stats = getChildStats(c.id);
  return `
    <div class="card card-hover" data-open-child="${c.id}" style="cursor:pointer">
      <div class="row" style="gap:14px;margin-bottom:12px">
        <div class="child-card-avatar avatar-${c.avatarIndex}">${initials(c.name)}</div>
        <div style="flex:1">
          <div class="fw-700" style="font-size:17px">${esc(c.name)}</div>
          <div class="text-muted small">${c.age != null ? "Age " + c.age : ""}${c.grade ? " · " + esc(c.grade) : ""}</div>
        </div>
        <button class="btn btn-ghost btn-sm" data-edit-child="${c.id}">Edit</button>
      </div>
      <div class="chip-group mb-2">
        ${(c.passions || []).slice(0, 4).map(p => `<span class="chip" style="cursor:default">${esc(p)}</span>`).join("")}
        ${(c.passions || []).length > 4 ? `<span class="chip" style="cursor:default">+${c.passions.length - 4} more</span>` : ""}
      </div>
      <div class="row" style="gap:14px">
        <div class="stack-tight"><span class="small text-muted">Stars</span><span class="fw-700">⭐ ${stats.totalStars}</span></div>
        <div class="stack-tight"><span class="small text-muted">Momentum</span><span class="fw-700">${stats.totalMomentum}</span></div>
        <div class="stack-tight"><span class="small text-muted">Projects</span><span class="fw-700">${stats.totalProjects}</span></div>
      </div>
      <div class="divider"></div>
      <div class="row-between">
        <span class="small text-muted">Access code: <span class="kbd">${esc(c.accessCode)}</span></span>
        <button class="btn btn-ghost btn-sm" data-kid-link="${c.accessCode}">${icon("child")} Open view</button>
      </div>
    </div>
  `;
}

/* ---------- Add / Edit modal ---------- */
function openChildModal(childId = null) {
  const existing = childId ? getChild(childId) : null;
  const draft = existing ? { ...existing } : {
    name: "", age: "", birthday: "", grade: "",
    passions: [], strengths: [], supportNeeds: [], goals: [],
    faithEnabled: false, faithTradition: "", notes: "",
    learningStyle: getState().family?.learningStyleDefault ?? 5,
    diyMaterials: getState().family?.diyMaterialsPreference ?? 5,
  };
  const arr = (v) => Array.isArray(v) ? v.join(", ") : v || "";

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="grid grid-2">
      <div class="field"><label>Name</label><input class="input" id="f-name" value="${esc(draft.name)}"/></div>
      <div class="field"><label>Age</label><input class="input" id="f-age" type="number" min="0" max="22" value="${draft.age ?? ""}"/></div>
      <div class="field"><label>Birthday</label><input class="input" id="f-birthday" type="date" value="${esc(draft.birthday || "")}"/></div>
      <div class="field"><label>Grade / year (optional)</label><input class="input" id="f-grade" value="${esc(draft.grade || "")}"/></div>
    </div>
    <details ${draft.birthData?.time || draft.birthData?.city ? "open" : ""} style="margin:0 0 14px">
      <summary class="text-muted small fw-700" style="cursor:pointer;padding:6px 0">Optional birth data (for interpretive frameworks in Child Insights)</summary>
      <div class="grid grid-2" style="margin-top:8px">
        <div class="field"><label>Time of birth</label><input class="input" type="time" id="f-bd-time" value="${esc(draft.birthData?.time || "")}"/></div>
        <div class="field"><label>City of birth</label><input class="input" id="f-bd-city" value="${esc(draft.birthData?.city || "")}" placeholder="e.g. Wanaka, NZ"/></div>
      </div>
      <div class="small text-muted">Used only for optional interpretive frameworks (Astrology / Human Design). Stays on this device.</div>
    </details>
    <div class="field"><label>Passions & interests</label><input class="input" id="f-passions" placeholder="comma separated" value="${esc(arr(draft.passions))}"/></div>
    <div class="field"><label>Strengths</label><input class="input" id="f-strengths" placeholder="comma separated" value="${esc(arr(draft.strengths))}"/></div>
    <div class="field"><label>Areas needing support</label><input class="input" id="f-support" placeholder="comma separated" value="${esc(arr(draft.supportNeeds))}"/></div>
    <div class="field"><label>Current goals</label><input class="input" id="f-goals" placeholder="comma separated" value="${esc(arr(draft.goals))}"/></div>
    <div class="field">
      <label class="checkbox"><input type="checkbox" id="f-faith" ${draft.faithEnabled ? "checked" : ""}/> Include Faith Gigs for this child</label>
      <input class="input mt-1 ${draft.faithEnabled ? "" : "hidden"}" id="f-faith-tradition" placeholder="Faith tradition (e.g. Christian — Anglican)" value="${esc(draft.faithTradition || "")}"/>
    </div>
    <div class="field"><label>Notes from parent</label><textarea class="textarea" id="f-notes" data-voice data-voice-label="Dictate your notes">${esc(draft.notes || "")}</textarea></div>
    <div class="field">
      <label>Child portal PIN <span class="text-muted small">(optional, 4 digits)</span></label>
      <input class="input" id="f-pin" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="leave blank to skip" value="${esc(draft.pin || "")}" style="max-width:160px;letter-spacing:0.4em;text-align:center"/>
      <span class="hint">When set, the child must enter this PIN alongside their access code.</span>
    </div>
    ${existing ? `<div class="small text-muted">Access code: <span class="kbd">${esc(existing.accessCode)}</span></div>` : ""}
  `;

  const footer = document.createElement("div");
  footer.style.cssText = "display:flex;gap:10px;width:100%;justify-content:space-between";
  footer.innerHTML = `
    <div>${existing ? `<button class="btn btn-danger" id="f-delete">Delete</button>` : ""}</div>
    <div class="btn-row">
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn-primary" id="f-save">${existing ? "Save changes" : "Add child"}</button>
    </div>
  `;

  const modal = openModal({
    title: existing ? `Edit ${existing.name}` : "Add a child",
    body, footer,
  });

  const faithCb = body.querySelector("#f-faith");
  const faithIn = body.querySelector("#f-faith-tradition");
  faithCb.addEventListener("change", () => faithIn.classList.toggle("hidden", !faithCb.checked));

  footer.querySelector("#f-save").addEventListener("click", () => {
    const birthday = body.querySelector("#f-birthday").value || null;
    const patch = {
      name: body.querySelector("#f-name").value.trim(),
      age: parseInt(body.querySelector("#f-age").value, 10) || null,
      birthday,
      grade: body.querySelector("#f-grade").value.trim() || null,
      passions: splitCsv(body.querySelector("#f-passions").value),
      strengths: splitCsv(body.querySelector("#f-strengths").value),
      supportNeeds: splitCsv(body.querySelector("#f-support").value),
      goals: splitCsv(body.querySelector("#f-goals").value),
      faithEnabled: faithCb.checked,
      faithTradition: faithIn.value.trim(),
      notes: body.querySelector("#f-notes").value.trim(),
      birthData: {
        date: birthday,
        time: body.querySelector("#f-bd-time")?.value || "",
        city: body.querySelector("#f-bd-city")?.value.trim() || "",
      },
      pin: (body.querySelector("#f-pin")?.value || "").replace(/\D/g, "").slice(0, 4),
    };
    if (!patch.name) { toast("Name is required", { type: "warning" }); return; }
    if (existing) {
      updateChild(existing.id, patch);
      toast(`${patch.name} updated`, { type: "success" });
    } else {
      addChild(patch);
      toast(`${patch.name} added`, { type: "success" });
    }
    modal.close();
    rerender();
  });

  if (existing) {
    footer.querySelector("#f-delete").addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: `Delete ${existing.name}?`,
        message: "This removes their profile, projects, milestones and reflections.",
        confirmLabel: "Delete",
        danger: true,
      });
      if (ok) {
        removeChild(existing.id);
        toast(`${existing.name} removed`);
        modal.close();
        rerender();
      }
    });
  }
}

/* ---------- Child detail view ---------- */
export function renderChildDetail(container, params) {
  const child = getChild(params.id);
  if (!child) {
    container.innerHTML = `<div class="empty"><div class="emoji">🔍</div>Child not found.</div>`;
    return;
  }
  const stats = getChildStats(child.id);

  container.innerHTML = `
    <div class="topbar">
      <div class="row" style="gap:14px">
        <div class="child-card-avatar avatar-${child.avatarIndex}" style="width:64px;height:64px;font-size:26px">${initials(child.name)}</div>
        <div>
          <h1>${esc(child.name)}</h1>
          <div class="sub">${child.age != null ? "Age " + child.age : ""}${child.grade ? " · " + esc(child.grade) : ""}</div>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn" data-edit>Edit profile</button>
        <button class="btn btn-primary" data-kid>${icon("child")} Open ${esc(child.name)}'s view</button>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      <div class="metric"><div class="v">⭐ ${stats.totalStars}</div><div class="l">Stars earned</div></div>
      <div class="metric"><div class="v">${stats.totalMomentum}</div><div class="l">Momentum Points</div></div>
      <div class="metric"><div class="v">${stats.completedMilestones}/${stats.totalMilestones}</div><div class="l">Milestones</div></div>
      <div class="metric"><div class="v">${stats.badges}</div><div class="l">Project badges</div></div>
    </div>

    <div class="grid" style="grid-template-columns: 2fr 1fr; gap:18px">
      <div class="card">
        <h3 class="mb-2">Profile</h3>
        ${listBlock("Passions", child.passions)}
        ${listBlock("Strengths", child.strengths)}
        ${listBlock("Areas needing support", child.supportNeeds)}
        ${listBlock("Current goals", child.goals)}
        ${child.notes ? `<div class="divider"></div><div class="small text-muted fw-600 mb-1">Notes</div><p>${esc(child.notes)}</p>` : ""}
      </div>

      <div class="card" style="background:var(--card-elev)">
        <h3 class="mb-2">Access</h3>
        <div class="small text-muted">Share this code with ${esc(child.name)} to open their portal:</div>
        <div class="row mt-1" style="gap:8px">
          <span class="kbd" style="font-size:18px;padding:6px 12px">${esc(child.accessCode)}</span>
          <button class="btn btn-sm" id="copy-code">Copy</button>
        </div>
        <div class="divider"></div>
        <div class="small text-muted fw-600 mb-1">Direct link</div>
        <div class="kbd" style="font-size:11px;word-break:break-all;display:block">${location.origin}${location.pathname}#/kid/${esc(child.accessCode)}</div>
      </div>
    </div>
  `;

  container.querySelector("[data-edit]").addEventListener("click", () => openChildModal(child.id));
  container.querySelector("[data-kid]").addEventListener("click", () => navigate("/kid/" + child.accessCode));
  container.querySelector("#copy-code").addEventListener("click", () => {
    navigator.clipboard?.writeText(child.accessCode);
    toast("Access code copied", { type: "success" });
  });
}

function listBlock(label, arr) {
  if (!arr || arr.length === 0) return "";
  return `
    <div class="small text-muted fw-600 mb-1">${esc(label)}</div>
    <div class="chip-group mb-2">${arr.map(x => `<span class="chip" style="cursor:default">${esc(x)}</span>`).join("")}</div>
  `;
}

function splitCsv(s) {
  return s.split(",").map(x => x.trim()).filter(Boolean);
}
function initials(name) {
  return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}
