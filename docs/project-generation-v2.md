# Project Generation v2 — Design Spec

**Implementation-ready.** Date: 2026-07-18. Status: **frozen philosophy, ready to build.**

The *Recommend / create* behaviour: North Star designs a real-world quest that is unmistakably built for **this** child, this week. v2 is not a rewrite of the prompt — the [current generator](../supabase/functions/ai/index.ts) (`generateProject`) already does strong educational design. v2 changes **where the generator's understanding comes from** and **how the result is sized and balanced**: from ad-hoc, client-assembled payloads to the **assembled LFM understanding** plus the **Rhythm Plan**.

Governed by: [living-family-model.md](living-family-model.md), [north-star-curriculum-foundation](../docs/) (Mission/Core Word/Motto as the seed), the three-outcome lens. Reads: [lfm-data-model.md](lfm-data-model.md) understanding + [rhythm-engine.md](rhythm-engine.md) Plan. Consolidates: the current `constraints` payload, `summarizePreferences`, `recentDomains`, `focus`.

> **What changes in one line:** v1 asks the *client* to gather scattered fields and hand them to the model. v2 asks the *LFM* for this child's assembled understanding — Traits, active Moments, confirmed Observations, the family's values — already reconciled for provenance and permanence, and sizes the quest to the *living* Rhythm Plan rather than a static budget. Same design intelligence; a far truer, more current input.

---

## 1 · The input, reassembled

v1 input (today): `payload.family`, `payload.child`, `constraints.{focus, preferences, recentDomains, avoidTitles, size, intent, domains, ownedResources}` — each assembled by the client from various stores.

v2 input: **one call to the LFM understanding assembler** (`understanding(child)` + `understanding(family)`, data model §1) plus the **Rhythm Plan** for the week, plus the parent's optional **spark** (`intent`) for this quest. Concretely, the generator receives:

| Block | Source | Was (v1) |
|---|---|---|
| **Child understanding** — interests, strengths, learning preferences, growth goals, stage | assembled `lfm_traits` (child), filtered by `status = active`, weighted by `permanence` × freshness | `payload.child` + `focus` (manually chosen each time) |
| **Family soul** — values, Mission, Core Word, culture | assembled `lfm_traits` (family) · `value` category + curriculum foundation | `payload.family.acronym` etc. |
| **Active Moments** | `lfm_moments` where `status ∈ {active, watching}` | *not represented* — v1 is blind to "Noah's wrist" |
| **Confirmed noticings** | recent `lfm_observations` · `confirmed` | *not represented* |
| **Learning signals** | distilled from `lfm_signals` (replaces `summarizePreferences`) | `constraints.preferences` |
| **Capability balance** | recent-domain lean from signals/traits | `constraints.recentDomains` |
| **Size & pace** | **Rhythm Plan** stance + target workload | `constraints.size` (manual) |
| **Avoid-repetition** | prior quest titles/themes for this child | `constraints.avoidTitles` |
| **Resources** | inventory + owned resources | `constraints.ownedResources` |

**The provenance rule carries through:** `declared` and `confirmed` Traits drive the design confidently; `inferred` Traits *tint* it but never dominate (data model §4). The generator is told which is which, so it leans on what's trusted and holds inferences lightly — the same restraint the rest of North Star shows.

---

## 2 · The three things v2 adds to the design

Beyond re-sourcing the input, v2 makes three behavioural upgrades the LFM now makes possible:

1. **Moment-aware design.** Active Moments are hard constraints on the quest. A `passing` wrist Moment ⇒ no two-handed builds this cycle; a `hard_season` ⇒ lighter, lower-pressure, more comfort. This is the single biggest felt difference — quests that fit the family's *actual* week, not their profile in the abstract.
2. **Rhythm-sized, not size-picked.** Quest scope (missions, span, workload) is derived from the Rhythm Plan's target and stance, not a manually chosen small/medium/large. A `light`/`restoring` week yields a gentler quest automatically. `sizeGuidance()` becomes a function of the Plan.
3. **Provenance-weighted soul.** Values and growth goals that are `declared`/`confirmed` shape the quest's purpose strongly; freshly-`inferred` interests appear as *doorways to test*, framed so a wrong inference costs nothing.

