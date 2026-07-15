# North Star — Build Roadmap

**Master implementation plan · 18–24 months · CTO view**

Date: 2026-07-14 · Companion to [the Living Family Model Constitution](living-family-model.md) (the *why*) and [the Commercial Architecture Proposal](commercial-architecture-proposal.md) (the *what*). This document is the *how* and the *when*.

---

> **The purpose of the Living Family Model is not to remember more information. It is to help every family increasingly feel understood.**
>
> Everything in this roadmap is measured against that sentence. Before a single production feature of the Living Family Model is built, two assumptions it depends on must be proven with real families — see [the LFM Validation Experiments](lfm-validation-experiments.md). If either fails, we rethink the architecture before investing months of engineering. If both succeed, they become the foundation for everything that follows.

---

## How to read this

Every phase below **ships a working product that could reasonably go live.** There are no phases that exist only to rearrange internal architecture — where foundational work is unavoidable (the entitlement engine, the memory substrate) it is bundled into a phase that also delivers user-visible value, and I say so explicitly.

The roadmap is sequenced around one belief: **the highest-value, lowest-regret work is to make what already exists secure and sellable, then deepen the single thing that is the moat — the Living Family Model.** Breadth is not the problem; North Star already has plenty. Depth, safety, and revenue are the problems.

**Effort** is expressed as rough founder-with-AI weeks (S ≈ ≤1wk, M ≈ 1–3wk, L ≈ 3–6wk, XL ≈ 6–10wk), assuming a very small team. Where a hire materially changes the estimate I note it.

---

## The baseline we are building from

An honest starting inventory, because it dictates the sequence:

- **Breadth is already high.** Onboarding (Quick Start + Full), children, projects, capability domains, inventory, resources, councils, reflections, portfolio, growth reports, insights, calendar, rewards, settings, billing, and a child portal all exist in some form.
- **Security is the liability.** Multiple live authorization holes (self-service child limits, role self-promotion, a cross-family child-data breach chain, an unguarded AI endpoint, contributor-callable billing). The paywall is currently decorative.
- **Monetization is thin.** One seat counter, not an entitlement system; Stripe wired but only for base + child-seat + adult-seat; no plan/tier concept in the data.
- **Stack facts that shape decisions:** vanilla JS ES-module SPA, no bundler, hash router; Supabase (Postgres + RLS + Deno edge functions); Netlify deploy. Files are stored **inline as base64 in table rows** (Supabase Storage is unused). The **migration history table is out of sync with the live schema** — a standing ops hazard.

Two baseline decisions I'm making as CTO up front:

1. **We do not rewrite the frontend.** Vanilla-JS-no-bundler is not elegant, but it works, and a framework rewrite is precisely the "internal architecture with no user value" the brief warns against. We introduce a light build step only if/when it pays for itself (§ Cross-cutting).
2. **We reconcile the migration history early and cheaply** (Phase 0), because every later phase writes migrations and we cannot keep flying blind about what's applied.

---

## Phase overview

| # | Phase | Ships? | Effort | Revenue impact |
|---|---|---|---|---|
| 0 | Security Hardening & Enforcement | ✅ safety release | M (1–3 wk) | Protects future revenue |
| 1 | Founding Family — Sellable | ✅ **revenue on** | M (2–4 wk) | 🟢 **Starts revenue** |
| 2 | Entitlement Engine & Progressive Disclosure | ✅ UX-quality release | L (3–6 wk) | Enables tiers; lifts retention |
| 3 | Living Family Model — Foundations | ✅ "it remembers us" | L–XL (5–8 wk) | 🟢 Retention / moat |
| 4 | Child Insights (Flourish headline) | ✅ new depth | M–L (3–6 wk) | Justifies Flourish |
| 5 | Tier Activation (Foundation / Flourish / Legacy) | ✅ full commercial model | M (2–4 wk) | 🟢 **ARPU / expansion** |
| 6 | Family Economy (in Councils) | ✅ Legacy depth | M (2–4 wk) | Legacy value |
| 7 | Community Hall | ✅ ecosystem (heavy) | XL (8–12 wk) | Network effects / retention |
| ∞ | Vision Horizon (Relationship Intelligence, Family Culture, AI-driven unfolding) | ongoing | — | Long-term moat |

