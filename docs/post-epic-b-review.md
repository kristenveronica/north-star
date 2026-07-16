# CTO Review — After Epics A & B

**A roadmap challenge, written after shipping Security and Durable Data.** Date: 2026-07-16.

I was asked not to protect previous decisions. This review takes that seriously. Where I now think the plan is wrong, I say so. The headline up front, so nothing is buried:

> **I would not build Epic C (payments) next. The highest-leverage engineering epic now is Epic D — the working loop — with Epic E's validation experiments elevated from a side-track to the most important thing happening this month, and payments (C) made minimal and late.**

The reasoning follows the nine questions, then the single recommendation.

---

## Context: what "Epic C next" actually means

For clarity, the Sprint 1 epics are: **A** Security (done), **B** Durable Data & Context Substrate (done), **C** Single-Plan Founding Payments, **D** The Working Loop (onboard → generate → complete → reflect → upload), **E** Flywheel De-risk (the validation experiments that gate the entire Sprint 2 LFM engine).

Everything downstream is currently **unblocked** — C1 (A3 ✓), C2 (C1, A4 ✓), D1 (B2 ✓), D2 (A5 ✓), D3 (B1 ✓), E (needs D2). So this is a pure prioritisation choice, not a dependency-forced one. That matters: I'm free to pick the highest-leverage epic, and I should.

---

## 1. Knowing what I now know — would I still build Epic C next?

**No.** Not C in isolation, and not C before the loop works and the premise is validated.

Payments are a **gate in front of the product**, not the product. Epic C turns on a cash register. Epic D is whether there's anything worth ringing up. After building A and B, three things are clear:

1. **The loop is not yet verified end-to-end.** B1 proved the *data* is durable under the new RLS — but "durable data" is not "walkable product." D exists precisely to prove onboard → generate → complete → upload → reflect has zero dead ends. I have *not* confirmed that. Charging money for an unverified loop — to our **first 25 hand-picked families**, the worst possible cohort to disappoint — is a reputational risk taken for a webhook.

2. **D is what fills the substrate we just built.** B2 is an empty foundation by design. D3 ("completion / reflection / upload persist — the signal the LFM will accumulate") is the tap that starts filling it with real family context. Until D ships, the substrate stays empty, the LFM has nothing to learn from, and **E has no real data to run on.** D unblocks the two things that actually matter.