The proven parts of `generateProject` stay: the hero-framing, the three-ingredient balance (delight / growth / stretch), the anti-sameness rule, measurable-accountable-controllable-small missions, the cached `PROJECT_RULES` prefix. **We are not touching what already works — only what it's fed.**

---

## 3 · The generation flow

```
parent spark (optional)  ─┐
understanding(child)      ─┤
understanding(family)     ─┼─►  build generation context  ─►  ai:generate-project (v2)  ─►  draft quest
Rhythm Plan (week)        ─┤          (server-side)              (existing prompt,              │
active Moments            ─┘          from LFM, not client)       new context blocks)           ▼
                                                                                        parent: accept / edit / decline
                                                                                                │
                                                                        ┌───────────────────────┼───────────────────────┐
                                                                        ▼                        ▼                       ▼
                                                                 accept → live quest      edit → refine (spark)   decline → reason
                                                                        │                        │                       │
                                                                        └────────────── every outcome writes lfm_signals ┘
                                                                                     (the learning loop, closed properly)
```

**Key move:** context assembly moves **server-side**, reading the LFM directly, so the client no longer hand-marshals a dozen fields (and can't drift out of sync with the truth). The client sends only: `child_id`, optional `intent` (spark), and `refine`/`previous` for amendments.

---

## 4 · The output feeds the loop back

Every decision on a generated quest emits `lfm_signals` (data model §3.1), which is what makes generation get better:

| Outcome | Signal(s) written | Later effect |
|---|---|---|
| **Accepted** | `project_choice` (domain, interest hooks) | affirms the interests/values it leaned on |
| **Edited** | `feedback` + the edit as a spark | tunes toward the parent's correction |
| **Declined** | `feedback` with reason | `too_hard`/`not-them`/`wrong-domain` re-tune future context |
| **Lived** (progress) | `milestone_progress`, `time_vs_estimate`, `too_easy`/`wanted_more`, `completed`/`abandoned` | feeds Rhythm pace + Observation detectors + Trait distillation |

This replaces the current `preference_signals` write path — same loop, now on the unified `lfm_signals` stream, and now feeding rhythm and observations too, not just the next generation.

---

## 5 · Implementation shape

- **New server-side context builder** — a module in the `ai` function (or shared layer) that takes `child_id` and returns the v2 context by reading the LFM assembler + Rhythm Plan. This is the bulk of the work; the prompt itself changes minimally.
- **`ai` action** — extend `generate-project` to accept the v2 shape (`child_id` + `intent` + `refine`), internally assembling context; keep a compatibility path during migration (dual-mode: if a full `constraints` payload is sent, use it — lets us cut over incrementally).
- **Prompt** — add three context blocks (Active Moments, Confirmed Noticings, Provenance-tagged understanding); replace `sizeGuidance(constraints.size)` with `sizeGuidance(rhythmPlan)`. Keep `PROJECT_RULES` byte-identical so the cache still hits.
- **Signal writing** — the accept/edit/decline handlers write `lfm_signals` instead of `preference_signals`.
- **Cost** — unchanged (same model, same cached prefix); context is slightly richer but bounded (assembled understanding is compact by design).

## 6 · Migration (incremental, no big-bang)

1. Stand up the LFM tables + assembler (data model §9), dual-writing signals from the existing loop.
2. Backfill Traits from current `learning_profile` / `focus` usage.
3. Add the v2 context builder **behind the dual-mode action** — generate from LFM when understanding exists, fall back to the v1 payload otherwise.
4. Move accept/edit/decline to write `lfm_signals`.
5. Once LFM understanding is populated for active families, make v2 the default and retire client-side payload assembly + `summarizePreferences`.

---

## 7 · Open implementation questions (none block starting)

1. **Understanding freshness at generation time** — assemble live, or read a per-child snapshot? *Recommend: live-assemble (data model §10.1); revisit only if hot.*
2. **How much inferred understanding to expose** — too much and the quest chases weak signals. *Recommend: cap inferred Traits' weight in context; label them as doorways.*
3. **Spark vs. understanding tension** — when the parent's spark contradicts standing understanding, spark wins for *this* quest (it's a live signal) but doesn't overwrite Traits. Already the v1 instinct; make it explicit in the prompt.
4. **Sibling/family quests** — v2 is per-child; shared-family quests read both scopes. Defer until per-child v2 is proven.
