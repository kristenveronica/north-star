# Living Family Model — Validation Experiments

**Prove the two assumptions the moat rests on — with real families, before a single production feature.**

Date: 2026-07-14 · Precedes Phase 3 of [the Build Roadmap](build-roadmap.md); occupies the "de-risk the core bet" slot (weeks 3–5) of [the Six-Month Cut](six-month-focus.md).

---

> **The purpose of the Living Family Model is not to remember more information. It is to help every family increasingly feel understood.**

Everything below measures that sentence. The Living Family Model is a large, expensive bet resting on two unproven assumptions. If either is false, we should discover it in **week 4 for a few thousand dollars**, not in month 6 for a few hundred thousand.

| # | Hypothesis | If it fails |
|---|---|---|
| 1 | Accumulated family context produces **dramatically better** project generation than minimal context. | Memory isn't the moat — context doesn't buy enough. Rethink where value lives (perhaps the loop itself, not memory). |
| 2 | North Star can generate observations that make families **genuinely feel understood** — and that feeling comes from real, specific understanding, not vague flattery. | "Feeling understood" is a parlor trick anyone can copy. No defensible moat. Rethink observation as a trust mechanism. |

**Two non-negotiable design rules for both experiments:**

- **No production code.** Both are run *concierge / Wizard-of-Oz* — context assembled by hand, outputs generated manually or with the existing pipeline fed different inputs, results scored by real parents. We are testing the *assumption*, not building the *machine*.
- **Pre-register the success threshold before running.** The pass/kill line is written down first, so we can't rationalize a marginal result into a green light after the fact. The thresholds below are the commitments.

A note on ethics: real families, real children's data — get explicit consent, use only each family's own data, never expose one family's data to another, and tell parents that critical feedback is the most valuable kind.

---

## Experiment 1 — Does context actually make generation dramatically better?

**Question.** For the *same* child, does a project built from rich accumulated context beat one built from minimal context — by enough that a parent feels the difference clearly, not marginally?

**Design — blind, paired, same-family comparison.**

1. **Recruit 5–8 real families** (founding-adjacent cohort), each with at least one child. Where a family lacks history, gather rich context in a single 30-minute interview — that *is* the concierge stand-in for the memory layer.
2. **For each child, assemble two context bundles by hand:**
   - **Minimal:** age + grade + one stated interest. (What any generic tool already has.)
   - **Rich:** everything you can — accumulated interests and strengths, past projects, family values/vision, inventory, learning style, recent reflections, family rhythms and relationships.
3. **Generate one project from each bundle.** (Use the real generation pipeline if convenient — the *variable under test is the context, not the pipeline*.) **Match output length and format** so the only difference is context-driven fit, not verbosity.
4. **Present both to the parent blind** — unlabeled, order randomized — and ask:
   - Forced choice: *"Which project fits your child and family better?"*
   - Magnitude: *"How much better?"* (1 = marginally · 5 = dramatically)
   - Open: *"Why?"*
   - Optionally, let the child react too.

**Pre-registered thresholds** (~10–16 paired comparisons across the cohort):

- ✅ **PASS ("dramatically better"):** rich context chosen in **≥ 75%** of comparisons **and** median magnitude **≥ 4**.
- 🛑 **KILL:** rich chosen **≤ 55%** (near chance) **or** median magnitude **≤ 2** (marginal). Context isn't buying enough — the memory-as-moat premise is in doubt; rethink before building it.
- ⚠️ **GREY (55–75% / magnitude ~3):** promising but not the slam-dunk the thesis needs. Dig into *which* context drove the wins — you may find only a few context types matter, which means a **cheaper, leaner** memory layer than planned.

**Confounds to kill up front:**

- **Length/effort bias** — richer context yields longer output, which parents equate with "better." *Normalize length.*
- **Order/anchoring** — randomize which project is shown first.
- **Strawman minimal** — the minimal-context project must be a *fair, competent* generation, not a deliberately weak one, or the test is rigged and worthless.
- **Evaluator leakage** — the parent (ideally the presenter too) must not know which is which.

**Effort / cost.** ~1 week, mostly manual. A handful of interviews, ~two dozen generations, short scoring sessions. Near-zero engineering.

