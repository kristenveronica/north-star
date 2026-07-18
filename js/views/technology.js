/* ============================================================
   technology.js — per-child Technology Agreement editor.

   Reached from Learning Profile → Technology & Digital Learning. A calm,
   progressively-disclosed editor for one child's digital values + boundaries.
   Everything auto-saves into the child's learning_profile; the data feeds AI
   project generation, and a beautiful PDF can be printed to sign together.
   ============================================================ */

import { getState, getChild, setTechAgreement, markTechReviewed } from "../store.js";
import { esc, toast } from "../components/ui.js";
import { mountTechSections } from "../components/techSections.js";
import {
  childTechAgreement, techProgress, techReviewSuggestion, ageBandOf,
} from "../lib/techAgreement.js";
import { generateTechAgreementPdf } from "../lib/pdf/agreement.js";
import { navigate } from "../router.js";

export function renderTechAgreement(container, params) {
  const child = getChild(params.childId);
  if (!child) {
    container.innerHTML = `<div class="empty"><div class="emoji">🔍</div>Child not found.</div>`;
    return;
  }
  const family = getState().family || {};
  const prog = techProgress(childTechAgreement(child));
  const nudge = techReviewSuggestion(child);
  const reviewDate = childTechAgreement(child).reviewDate || "";

  const embedded = !!params.embedded;
  container.innerHTML = `
    ${embedded ? `
    <div class="btn-row mb-2" style="justify-content:flex-end;align-items:center">
      <span class="small text-muted" id="ta-status" aria-live="polite"></span>
    </div>` : `
    <div class="topbar">
      <div>
        <a href="#/style" class="small text-muted">← Learning Profile</a>
        <h1>Technology Agreement</h1>
        <div class="sub">${esc(child.name)} · a living agreement that shapes how North Star designs ${esc(child.name)}'s learning</div>
      </div>
      <div class="btn-row">
        <span class="small text-muted" id="ta-status" aria-live="polite"></span>
      </div>
    </div>`}

    <p class="text-muted mb-3" style="max-width:74ch;line-height:1.6">North Star doesn't prescribe rules. This is a space to intentionally think through your family's digital decisions <em>before</em> situations arise — the goal is conversation, clarity and alignment. Adopt the suggestions that fit, edit freely, and skip anything that doesn't apply yet. <strong>${prog.addressed} of ${prog.total} sections addressed.</strong></p>

    ${nudge && nudge.kind !== "setup" ? `
      <div class="suggestion-banner mb-2">
        <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">
          <span style="flex:1;min-width:240px"><strong>${esc(nudge.title)}</strong> — ${esc(nudge.text)}</span>
          <button class="btn btn-sm" id="ta-reviewed">Mark reviewed today</button>
        </div>
      </div>` : ""}

    <div style="max-width:880px">
      <div id="tech-host"></div>

      <div class="card mt-2">
        <h3 class="mb-1">Review date <span class="text-muted small" style="font-weight:400">(optional)</span></h3>
        <p class="small text-muted" style="margin:0 0 8px">When you'd like to revisit this agreement together. North Star will give you a gentle nudge — never a demand.</p>
        <input class="input" type="date" id="ta-review" value="${esc(reviewDate)}" style="max-width:220px"/>
      </div>

      <div class="row" style="justify-content:flex-end;gap:12px;margin-top:18px">
        <button class="btn" id="ta-reviewed-2">Mark reviewed today</button>
        <button class="btn btn-primary" id="ta-pdf-2">⬇ Generate Agreement PDF</button>
      </div>
    </div>
  `;

  const statusEl = container.querySelector("#ta-status");
  let saveT;
  const persist = () => {
    clearTimeout(saveT);
    if (statusEl) statusEl.textContent = "Saving…";
    saveT = setTimeout(() => {
      setTechAgreement(child.id, api.getAgreement());
      if (statusEl) statusEl.textContent = "✓ Saved";
    }, 450);
  };

  const api = mountTechSections(
    container.querySelector("#tech-host"),
    childTechAgreement(child),
    persist,
    { pageId: `tech-${child.id}` },
  );

  container.querySelector("#ta-review").addEventListener("change", (e) => {
    api.getAgreement().reviewDate = e.target.value || null;
    persist();
  });

  const flush = () => setTechAgreement(child.id, api.getAgreement());
  const doPdf = async (btn) => {
    flush();
    const orig = btn.textContent; btn.disabled = true; btn.textContent = "Generating…";
    try {
      await generateTechAgreementPdf({ child: getChild(child.id), family: getState().family || {} });
      markTechReviewed(child.id, ageBandOf(child.age));
      toast("Agreement PDF ready — check your downloads.", { type: "success" });
    } catch (err) {
      console.error("Tech agreement PDF failed", err);
      toast("Couldn't generate the PDF just now. Please try again.", { type: "error", duration: 3200 });
    } finally { btn.disabled = false; btn.textContent = orig; }
  };
  // Single PDF action lives at the bottom of the page (#ta-pdf-2).
  container.querySelector("#ta-pdf-2").addEventListener("click", (e) => doPdf(e.currentTarget));

  const markReviewed = () => {
    flush();
    markTechReviewed(child.id, ageBandOf(child.age));
    toast("Marked as reviewed today", { type: "success" });
    navigate(`/technology/${child.id}`);
  };
  container.querySelector("#ta-reviewed")?.addEventListener("click", markReviewed);
  container.querySelector("#ta-reviewed-2")?.addEventListener("click", markReviewed);
}
