# North Star — Beta Readiness Test Checklist

Work top to bottom: each section depends on the ones above it. Mark each line
**✅ pass / ❌ fail (note what happened)**. Anything ❌ is a beta blocker unless
noted as *(optional)*.

Test on the device(s) your beta families will actually use — at least one
desktop and one phone. Use a **fresh browser profile / incognito** for the
"new family" runs so you're not seeing cached state.

Legend: 🔑 = needs Stripe configured first · 📱 = also repeat on mobile

---

## 0. Pre-flight (do once)

- [ ] App loads at its URL with no console errors (open DevTools → Console).
- [ ] Supabase Edge Function secrets are set: `ANTHROPIC_API_KEY` (AI),
      and for billing tests 🔑 `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
      the 6 `STRIPE_PRICE_*` ids, `APP_URL`.
- [ ] Stripe webhook endpoint shows recent **200**s (Workbench → Webhooks). 🔑

---

## 1. Account & onboarding (the first impression)

- [ ] 📱 From a fresh profile, sign up with a new email + password.
- [ ] Email/confirmation flow (if on) completes and lands you in the app.
- [ ] Onboarding / Family North Star flow runs without dead-ends; you can
      complete it OR skip and return later.
- [ ] After onboarding you land on the Dashboard with your family name shown.
- [ ] Log out, then log back in — your data is still there (cloud hydrate works).

**Expected:** a stranger can get from "never heard of it" to a working dashboard
unaided.

---

## 2. Children & profiles

- [ ] 📱 Add a child: name, **gender**, birthday, grade. Age auto-calculates.
- [ ] Add passions, strengths, areas to grow, goals, notes.
- [ ] Set a child portal PIN and printing permission.
- [ ] Edit the child — changes save and persist after a **hard reload**.
- [ ] Add a **second child** (note: beyond 1 may trigger the billing modal — see §8).
- [ ] Children list shows oldest-first.

**Expected:** profiles are sticky across reloads; gender is recorded.

---

## 3. The magic loop — generate → do → reflect (core product)

- [ ] Open **Generate Project**. The spark screen shows one question + examples.
- [ ] Type a real-life spark (e.g. "Noah loves mountain biking…") → **Generate Project**.
- [ ] A full proposal appears: title, duration, "Why North Star suggested this",
      capabilities, academic + practical skills, milestones with deadlines,
      materials, reflection prompts, extensions, parent notes.
- [ ] **Pronoun check:** the child-facing text uses the correct pronouns for the
      child's gender (the Jetty = he/him case).
- [ ] **Refine** once — it redesigns; counter drops to "2 refinements available".
- [ ] Refine twice more — after the 3rd it shows "You can still edit this project
      manually after accepting it." and the refine box is gone.
- [ ] **Save as Draft** → it appears under **Drafts** on the Projects page.
- [ ] Generate again → **Accept Project** → opens the project detail, fully editable.
- [ ] Open a milestone, mark it complete → star + momentum points awarded.
- [ ] Complete all milestones → project flips to "Ready for final reflection".
- [ ] Add the final reflection → project marked **Completed**.
- [ ] Edit a project (title, dates, milestones, materials) — changes save.

**Expected:** one unbroken loop from spark to completed project, with rewards.

---

## 4. Persistence & sync (the bug we just fixed — verify hard)

- [ ] Generate + **Accept** a project, wait ~2s, **hard reload** → still in Active.
- [ ] **Save as Draft**, wait ~2s, **hard reload** → still in Drafts.
- [ ] Activate a draft (Activate project →) → moves to Active and persists.
- [ ] Reload and confirm the rich fields (child description, parent notes,
      reflection prompts, extensions) are still on the project.
- [ ] Log out and back in (or open in a different browser) — projects are there.

**Expected:** nothing generated ever disappears on reload.

---

## 5. The intelligence layers feed generation

- [ ] Fill in **Learning Profile** (levels, how the child learns, about).
- [ ] Set **Capability Domains** / **Technology** preferences + tech agreement.
- [ ] Add a few **Family Inventory** items and a **Family North Star** mission/motto.
- [ ] Generate a new project → confirm it visibly reflects these
      (uses owned items, honours tech limits, matches the family's values/levels).
- [ ] *(optional)* Turn on Travel/Worldschool or Faith and confirm generation respects it.

**Expected:** the AI uses the family's real context, not generic content.

---

## 6. Reporting & insights

- [ ] Generate a **Growth Report** for a child — it produces a coherent report.
- [ ] *(optional, premium)* Open **Child Insights** and confirm it loads.
- [ ] Progress / Portfolio / Reflections pages render the child's real data.

---

## 7. Membership, invites & scoped access (newest system — test carefully)

- [ ] In **Family Settings → Family Members**, add a support person.
- [ ] Set them as **Contributor**, grant some permissions, scope to **one child**.
- [ ] Generate an invite → copy the link (and/or confirm an email arrives).
- [ ] In a **second fresh browser profile**, open the invite link → sign up as that person.
- [ ] That account lands in **your family** (not a new empty one).
- [ ] **Scoped portal check:** the contributor sees ONLY the permitted child and
      only the pages you granted (no Family North Star / Settings / config pages).
- [ ] Contributor can generate a project (if granted) using the simplified flow.
- [ ] Back as Owner, use **"View as"** to preview the contributor's portal.
- [ ] Owner can change/revoke the contributor's access.

**Expected:** a second real person joins, sees only what they should, and can't
alter the family's core setup.

---

## 8. Billing (Stripe **test mode**) 🔑

Use test card `4242 4242 4242 4242`, any future expiry, any CVC.

- [ ] Trigger the plan modal (Children → Add a child profile beyond the first).
- [ ] **Prices display** correctly (base + per-seat) and the **Total updates** as
      you change "How many children?" and Monthly/Annual.
- [ ] **Continue to payment** → Stripe Checkout shows **North Star** branding.
- [ ] Complete payment → redirected back into the app.
- [ ] Stripe webhook fires (200) and `family_billing` gets the subscription.
- [ ] Settings → **Manage subscription** now opens the Stripe Billing Portal.
- [ ] Multi-child: buying for 3 children creates base + 2 seats in **one** checkout.
- [ ] Grant a contributor an AI permission → **Update billing seats** →
      "Adult contributor seats" reflects the new count.
- [ ] *(optional)* Cancel via the portal → app reflects the change after webhook.

**Expected:** a real (test) transaction completes end-to-end and unlocks capacity.

---

## 9. Child portal

- [ ] 📱 Open a child portal via its access code (+ PIN if set).
- [ ] The child sees their projects/missions and can mark progress.
- [ ] Printing respects the permission you set.

---

## 10. Cross-cutting polish (note issues, not all blockers)

- [ ] 📱 Every main page is usable on a phone (nav, modals, buttons reachable).
- [ ] Error states are friendly (e.g. AI fails → clear message + retry, no crash).
- [ ] No raw console errors during a normal session.
- [ ] Logout clears data from the device (next visitor can't see your family).
- [ ] A second family (different account) never sees the first family's data.

---

## Sign-off

- [ ] Core loop (§1–4) fully green → **safe for a comped, hand-held beta.**
- [ ] §7 green → **safe to invite co-parents / contributors.**
- [ ] §8 green → **safe for self-serve paid signups.**

Date tested: __________  Tester: __________  Build/commit: __________
