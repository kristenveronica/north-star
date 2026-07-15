# North Star — The Six-Month Cut

**If we had only six months and constrained funding: the 20% that builds 80% of the moat.**

Date: 2026-07-14 · A ruthless amendment to [the Build Roadmap](build-roadmap.md). This document deletes more than it builds. That is the point.

---

## The one-sentence answer

**Build the flywheel between *usage* and *memory*, and delete everything else.**

Every feature in the roadmap is expendable except the loop where a family uses North Star, North Star remembers, and that memory makes the next use better. That loop is the only thing that compounds. Nothing else on the roadmap gets *more valuable* the longer a family stays — so in a six-month, hour-scarce world, nothing else earns a place.

---

## The moat is not a feature. It is a flywheel.

```
       a family lives, completes projects,
        reflects, has weekly conversations
                     │  (signal)
                     ▼
      the Living Family Model accumulates
        durable understanding of THIS family
                     │  (memory)
                     ▼
      generation & guidance get more personal,
            more accurate, more theirs
                     │  (value)
                     ▼
        the family gets more out of it,
           uses it more, stays longer
                     │
                     └──────────► (more signal — the wheel turns again)
```

Two properties make this a moat and nothing else on the roadmap one:

1. **It compounds.** Month 12 is dramatically better than month 1 *for the same family*, with no new features shipped — purely because North Star knows them better.
2. **It is non-portable and non-replicable.** A competitor with the identical AI model but no history *cannot* match month-12 North Star. The understanding can't be copied, bought, or rushed. Every month a family stays, the switching cost rises.

That is the entire thesis of the Constitution, reduced to an engineering priority.

---

## The 20% we build

> **Revised after the Founder↔CTO review (2026-07-14).** Two changes survived that review and improved the plan: **Observation** is elevated to a first-class capability (it is the *ignition* for the memory flywheel, not an afterthought), and a **thin capability-flag spine** is added as infrastructure. Child Insights stayed out; a human-guidance *marketplace* stayed out. Reasoning in the review notes at the foot of this document.

**There are two flywheels, and they interlock.** The memory flywheel (usage → memory → better guidance → more usage) is the moat. But it has a cold start: in month 1 memory is nearly empty, so guidance is generic, and a family may leave before it compounds. The **observation flywheel** (observation → trust → sharing → richer memory → sharper observation) is what *ignites* it — it makes the memory *visible* and earns the trust that makes a family share. **Memory is the asset; observation is the proof.** My first draft had the asset without the proof. Both are now first-class.

**Tier 1 — The moat itself (where the six months actually go):**

1. **The Living Family Model memory substrate.** Durable, extensible, family- and child-scoped accumulated understanding. The compounding asset. Everything else exists to fill it or feed from it.
2. **Observation — "I've noticed…"** The visible face of memory, and the ignition of the whole system. Gentle, *true* statements — *"Noah consistently gravitates toward engineering challenges," "your family seems happiest when projects happen outdoors," "Jett is far more engaged when Noah joins in."* Not recommendations, not reports — evidence that North Star is genuinely learning. This is what earns trust in month 1–3 before deep memory exists, and trust is what makes a family share, which is what feeds memory. **Hard rule: an observation ships only when it's true and earned — a wrong "I've noticed…" destroys trust faster than silence.** (It also carries the cheap, on-brand outward form: *"this may be a season where a mentor could take Noah further than I can"* — see §4 of the review.)
3. **A magic loop worth doing, wired *into* memory.** Generation reads from memory and writes back to it, so every completed project makes the next one better. Completion, reflection, and upload are not features — they are the *signal-capture* that turns the wheel. The loop must be good enough that families keep doing it.
4. **The Weekly Conversation.** The highest-signal, most defensible, cheapest input pump — memory grows through *relationship*, not forms. Now motivated by the trust observation has already built: a family that's seen North Star *notice* them will answer its questions.
5. **Moments of delight + the plan-rarely-relate-often rhythm.** Cheap to build, and they protect the one thing the moat needs above all: *time*. A family that churns in month 2 never reaches compounding.

**Tier 0 — The floor (not moat, but you die without it):**

6. **Security hardening (Phase 0).** Not a moat — a license to operate. One breach of children's data ends the company before any moat can form. Non-negotiable, kept minimal.
7. **A thin capability-flag spine.** *Conceded in the review.* Not the commercial entitlement engine — a lightweight `features`/flag table + a resolver that answers "is this on for this family?" It costs ~days, and it's the infrastructure everything else rides on: dark-launching LFM generation changes to a subset of families, A/B-ing observation quality, gating internal test builds, marking the founding cohort. It *serves* the flywheel work rather than competing with it. **Scope guardrail: build the flag mechanism and the handful of flags actually needed — do not model plans, tiers, ranks, or Stripe. That's the commercial engine, and it stays deleted.**
8. **Single-plan monetization.** One plan, taken cleanly. Not tiers. Revenue is survival, and a paying family is a committed one. Just enough to charge — nothing more.

That's the whole build. Six months.

---

## What we delete — and why it doesn't compound

Each of these is a fine idea. None of them makes North Star more valuable in month 12 than month 1, so all of them are cut from the six months.

