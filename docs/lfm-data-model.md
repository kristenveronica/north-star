# The Living Family Model — Data Model

**Implementation-ready specification.** Date: 2026-07-18. Status: **frozen philosophy, ready to build.**

The *why* lives in [living-family-model.md](living-family-model.md) (the constitution) and [first-family-experience.md](first-family-experience.md). This document is the *what* engineering implements. It defines the records, fields, lifecycles, and the consumer matrix — nothing philosophical that isn't load-bearing for the schema.

> **The one rule that shapes everything:** the Living Family Model is **not a profile blob.** A child's understanding and the family's understanding are **assembled on demand** from many small, individually-tracked records. Storing understanding atomically is what lets one belief be temporary and another permanent, one inferred and another confirmed, without them fighting over a single mutable field.

---

## 1 · The five record types

They map one-to-one onto the frozen behaviours (*Listen · Understand · Reflect/Notice · Accompany · Recommend*). *Keep learning* is the loop between them.

| Record | Behaviour | Role | Table |
|---|---|---|---|
| **Signal** | Listen | Raw, append-only evidence of what happened | `lfm_signals` |
| **Trait** | Understand | Distilled standing understanding ("who they are") | `lfm_traits` |
| **Observation** | Reflect / Notice | What North Star notices and offers back | `lfm_observations` |
| **Moment** | Accompany | The family's story (life events) | `lfm_moments` |
| **Recommendation** | Recommend / Adapt | Three-question proposals the parent decides on | `lfm_recommendations` |

**Understanding (assembled, not stored):**
> `understanding(subject) = active Traits + active Moments + recently-confirmed Observations`, for that subject.

Assembled by a read function; optionally materialised into `lfm_understanding_snapshot` (one jsonb row per subject) for read-heavy consumers (project generation, dashboard), refreshed on write. Snapshot is a **cache, never the source of truth** — always rebuildable from the atomic records.

---

## 2 · The scope model

Every record belongs to exactly one **subject**, at one of two scales:

- `subject_type` ∈ { `child`, `family` }
- `subject_id` — the child's id, or the family's id when `subject_type = family`
- `family_id` — always present, on every row, for RLS isolation regardless of scope

A family is **not** the aggregate of its children — it has its own Traits, Moments, and Observations (rhythm, culture, seasons). Cross-scope effects (Noah's wrist bends the *family's* rhythm) are not stored as links; they are computed by the engines that read across both scopes (§7).

---

## 3 · Record schemas

Postgres/Supabase. `id uuid default gen_random_uuid()`, `family_id uuid not null`, timestamps `created_at`/`updated_at` on every table (omitted below for brevity). All tables RLS-isolated by `family_id` (§8).

### 3.1 `lfm_signals` — evidence (append-only)

The raw stream. Immutable once written. Everything else is derived from this and can be recomputed.

| Column | Type | Notes |
|---|---|---|
| `subject_type` | text | `child` \| `family` |
| `subject_id` | uuid | |
| `source` | text | `onboarding` \| `project_choice` \| `milestone_progress` \| `reflection` \| `rhythm` \| `feedback` \| `life_update` \| `conversation` \| `outcome` |
| `kind` | text | specific event, e.g. `interest_expressed`, `depth_reached`, `time_vs_estimate`, `too_easy`, `wanted_more`, `lost_interest`, `completed`, `abandoned` |
| `payload` | jsonb | event specifics (project_id, domain, minutes_actual vs minutes_estimate, depth_layer, text, …) |
| `weight` | numeric | how much this should count (default 1.0) |
| `observed_at` | timestamptz | when it happened (may differ from `created_at`) |

Append-only. No updates, no deletes (except retention policy). **Consolidates the existing `preference_signals`.**

### 3.2 `lfm_traits` — standing understanding

The distilled "who this child / this family is." The primary input to generation and rhythm.

| Column | Type | Notes |
|---|---|---|
| `subject_type` / `subject_id` | | child or family |
| `category` | text | `interest` \| `learning_preference` \| `temperament` \| `value` \| `growth_goal` \| `pace` \| `rhythm_preference` \| `developmental_stage` \| `circumstance` \| `relationship` \| `strength` \| `sensitivity` |
| `label` | text | human key, e.g. `horses`, `learns-by-doing`, `confidence` |
| `detail` | jsonb | structured value: strength, linked capability domains, examples, notes |
| `provenance` | text | `declared` \| `inferred` \| `confirmed` \| `corrected` (§4) |
| `permanence` | text | `provisional` \| `seasonal` \| `enduring` (§5) |
| `status` | text | `active` \| `fading` \| `dormant` \| `superseded` |
| `confidence` | numeric | 0–1, **internal only, never shown** (§6) |
| `last_affirmed_at` | timestamptz | drives freshness / decay (§6) |
| `source_signal_ids` | uuid[] | provenance trace back to evidence |
| `supersedes_id` | uuid | the trait this one replaced (evolution, not deletion) |

