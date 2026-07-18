# The Living Family Model — Data Model

**Implementation-ready specification.** Date: 2026-07-18 (rev. 2 — consolidated). Status: **locked, ready to build.**

The *what* engineering implements. Vocabulary and shape are fixed by [lfm-architecture.md](lfm-architecture.md) (the four nouns) and grounded in the constitution ([living-family-record.md](living-family-record.md) — the two-layer Archive/Understanding blueprint). This document defines the records, fields, lifecycles, and the consumer matrix. It **evolves migration [0027](../supabase/migrations/0027_living_family_record.sql)** — which already built the substrate — per [lfm-consolidation-audit.md](lfm-consolidation-audit.md). It does not create a parallel model.

> **The one rule that shapes everything:** understanding is **assembled on demand**, never a profile blob. A subject's current understanding is read from many small, individually-tracked **Understanding** records grounded in the **Archive** — so one belief can be temporary and another permanent, one inferred and another confirmed, without them fighting over a single mutable field.

---

## 1 · The model — four nouns, two layers, three engines

Per [lfm-architecture.md](lfm-architecture.md):

| Noun | Layer / role | Table |
|---|---|---|
| **Archive** (Moments · Evidence · Reflections) | Layer 1 — *what happened* | `family_archive` (+ `understanding_evidence` for Evidence links) |
| **Understanding** (Child · Family) | Layer 2 — *what it may mean* | `understandings` |
| **Recommendation** | output — *what we suggest* | `recommendations` *(new)* |
| **Report** | output — *what we communicate back* | `reports` *(unified)* |

**Assembled understanding (read, never stored):**
> `understanding(subject) = active Understanding records for that subject + active Moments currently in effect (from the Archive)`.

