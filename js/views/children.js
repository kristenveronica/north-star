/* ============================================================
   children.js — List + detail/edit for each child.
   ============================================================ */

import { getState, update, addChild, updateChild, removeChild, getChild, getChildStats, ageOf, generateAccessCode } from "../store.js";
import { attachCityAutocomplete } from "../lib/cities.js";
import { esc, toast, icon, openModal, confirmDialog } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";
import { saveDraft, loadDraft, clearDraft } from "../lib/drafts.js";
import { childProfileLimit, childSeatsUsed, canAddChild } from "../lib/entitlements.js";
import { startBaseCheckout, addChildSeat, getBillingPrices } from "../lib/billing.js";

export function renderChildren(container) {
  const s = getState();
  const used = childSeatsUsed(s);
  // Existing children are grandfathered, so the shown allotment is never below
  // how many profiles actually exist (avoids a nonsensical "2 of 1 used").
  const limit = Math.max(childProfileLimit(s.family), used);
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Children</h1>
        <div class="sub">Add each child. Each one gets their own profile, projects, and access code.</div>
      </div>
      <div class="row" style="gap:14px;align-items:center">
        <span class="small text-muted" id="seat-usage">${used} of ${limit} ${limit === 1 ? "profile" : "profiles"} used</span>
        <button class="btn btn-primary" id="add-child">${icon("plus")} Add child</button>
      </div>
    </div>

    ${s.children.length === 0 ? `<div class="empty"><div class="emoji">👨‍👩‍👧‍👦</div><h3>No children yet</h3><p>Add your first child to start designing their learning path.</p></div>` : ""}

    <div class="grid grid-auto">
      ${s.children.map(c => childTile(c)).join("")}
    </div>
  `;

  // Gate adding profiles by the family's subscription (basic = 1; bolt-on for more).
  container.querySelector("#add-child").addEventListener("click", () => {
    if (canAddChild(getState())) openChildModal();
    else showChildSeatUpgrade();
  });

  // Returning from Stripe Checkout (success_url/cancel_url land here).
  const hash = window.location.hash;
  if (hash.includes("billing=success")) {
    toast("Subscription active — your new child profile is unlocked ✨", { type: "success" });
    history.replaceState(null, "", hash.split("?")[0]);
  } else if (hash.includes("billing=cancelled")) {
    toast("Checkout cancelled — no charge was made.");
    history.replaceState(null, "", hash.split("?")[0]);
  }

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

/* ---------- Subscription gate: adding a child profile beyond the plan ----------
   The basic account includes 1 child profile; additional profiles are a paid
   bolt-on seat. This is the UX gate + upsell; the entitlement is server-managed
   and the hard limit is enforced server-side (see js/lib/entitlements.js). */
function showChildSeatUpgrade() {
  const s = getState();
  const limit = childProfileLimit(s.family);
  const used = childSeatsUsed(s);

  const body = document.createElement("div");
  body.innerHTML = `
    <p style="margin-top:0">Your plan includes <strong>${limit} child ${limit === 1 ? "profile" : "profiles"}</strong>, and ${used >= limit ? "all of them are" : `${used} of ${limit} are`} in use.</p>
    <p class="text-muted small">Each child gets their own private profile, tailored learning path, projects and access code. You can unlock another by adding a child-profile seat to your subscription.</p>
    <div class="card" style="background:var(--card-elev);margin-top:6px">
      <div class="row-between" style="align-items:center">
        <div>
          <div class="fw-700">Additional child profile</div>
          <div class="text-muted small">A paid bolt-on seat, added to your plan.</div>
        </div>
        ${icon("child")}
      </div>
    </div>
  `;
  const footer = document.createElement("div");
  footer.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end";
  footer.innerHTML = `
    <button class="btn" data-close>Not now</button>
    <button class="btn btn-primary" id="seat-upgrade">Add a child profile</button>
  `;
  const modal = openModal({ title: "Add another child profile", body, footer });
  const btn = footer.querySelector("#seat-upgrade");
  btn.addEventListener("click", async () => {
    btn.disabled = true; btn.textContent = "Working…";
    try {
      const res = await addChildSeat();
      if (res?.needsBase) {
        // No active base subscription yet → let them choose monthly/annual, buying
        // the base plan (incl. 1 child) plus enough seats for the child they want.
        modal.close();
        showBaseSubscribe(childSeatsUsed(getState()));
        return;
      }
      if (res?.ok) {
        bumpChildLimit(1);          // optimistic; the webhook is the real source of truth
        modal.close();
        toast("Child profile added to your plan ✨", { type: "success" });
        openChildModal();           // proceed to create the new child
      }
    } catch (e) {
      toast(e.message || "Couldn't add a profile right now", { type: "warning" });
      btn.disabled = false; btn.textContent = "Add a child profile";
    }
  });
}

/** Format a Stripe amount (smallest currency unit) as money. */
function fmtMoney(amount, currency = "usd") {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "usd").toUpperCase() }).format(amount / 100);
  } catch { return `$${(amount / 100).toFixed(2)}`; }
}

/** Choose plan + how many children, see live pricing, then subscribe via Stripe.
    childCount: how many children to cover (base includes 1; the rest are seats),
    so a family with several children checks out ONCE. */
async function showBaseSubscribe(childCount = 1) {
  let count = Math.max(1, childCount || 1);
  let interval = "month";
  let prices = null;          // { month:{base,seat,aiseat}, year:{...} } once loaded

  const body = document.createElement("div");
  const footer = document.createElement("div");
  footer.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end";
  const modal = openModal({ title: "Choose your plan", body, footer });

  function render() {
    const set = prices?.[interval] || {};
    const base = set.base, seat = set.seat;
    const extra = Math.max(0, count - 1);
    const currency = base?.currency || seat?.currency || "usd";
    const baseAmt = base?.amount ?? null;
    const seatAmt = seat?.amount ?? null;
    const total = baseAmt != null ? baseAmt + extra * (seatAmt || 0) : null;
    const per = interval === "year" ? "/year" : "/month";

    body.innerHTML = `
      <p style="margin-top:0">Start your North Star subscription. Your plan includes <strong>1 child profile</strong>; add a seat for each additional child now so you only check out once.</p>

      <div class="chip-group" style="margin:12px 0">
        <button class="chip${interval === "month" ? " selected" : ""}" data-int="month">Monthly</button>
        <button class="chip${interval === "year" ? " selected" : ""}" data-int="year">Annual${prices?.year?.base && prices?.month?.base ? "" : ""}</button>
      </div>

      <div class="field">
        <label>How many children?</label>
        <div class="row" style="gap:12px;align-items:center;margin-top:4px">
          <button class="btn btn-sm" data-step="-1" ${count <= 1 ? "disabled" : ""}>−</button>
          <span class="fw-700" style="min-width:2ch;text-align:center;font-size:18px">${count}</span>
          <button class="btn btn-sm" data-step="1">+</button>
          <span class="small text-muted">includes 1${extra ? ` + ${extra} extra seat${extra === 1 ? "" : "s"}` : ""}</span>
        </div>
      </div>

      ${prices ? `
        <div class="card" style="background:var(--card-elev);margin-top:12px">
          <div class="row-between"><span>Base plan <span class="text-muted small">(incl. 1 child)</span></span><span class="fw-600">${fmtMoney(baseAmt, currency)}${per}</span></div>
          ${extra > 0 ? `<div class="row-between" style="margin-top:6px"><span>${extra} × child seat${seatAmt != null ? ` <span class="text-muted small">(${fmtMoney(seatAmt, currency)} each)</span>` : ""}</span><span class="fw-600">${fmtMoney(seatAmt != null ? seatAmt * extra : null, currency)}${per}</span></div>` : ""}
          <div class="divider"></div>
          <div class="row-between"><span class="fw-700">Total</span><span class="fw-700">${fmtMoney(total, currency)}${per}</span></div>
        </div>`
      : `<div class="small text-muted" style="margin-top:12px">Loading current pricing…</div>`}

      <p class="text-muted small mt-2">You can add or remove children, and manage or cancel, anytime from Settings.</p>
    `;
    footer.innerHTML = `
      <button class="btn" data-close>Not now</button>
      <button class="btn btn-primary" data-go ${prices && baseAmt == null ? "disabled" : ""}>Continue to payment →</button>`;

    body.querySelectorAll("[data-int]").forEach(b => b.addEventListener("click", () => { interval = b.dataset.int; render(); }));
    body.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => { count = Math.max(1, count + (+b.dataset.step)); render(); }));
    const goBtn = footer.querySelector("[data-go]");
    if (goBtn) goBtn.addEventListener("click", async () => {
      goBtn.disabled = true; goBtn.textContent = "Redirecting…";
      try { await startBaseCheckout(interval, Math.max(0, count - 1)); }
      catch (e) { toast(e.message || "Couldn't start checkout", { type: "warning" }); modal.close(); }
    });
  }

  render();                                   // initial paint (prices loading)
  try { prices = await getBillingPrices(); } catch { prices = null; }
  render();                                   // repaint with live prices (or gracefully without)
}

/** Optimistically raise the local entitlement so the gate opens immediately.
    Not synced to the server (entitlements are server-managed); a hydrate will
    replace it with the authoritative value set by the Stripe webhook. */
function bumpChildLimit(by = 1) {
  update(s => {
    if (!s.family) return;
    const ent = s.family.entitlements || { childProfileLimit: 1 };
    s.family.entitlements = { ...ent, childProfileLimit: (ent.childProfileLimit || 1) + by };
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
          <div class="text-muted small">${ageOf(c) != null ? "Age " + ageOf(c) : ""}${c.grade ? " · " + esc(c.grade) : ""}</div>
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
      <div class="row-between" style="gap:12px;flex-wrap:wrap">
        <span class="small text-muted">Access code: <span class="kbd">${esc(c.accessCode)}</span></span>
        <button class="btn-portal avatar-${c.avatarIndex}" data-kid-link="${c.accessCode}" style="width:auto;padding:8px 16px">${icon("child")} Open ${esc(c.name)}'s portal →</button>
      </div>
    </div>
  `;
}

