# Living Family Model — Constitution

**Status: constitutional.** Stable across implementations; implementations change beneath it. Every change to North Star ("NS") must be answerable to a single question — *"Does this violate the Constitution?"* If yes, the implementation is wrong. If no, it may proceed. This governs data, semantics, and engineering discipline. It is not product vision and does not restate architecture; it is the specification those must satisfy.

The four data nouns — **Archive, Understanding, Recommendation, Report** — are the only kinds of state NS holds. They are defined in Article I and referenced throughout.

---

## Article 0 — Prime Directive

**Principle.** North Star optimises for improving its **Understanding** of the family over time — not for generating projects. Projects, reports, and every other output are one expression of Understanding, never the goal.

**Why.** North Star's durable value is the quality of its evolving Understanding, not any individual output it produces. Projects, coaching, reports, planning, and recommendations may all change form over the years; Understanding is the enduring asset — so a feature that grows output but not Understanding grows the wrong thing.

**Engineering implications.**
- Judge every feature by what it adds to, or how faithfully it consumes, Understanding — not by output volume.
- A feature that produces output without reading or enriching Understanding is suspect until proven otherwise.
- Success is measured in Understanding quality (accuracy, provenance, correction rate), not generation count.

---

## Article I — The Four Nouns

**Principle.** All state is exactly one of four nouns. Each owns a distinct layer of reality. No structure may hold two.

| Noun | IS | IS NOT |
|---|---|---|
| **Archive** | the immutable record of *what happened* — events and evidence, each with a source and a timestamp | interpretation, belief, advice, or a message |
| **Understanding** | NS's current interpretation of the family — derived, replaceable beliefs, each pointing to Archive evidence | a fact, a suggestion, or a message; never immutable |
| **Recommendation** | a proposed action derived from Understanding | evidence, belief, communication, or an action already taken |
| **Report** | a rendering of the other three for a human | a source of truth; it may never originate or store belief |

**No overlap.** If a datum could belong to two nouns, it belongs to the more raw one (Archive → Understanding → Recommendation → Report) and the others reference it by identity. **Truth flows upward only:** Archive feeds Understanding feeds Recommendation feeds Report. It never flows down — a Report never writes Understanding; a Recommendation never writes Archive.

**Truth never flows sideways.** An Understanding record does not directly modify another Understanding record; beliefs do not derive from beliefs. Everything ultimately flows through the Archive — if one belief should influence another, it does so by way of the evidence in between, never laterally.

---

## Article II — Immutability of the Archive

**Principle.** The Archive is append-only. History is never rewritten. Corrections create new evidence.

**Why.** Evidence that can be edited is not evidence; every belief's justification must remain exactly as it was when the belief was formed.

**Engineering implications.**
- No update or deletion of Archive entries in normal operation. A correction is a *new* entry that references what it corrects.
- A mistake in history is itself a fact — record the correction, keep the original.
- The only sanctioned removal is total erasure of a family's data (right to be forgotten); it is never selective rewriting.

*Example.* A parent says "that never happened" → append a contradiction event referencing the original; do not delete the original.

---

## Article III — Replaceability of Understanding

**Principle.** Understanding is NS's current interpretation and is expected to change. Nothing may treat it as permanent truth. **Only Understanding may be replaced. Archive may never be replaced.**

**Why.** Beliefs are provisional by nature; code that hard-codes a belief as fact is wrong the moment the family changes.

**Engineering implications.**
- Understanding is always re-derivable from the Archive; it may be regenerated and replaced with no data loss.
- No downstream system may cache a belief as immutable or persist a decision that cannot be revised when Understanding changes.
- Replacing or removing an Understanding record must never touch the Archive it came from.

---

## Article IV — Provenance

**Principle.** Every Understanding must point back to the Archive evidence that produced it. Nothing exists "because the AI said so."

**Why.** A belief with no traceable evidence cannot be trusted, explained, or corrected.

**Engineering implications.**
- Every Understanding carries links to its supporting Archive evidence and a provenance level (Article VI).
- No belief may be written without evidence references. Model output alone is not evidence.
- If the supporting evidence is erased, the belief must fall with it — no orphan beliefs.

---

## Article V — Uncertainty

**Principle.** NS never pretends certainty. When uncertain, it asks, or it stays provisional. It never manufactures confidence.

**Why.** False confidence corrupts every decision built on it and is the fastest way to lose a parent's trust.

**Engineering implications.**
- Confidence is explicit and honest; a low-evidence belief is labelled provisional, never presented as fact.
- Thin or contradictory evidence → surface for confirmation, or withhold. Never round up to certainty.
- "Unknown" is a first-class state. Silence is preferable to a confident guess.

---

## Article VI — Levels of Truth

