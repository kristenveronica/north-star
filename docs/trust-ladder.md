# The Trust Ladder

**Three stages of the relationship — and the evidence North Star must earn to climb each.** Date: 2026-07-16.

A Head-of-Product critique of the Family Reflection engine, and the model it produced. This document operationalises [the Wisdom Model](wisdom-model.md) and [the Observation Framework](observation-framework.md) into concrete **evidence thresholds** — the rungs North Star must reach before it may *reflect*, *observe*, or *recommend*. It is downstream of the Constitution and upstream of any first-moment UI: **the ladder is built before the screen.**

---

## The critique that produced this

I designed a "first unforgettable moment" that fires during onboarding and called it an *observation* — "the single most true thing you **notice** about them," voiced as "**I've noticed…**". But at onboarding North Star has watched the family do **nothing**. It has only what they *typed into a form*. Synthesising that is valuable — but it is a **reflection**, not an observation, and dressing it as one is a quiet lie the family will eventually catch: *"You didn't 'notice' that — I told you that on the signup screen."* The instant they catch it, every future claim is discounted.

The fix is not to abandon the onboarding moment. It is to **separate three things I had collapsed into one**, give each its honest voice, and let North Star climb from one to the next only as it earns the evidence.

---

## 1. Onboarding, or only after behaviour?

**Both — but they are different moments, with different claims and different emotional ceilings.**

- The **onboarding moment** is real and worth building, but its honest ceiling is *"you listened, and you helped me see my own words clearly."* That is lightening and trust-opening — but it is **reflection**, and it must not pretend to be more.
- The **truly unforgettable "how did you know that?" moment** — the one the family did not hand us — can only come **after North Star has watched them live.** It is an **observation**, and it is *earned*, never available on day one.

My earlier claim ("the first unforgettable moment is the onboarding reflection") was half right. The onboarding reflection is the first **trust** moment. The first **unforgettable** moment — *"it saw something we never told it"* — belongs to Stage 2, later. Building the first without conflating it with the second is the whole point.

---

## 2. Reflect vs. observe vs. understand

Three genuinely different acts, on three different kinds of evidence:

| | **Reflect** | **Observe** | **Understand** |
|---|---|---|---|
| **Evidence** | what the family **told** us (self-report) | what the family **did** (behaviour, over time) | many observations, **across seasons** |
| **Epistemic status** | their own knowledge, re-organised | *new* information we gathered by attention | interpretation — meaning, trajectory, need |
| **The felt reaction** | "you *heard* me" | "you *saw* something I never said" | "you *understand* us" |
| **Honest voice** | "Here's the thread I hear in what you've shared…" | "I've noticed, over the last few weeks…" | "Because I've come to understand…" |
| **Wisdom-Model level** | (pre-observation: synthesis of the told) | Levels 1–3: behaviour → pattern → relationship | Levels 4–5: growth → flourishing |
| **The failure mode** | summarising instead of synthesising | calling one event a pattern | recommending before understanding is demonstrated |

The distinction that matters most: **reflection re-presents what they know; observation adds what they didn't say; understanding interprets what it all means.** Each is a strictly higher claim on a strictly higher bar of evidence. North Star must never speak in a higher rung's voice than its evidence has earned — that single rule is the difference between a guide that feels *wise* and one that feels *presumptuous*.

---

## 3. The three stages, as distinct phases of the relationship

Each stage unlocks a different **voice** and a different **permission**. The relationship climbs; it does not skip.

### Stage 1 — Reflection *(from the first session)*
North Star gives back a **synthesised through-line of what the family shared** — a connection between things they said that they had not drawn themselves. It never claims to have watched them. Its gift is *being heard and helped to see one's own family clearly.*
- **Unlocks the voice:** *"Here's the thread I hear…"*
- **Permission earned:** to reflect. **Not** to claim it noticed behaviour; **not** to recommend.
- **Emotional ceiling:** *"you get us — I hadn't put it that way myself."*

### Stage 2 — Observation *(after real behaviour)*
North Star names a **pattern in what the family did** — something they never told it — grounded in specific, repeated events. This is the first *unforgettable* moment, because the evidence was gathered, not given.
- **Unlocks the voice:** *"I've noticed, across the last few weeks…"*
- **Permission earned:** to say it *noticed*; to reflect a pattern back. Still cautious about *why*.
- **Emotional ceiling:** *"how did you see that? — that's exactly what happens."*