/* ---------- Add / Edit modal ---------- */
const NEW_CHILD_DRAFT = "child-new";

// Per-child permissions the parent explicitly grants. Project generation stays
// within these boundaries (see supabase/functions/ai generateProject rules).
// Gender — used so the AI uses the right pronouns; "" = not specified (neutral they/them).
const GENDER_OPTIONS = [
  { value: "", label: "Prefer not to say" },
  { value: "girl", label: "Girl (she/her)" },
  { value: "boy", label: "Boy (he/him)" },
  { value: "nonbinary", label: "Non-binary (they/them)" },
];

const MOBILITY_OPTIONS = [
  { key: "adult-supervision-all", label: "Adult supervision required for all outings" },
  { key: "parent-can-drive", label: "Parent / caregiver can drive" },
  { key: "walk-local-supervised", label: "May walk locally with adult supervision" },
  { key: "walk-local-alone", label: "May walk locally alone" },
  { key: "bike-supervised", label: "May ride a bike with adult supervision" },
  { key: "bike-independent", label: "May ride a bike independently" },
  { key: "transit-supervised", label: "May use public transport with adult supervision" },
  { key: "transit-independent", label: "May use public transport independently" },
  { key: "visit-businesses", label: "May travel to local businesses for interviews or projects" },
  { key: "drive-independent", label: "May drive independently" },
];