**Critical path to revenue is Phase 0 → Phase 1** (~4–6 weeks). Everything after Phase 1 is deepening a product that is already earning.

---

## Ordering logic (the three questions, answered up front)

- **Why 0 before everything?** Every later phase writes to the same tables and edge functions. Securing them first means we build on solid ground once, instead of retrofitting authorization into a dozen features later (far more expensive, and unsafe in the interim).
- **Why 1 (launch) before 2 (the entitlement engine)?** *You do not need a features registry or tier system to sell one plan.* At launch everyone is Founding, so there is no gating to perform — only capacity + billing + AI enforcement, which already live in Phase 0. Deferring the registry until we actually have multiple tiers avoids building speculative machinery, and gets revenue and real user behaviour months earlier.
- **Why 3 (LFM) before 4–7 (the deepening features)?** Insights, Economy, and Community all *draw on* accumulated family understanding. Build the memory substrate first and they plug into it; build them first and each gets reworked when the LFM arrives. This is the single biggest rewrite-avoidance decision in the roadmap.
- **Why 4 (Insights) before 5 (Tier Activation)?** Don't turn on Flourish until Flourish is worth buying. Activating tiers before their differentiating features exist sells a hollow promise — the opposite of "tease, don't hide."
- **Could 1 and 2 merge?** Partially — a lean team could fold the "invisible" registry groundwork into launch. I recommend against it: keep the launch surface small to reduce launch risk and reach revenue faster. Noted as an option.
- **Could 6 and 7 be reordered or cut?** Yes — see the CTO critique. Community especially is a candidate for radical deferral.

---

## Phase 0 — Security Hardening & Enforcement

**Purpose.** Close every live authorization hole and make the enforcement surface trustworthy. No new customer features. This is the agreed Phase 0, unchanged.

**User value delivered.** Invisible but essential: families' data (including children's PII) stops being exposed; the platform becomes safe to charge money for and to grow on.

**Engineering work.** Reconcile the migration-history drift; establish the API-level regression harness (attacks + legitimate-workflow tests) that every later phase reuses as a safety net.

**Database work.** Migration `0025_security_hardening.sql`: revoke client writes to entitlement columns; guard triggers preventing role self-promotion / limit tampering / child re-parenting; fix `can_access_child`/`member_child_access` cross-family binding; owner-scope `fm_insert`/`fm_update`; fix the beta-to-paid demotion; CHECK constraints; tighten over-broad grants and `public`-role policies. Reversible, with a companion rollback script. No destructive DDL.

**Backend work.** `_shared/authz.ts`; owner-gate every mutating billing action; add auth + permission + billing-status enforcement to the AI endpoint; child-portal fixes (exact-match not `ilike`, no PII in the response, throttle, higher-entropy codes with rotation); send-invite ownership check; security event logging (privilege-escalation attempts, portal brute force, billing abuse, repeated AI abuse).

**Frontend work.** Minimal: stop the client writing `child_profile_limit`; remove the free "Enable Child Insights" toggle. No visual/nav change.

**AI work.** Add the server-side gate to the AI function; lightweight abuse throttling only (no quota/usage accounting yet).

**Testing.** The regression harness is the deliverable: each attack must flip from succeeding to failing; each legitimate role workflow (architect/contributor/observer/child) must keep passing. Run in staging, then against prod.

**Deployment risks.** Migration-history drift means tooling can't be trusted — diff live policies before/after. Sequence hazard: the client change (stop writing the limit) must ship *before* the migration or sync errors. Over-tight policy could lock out a legitimate flow — caught by the harness in staging.

**Dependencies.** None. This is the root.

**Approximate effort.** M (1–3 weeks).

**Expected business outcome.** No direct revenue; removes an existential liability (a minor-PII breach pre-launch would be catastrophic) and unblocks everything else.

---

## Phase 1 — Founding Family: Sellable

**Purpose.** The minimum commercial layer to take money for a **single** plan, cleanly and safely. Turn the existing product into a product people can buy.