### 3.3 `lfm_moments` — the family's story

Life events North Star accompanies. **Never called "changes" in any surface.**

| Column | Type | Notes |
|---|---|---|
| `subject_type` / `subject_id` | | a child (Noah's wrist) or the family (moving house) |
| `type` | text | `health` \| `interest` \| `achievement` \| `family_structure` \| `travel` \| `logistics` \| `opportunity` \| `hard_season` \| `life_milestone` |
| `title` | text | the parent's words, lightly normalised |
| `understanding` | text | North Star's plain-language reading (question 1: *what changed*) |
| `emotional_register` | text | `joyful` \| `neutral` \| `tender` \| `hard` — governs tone of response |
| `horizon` | text | `passing` \| `lasting` \| `unfolding` (§5) |
| `onset_at` | timestamptz | when it began |
| `review_at` | timestamptz | for `passing` moments — when to check back / restore |
| `affects` | jsonb | computed blast radius (question 2): project ids, rhythm keys, plans |
| `status` | text | `active` \| `watching` \| `acknowledged` \| `resolved` — `acknowledged` = North Star showed up, changed no plan |
| `source_signal_id` | uuid | the `life_update` signal that created it |

`unfolding` moments (a new interest) are the bridge to Traits: watched, and if they persist, promoted to a `provisional → enduring` interest trait.

### 3.4 `lfm_observations` — what North Star notices

Generated from signals/traits; surfaced to the parent; fed back on confirmation.

| Column | Type | Notes |
|---|---|---|
| `subject_type` / `subject_id` | | child-scoped or family-scoped |
| `category` | text | `interest_shift` \| `engagement_pattern` \| `rhythm_health` \| `growth` \| `strength_emerging` \| `struggle` |
| `noticing` | text | the humble sentence shown: *"Jett stays engaged much longer outdoors."* |
| `evidence` | jsonb | supporting pattern + `signal_ids` (never shown raw; used to justify & to let the parent see "why") |
| `confidence` | numeric | internal; gates whether it's surfaced at all |
| `status` | text | `draft` \| `offered` \| `confirmed` \| `corrected` \| `dismissed` \| `expired` |
| `led_to_recommendation_id` | uuid | nullable — many observations lead nowhere, and that's complete |
| `surfaced_at` / `responded_at` | timestamptz | |

On `confirmed` → strengthens or creates a Trait (provenance `confirmed`). On `corrected` → supersedes the mistaken Trait. On ignore past a window → `expired` (never nags).

### 3.5 `lfm_recommendations` — proposals (never silent)

The three-question contract, made a record. Nothing significant mutates projects/rhythm without one.

| Column | Type | Notes |
|---|---|---|
| `subject_type` / `subject_id` | | |
| `trigger_type` / `trigger_id` | text / uuid | `moment` \| `observation` \| `feedback_signal` |
| `what_changed` | text | question 1 summary |
| `what_it_affects` | jsonb | question 2 — the blast radius shown to the parent |
| `recommendation` | text | question 3 — the proposal, in plain language |
| `proposed_actions` | jsonb | structured: `pause_project` \| `resize_rhythm` \| `redirect_domain` \| `add_project` \| `lighten` \| `restore` |
| `status` | text | `proposed` \| `accepted` \| `edited` \| `declined` \| `expired` |
| `decision_note` | text | the parent's edit/reason, if any (itself a signal) |
| `applied_at` | timestamptz | when accepted actions were executed |

---

## 4 · Provenance — inferred vs confirmed

The axis your questions 7–8 turn on.

| Provenance | Meaning | Behaviour |
|---|---|---|
| `declared` | The parent said it (onboarding, a life update) | Trusted; drives generation immediately |
| `inferred` | North Star derived it from signals | **Held loosely** — contributes but doesn't dominate; may prompt an Observation to confirm |
| `confirmed` | The parent affirmed an inference | Promoted to trusted; confidence raised |
| `corrected` | The parent fixed an inference | The old trait is `superseded`; the correction is `declared`-strength |

**Corrections supersede, never delete.** The history of being wrong is part of the understanding (and protects against silently re-inferring the same mistake).

---

## 5 · Permanence & horizon — temporary vs permanent

The axis your questions 5–6 turn on.

**Traits — `permanence`:**
- `provisional` — new or lightly-evidenced (a just-emerged interest). Watched; low weight until affirmed.
- `seasonal` — real but tied to a period (soccer season, a school term).
- `enduring` — stable, repeatedly affirmed. The backbone of the understanding.

Traits move `provisional → enduring` as life re-affirms them, or `active → fading → dormant` as they go quiet.

**Moments — `horizon`:**
- `passing` — temporary (broken wrist, a trip). Carries a `review_at`; North Star **schedules its own return** to restore what it paused.
- `lasting` — a durable new reality (new sibling, moving house). May spawn Traits/circumstances; the acute phase eases over time.
- `unfolding` — watch-and-see (a new passion). Promoted to a Trait if it persists, or quietly closed if it fades.

---

## 6 · Confidence & freshness — internal only

- `confidence` (0–1) governs how strongly a belief drives behaviour and whether an Observation is surfaced. **Never rendered to a parent as a number, bar, or percentage** — per the frozen "never computational" rule. It shows up only as *how loosely North Star holds something* ("I'm still getting to know her").
- `last_affirmed_at` drives **freshness**: without new affirming signals, confidence decays on a per-category half-life (interests fade faster than values), moving a Trait toward `fading`. This is the engineering expression of "held loosely, re-questioned" — implemented by a scheduled recompute, not exposed.

---

## 7 · The consumer matrix

Which records feed which engine (questions 9–12). ● = primary input, ○ = secondary/constraint.

| Data | Project Generation | Rhythm | Observations engine | Recommendations |
|---|---|---|---|---|
| **Traits** · interest / strength / growth_goal / learning_preference / stage | ● | ○ | ○ (drift detection) | |
| **Traits** · pace / rhythm_preference | ○ | ● | | |
| **Traits** · value | ● (project soul) | | | |
| **Traits** · circumstance / sensitivity | ○ (constraint) | ○ (constraint) | | ○ |
| **Moments** · `passing` | ○ (constraint) | ● (temporary reshape) | | ● (adapt + restore) |
| **Moments** · `lasting` / `hard_season` | ○ | ● (lighten) | ○ | ● |
| **Moments** · `unfolding` | ○ | | ● (is it sticking?) | ○ |
| **Observations** · confirmed | ● (feeds Traits) | ○ | — (source) | ● |
| **Signals** · feedback (too_easy / wanted_more / lost_interest) | ○ (difficulty) | ● (sizing) | ● (patterns) | ● |
| **Signals** · time_vs_estimate | | ● (pace calibration) | ○ | |
| **Signals** · project_choice / depth_reached | ○ | ○ | ● (interest & engagement patterns) | |

Reading this top-to-bottom answers the four "which feeds…" questions directly.

---

## 8 · Storage, isolation, integrity (Supabase)

- Five tables above + optional `lfm_understanding_snapshot`. New migration (next in sequence).
- **RLS on every table**, family-isolated with the established helpers: `using (is_family_member(family_id))` for read; writes gated to members, sensitive mutations to owners as appropriate. Child-scoped reads additionally respect `can_access_child` where a member's access is per-child.
- **Beware the known RLS gotcha** (see migration 0030): if any SELECT policy self-references its table through a STABLE `SECURITY DEFINER` function, `INSERT … RETURNING` breaks. Keep LFM SELECT policies inlined / non-self-referential.
- `lfm_signals` is append-only (revoke UPDATE/DELETE from `authenticated`; retention handled server-side).
- Snapshot refresh: on write to any atomic table for a subject, enqueue a rebuild of that subject's snapshot (or rebuild inline for low volume at beta scale).

---

## 9 · Relationship to what already exists

This **consolidates**, it doesn't duplicate:

| Existing | Becomes |
|---|---|
| `preference_signals` (+ `summarizePreferences`) | `lfm_signals` → distilled into `lfm_traits` (the learning loop, generalised) |
| `family_profiles.learning_profile` (jsonb) | Migrated into `lfm_traits` (learning_preference / strength / sensitivity categories); jsonb kept as a read cache if useful |
| `family_profiles.rhythm` (jsonb) | Rhythm *preferences* → `lfm_traits`; the assembled rhythm remains where the rhythm engine reads it |
| `parent_observations`, `child_self_assessments` | Sources of `lfm_signals`; parent-authored notes may also seed `declared` Traits |
| `growth_reports` | A *read* over the assembled understanding + Moments over time (Legacy: trend analysis) |

Migration is incremental: stand up the tables, dual-write from the existing loop, backfill Traits from current `learning_profile`, then cut consumers over.

---

## 10 · Open implementation questions

None block starting. Flagged for decision as we build:

1. **Snapshot vs. live-assemble** at beta scale — start with live-assemble (simplest, correct), add the snapshot cache only if reads get hot. *Recommend: live-assemble first.*
2. **Decay cadence** — the freshness recompute can be lazy (on read) or scheduled (cron). *Recommend: lazy on read for beta; cron later.*
3. **Where Traits are distilled** — an edge function on a signal-count threshold, vs. batch. *Recommend: threshold-triggered edge function, reusing the existing `ai` function pattern.*
4. **Observation generation trigger** — event-driven (on signal) vs. periodic sweep. *Recommend: periodic sweep + natural-checkpoint triggers (project complete, season boundary), to keep it calm and non-nagging.*

---

*This model is the substrate for project generation, rhythm, observations, and accompaniment. Build order and the engines that read it are specified separately; this document defines only the shape of what North Star understands.*