function openChildModal(childId = null) {
  const existing = childId ? getChild(childId) : null;
  const blankDraft = {
    name: "", gender: "", age: "", birthday: "", grade: "",
    passions: [], strengths: [], supportNeeds: [], goals: [], notes: "",
    learningStyle: getState().family?.learningStyleDefault ?? 5,
    diyMaterials: getState().family?.diyMaterialsPreference ?? 5,
    mobilityProfile: { permissions: [], notes: "" },
  };
  // For a NEW child, restore this account's in-progress draft so nothing typed is lost.
  const restoredDraft = existing ? null : loadDraft(NEW_CHILD_DRAFT);
  const draft = existing ? { ...existing } : { ...blankDraft, ...(restoredDraft || {}) };
  const arr = (v) => Array.isArray(v) ? v.join(", ") : v || "";

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="grid grid-2">
      <div class="field"><label>Name</label><input class="input" id="f-name" value="${esc(draft.name)}"/></div>
      <div class="field">
        <label>Gender</label>
        <select class="select" id="f-gender">
          ${GENDER_OPTIONS.map(o => `<option value="${o.value}" ${(draft.gender || "") === o.value ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
        </select>
        <span class="hint">Helps North Star use the right pronouns for ${esc(draft.name || "your child")}.</span>
      </div>
      <div class="field">
        <label>Birthday</label>
        <input class="input" id="f-birthday" type="date" value="${esc(draft.birthday || "")}"/>
        <span class="hint" id="age-hint">${ageOf(draft) != null ? "Age " + ageOf(draft) + " — tracked automatically." : "Age is tracked automatically from the birthday."}</span>
      </div>
      <div class="field"><label>Grade / year (optional)</label><input class="input" id="f-grade" value="${esc(draft.grade || "")}"/></div>
    </div>
    <details ${draft.birthData?.time || draft.birthData?.city ? "open" : ""} style="margin:0 0 14px">
      <summary class="text-muted small fw-700" style="cursor:pointer;padding:6px 0">Optional birth data (for interpretive frameworks in Child Insights)</summary>
      <div class="grid grid-2" style="margin-top:8px">
        <div class="field"><label>Time of birth</label><input class="input" type="time" id="f-bd-time" value="${esc(draft.birthData?.time || "")}"/></div>
        <div class="field" style="position:relative">
          <label>City of birth</label>
          <input class="input" id="f-bd-city" autocomplete="off" value="${esc(draft.birthData?.city || "")}" placeholder="Start typing a city…"/>
          <input type="hidden" id="f-bd-country" value="${esc(draft.birthData?.country || "")}"/>
          <span class="hint">Pick from the list so we capture the correct country (many cities share a name).</span>
        </div>
      </div>
      <div class="small text-muted">Used only for optional interpretive frameworks (Astrology / Human Design).</div>
    </details>
    <div class="field"><label>Passions & interests</label><input class="input" id="f-passions" placeholder="comma separated" value="${esc(arr(draft.passions))}"/></div>
    <div class="field"><label>Strengths</label><input class="input" id="f-strengths" placeholder="comma separated" value="${esc(arr(draft.strengths))}"/></div>
    <div class="field"><label>Areas needing support</label><input class="input" id="f-support" placeholder="comma separated" value="${esc(arr(draft.supportNeeds))}"/></div>
    <div class="field"><label>Current goals</label><input class="input" id="f-goals" placeholder="comma separated" value="${esc(arr(draft.goals))}"/></div>
    <div class="field"><label>Notes from parent</label><textarea class="textarea" id="f-notes" data-voice data-voice-label="Dictate your notes">${esc(draft.notes || "")}</textarea></div>
    <details open class="card" style="background:var(--card-elev);margin:4px 0 14px;padding:14px 16px">
      <summary class="fw-700" style="cursor:pointer">Mobility &amp; Independence <span class="text-muted small" style="font-weight:400">— set this for ${esc(draft.name || "your child")}</span></summary>
      <p class="text-muted small" style="margin:8px 0 8px">Tell North Star what kinds of movement and transport you're comfortable with for ${esc(draft.name || "this child")}. Projects will stay within these boundaries. You can collapse this once you've set it.</p>
      <div class="stack" style="gap:8px">
        ${MOBILITY_OPTIONS.map(o => `
          <label class="checkbox" style="align-items:flex-start">
            <input type="checkbox" data-mob-perm="${o.key}" ${(draft.mobilityProfile?.permissions || []).includes(o.key) ? "checked" : ""}/>
            <span>${esc(o.label)}</span>
          </label>`).join("")}
      </div>
      <div class="field" style="margin:12px 0 0">
        <label class="small">Additional mobility notes <span class="text-muted">(optional)</span></label>
        <textarea class="textarea" id="f-mob-notes" data-voice data-voice-label="Dictate mobility notes" placeholder="e.g. ${esc(draft.name || "Noah")} can walk to nearby shops alone during daylight, but needs an adult for public transport.">${esc(draft.mobilityProfile?.notes || "")}</textarea>
      </div>
    </details>
    <div class="field">
      <label>Child portal PIN <span class="text-muted small">(optional, 4 digits)</span></label>
      <input class="input" id="f-pin" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="leave blank to skip" value="${esc(draft.pin || "")}" style="max-width:160px;letter-spacing:0.4em;text-align:center"/>
      <span class="hint">When set, the child must enter this PIN alongside their access code.</span>
    </div>
    <div class="field">
      <label>Printing Permissions <span class="text-muted small" style="font-weight:400">— can ${esc(draft.name || "this child")} print from their own portal?</span></label>
      <div class="stack" style="gap:8px;margin-top:4px">
        ${PRINT_PERMISSIONS.map(o => `
          <label class="checkbox" style="display:flex;align-items:flex-start;gap:9px;cursor:pointer">
            <input type="radio" name="f-print-perm" value="${o.value}" ${(draft.printPermission || "approval") === o.value ? "checked" : ""} style="margin-top:2px"/>
            <span><span class="fw-600">${esc(o.label)}</span> <span class="small text-muted">— ${esc(o.desc)}</span></span>
          </label>`).join("")}
      </div>
      <span class="hint">You can always print from the parent portal, whatever you choose here.</span>
    </div>
    <div class="field">
      <label>Access code <span class="text-muted small" style="font-weight:400">— what ${esc(draft.name || "your child")} types to open their portal</span></label>
      <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">
        <input class="input" id="f-access" maxlength="8" value="${esc(draft.accessCode || "")}" placeholder="${existing ? "" : "auto from name"}" style="max-width:180px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;text-align:center"/>
        <button class="btn btn-sm" type="button" id="f-access-name">↻ From name</button>
      </div>
      <span class="hint">Make the first letters mean something to you — ${esc(draft.name || "your child")}'s initials, or a little trio that's special to your family (like your core word). The digits keep it unique. <span class="text-muted">e.g. NOA274.</span></span>
    </div>
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

  // Faith is a family-level setting (Parent portal → Settings), not per-child.

  // Live age from birthday
  const bdayInput = body.querySelector("#f-birthday");
  const ageHint = body.querySelector("#age-hint");
  bdayInput.addEventListener("change", () => {
    const a = ageOf({ birthday: bdayInput.value });
    ageHint.textContent = a != null
      ? `Age ${a} — tracked automatically.`
      : "Age is tracked automatically from the birthday.";
  });

  // City-of-birth autocomplete (captures country too)
  attachCityAutocomplete(body.querySelector("#f-bd-city"), body.querySelector("#f-bd-country"));

  // Access code: keep it tidy (UPPERCASE, letters+digits), let the parent derive
  // a meaningful code from the name, and auto-fill a blank one on name blur.
  const accessInput = body.querySelector("#f-access");
  accessInput.addEventListener("input", () => {
    accessInput.value = accessInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  });
  body.querySelector("#f-access-name").addEventListener("click", () => {
    accessInput.value = generateAccessCode(body.querySelector("#f-name").value.trim());
  });
  if (!existing) {
    body.querySelector("#f-name").addEventListener("blur", () => {
      if (!accessInput.value.trim()) accessInput.value = generateAccessCode(body.querySelector("#f-name").value.trim());
    });
  }

  // Read the whole form into a child patch.
  const gatherPatch = () => {
    const birthday = body.querySelector("#f-birthday").value || null;
    // Only include accessCode when the field has a value, so a mid-edit blank
    // never wipes an existing code (and a new child falls back to name-derived).
    const codeVal = (body.querySelector("#f-access")?.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    return {
      ...(codeVal ? { accessCode: codeVal } : {}),
      name: body.querySelector("#f-name").value.trim(),
      gender: body.querySelector("#f-gender")?.value || "",
      age: ageOf({ birthday }),
      birthday,
      grade: body.querySelector("#f-grade").value.trim() || null,
      passions: splitCsv(body.querySelector("#f-passions").value),
      strengths: splitCsv(body.querySelector("#f-strengths").value),
      supportNeeds: splitCsv(body.querySelector("#f-support").value),
      goals: splitCsv(body.querySelector("#f-goals").value),
      notes: body.querySelector("#f-notes").value.trim(),
      birthData: {
        date: birthday,
        time: body.querySelector("#f-bd-time")?.value || "",
        city: body.querySelector("#f-bd-city")?.value.trim() || "",
        country: body.querySelector("#f-bd-country")?.value.trim() || "",
      },
      pin: (body.querySelector("#f-pin")?.value || "").replace(/\D/g, "").slice(0, 4),
      printPermission: body.querySelector('input[name="f-print-perm"]:checked')?.value || "approval",
      mobilityProfile: {
        permissions: [...body.querySelectorAll("[data-mob-perm]:checked")].map(c => c.dataset.mobPerm),
        notes: (body.querySelector("#f-mob-notes")?.value || "").trim(),
      },
    };
  };
  const clearNewChildDraft = () => clearDraft(NEW_CHILD_DRAFT);

  /* ---------- Auto-save: a safety net so nothing typed is lost ----------
     Existing child → write through to the store on every edit (silent).
     New child → keep a per-account restorable draft until they save. */
  let autosaveTimer;
  const autosaveChild = () => {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      const patch = gatherPatch();
      if (existing) {
        if (patch.name) updateChild(existing.id, patch);   // keep last good if name is mid-edit
      } else {
        saveDraft(NEW_CHILD_DRAFT, patch);
      }
    }, 700);
  };
  body.addEventListener("input", autosaveChild);
  body.addEventListener("change", autosaveChild);
  // Explicit Cancel on a new child = intentional discard of the draft.
  if (!existing) footer.querySelector("[data-close]")?.addEventListener("click", clearNewChildDraft);

  footer.querySelector("#f-save").addEventListener("click", () => {
    clearTimeout(autosaveTimer);
    const patch = gatherPatch();
    if (!patch.name) { toast("Name is required", { type: "warning" }); return; }
    if (existing) {
      updateChild(existing.id, patch);
      toast(`${patch.name} updated`, { type: "success" });
    } else {
      // New child with no chosen code → derive a meaningful one from the name.
      if (!patch.accessCode) patch.accessCode = generateAccessCode(patch.name);
      addChild(patch);
      toast(`${patch.name} added`, { type: "success" });
    }
    clearNewChildDraft();
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
export const PRINT_PERMISSIONS = [
  { value: "allow", label: "Allow independently", desc: "Can generate and download PDFs from their own portal." },
  { value: "approval", label: "Require parent approval", desc: "Sees printable projects but a parent does the printing." },
  { value: "disabled", label: "Disable printing", desc: "No PDF generation from the child portal." },
];

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
          <div class="sub">${ageOf(child) != null ? "Age " + ageOf(child) : ""}${child.grade ? " · " + esc(child.grade) : ""}</div>
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

        <div class="divider"></div>
        <h3 class="mb-1">Printing Permissions</h3>
        <p class="small text-muted" style="margin:0 0 8px">Control whether ${esc(child.name)} can generate printable PDFs from their own portal. You can always print from here.</p>
        <div class="stack" style="gap:8px">
          ${PRINT_PERMISSIONS.map(o => `
            <label class="checkbox" style="display:flex;align-items:flex-start;gap:9px;cursor:pointer">
              <input type="radio" name="print-perm" value="${o.value}" ${ (child.printPermission || "approval") === o.value ? "checked" : "" } style="margin-top:2px"/>
              <span><span class="fw-600">${esc(o.label)}</span><br/><span class="small text-muted">${esc(o.desc)}</span></span>
            </label>`).join("")}
        </div>
      </div>
    </div>
  `;

  container.querySelector("[data-edit]").addEventListener("click", () => openChildModal(child.id));
  container.querySelector("[data-kid]").addEventListener("click", () => navigate("/kid/" + child.accessCode));
  container.querySelector("#copy-code").addEventListener("click", () => {
    navigator.clipboard?.writeText(child.accessCode);
    toast("Access code copied", { type: "success" });
  });
  container.querySelectorAll('input[name="print-perm"]').forEach(r => {
    r.addEventListener("change", () => {
      if (r.checked) { updateChild(child.id, { printPermission: r.value }); toast("Printing permission saved", { type: "success" }); }
    });
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