Understanding is the beliefs; active Moments add current reality (Noah's wrist) that colours guidance without being a belief. Assembled by a read function over `understandings` + open `moment` Archive entries. **No snapshot table** — `understandings` *is* the durable layer; assemble live (§10.1).

The retired vocabulary (*signals, traits, observations, preferences, summaries, profiles, insights*) does not appear below by design.

---

## 2 · The scope model

Every record belongs to one **subject**, carried by the `scope` + `subject_id` columns 0027 already defines:

- `scope` ∈ { `family`, `child`, `adult`, `relationship`, `project` }
- `subject_id` — the child/member/project id; null for `family` scope
- `related_subject_id` — the second party, for `relationship` scope
- `family_id` — always present on every row, for RLS isolation regardless of scope

A family is **not** the aggregate of its children — it has its own Understanding and Moments (rhythm, culture, seasons). Cross-scope effects (Noah's wrist bends the *family's* rhythm) are computed by the engines that read across scopes (§7), never stored as links.

---

## 3 · Record schemas

Postgres/Supabase. Every table already has (or gets) `id uuid default gen_random_uuid()`, `family_id uuid not null`, `created_at`. Tables 3.1–3.3 **exist today** (migration 0027); the change column lists only what migration 0031 adds. Tables 3.4–3.5 are new/unified.

### 3.1 `family_archive` — the Archive (exists) · *what has happened*

The durable source stream: **Moments**, **Evidence** source rows, and **Reflections**. Append-mostly; retention family-governed.

| Column | Type | Notes |
|---|---|---|
| `scope` / `subject_id` / `related_subject_id` | | the subject (0027) |
| `source_type` | text | `moment` \| `parent_observation` \| `child_self_assessment` \| `reflection` \| `project_decision` \| `feedback` \| `conversation` \| `note` … (free text; new kinds need no migration) |
| `title` / `content` / `summary` | text | original + distilled source text |
| `retention_state` | text | `retain_original` \| `retain_summary_only` \| `use_temporarily_then_delete` \| `exclude_from_ai` (family-governed) |
| `occurred_at` | timestamptz | when it happened (vs `created_at` = when recorded) |
| `metadata` | jsonb | kind-specific detail (project_id, domain, minutes_actual vs estimate, emotional_register for Moments, …) |

**Migration 0031 adds nothing structural** — the retired tables (`preference_signals`, `parent_observations`, `child_self_assessments`) fold in as `source_type` values. A **Moment** is a `family_archive` row with `source_type='moment'`; its life-event specifics (`emotional_register`, blast radius) live in `metadata`, and its *meaning* + `review_at` live on the derived Understanding (§3.2).

### 3.2 `understandings` — Understanding (exists) · *what North Star believes*

The distilled "who this child / this family is." The primary input to every engine.

| Column | Type | Notes |
|---|---|---|
| `scope` / `subject_id` / `related_subject_id` | | child, family, relationship, … (0027) |
| `domain` | text | free text: `interest`, `capability`, `temperament`, `value`, `growth_goal`, `pace`, `rhythm_preference`, `learning_preference`, `relationship`, `culture`, `challenge`, `strength`, `sensitivity`, `circumstance` … |
| `statement` | text | the belief, plainly ("moves toward challenge") |
| `lifespan` | text | `permanent` \| `slow_changing` \| `seasonal` \| `temporary` \| `momentary` (§5) |
| `status` | text | `emerging` \| `strengthening` \| `established` \| `weakening` \| `contradicted` \| `retired` |
| `confidence` | real | 0–1, **internal only, never shown** (§6) |
| `family_verdict` | text | `accurate` \| `partly_accurate` \| `no_longer_true` \| `incorrect` (parent correction) |
| `excluded_from_ai` | bool | family suppression — "do not use this" |
| `first_noticed_at` / `last_reinforced_at` | timestamptz | drive freshness/decay (§6) |
| `metadata` | jsonb | structured detail: strength, linked capability domains, examples |
| **`provenance`** | text | **(0031)** `declared` \| `inferred` \| `confirmed` \| `corrected` (§4) — the axis generation reads to know how hard to lean |
| **`surfaced_at`** | timestamptz | **(0031)** when this belief was last offered to the parent |
| **`surface_status`** | text | **(0031)** `draft` \| `offered` \| `confirmed` \| `corrected` \| `dismissed` \| `expired` — a **surfaced Understanding** is what we used to call an "observation" |
| **`noticing`** | text | **(0031)** the humble sentence shown to the parent (the `statement` is the internal belief; `noticing` is its phrasing) |
| **`review_at`** | timestamptz | **(0031)** for seasonal/temporary beliefs and Moment-derived beliefs the Rhythm Engine must revisit (the self-restore trigger) |

Correction supersedes, never deletes: a `family_verdict = incorrect` moves `status → contradicted`/`retired`; the correcting belief is `declared`-strength (§4). Evolution keeps history, not a mutable overwrite.

### 3.3 `understanding_evidence` — Evidence links (exists) · provenance

Keeps meaning (Understanding) separate from source (Archive). **Use as-is; 0031 changes nothing.**

| Column | Type | Notes |
|---|---|---|
| `understanding_id` | uuid | the belief |
| `source_type` / `source_id` | text / uuid | polymorphic pointer into Archive or a durable source row (project, milestone, media, reflection) |
| `stance` | text | `supporting` \| `contradicting` \| `neutral` — contradicting evidence is retained, never discarded |
| `note` | text | free-text evidence note |

This replaces the inline `source_signal_ids[]` idea entirely — a separate table with `stance` is strictly better (the model can weaken its own conclusions).

### 3.4 `recommendations` — Recommendation (new) · *what North Star suggests*

The three-question contract, made a record. Nothing significant mutates projects/rhythm without one. **The only genuinely new table.**

| Column | Type | Notes |
|---|---|---|
| `scope` / `subject_id` | | child or family |
| `trigger_type` / `trigger_id` | text / uuid | `moment` \| `understanding` \| `feedback` (the Archive/Understanding row that prompted it) |
| `what_changed` | text | question 1 |
| `what_it_affects` | jsonb | question 2 — the blast radius shown to the parent (project ids, rhythm keys) |
| `recommendation` | text | question 3 — the proposal, plainly |
| `proposed_actions` | jsonb | structured: `pause_project` \| `resize_rhythm` \| `redirect_domain` \| `add_project` \| `lighten` \| `restore` |
| `status` | text | `proposed` \| `accepted` \| `edited` \| `declined` \| `expired` |
| `decision_note` | text | the parent's edit/reason (itself an Archive `feedback` entry) |
| `applied_at` | timestamptz | when accepted actions executed |

### 3.5 `reports` — Report (unified) · *what North Star communicates back*

One table replacing `growth_reports` + `reflection_reports` + client `insightReports`. A generated read over Understanding for a period/milestone.

| Column | Type | Notes |
|---|---|---|
| `scope` / `subject_id` | | child or family |
| `type` | text | `growth` \| `monthly` \| `quarterly` \| `annual` \| `milestone` |
| `period_key` | text | e.g. `2026-T2`; `school_year`/`quarter` in `metadata` |
| `content` | jsonb | `{ narrative, strengths[], growth[], demonstrated[], nextSteps[], surfaced_understanding_ids[] }` |
| `status` | text | `scheduled` \| `generating` \| `ready` |
| `generated_at` | timestamptz | |

A Report is a *read* — always rebuildable from Understanding + Archive; the row is a cache of the generated document.

---

## 4 · Provenance — inferred vs confirmed

The `provenance` axis (new column on `understandings`), working with the existing `family_verdict`:

| Provenance | Meaning | Behaviour |
|---|---|---|
| `declared` | The parent said it (onboarding, a life update) | Trusted; drives generation immediately |
| `inferred` | North Star derived it from the Archive | **Held loosely** — contributes but doesn't dominate; may be surfaced to confirm |
| `confirmed` | The parent affirmed an inference (`family_verdict = accurate`) | Promoted to trusted; confidence raised |
| `corrected` | The parent fixed it (`family_verdict = no_longer_true/incorrect`) | Old belief `contradicted`/`retired`; the correction is `declared`-strength |

**Corrections supersede, never delete** — the history of being wrong is part of the understanding and prevents silently re-inferring the same mistake.

---

## 5 · Lifespan & Moment horizon — temporary vs permanent

The `lifespan` axis (existing column), from the blueprint's five lifespans:

- `permanent` — bedrock (values, temperament, growth trajectory). Held indefinitely; revised only on real change; **never decays on its own**.
- `slow_changing` — evolves over years (identity, culture, capability). Revisited on a slow cadence.
- `seasonal` — belongs to a chapter (a live interest, a readiness, a season of life). Held now, released gently as it passes, residue promoted.
- `temporary` — true for now (a current struggle, this week's context, a fresh interest). Held lightly, decays fast unless reinforced.
- `momentary` — a single event. Not kept as a belief; kept only if it *teaches* something that promotes upward.

**Moments** (Archive `source_type='moment'`) carry their horizon on their derived Understanding: a `passing` Moment ⇒ a `temporary` Understanding with `review_at` set (North Star schedules its own return to restore what it paused); a `lasting` Moment ⇒ a `slow_changing`/`permanent` Understanding; an `unfolding` Moment (a new interest) ⇒ a `seasonal` Understanding, promoted if it persists.

---

## 6 · Confidence & freshness — internal only

- `confidence` (0–1) governs how strongly a belief drives behaviour and whether it is surfaced. **Never rendered as a number, bar, or percentage** — per the frozen "never computational" rule. It shows only as *how loosely North Star holds something* ("I'm still getting to know her").
- `last_reinforced_at` drives **freshness**: without new supporting Evidence, confidence decays on a per-lifespan half-life (interests fade faster than values), moving a belief toward `weakening`. Implemented as a scheduled/lazy recompute, never exposed.

---

## 7 · The consumer matrix

Which records feed which engine. ● = primary input, ○ = secondary/constraint.

| Data | Project Generation | Rhythm Engine | Observation Engine | Recommendations |
|---|---|---|---|---|
| **Understanding** · interest / strength / growth_goal / learning_preference / capability | ● | ○ | ○ (drift) | |
| **Understanding** · pace / rhythm_preference | ○ | ● | | |
| **Understanding** · value | ● (project soul) | | | |
| **Understanding** · circumstance / sensitivity | ○ (constraint) | ○ (constraint) | | ○ |
| **Archive · Moment** · passing | ○ (constraint) | ● (reshape) | | ● (adapt + restore) |
| **Archive · Moment** · lasting / hard season | ○ | ● (lighten) | ○ | ● |
| **Archive · Moment** · unfolding | ○ | | ● (is it sticking?) | ○ |
| **Surfaced Understanding** · confirmed | ● (strengthens belief) | ○ | — (source) | ● |
| **Archive** · feedback (too_easy / wanted_more / lost_interest) | ○ (difficulty) | ● (sizing) | ● (patterns) | ● |
| **Archive** · time_vs_estimate | | ● (pace) | ○ | |
| **Archive** · project_decision / depth_reached | ○ | ○ | ● (engagement patterns) | |

---

## 8 · Storage, isolation, integrity (Supabase)

- **Extends 0027:** `family_archive`, `understandings`, `understanding_evidence` exist. Migration **0031** adds the `understandings` columns (§3.2), creates `recommendations` + `reports`, and folds the retired tables in.
- **RLS on every table**, family-isolated via the established helpers (`is_family_member(family_id)` for read; sensitive mutations gated to owners). Child-scoped reads respect `can_access_child` where access is per-child.
- **RLS gotcha (migration 0030):** if any SELECT policy self-references its table through a STABLE `SECURITY DEFINER` function, `INSERT … RETURNING` breaks. Keep new SELECT policies inlined / non-self-referential.
- `family_archive` is append-mostly; retention handled server-side per `retention_state`.
- Assemble understanding live (query `understandings` + open Moments); add a cache only if reads get hot.

---

## 9 · What this consolidates

| Existing | Becomes |
|---|---|
| `preference_signals` (+ `summarizePreferences`) | **Archive** entries (`source_type='project_decision'/'feedback'`) → distilled into **Understanding**; `summarizePreferences` deleted |
| `family_profiles.learning_profile` / `.rhythm` (jsonb) | read caches projected from **Understanding** (learning_preference / rhythm_preference domains) |
| `parent_observations`, `child_self_assessments` | **Archive** entries (`source_type='parent_observation'/'child_self_assessment'`) → seed **Understanding** |
| `growth_reports`, `reflection_reports`, client `insightReports` | one **`reports`** table |
| raw `reflections` | **Archive** Reflections (`source_type='reflection'`) |

Migration is incremental: extend `understandings`; add `recommendations` + `reports`; write-through the retired tables to Archive; backfill Understanding from `learning_profile`; cut consumers over; drop the retired tables. Full sequence in [lfm-consolidation-audit.md](lfm-consolidation-audit.md) §11.

---

## 10 · Open implementation questions (none block starting)

1. **Assemble vs. cache** — start with live-assemble over `understandings` (simplest, correct); add a cache only if hot. *Recommend: live-assemble.*
2. **Decay cadence** — lazy (on read) vs. scheduled (cron). *Recommend: lazy on read for beta.*
3. **Distillation trigger** — where Archive rises to Understanding: threshold-triggered edge function reusing the `ai` pattern, vs. batch. *Recommend: threshold-triggered.*
4. **Surfacing trigger** — event-driven vs. periodic sweep. *Recommend: periodic sweep + natural checkpoints (project complete, season boundary), to stay calm.*

---

*This model is the substrate for the Observation Engine, the Rhythm Engine, and Project Generation — all of which read the same four nouns. Build order in the consolidation audit; migration 0031 is next.*