---

## Experiment 2 — Do observations make families feel understood — for real, or is it flattery?

**Question.** Can North Star produce observations that make a family feel *genuinely understood* — and, critically, **does that feeling come from specific accurate understanding, or from vague statements that would make anyone feel understood?**

**Why this design is different — the Barnum trap.** Vague, warm, universal statements ("your family has a real curiosity about the world") make almost everyone feel understood. That's the **Forer/Barnum effect** — it's exactly how astrology works, and it is *not a moat* because anyone can generate flattery. If our "feeling understood" is really Barnum, the observation flywheel is an illusion. So this experiment doesn't just measure "feel understood" — it measures whether that feeling is driven by **real understanding** by pitting three kinds of observation against each other. *(This is also the empirical reason Child Insights was rejected earlier as a trust builder: astrology is the Barnum arm of this very test.)*

**Design — blind, mixed set with a Barnum control and a wrongness decoy.**

1. Same 5–8 families (run in the same sessions as Experiment 1). For each, hand-craft a **shuffled, unlabeled** set of observations of three types:
   - **(A) Specific-true** — drawn from real data. *"Noah has chosen building or engineering projects in 4 of his last 5."*
   - **(B) Barnum/generic** — vague, universally flattering, true of almost any family. *"Your family has a warmth and a real curiosity about the world."*
   - **(C) Specific-wrong** — specific but *false* (a decoy). *"Jett seems most engaged working on his own"* — when the opposite is true.
2. For each observation the parent rates:
   - *"Does this make you feel North Star understands your family?"* (1–5)
   - *"Is this accurate?"* (yes / partly / no)
   - Open reaction.

**Pre-registered thresholds:**

- ✅ **PASS:** Specific-true scores **high in absolute terms** (median "feel understood" ≥ 4) **AND materially higher than Barnum** (the gap is the real signal — it proves *understanding*, not flattery, drives the feeling) **AND** Specific-wrong scores **low** (families reject false specifics — proving they're discriminating, not just agreeable).
- 🛑 **KILL / rethink:**
   - **Barnum ≈ Specific-true** → the feeling is the Forer effect. Anyone can flatter; there's no defensible moat in observation. Either raise specificity dramatically or drop observation as the trust mechanism.
   - **Specific-wrong ≈ Specific-true** → families aren't discriminating; agreement is unreliable and "feel understood" isn't measuring understanding at all. The metric itself is broken — fix the measure before trusting any result.

**Confounds to kill up front:**

- **Social desirability** — parents want to be kind. The specific-wrong decoy exists precisely to catch indiscriminate agreement; frame critical feedback as the most useful.
- **Cherry-picking** — craft a *fixed* number of each type per family; the person authoring the specific-true items shouldn't also score them.
- **Small-n** — at this scale the *qualitative reactions* matter as much as the numbers. A parent going quiet and saying "…how did it know that?" is data.

**Effort / cost.** ~1 week, manual, overlapping with Experiment 1's sessions. Near-zero engineering.

---

## Decision rules (the whole point)

| Outcome | Decision |
|---|---|
| **Both pass** | Green-light the six-month LFM build with confidence. These two protocols **become the permanent evaluation harness** — the same blind comparisons run forever as regression tests on generation and observation quality. The experiment isn't throwaway; it's the seed of the quality measurement Phase 3 needs anyway. |
| **Exp 1 fails** | The moat premise (context → dramatically better generation) is broken. Do **not** build the memory layer yet. Investigate whether value lives elsewhere (the loop itself, a leaner context set) before committing months. |
| **Exp 2 fails (Barnum)** | Observation is flattery, not understanding — not defensible. Either find a specificity bar that beats Barnum, or drop observation as a trust mechanism and lean the cold-start elsewhere. |
| **Either grey** | Run one more tightened round before deciding. Grey is not green. |

**The commitment:** we do not begin production engineering on the Living Family Model until both hypotheses have passed on real families. This is cheap insurance against the single most expensive way North Star could fail — building a beautiful memory system that doesn't actually make anyone feel understood.

*If it doesn't make a family feel understood, it doesn't belong in the Living Family Model — no matter how much it remembers.*