3. **We are about to price a moat we have not proven exists.** North Star's price is justified by a compounding relationship (the LFM). That relationship's core premise — *does memory-aware generation actually make families feel understood?* — is still **unvalidated** (that's Epic E). Selling retention-priced access before validating the retention mechanism is selling a promise we haven't tested. E costs a week of concierge; it should precede monetisation, not trail it.

**What I'd build instead:** **D now**, with **E launched in parallel** the moment generation is reliable (D2), and **C last in the sprint — and manual/concierge for launch** (a Stripe payment link + the existing beta promo, not the full C2 webhook/plan-mapping machinery). With 25 known families you can take money and learn willingness-to-pay *by hand* while the automated billing waits for a loop that's proven and a premise that's validated.

Note the Sprint 1 waves already half-agree — they run C2 and D1–D3 *in parallel* (Wave 3), not C-then-D. My divergence is sharper: **make C manual and late, and treat E as the centrepiece, not the side-show.**

---

## 2. Assumptions from the roadmap that have now proven false

- **"We have a seat counter."** Optimistic. B1 revealed `child_profile_limit` **defaults to 10** and H4 makes billing only ever *raise* it — so capacity enforcement is effectively **open** today. C1 is therefore slightly more than "seed a plans row"; it must make capacity *actually bind*. Small, but the roadmap under-counted it.
- **"LFM Foundations is an L–XL, 5–8 week phase that must wait until Phase 3."** Half false. The roadmap **conflated the substrate with the engine.** The *substrate* (durable, extensible, secure memory) took **days**, was fully additive, and shipped now with zero disruption. What remains for Phase 3 is the *engine* (reasoning over context, conversational extraction, promotion logic) — which is the genuinely hard part. Separating them changes the sequencing: the cheap half is already done.
- **"Migration-history drift is a blocking hazard."** Real, but less blocking than framed. By verifying against the *live* schema directly and using `apply_migration` (which records history — 0027 is now in it), I've been shipping migrations safely and *incrementally healing* the drift. It's a managed nuisance, not a gate.
- **"The regression harness runs cleanly against staging/prod."** Partially false in *this* toolchain: `RAISE NOTICE` output is invisible through the MCP, and the synthetic `auth.users` FK blocks some behavioural fixtures. Verifying security needs **row-returning** tests (which I built) and, ideally, a seeded test user. The harness is right; its runnability assumptions were slightly off.

## 3. Assumptions that have become stronger

- **"Security is the root dependency."** Strongly confirmed — the holes were *worse* than documented (access codes were ~9 real bits **and** leaked the child's name; the AI endpoint had *zero* authorization; the cross-family chain was real). Front-loading A was unambiguously correct.
- **"Keep the LFM extensible; never hard-wire to `child_id`."** This (Appendix M) turned out to be the single most important design principle in B — it directly produced the scope model and the Archive/Understanding split. Confirmed as load-bearing.
- **"Depth over breadth is the whole game."** Building B made it visceral: every unit of depth on the moat compounds; every new breadth feature (Community, Economy, Insights) is just more surface to secure and maintain. The instinct to starve breadth and feed depth is *more* right than when written.
- **"Additive, reversible migrations + a permanent harness."** Vindicated as the correct discipline; it's already paying compounding dividends (B extended it in an afternoon).

## 4. What is now much *easier* than we expected

- **The LFM substrate.** Budgeted as part of a multi-week phase; delivered in days, additive and safe. The **conceptual** work (the Living Family Record blueprint) was the hard part — not the schema.
- **Adding secure, family-scoped tables.** The `is_family_member()` RLS pattern + the harness make new secure tables nearly mechanical. Every future LFM/feature table is now cheap and low-risk.
- **Standing up E's data capture.** Because B2 exists, the place to accumulate the context E needs already exists. E got cheaper because B shipped.

## 5. What is now much *harder* (or more clearly hard) than we expected

- **The LFM *engine*, not its storage.** B clarified that the schema is easy but the **judgment layer is hard**: what to promote from event to meaning, how to weigh contradicting evidence, when a belief graduates lifespans, how confidence is earned. Your Archive/Understanding refinement made provenance and correction first-class — which *raises* the bar on getting that logic auditable and right. This is the real Phase 3, and it's harder and riskier than the substrate implied.
- **AI cost & quality observability.** The moment generation reasons over rich context, both cost and quality become hard to manage **blind** — and we have **no usage telemetry** yet. This moved from "later" to "needed alongside the engine."
- **Payments correctness (C2).** Unchanged but still genuinely fiddly — real money, webhook idempotency, beta-family mapping, failure paths. It remains the highest-*severity* task in C, which is another reason not to rush it ahead of a working loop.

## 6. Has anything become unnecessary?

- **C3 (flag mechanism) and C4 (entitlement registry) — confirmed unnecessary now.** B proved you don't need a feature flag to dark-launch: an **additive substrate with no engine reading it *is* the dark launch.** Cut C3 unless D specifically needs it (it doesn't).
- **The original A6 "lengthen + rotate codes" task** — overtaken by the A6b word-pair redesign, already shipped better.
- **Heavyweight dry-run ceremony for additive migrations** — I learned to match ceremony to blast radius; additive-only changes get apply-then-verify-by-query, not a rollback rehearsal.

## 7. Has anything become more important?

- **Epic E (validation experiments) — dramatically.** This is the biggest shift in my thinking. Now that the substrate is trivial and the *engine* is confirmed to be the hard, expensive, unproven part, **proving the engine is worth building — before building it — is the highest-leverage act in the whole plan.** E is cheap (concierge, 5–8 families), it gates *all* of Sprint 2, and it answers an existential question. The roadmap files E as a "parallel, mostly non-engineering track." I now think it's the **crown jewel of the next month.**
- **Epic D (the working loop).** It's the actual product *and* the signal-capture that fills the substrate and feeds E. Its status quietly rose from "hardening chores" to "the thing everything else depends on."
- **AI cost telemetry** — promoted, because the next real build (the engine) cannot be steered blind.

## 8. Shortest path to launch while preserving the Constitution

**Keep:**
- Security (A — done). Non-negotiable.
- **The working, durable loop (D)** — onboard → generate → complete → upload → reflect. This *is* the product.
- Durable capture (B — done).
- A way to take money — but the **minimum** one.

**Remove from the launch critical path** (defer, don't delete): automated 3-tier billing, the entitlement registry, the disclosure engine, Child Insights, Family Economy, Community, Rewards depth, adult add-seat flows. The roadmap already defers most of these; this confirms it.

**Move:**
- **E earlier — to now, in parallel.** It's cheap and it gates everything; there is no reason to run it after months of engine work instead of before.
- **C later and lighter.** Launch on a **concierge Founding sale** (payment link + existing promo) rather than building C2's webhook/plan machinery first. Automate billing once the loop is proven and E has reported.

**The shortest honest launch = A (secure) + D (a loop that works) + a manual way to pay + E running.** The Constitution is preserved precisely *because* we refuse to sell a hollow or unproven experience.

## 9. If I owned 30% — would I spend the next month as the roadmap proposes?

**Substance yes; sequence no.** I would not spend the month building automated payments and plan machinery. I'd spend it:

1. **Hardening the loop end-to-end (D)** so the product genuinely works — mostly wiring existing pieces, low risk, fast.
2. **Running the validation experiments (E) in parallel** with real families the moment generation is reliable — because **if E fails, most of the post-launch roadmap is wrong, and I'd want to know that for the price of one concierge week, not three months of engine-building.**
3. **A minimal, possibly manual, Founding sale** to start learning willingness-to-pay — without letting billing machinery become the month's centre of gravity.

The single sentence: **building the cash register before validating that the store has something worth selling is optimising the wrong thing.** E is the cheapest possible test of the most expensive assumption in the business. I'd protect that week above almost anything.

The one place I'd check my own contrarianism: revenue *does* discipline a product, and a founding family's payment is real signal — so I would not *skip* C. I'd make it **small and manual now, automated later.** That preserves the learning without betting the month on plumbing.

---

## Recommendation — the one next Epic

> ### Build **Epic D — The Working Loop** next. Launch **Epic E** in parallel the instant generation (D2) is reliable.

**Why D is the highest-leverage engineering time right now — not because it's next in the list, but on the merits:**

1. **It is the product.** Everything else — payments, tiers, insights — gates or decorates the loop. If the loop has dead ends, none of it matters. Nothing we could build ranks above "the core experience actually works."
2. **It's mostly hardening, not new build** — low risk, fast, and it converts the broad-but-shaky existing surface into something trustworthy. High value per engineering hour.
3. **D3 turns on the signal.** Durable completion/reflection/upload is what starts filling the B2 substrate with real family context — the prerequisite for *both* the future LFM engine *and* the E experiments. D is the keystone that makes the next two months' work possible.
4. **It unblocks E, the cheapest test of the roadmap's most expensive assumption.** D2 gives E real generation to evaluate. Run D and E together and, within weeks, we either de-risk the entire moat thesis or learn — cheaply — that it needs rethinking *before* we build the engine.

**Where this differs from the roadmap, plainly stated:** the roadmap's example ordering (and a literal reading of "Epic C next") puts **payments first**. I'm recommending **D first, E elevated to the centrepiece, and C minimal-and-late**. I'm not protecting the loop because it's the product-in-the-abstract; I'm choosing it because, after building the foundation beneath it, D is the one epic that simultaneously ships the product, fills the moat, and unlocks the validation that tells us whether the rest of the plan is even right.

Secure it (done). **Make it work and prove it's worth remembering (D + E).** *Then* sell it (C). That order serves North Star today better than the order we wrote last week.

---

## Addendum — Epic C reframed: *Founding Family Activation* (resolved with the founder)

The founder pushed back on one recommendation, correctly. I proposed making payments **manual/concierge** to avoid the plumbing. That was a mistake — it optimised for engineering convenience and, in doing so, would have **discarded a validation signal.** Revised position:

**Payment is not billing infrastructure. It is a commitment mechanism.** A family that pays behaves differently from a beta tester — they engage more deliberately, expect more, and either stay or leave for real reasons. **That behaviour is part of what we need to validate**, so the payment must be *real*, not comped or invoiced by hand. This changes my recommendation: keep Epic C — but shrink it from "Commercial Architecture" to the smallest **real** commitment loop.

### Epic C, reframed: the objective is a funnel, not a billing system
> Can a family **discover → purchase → onboard → experience the magic loop → and remain subscribed?**

Nothing more. Everything that isn't on that path is cut.

**Three implications I'd add to the founder's framing (strengthening it, not just accepting it):**

1. **The charge must be non-zero.** A 100%-off founding comp validates *nothing* about commitment — it recreates the beta dynamic we're trying to escape. Founding pricing can be generous, even steeply discounted, but it must be **real money** or the commitment signal doesn't exist. *(This is a commercial/pricing call — yours — but the validation design depends on it, so I flag it.)*
2. **The paying cohort and the validation cohort must be the same families.** Then Epic E observes commitment, engagement depth, *and* "do they feel understood" from one group — and the retention question ("remain subscribed") becomes the single truest signal of whether the whole thesis holds. One funnel, three answers, from the same 25 families. That is capital-efficient company-building.
3. **"Discover" is mostly a commercial surface, not an engineering one.** Acquisition/positioning is yours; engineering's job is that *once a family arrives*, purchase → onboard → loop → stay is frictionless and durable. I'll own the funnel from the buy button inward.

### What "just enough commerce" means technically (deliberately tiny)
- **Keep:** one Founding plan, a **real** checkout (a Stripe Payment Link or minimal Checkout session — real card charge, minimal build), an **idempotent** webhook that flips the family to *active*, capacity that actually binds (C1 — and note B1 found it currently *doesn't*: `child_profile_limit` defaults to 10), and the ability to observe retention (they can cancel; we can see it).
- **Cut, unchanged from the review:** entitlement engine, `plans` table beyond one row, tiers, disclosure engine, upgrade/downgrade/proration, adult-seat flows, the registry (C3/C4).
- The difference from my earlier "manual" idea: **real self-serve payment, minimally built** — not hand-invoicing. Small, but genuine.

### The sequence I would now choose

The cleanest structure merges the loop and the commitment into **one measurable outcome**, with validation observing it:

1. **Activation (Epic D + the thin Epic C, as one deliverable).** Build order within it:
   - **First, the loop (D1–D4)** — you cannot sell entry to a loop with dead ends. This is the bulk of the engineering and it fills the B2 substrate with real signal.
   - **Then the thin commitment bracket around it** — real single-plan checkout + idempotent webhook → active, capacity binding, existing beta families handled. Acceptance = **one real family completes discover → pay → onboard → loop → still subscribed a week later.**
2. **Validation (Epic E), in parallel, observing the *activated* families** — now measuring commitment behaviour and retention alongside "does context improve generation" and "do observations feel understood." The paid cohort *is* the experiment.
3. **Then Sprint 2 — the LFM engine** (memory-aware generation), gated on E's go/no-go.

### Why this is the right shape for a *company*, not just software
The engineering roadmap and the commercial roadmap now reinforce each other instead of running as separate tracks. The same funnel that proves the *product* works (the loop) also proves the *business* works (a family will pay and stay) and de-risks the *moat* (E observes whether paying families feel understood). We learn willingness-to-pay, commitment behaviour, and the validity of the entire LFM thesis **from one cohort, in one motion.** That is the tightest possible coupling of build and business — which is exactly what a company this small should want.

**Net change to my recommendation:** I withdraw "make payments manual and late." The revised recommendation is: **build the loop and a thin, real commitment bracket as one Activation epic, run validation over the paying cohort in parallel, keep automated *commercial architecture* (tiers/registry) deferred until retention is proven.** Epic C doesn't disappear — it becomes the smallest real thing that turns a user into a committed family.

---

*This review serves the Constitution, not the roadmap. If the roadmap ever stops serving a family's flourishing — or an engineering month's leverage — we change it. This is one of those moments, in a small but real way.*