**User value delivered.** A trustworthy purchase: one clear plan, a working checkout, a coherent first-run experience. Foundational families can commit.

**Engineering work.** Light, high-leverage nav cleanup that doesn't need the disclosure engine: the "Set Up Your Family" → "Your Family" label swap, Family Councils → Plan, retire orphan Insights routes. (Cheap wins that make the product feel more complete at launch.)

**Database work.** Seed a minimal `plans` table (the `founding` row + capacity 5 children / 2 adults); add `plan_code` (default `founding`) and `extra_adults` to `family_billing`; derive capacity server-side from `plans ⋈ family_billing` (building on Phase 0's enforcement). **Not** the full features registry yet.

**Backend work.** Stripe hardening: `plan_code` metadata on the subscription; webhook maps price → plan_code; confirm one product + existing price set is enough; verify beta families map to `founding` and keep capacity.

**Frontend work.** Founding pricing/checkout polish; the "You're set" and add-a-child flows; confirm the magic loop (add child → generate → complete → upload → reflect) is walkable end-to-end with no dead ends.

**AI work.** None beyond Phase 0.

**Testing.** Checkout happy-path + failure paths; capacity enforcement for a founding family; beta-family conversion regression; full magic-loop walkthrough.

**Deployment risks.** Real payments — test with Stripe test mode exhaustively; get webhook idempotency right. Low schema risk (additive only).

**Dependencies.** Phase 0 (enforcement must be real or the plan is decorative).

**Approximate effort.** M (2–4 weeks).

**Expected business outcome.** 🟢 **Revenue begins.** Validates willingness to pay and onboards the founding cohort — the single most important data point for everything downstream.

---

## Phase 2 — Entitlement Engine & Progressive Disclosure

**Purpose.** Build the extensible entitlement/feature registry *and* the disclosure engine that makes the product feel simple and unfold over time. Two things because they share the same substrate and both are needed before tiers.

**User value delivered.** Foundation/Founding families get the §0 experience: a calm first week, features that appear when useful (Inventory after a few projects, resources in-context), the child hub reorganised around the **Growth Map**, and the first **moments of delight**. This is a genuine UX-quality release even with one plan.

**Engineering work.** `features.js` resolver (client) + `_shared/entitlements.ts` (server) — one resolver, two homes; `discloseFeature()`; the nav restructure in full; `upgradePreview.js`; lifecycle-trigger + delight surfacing.

**Database work.** `features` table (with `purpose`, `min_plan`, `state`, `surface_class`, `reveal_rule`, `at_launch`, `founding_early_access`); `family_progress` and `family_disclosures`; seed the registry from the approved matrix. Publicly readable, service-role-write-only.

**Backend work.** Server-side resolver enforcement wherever gated data is read/written; progress-signal computation (mostly derived from existing rows).

**Frontend work.** Sidebar/child-hub/route-guard all ask the resolver; Growth Map becomes the child-hub backbone; Learning Resources dissolve into project context; Inventory goes dormant; Portfolio folds into the hub; contextual surfacing + delight moments.

**AI work.** None required (disclosure timing is deterministic thresholds this phase; AI-readiness is deferred, §Vision).

**Testing.** Resolver cross-product (plans × states × roles) as the oracle; lifecycle-transition tests (flip a registry row → nav changes, no deploy); "Foundation walks the whole loop with zero padlocks/upgrade prompts" acceptance test.

**Deployment risks.** Nav restructure changes UX for existing founding families — communicate; it's visibility-only and reversible. Registry seeding must exactly match intended access.

**Dependencies.** Phase 1 (real families to calibrate thresholds against; a plan to hang entitlements on).

**Approximate effort.** L (3–6 weeks).

**Expected business outcome.** Higher activation and retention (simpler onboarding, unfolding value); the machinery that makes tiers possible is now live and testable by flipping rows.

---

## Phase 3 — Living Family Model: Foundations

**Purpose.** Begin the moat. Make North Star *remember* and let that memory shape what it generates — the constitution, made minimally real.

**User value delivered.** "It remembers us." Projects, reflections, and reports start reflecting the family's actual context, culture, and history. The **Weekly Conversation** arrives — a gentle, optional check-in through which North Star learns by talking, not by forms.

**Engineering work.** A durable family-memory layer (extensible, free-form-capable — see the Appendix M constraint: not rigid enums) that the AI reads from and writes to; the Weekly Conversation surface (dictate / type / skip-no-penalty).

**Database work.** A memory/context store keyed to family (and child) that can hold accumulated understanding and conversational input; care to keep it extensible so Family Culture and Relationship Intelligence can grow into it later without a rewrite.

**Backend work.** Context assembly for generation (family + child + relationships + context + memory); Weekly Conversation intake; feed the accumulated understanding into project generation, councils, reflections, reports.

**Frontend work.** The Weekly Conversation UI (voice-first friendly); light surfacing of "what North Star has come to understand" where it builds trust.

**AI work.** This is the AI-heavy phase: generation that *reasons over accumulated context* rather than a single request's inputs; conversational intake that quietly extracts durable understanding; questions that personalise from history and don't repeat by rote. Enforcement + throttling from Phase 0 still apply; still no per-tier AI quota.

**Testing.** Quality evaluation (does memory measurably improve generation?); privacy tests (family memory is strictly family-scoped — reuse Phase 0 harness); conversation skip/again-later flows; cost monitoring (richer context = more tokens).

**Deployment risks.** AI cost per generation rises with context depth — watch it (the Phase 0 throttle is the backstop; a real usage ledger may become necessary here). Quality regressions are subtle — need an eval loop, not just unit tests.

**Dependencies.** Phase 1 (engaged families generate the signal worth remembering); Phase 2 (disclosure surfaces the Weekly Conversation at the right moment).

**Approximate effort.** L–XL (5–8 weeks).

**Expected business outcome.** 🟢 The retention engine. This is what makes leaving costly and what the whole constitution is about — value that compounds with tenure.

---

## Phase 4 — Child Insights (Flourish headline)

**Purpose.** Build the depth that justifies Flourish: the child-profile Insights and matured Growth Reports.

**User value delivered.** Parents get language for who their child is becoming — optional interpretive lenses (Astrology, Human Design, Personality *tendencies*) inside the child profile, plus richer growth reports drawing on LFM memory. Simplified/comprehensive as a within-feature toggle.

**Engineering work.** Insights modules in the child hub (never top-level); keep lenses lightweight and clearly *interpretive*, distinct from AI-observed patterns.

**Database work.** Insight configuration/state per child (largely exists); reports drawing on the Phase 3 memory layer.

**Backend/AI work.** Generate insight content and growth-report narrative from accumulated understanding; hold interpretive lenses as tendencies-not-verdicts (a constitutional constraint, enforced in tone).

**Frontend work.** Insights tabs in the hub; simplified/comprehensive toggle; Growth Report presentation as recognition, not statistics.

**Testing.** Tone/safety review (tendencies not classifications); entitlement gating (this is Flourish+ — but tiers aren't *live* until Phase 5, so build it entitled-but-previewable).

**Deployment risks.** Sensitivity — personality framing about children must be careful and opt-in. Reputational, not technical.

**Dependencies.** Phase 3 (Insights are only as good as the memory behind them).

**Approximate effort.** M–L (3–6 weeks).

**Expected business outcome.** Creates the tangible reason to move from Foundation to Flourish — needed before Phase 5.

---

## Phase 5 — Tier Activation (Foundation / Flourish / Legacy)

**Purpose.** Turn on the full three-tier commercial model now that each tier has genuine substance.

**User value delivered.** Clear choice: Foundation (the complete loop), Flourish (adaptation — Insights, Growth Reports, richer LFM), Legacy (the deep family OS). Contextual upgrade previews go live at earned moments (disclosure Stage 4).

**Engineering work.** Flip `min_plan` gating on for real; close the Founding purchase window (`is_purchasable=false`) so new customers pick a tier while founders keep their bundle.

**Database work.** Seed remaining plan rows; wire `founding_early_access` decisions per feature.

**Backend work.** Three Stripe price sets (Foundation/Flourish/Legacy, monthly/annual); upgrade/downgrade flows; webhook price→plan mapping extended; proration.

**Frontend work.** Pricing page with three tiers; in-app upgrade previews; plan management in Settings.

**Testing.** Full entitlement matrix live; upgrade/downgrade/proration; founders unaffected (bundle intact); "Foundation still feels complete" re-test.

**Deployment risks.** Billing complexity multiplies (3 price sets, upgrades, proration, dunning). This is the riskiest *commercial* phase — stage carefully.

**Dependencies.** Phases 2 (engine), 3 + 4 (Flourish/Legacy substance).

**Approximate effort.** M (2–4 weeks) — mostly Stripe + flows, engine already built.

**Expected business outcome.** 🟢 ARPU and expansion revenue; the business model becomes real. Also the point of maximum operational overhead — see critique.

---

## Phase 6 — Family Economy (in Councils)

**Purpose.** Add a Legacy-depth capability *inside* Family Councils: educational, manually-managed family finance.

**User value delivered.** Goals, children's earnings, business income, Save/Spend/Invest/Give, allowances, project budgets — a family learning about money together. **No bank aggregation.**

**Engineering/DB/Backend/Frontend.** A contained module within Councils; simple manual ledgers; LFM-aware suggestions ("a saving goal that fits this family"). Small, deliberately bounded.

**AI work.** Light — surface economy opportunities in council/project context from LFM understanding.

**Testing.** Standard; entitlement gating (Legacy).

**Deployment risks.** Scope creep toward real banking — resist hard. Keep it educational and manual.

**Dependencies.** Phase 3 (LFM), Phase 5 (Legacy tier live to gate it).

**Approximate effort.** M (2–4 weeks).

**Expected business outcome.** Deepens Legacy's justification; modest direct impact.

---

## Phase 7 — Community Hall

**Purpose.** The living ecosystem where families contribute — share projects, offer ideas, mentor newer families, showcase, celebrate.

**User value delivered.** Belonging and network effects; the platform improves because families use it. (Long-term, potentially the strongest retention lever — but only at scale.)

**Engineering/DB/Backend/Frontend.** Substantial: sharing with consent, contribution flows, **moderation**, showcases, mentoring connections, events. New heavy surface area.

**AI work.** Matching, moderation assistance, surfacing relevant contributions via LFM.

**Testing.** Trust & safety is the hard part — moderation, consent, child-safety in a social context. Extensive.

**Deployment risks.** Highest of any phase: moderation cost and liability, child-safety in social features, needs critical mass to not feel empty, ongoing operational load. A social product bolted onto a family product.

**Dependencies.** A meaningful base of active families (won't exist until well after launch); Phase 3 (LFM), Phase 5 (gating).

**Approximate effort.** XL (8–12 weeks), plus permanent ongoing moderation cost.

**Expected business outcome.** Potentially large (network effects, retention) — but far out, and easy to get wrong. **Strong candidate for radical deferral / concierge-first — see critique.**

---

## ∞ Vision Horizon (not scheduled — kept open by design)

Per Appendix M of the proposal and the constitution: **Relationship Intelligence** (reasoning across children/adults), **Family Culture** as a full living layer, **AI-driven disclosure readiness** (`reveal_rule.mode: "ai_readiness"`), and North Star as a fully-realised trusted family guide. These are *expressions of the same Living Family Model*, not new products. The only near-term obligation is negative: **don't design them out** (keep memory extensible; let the LFM reason across the whole family; don't hard-wire generation to a single `child_id`). Not built in this 18–24 month window.

---

## Cross-cutting engineering (threaded through, not a phase)

- **Files → Supabase Storage.** Base64-in-rows is fine for a handful of families; it will not survive portfolio growth and keepsake videos. Plan a migration to private, path-scoped Storage buckets **around Phase 3–4** (when portfolios matter). Signed URLs + family/child-scoped paths from day one when it lands. Not urgent now; do not let it slip past Phase 4.
- **Build step / TypeScript.** Stay vanilla until it hurts. Reassess a light bundle/TS step only if team grows or bug rate from the no-types codebase rises. Deliberately *not* a phase.
- **Observability.** The Phase 0 security logging should grow into basic product/cost telemetry (AI spend per family, activation funnel) by Phase 3 — you cannot manage LFM cost or tier conversion blind.
- **The regression harness is permanent infrastructure** — every phase adds to it.

---

## MVP discipline — what we deliberately DON'T build early

- No features registry until there's more than one plan to gate (Phase 2, not Phase 1).
- No AI usage-accounting/quota system until cost data demands it (throttle-only through Phase 2; revisit at Phase 3).
- No `ai_readiness` disclosure, no Relationship Intelligence, no full Family Culture engine — all Vision Horizon.
- No bank aggregation, ever, in the Economy.
- No Community until there's a community to serve.
- No frontend rewrite.
- Everything speculative hides behind the `state`/`surface_class`/feature-flag machinery so it can ship dark and reveal by flipping a column.

---

## Top technical risks

1. **AI cost scaling with LFM depth.** Richer context = more tokens per generation; unbounded, it erodes margin. *Mitigation:* Phase 0 throttle now; usage telemetry by Phase 3; quota only if data demands.
2. **Migration-history drift.** Tooling misreports what's applied; a bad migration could corrupt live data. *Mitigation:* reconcile in Phase 0; always diff live schema before applying.
3. **Base64-in-rows storage.** Bloats rows, caps portfolio/video growth, and keeps sensitive files in ordinary tables. *Mitigation:* scheduled Storage migration by Phase 4.
4. **Single-builder bus factor + a broad, under-tested surface.** Lots of existing features, thin test coverage. *Mitigation:* the regression harness; ruthless prioritisation; prune (below).
5. **AI quality regressions** as generation grows context-dependent — hard to catch with unit tests. *Mitigation:* an evaluation loop from Phase 3.

## Top product risks

1. **Breadth over depth.** The biggest one. The app already has many features; adding more before deepening the loop and the LFM risks a wide-but-shallow product. *Mitigation:* the roadmap front-loads depth (LFM) over new breadth; feature audit (below).
2. **Founding families experience UX churn** (nav restructure in Phase 2 after launching in Phase 1). *Mitigation:* light cleanup at launch, communicate changes, visibility-only.
3. **Insights sensitivity** — personality framing about children. *Mitigation:* tendencies-not-verdicts, opt-in, careful tone.
4. **Disclosure feels manipulative if mistuned.** *Mitigation:* the restraint rules are architectural; calibrate thresholds against real behaviour.

## Top commercial risks

1. **Turning on three tiers too early** — operational overhead (3 price sets, upgrades, proration, dunning, support) before there's proven demand or differentiating depth. *Mitigation:* Phase 5 gated behind Phases 3–4; consider staying single-plan longer (critique).
2. **Founding over-promise.** Resolved in the proposal (Founding is a bounded bundle, not "everything forever") — hold that line.
3. **Willingness-to-pay unproven.** *Mitigation:* Phase 1 exists precisely to learn this early, cheaply.
4. **Churn if the moat isn't real yet.** Selling retention-priced tiers before the LFM compounds is fragile. *Mitigation:* LFM (Phase 3) before tier activation (Phase 5).

## Recommended hiring order

Assuming lean funding, hire only when a bottleneck is proven:

1. **Full-stack engineer (Supabase/Postgres + JS)** — first hire, to break the single-builder bus factor and parallelise Phases 2–4. Highest leverage.
2. **AI/ML-leaning engineer** — around Phase 3, to own the LFM context/eval/cost loop (the hardest, most differentiating work).
3. **Trust & safety / community lead** — *only if* Community (Phase 7) is greenlit; do not hire ahead of that decision.
4. **Part-time designer** (contract) — around Phase 2/4 for the disclosure and Insights UX.
Customer support/success is a founder job until the founding cohort outgrows it.

## Suggested release cadence

- **Phase 0 & 1:** ship as soon as green — these are urgent. Small, frequent, well-tested releases.
- **Steady state from Phase 2:** a shippable increment roughly every **2–3 weeks**, behind feature flags, with the regression harness gating each. Big phases (3, 7) ship in dark increments, revealed when whole.
- **Never** batch security fixes behind feature work — security ships the moment it's ready.

## Definition of Version 1.0 — "Secure & Sellable"

The complete magic loop, monetized and safe. A founding family can pay, trust the product with their children's data, and complete onboard → child → generate → complete → upload → reflect without friction. **= Phases 0–2.** This is the beginning of the relationship, delivered well.

## Definition of Version 2.0 — "Adaptive"

North Star actively adapts to the family. It remembers (LFM foundations + Weekly Conversation), it has something real to say about each child (Insights + Growth Reports), and the three-tier model is live. Flourish is genuinely worth buying. **= Phases 3–5.** This is where the moat becomes visible.

## Definition of Version 3.0 — "The Family Operating System"

The deep, connected North Star: Family Economy, a contributing Community, and the first Relationship-Intelligence / Family-Culture capabilities — the platform beginning to personalise *family life*, not just learning, and pointing beyond itself to human guides. **= Phases 6–7 + early Vision Horizon.** The trusted family guide.

---

## CTO critique — where I think you're building too much, too early

You asked me to be willing to recommend delaying or deleting work. Here is where I'd hold the line:

**1. Community (Phase 7) is the clearest over-reach — defer it hard, and do it concierge-first.** It's the heaviest build in the roadmap, carries permanent moderation cost and child-safety liability, and *only works at a scale you won't have for a long time*. Building an in-product community for a few dozen founding families is building a stadium for a dinner party. **Recommendation:** when the moment comes, start with a **manual, off-platform community** (a hosted group, curated by you) to prove families *want* to contribute before writing a line of Community code. Delete the in-product build from the 18–24 month plan entirely; earn it later. This alone de-risks the roadmap significantly.

**2. Reconsider whether you need three tiers at all in this window.** Every additional tier is real operational weight — pricing, upgrade flows, proration, dunning, support, and the cognitive load of *deciding what goes where*. A single excellent plan (Founding, then a single "North Star" plan) is dramatically simpler to run and sell, and the constitution's "relationship not tiers" ethos arguably *prefers* it. **Recommendation:** seriously consider staying single-plan through v2.0 and only splitting into Foundation/Flourish/Legacy once retention and demand are proven and you have a waitlist. The entitlement engine (Phase 2) is still worth building — for disclosure and future-proofing — but you may not need to *activate* multi-tier billing (Phase 5) as early as the example implies. This is the highest-value question in the whole roadmap; I'd want to discuss it explicitly.

**3. Audit and prune the existing breadth before adding more.** The app already has domains, inventory, resources, rewards, portfolio, councils, reports, insights, calendar. Before Phase 4+ adds Insights depth and Economy, I'd run a hard **feature audit against the constitution's Purpose test**: does each existing feature clearly help a family flourish, and is it deep enough to be worth maintaining? Some are likely shallow. Cutting or dormant-ing two or three would *reduce* surface area, maintenance, and cognitive load — fully in the spirit of "reduce work, not create it." **Adding depth to the loop and the LFM will do more for North Star than any new feature.**

**4. Child Insights is seductive but not core.** Astrology/Human Design are fun to build and demo well, but they are a Flourish garnish, not the loop. Keep them lightweight, keep them after the LFM, and don't let them expand into a personality-assessment product. If time gets tight, Insights is more deferrable than the LFM.

**5. Family Economy: keep it tiny or skip it in this window.** It's a genuine Legacy delighter but low-urgency, and it has a strong gravitational pull toward becoming a fintech feature. If capacity is tight, this is a clean cut for the 18–24 month plan.

**The through-line:** North Star's advantage is not how many things it does — it already does many. It's how *deeply it understands one family over time.* Every hour spent on the Living Family Model (Phase 3) compounds; most hours spent on new breadth (Community, Economy, even Insights) do not. If I could change one thing about the instinct behind the example ordering, it would be to **spend less on breadth (5, 6, 7) and more on depth (3), and to prove demand before multiplying tiers.** Secure it, sell it, make it remember — then, and only then, widen it.

*This roadmap serves the Constitution. If a phase ever stops serving a family's flourishing, we cut it — including phases in this document.*