**Principle.** Every claim carries a provenance level with defined precedence.

- **Declared** — stated directly by a parent or child. Authoritative.
- **Confirmed** — inferred by NS, then affirmed by a human. Strong.
- **Inferred** — derived by NS from repeated evidence. Provisional.
- **Corrected** — a human changed the value; the new value takes Declared strength, the prior value becomes history.
- **Incorrect** — a human rejected it; it suppresses that inference.
- **Expired** — no longer reinforced within its lifespan; inactive.

**Precedence.** Declared / Corrected ≥ Confirmed ≥ Inferred. **Incorrect** suppresses any Inferred claim of the same thing and must not resurface. **Expired** ranks below every active level. On contradiction, higher provenance wins; at equal provenance, resolve by most-recent reinforcement and evidence weight.

**Engineering implications.**
- Every consumer of Understanding must respect precedence; none may treat Inferred as equal to Declared.
- Suppression (Incorrect) and Expired are queryable states, not deletions (Article II).

---

## Article VII — Learning is Gradual

**Principle.** NS never learns from a single event unless it was explicitly Declared. Repeated evidence strengthens confidence **only to the extent that it is sufficiently independent**; contradictory evidence weakens it.

**Why.** One-shot inference produces confident nonsense, and repetition of the *same* signal is not corroboration — a belief must earn its confidence from genuinely distinct observations.

**Engineering implications.**
- Inference requires a threshold of corroborating Archive evidence (more than one) before a belief is formed.
- Evidence must be weighed for independence: near-identical or causally-linked events count as weaker corroboration than distinct ones. The Constitution mandates that independence *be accounted for*; it does not fix the weighting model, leaving room for it to improve.
- Confidence moves in increments — up on independent reinforcement, down on contradiction — never a binary flip from a single inference.
- Declared facts bypass the threshold (a statement is immediate); everything *inferred* obeys it.

*Example.* Repeated acceptance of nearly identical projects is one weak signal repeated, not strong independent evidence, and must not be treated as such.

---

## Article VIII — Capacity is a Hard Ceiling

**Principle.** Time is real. Capacity is a hard ceiling. NS never manufactures available time. **Projects adapt to families. Families never adapt to satisfy generated projects.**

**Why.** Overbooking a family to hit an internal target breaks both trust and the family's week.

**Engineering implications.**
- `generated_load ≤ available_capacity` is invariant. No band floor, default, or target may raise load above real available time.
- When capacity cannot sustain the smallest worthwhile output, NS declines and offers to defer or rebalance — it never shrinks-and-lies or overshoots.
- Capacity is computed deterministically from real inputs; it is never inflated to fit an ambition.

---

## Article IX — Generation Consumes, Never Creates

**Principle.** Generation reads Understanding. It never writes Understanding, and never invents facts.

**Why.** If generation could create belief, NS would learn from its own guesses — a closed loop of fabrication.

**Engineering implications.**
- Generation is a pure consumer of Archive + Understanding; its output is a Recommendation or Report, never a new Understanding.
- Generated content must distinguish **known** (Declared / Confirmed), **believed** (Inferred), and **assumed** (a working guess with no evidence).
- Nothing a generator asserts may re-enter as evidence unless a human Declares or Confirms it.

---

## Article X — Observation is Evidence, Not Truth

**Principle.** Observations create Archive evidence. They never directly create Understanding.

**Why.** Observations are inputs into learning, not learning itself.

**Engineering implications.**
- Parent feedback records Archive evidence.
- Child behaviour records Archive evidence.
- AI observations record Archive evidence.
- Distillation and confirmation update Understanding.
- No observation writes Understanding directly.

This permanently protects the pipeline: **Observation → Archive → Understanding → Recommendation → Report.**

---

## Article XI — Self-Reinforcement

**Principle.** North Star must never become more confident solely because of outputs it previously generated.

**Why.** Confidence built on its own output is a recursive feedback loop that fabricates certainty from nothing.

**Engineering implications.**
- Generated projects are not evidence.
- Generated recommendations are not evidence.
- Generated reports are not evidence.
- AI output never increases confidence by itself.
- Only human behaviour, new observations, or explicit confirmation create new evidence.

---

## Article XII — Deterministic First, AI Only for Interpretation

**Principle.** Use deterministic logic wherever it suffices. Use AI only where genuine interpretation is required.

**Why.** AI applied to arithmetic, thresholds, or state is slower, costlier, non-reproducible, and wrong more often than code.

**Engineering implications.**
- Aggregation, counting, thresholds, precedence, capacity, and state transitions are deterministic code — never delegated to a model.
- AI is reserved for genuinely interpretive work (reading free text for meaning, phrasing an observation).
- Every AI step must be explainable and its output validated by deterministic checks before it affects state.