### Stage 3 — Understanding *(over seasons)*
North Star interprets **what the accumulated observations mean** — the trajectory, the through-line, what would help this family flourish next — and only here earns the right to **recommend proactively** and to *point beyond itself* to human guides.
- **Unlocks the voice:** *"Because I've come to understand…"*
- **Permission earned:** to recommend, to prepare-rather-than-react, to advise with authority.
- **Emotional ceiling:** *"it understands our family — I trust where it's pointing us."*

---

## 4. The prompt fix — synthesise, never summarise

The Stage-1 engine (`ai · family-reflection`) is corrected in code alongside this document:
- **Reframed from observation to reflection.** It no longer claims to "notice"; it speaks only to what was *shared*. The voice moves from *"I've noticed about you"* to *"Here's the thread I hear in what you've told me."*
- **Every summary sentence forbidden.** A new hard rule: *do not restate, list, echo, or summarise anything they told you — they already know it. Say only the new connection they did not draw themselves. If your sentence contains a fact they stated, you have summarised, not synthesised — start again.*
- The output field is renamed `observation → reflection` to keep the code honest about which rung it stands on.

Reflection is the one act whose entire value is the *synthesis*. A summary of the onboarding form is worthless — they just filled it in. Only the through-line they hadn't seen is worth speaking.

---

## 5. The confidence thresholds — what evidence unlocks each rung

The ladder, as evidence gates. These are starting heuristics, to be calibrated against real families (the validation experiments), not final constants — but the *shape* is firm.

| North Star may… | Evidence required | Confidence gate | Voice it unlocks |
|---|---|---|---|
| **Reflect** | ≥ 2–3 **specific, self-reported** details that genuinely connect into a non-obvious through-line. Generic warmth ("we love our kids") is **not** enough → stay silent. | The gate is **specificity, not certainty** — it is honestly framed as "what I'm hearing," so it need not be *proven*, only *faithful and non-generic*. | *"Here's the thread I hear…"* |
| **Observe** | ≥ 3 **independent behavioural events** over ≥ 1–2 weeks pointing the same way, with contradicting evidence weighed and low. **One event is never a pattern.** | Pattern confidence **≈ ≥ 0.7**; never voiced on a single occurrence; contradicting evidence must be held, not ignored. | *"I've noticed, over the last few weeks…"* |
| **Recommend** | An **established** understanding — multiple reinforcing observations across seasons, contradictions weighed — **and** a prior observation has already *landed* (understanding demonstrated and not corrected away). | High **≈ ≥ 0.8**, **and** the Observation-Framework order holds: understanding → demonstrated understanding → trust → *then* recommendation. Never recommend cold. | *"Because I've come to understand… you might consider…"* |

**Mapping to the substrate we already built (migration 0027).** The ladder is not new machinery — it is a *discipline over the machinery already there*:
- An understanding's `status` **is** the rungs: `emerging`/`strengthening` (reflection or forming observation) → `established` (may inform a recommendation).
- `understanding_evidence.stance` supplies the "contradicting evidence weighed" gate — an understanding with unresolved contradictions may not climb.
- The **source of evidence** distinguishes reflection from observation: evidence of `source_type` = onboarding/told → a *reflection* (Stage 1); evidence from projects/reflections/behaviour → an *observation* (Stage 2). The schema already records this; the ladder says how to *speak* about it.
- `confidence` is the numeric gate; `lifespan` governs how long a rung's claim survives without reinforcement.

So the trust ladder is the **reasoning contract** the future engine must honour when it reads the substrate: *speak only at the rung your evidence occupies.*

---

## The cardinal rule

> **North Star may never speak in a higher rung's voice than its evidence has earned.** Reflect what you were told; claim to have *noticed* only what you *watched*; *recommend* only once you have *shown* you understand. Every rung skipped is trust spent — and trust, once discounted, does not come back at the price it was bought.

Build the ladder first. The UI only ever presents a rung; it must never let North Star stand on one it hasn't climbed.

---

*This document serves the Constitution and the Wisdom Model. When a question arises about whether North Star may say a thing to a family, the answer is here: which rung is the evidence on, and does the sentence stay on it?*