| Deleted | Why it doesn't compound |
|---|---|
| **Three-tier commercial system** | Tiers capture revenue; they don't deepen value. A single plan monetizes the moat without the operational weight. Build tiers when retention is *proven*, not before. |
| **Child Insights (Astrology / Human Design)** | Static lenses — a birth chart is identical in month 1 and month 20, zero compounding. Reviewed as a "trust accelerator" and rejected: it's *hollow* trust (computed from a birth date, requiring zero observation of the actual child), it risks miscasting the product as lens-content rather than understanding, and it carries real audience risk with values-driven families. The trust it seeks is better delivered by **Observation** (built, Tier 1). |
| **Community Hall** | Network effects compound at *platform* scale you won't have in six months. For one family, it adds nothing to their accumulated value. Concierge it off-platform if at all. |
| **Human-guidance marketplace/directory** | The AI *voicing* "a mentor may serve you here" is cheap and built (part of Observation). But a curated, vetted *supply* of mentors/circles/retreats + booking + the liability of vouching for strangers to families with children is closer to Community's cost than it looks, and the recommendation itself is a one-time event, not a compounding asset. Voice it; don't build the network. |
| **Family Economy** | A delighter, not a moat. Same value regardless of tenure. |
| **The commercial entitlement engine (plans, tiers, ranks, Stripe price-mapping, upgrade flows)** | Captures revenue; doesn't compound the moat. **Note the distinction drawn in the review:** the *thin capability-flag spine* IS built (Tier 0, infrastructure) — it's the *commercial tier machinery* on top of it that waits until retention is proven. |
| **Rewards, and most existing breadth** | Freeze. Every hour maintaining shallow breadth is an hour not spent on memory. Audit against the Constitution's Purpose test; dormant what doesn't serve the loop. |

**Growth Reports** are the one edge case — they *partly* compound (richer with history). But they're an *output* of the memory layer, so they come nearly for free once Tier 1 exists; don't build them as a separate effort.

---

## The six-month sequence

- **Weeks 1–3 — Security floor + flag spine.** Phase 0, minimal. Add the thin capability-flag layer (days) so everything after can dark-launch. License to operate. Ship.
- **Weeks 3–5 — De-risk the core bet.** Before committing the runway, run [the two LFM Validation Experiments](lfm-validation-experiments.md): (1) does accumulated context make generation *dramatically* better, and (2) can observations make families *feel understood* — for real, not Barnum flattery. Pre-registered pass/kill thresholds, real families, no production code. If either fails, rethink the architecture before month 6. Both must pass to proceed.
- **Weeks 5–8 — Single-plan sellable.** Take money for one plan. No registry, no tiers. Ship. *Revenue on.*
- **Weeks 8–24 — The dual flywheel, relentlessly.** Memory substrate → **Observation ("I've noticed…")** as the visible proof and ignition → memory-aware generation → Weekly Conversation → signal capture from the loop → light delight/retention. Then *iterate on generation and observation quality* for the rest of the runway. Not a feature you finish; a loop you tune until the compounding is undeniable.

Everything after week 8 is spent making two things true: **that North Star visibly *notices* each family, and visibly knows them better every month.**

---

## The only metric that matters

> **For a given family, is the guidance North Star generates in month 6 visibly better and more personal than what it generated in month 1 — because of everything it has learned in between?**

If yes, the moat is real and compounding, and you can raise, hire, and widen from a position of strength. If no, no quantity of features (Insights, Community, Economy, tiers) will save it — you'll have built breadth on sand.

Track it directly: sample real families, compare early vs. later generations blind, and ask *"which one clearly belongs to this family?"* When the later one wins every time, the six months succeeded.

---

## What "done" looks like in six months

Not a bigger product. A **narrower, deeper** one: secure, earning from a single plan, with a small number of committed families for whom North Star demonstrably becomes more personal, more useful, and harder to leave with every passing month.

That is 20% of the roadmap creating 80% of the defensibility — because it's the only 20% that compounds. Everything else can wait, and waiting will make it *cheaper* to build later, on top of a moat that already exists.

*Secure it. Sell it. Make it notice, then remember. Everything else is month seven.*

---

## Founder ↔ CTO review notes (2026-07-14)

Four founder challenges to the first draft; verdicts and reasoning.

1. **Entitlements before the LFM? — CONCEDED, with a scope cut.** The founder is right that *entitlements ≠ pricing*. But "entitlement engine" hides two things: a **thin capability-flag spine** (cheap, ~days, real infrastructure — dark launch, A/B, internal test, founding cohort) and the **commercial tier machinery** (plans, ranks, Stripe mapping, upgrade flows — heavy, speculative). Build the first now (it even *serves* the LFM rollout); keep the second deleted until retention is proven. The valid justification is *engineering leverage*, not the founder's "future plans/add-ons," which are commercial and don't need to exist yet.

2. **Child Insights as a trust accelerator? — DISAGREED.** Early trust matters (cold start is real), but astrology/human-design trust is *hollow* — computed from a birth date, no observation of the child — and risks miscasting North Star as lens-content, plus real audience risk with values-driven families. The founder's own point #3 is the better answer.

3. **Observation as a second flywheel? — STRONGLY AGREED, and elevated further.** This was the best point in the review. Observation isn't a second flywheel bolted on — it's the *ignition* for the first. Memory is the asset; observation is the *proof* that earns the trust that drives the sharing that feeds the memory. The first draft had the asset without the proof. Now first-class (Tier 1 #2). Guardrail: observations must be *true and earned*.

4. **Human guides earlier? — PARTIALLY AGREED.** Split the capability: the AI *voicing* "a mentor may serve you here" is cheap, on-brand, and folded into Observation — in. A curated, vetted *supply network* + booking + the liability of vouching for strangers to families with children is closer to Community's cost, and the recommendation is a one-time (non-compounding) event — out for six months.

**Net:** the review improved the plan. It did not change the thesis (memory is the moat); it corrected an omission (observation ignites it) and a false economy (a flag spine is cheap infrastructure, not premature commercial architecture).