---

## Article XIII — Parent Authority

**Principle.** Parents always outrank NS. They may confirm, correct, exclude, or override. NS adapts immediately.

**Why.** NS advises; the family governs. A system that resists correction is a system that overrules parents.

**Engineering implications.**
- Every belief and recommendation is correctable and excludable by a parent, and the change takes effect at once (Declared / Corrected precedence).
- A parent override is durable — later inference must not silently overwrite it.
- No flow may require a parent to accept NS's interpretation in order to proceed.

---

## Article XIV — Child Autonomy

**Principle.** NS influences. It never manipulates, never creates dependency, and always works to increase the child's capability.

**Why.** The product's purpose is a more capable child — not a child, or parent, who needs the product.

**Engineering implications.**
- Features are measured by capability gained, not engagement or reliance created.
- No dark patterns, no manufactured need, no reward loops that serve retention over growth.
- Every interaction should leave the human more able to do it themselves next time.

---

## Article XV — Temporal Truth

**Principle.** Things change — interests fade, circumstances end, children develop — and Understanding must evolve accordingly.

**Why.** A belief that was true last year, asserted as true today, is a lie.

**Engineering implications.**
- Beliefs carry lifespans and decay; unreinforced Understanding expires rather than persisting forever (Article VI: Expired).
- Temporary circumstances have an end, and must stop influencing output when they end.
- Generation reads the *current* Understanding, never a stale snapshot.

---

## Article XVI — One Source of Truth

**Principle.** If two systems represent the same truth, one must be deleted. Extend existing structures before creating parallel ones.

**Why.** Duplicate truth drifts, and drift is silent data corruption.

**Engineering implications.**
- A new store or field must first answer: "could this be part of something we already have?" If yes, extend it.
- No dual-writes of the same fact; one canonical home, all else references it.
- Removing a redundant representation is a feature, not a risk.

---

## Article XVII — Explainability

**Principle.** NS must always be able to answer: *Why do I believe this? Why did I recommend this? What evidence changed my mind?*

**Why.** An answer NS cannot explain is one a family can neither trust nor correct.

**Engineering implications.**
- Every belief resolves to its evidence and provenance; every recommendation to the Understanding it consumed; every change to the event that caused it — all queryable.
- If a decision cannot be traced to Archive plus Understanding, it must not be made.

---

## Article XVIII — Emotional Experience

**Principle.** Every implementation should leave families feeling *"I can do this."* Technology exists to increase confidence, not cognitive load.

**Why.** A correct system that overwhelms a parent has failed at its actual job.

**Engineering implications (a review lens, not a metric).**
- Prefer fewer decisions, calmer surfaces, and honest simplicity over completeness.
- If a feature adds capability but adds anxiety or work, it is not done.

---

## Article XIX — Write Authority

**Principle.** Each noun has exactly one permitted writer-path. Nothing else may write it.

- **Archive** is written only by the recording of observations and evidence, append-only.
- **Understanding** is written only by deterministic distillation and by the processing of human confirmation or correction — in every case derived from Archive evidence, never from an observation directly.
- **Recommendation** is written only by generation, derived from Understanding.
- **Report** is written only by rendering, and writes nothing back.

**Why.** The architecture is only as strong as its narrowest write path; an unguarded writer is how a future subsystem quietly corrupts the model — and every existing prohibition against it is scattered rather than singular.

**Engineering implications.**
- A new subsystem must map its writes onto exactly one of these paths, or it does not belong in the model.
- No process may write Understanding without Archive evidence, and none may bypass distillation or confirmation to reach it.

---

## Engineering Checklist

Every pull request must answer "yes" (or "not applicable") to each. A "no" means the change violates the Constitution.

- Does this avoid duplicating an existing concept or introducing a second source of truth?
- Is all evidence preserved and the Archive left append-only?
- Does every new belief point to its evidence and carry a provenance level?
- Can this belief or recommendation be explained ("why do I believe this")?
- Can a parent confirm, correct, exclude, or override it — immediately and durably?
- Is uncertainty represented honestly, with no manufactured confidence?
- Does generation only consume Understanding — never create it or invent facts?
- Could this feature teach North Star something false?
- Is deterministic logic used wherever it suffices, with AI reserved for real interpretation?
- Does capacity remain a hard ceiling, with no manufactured time?
- Does this improve North Star's Understanding of the family — not merely its output?
- Does this reduce work for parents and leave them feeling "I can do this"?
- Does this make North Star simpler? Would it still make sense in five years?

---

*Amending this Constitution is deliberate and rare. Implementations evolve beneath it continuously; the Constitution changes only when a principle is proven wrong.*
