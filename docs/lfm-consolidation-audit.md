# Architectural Consolidation Audit — Evolving into the Living Family Model

**Implementation-ready.** Date: 2026-07-18. Status: **decision doc — read before writing any migration.**

The objective, in the user's words: *not to add the LFM beside our existing architecture, but to evolve our existing architecture into the LFM while removing as much duplication as possible.* Simplicity is constitutional. The LFM must make the architecture **smaller**, not larger.

This audit supersedes the table proposals in [lfm-data-model.md](lfm-data-model.md) where they conflict (see §11).

---

## 0 · The headline finding

**The Living Family Model substrate already exists.** Migration [0027_living_family_record.sql](../supabase/migrations/0027_living_family_record.sql) built it a month ago, under the constitutional blueprint [living-family-record.md](living-family-record.md):

| 0027 table | Blueprint layer | What it is |
|---|---|---|
| `family_archive` | Layer 1 — *what happened* | durable source material: notes, events, conversations, with scope + retention states |
| `understandings` | Layer 2 — *what it may mean* | provisional beliefs: scope, `domain`, `statement`, `lifespan`, `status`, `confidence`, `family_verdict`, `excluded_from_ai` |
| `understanding_evidence` | provenance | belief ⇄ source links, with `stance` (supporting / contradicting / neutral) |

It is **schema-only — zero code references** in `js/` or `supabase/functions/`. It was built as "the smallest secure foundation… it does not yet produce observations, recommendations, or memory-aware generation (deferred by design)."

**My own [lfm-data-model.md](lfm-data-model.md) (2026-07-18) proposed rebuilding this from scratch** as `lfm_signals` + `lfm_traits` + `lfm_understanding_snapshot`, in different vocabulary. That doc is the single largest source of proposed duplication in the whole system. **We do not build it as written.** We evolve 0027.

> **The corrected objective:** finish wiring `family_archive` / `understandings` / `understanding_evidence` into live behaviour, extend them minimally where the engines need it, add exactly **one** genuinely new table (Recommendations), and **collapse five existing source/report tables into them.**

---

## 1 · Vocabulary reconciliation (my doc → what exists)

The `lfm_*` names conflict with the established no-prefix convention (`families`, `children`, `understandings`, `family_archive`) *and* with the constitutional blueprint. Retire the new vocabulary; adopt what exists:

| lfm-data-model.md term | Becomes | Notes |
|---|---|---|
| `lfm_signals` (Signal) | `family_archive` | same "what happened" layer |
| `lfm_traits` (Trait) | `understandings` | near-exact: `permanence`→`lifespan`, `provenance`→`family_verdict`(+one field, §4), `source_signal_ids[]`→`understanding_evidence` |
| `lfm_observations` (Observation) | `understandings` **(surfaced)** | an Observation is a belief that gets *shown*; §3 |
| `lfm_moments` (Moment) | `family_archive` event **+** `understandings` | §3 — no dedicated table at beta |
| `lfm_recommendations` (Recommendation) | **new** `recommendations` table | the one genuinely new structure; §5 |
| `lfm_understanding_snapshot` | **do not build** | `understandings` *is* the durable layer; assemble live (data-model §10.1 already agreed) |

Net: of six proposed structures, **three already exist, two collapse into existing, one is new.**

---

## 2 · Existing tables that can be EXTENDED (not replaced)

The five record types map onto three existing tables with small additions:

### `understandings` — carries Trait **and** Observation
Already holds scope, domain, statement, lifespan, status, confidence, family_verdict, excluded_from_ai, first_noticed_at, last_reinforced_at. **Add only:**
- `provenance text` — `declared | inferred | confirmed | corrected` (data-model §4). Today this is *partly* inferable from `family_verdict` + `created_by`, but naming it explicitly is worth one column — it's the axis generation reads to decide how hard to lean.
- Surfacing fields for the Observation lifecycle: `surfaced_at timestamptz`, `surface_status text` (`draft|offered|confirmed|corrected|dismissed|expired`), `noticing text` (the humble sentence; the `statement` is the internal belief, `noticing` is its phrasing for the parent). *These make an understanding "an observation" when populated — no second table.*
- `review_at timestamptz` — for seasonal/temporary understandings the Rhythm Engine must revisit (the self-restore trigger). Reuses this row instead of a Moments table.

### `family_archive` — carries Signal **and** Moment-event
Already holds scope, subject, `source_type` (free text), content/summary, retention_state, `occurred_at`, metadata. It already **is** the event log. **Add nothing structural** — new source kinds are just new `source_type` values (`project_decision`, `parent_observation`, `child_self_assessment`, `reflection`, `life_event`, `feedback`). A "Moment" is a `family_archive` row with `source_type='life_event'` whose *meaning* is an `understandings` row (lifespan `seasonal|temporary`, with `review_at`).

### `understanding_evidence` — provenance, already better than my design
My doc put `source_signal_ids uuid[]` inline on the trait. 0027's separate evidence table with `stance` is **strictly better** (retains contradicting evidence, polymorphic source pointer). Use it as-is. No change.

### `children` / `family_profiles` — absorb scattered profile JSON
`family_profiles.learning_profile` and `.rhythm` (jsonb) become **read caches** projected from `understandings` (categories: learning-preference, strength, sensitivity, rhythm-preference). Keep the columns as a denormalised convenience, but `understandings` is the source of truth. No new tables.

---

## 3 · The two "new" record types that are NOT new tables

**Observation → a surfaced `understandings` row.** The blueprint (LFR domain #14) says Observations are "where promoted understanding *lands*" — i.e. an Observation *is* an understanding, one North Star chose to speak. The lifecycle (draft→offered→confirmed→corrected→dismissed→expired) is `surface_status`; confirm/correct already map onto `family_verdict`. **Collapses the concept; costs three columns, not a table.**

**Moment → `family_archive` event + `understandings` meaning.** "Noah's wrist" is an event (archive, `source_type='life_event'`) plus a temporary understanding ("in a passing constraint on two-handed work", lifespan `temporary`, `review_at` set). The Rhythm Engine queries active temporary/seasonal understandings with a `review_at`; the restore is a Recommendation. **No `lfm_moments` table** unless a dedicated scheduler queue later earns it — flagged, not built.

> Answering the user's mandated question for each: *"Could this become part of something we already have?"* — **Signal:** yes, `family_archive`. **Trait:** yes, `understandings`. **Observation:** yes, `understandings` (surfaced). **Moment:** yes, `family_archive`+`understandings`. **Snapshot:** yes, it's just a query. **Recommendation:** no — genuinely new (§5).

---

## 4 · Existing tables that become OBSOLETE (collapse into the substrate)

Five tables are duplicate expressions of the two-layer model. All currently route through [repo.js](../js/lib/repo.js) + [store.js](../js/store.js).

| Obsolete table | Duplicates | Collapses into |
|---|---|---|
| `preference_signals` (0014) | a second "what happened" event stream | `family_archive` (`source_type='project_decision'` / `'feedback'`); meaning distils to `understandings` |
| `parent_observations` (0001) | structured source material about a child | `family_archive` (`source_type='parent_observation'`) → seeds `understandings` |
| `child_self_assessments` (0001) | structured source material from a child | `family_archive` (`source_type='child_self_assessment'`) → seeds `understandings` |
| `growth_reports` (0001) | a period *read* over understanding | unify into one `reports` concept (§4.1) |
| `reflection_reports` (0013) | the same period read, different cadence | unify into one `reports` concept (§4.1) |

`parent_observations` and `child_self_assessments` keep their **input UX**; only the storage changes to write-through the Archive. This deletes two bespoke schemas + their sync/repo/round-trip code (the very code [[north-star-data-sync-gaps]] had to hand-fix).

### 4.1 · Three report tables collapse to one
`growth_reports` + `reflection_reports` + the client-only `insightReports` are three shapes of one idea: *a generated read over understanding, for a period.* Unify into a single `reports` table (`scope`, `period_key`, `type`, `content jsonb`, `status`) — a cache of a generated view over `understandings` + `family_archive`. This also collapses the AI actions behind them (§6).

---

## 5 · The ONE genuinely new table

**`recommendations`** — the three-question contract as a record. 0027 explicitly deferred it ("does not yet produce recommendations"). It is not a belief and not an event, so it cannot fold into `understandings` or `family_archive`. Fields per data-model §3.5 (`trigger_type/id`, `what_changed`, `what_it_affects`, `recommendation`, `proposed_actions`, `status`, `decision_note`, `applied_at`). Drop the `lfm_` prefix. This is the whole net-new schema surface of the LFM.

**Net table math:** proposed new = 6 → actual new = **1** (`recommendations`); **+1 unified** (`reports`); **−5 deleted** (`preference_signals`, `parent_observations`, `child_self_assessments`, `growth_reports`, `reflection_reports`). The LFM ends the audit **4 tables smaller** than today, not 6 larger than my doc implied.

---

## 6 · Prompts / server actions that become OBSOLETE

Current `ai` actions: `suggest-core-word`, `suggest-vision`, `tidy-text`, `suggest-focus`, `generate-project`, `growth-reflection`, `coreword-living`, `mentor-turn`, `generate-printable`, `quickstart-extract`, `family-reflection`.

| Action | Verdict |
|---|---|
| **`suggest-focus`** | **OBSOLETE.** v1's "pick a subset of the profile to emphasise each generation" is exactly what assembled understanding replaces (Generation v2). Delete the action **and** its client focus-picker UI. |
| **`growth-reflection`** + **`family-reflection`** + **`coreword-living`** | **Collapse into one** understanding-sourced composer. Today each re-derives "understanding" statelessly from raw tables every call; post-LFM they *read* `understandings` and phrase a report/observation. One `compose-report` (period read) + one `compose-observation` (the Observation Engine's bounded step) replace all three. |
| **`generate-project`** | Evolves to v2 (reads `understandings` server-side); prompt body barely changes (see [project-generation-v2.md](project-generation-v2.md)). Not obsolete — re-sourced. |
| **`quickstart-extract`** | Stays, but writes `understandings` + `family_archive` instead of a bespoke profile blob. |
| `suggest-core-word`, `suggest-vision`, `tidy-text`, `mentor-turn`, `generate-printable` | Unaffected utilities (may later read understandings; no change required now). |

Net AI-action change: **−1 deleted** (`suggest-focus`), **−3→+2 merged** (`growth-reflection`/`family-reflection`/`coreword-living` → `compose-report`/`compose-observation`).

---

## 7 · Client state that becomes UNNECESSARY

[store.js](../js/store.js) currently hydrates 10+ raw tables per family; [repo.js](../js/lib/repo.js) `ensureFamilyAndHydrate` fans out to all of them. The LFM's assembled-understanding model means the client reads **understanding**, not raw source.

Remove from client state:
- `preferenceSignals`, `parentObservations`, `childSelfAssessments` — fold into Archive; client never holds the raw stream.
- `growthReports` + `reflectionReports` + `insightReports` → one `reports` array.
- The generation payload marshalling: `focus`, `constraints.preferences`, `recentDomains`, `avoidTitles` assembly (client-side) — Generation v2 assembles server-side. **[preferences.js](../js/lib/preferences.js) `summarizePreferences` is deleted entirely** (its job moves into server-side understanding distillation).
- `learningCapacity.js` static budget → the Rhythm Engine's `baseline_capacity` term (see [rhythm-engine.md](rhythm-engine.md)).

`ensureFamilyAndHydrate`'s fan-out shrinks by ~5 table pulls. Fewer sync paths = fewer of the round-trip bugs that [[north-star-data-sync-gaps]] catalogued.

---

## 8 · Concepts that collapse into one

The deepest simplification — five vocabularies become two, plus two derived:

| Today's scattered concepts | Collapse into |
|---|---|
| preference signal · parent observation · child self-assessment · raw reflection · archive event | **Archive entry** (`family_archive`) — one "what happened" |
| trait · understanding · observation-belief · `learning_profile` field · focus | **Understanding** (`understandings`) — one "what it means" |
| growth report · reflection report · insight report · family council | **Report** — one period-read over Understanding |
| focus payload · preferences summary · recentDomains · constraints | subsumed by **assembled Understanding** at generation time |

Two nouns North Star reasons with — **Archive** and **Understanding** — plus **Recommendation** (proposal) and **Report** (read). That is the entire model.

---

## 9 · What must NOT collapse (guardrails)

Consolidation has a floor. Keep separate:
- **Archive vs. Understanding** — the blueprint's most important structural decision (§Layer separation). Never merge belief into evidence.
- **`children`, `projects`, `milestones`, `family_members`, billing, media** — these are operational records, not memory; they *feed* the Archive but are not it. Do not fold them in.
- **`understanding_evidence` stance** — keep contradicting evidence; never delete-on-contradiction.
- **Retention states** on `family_archive` — family-governed; the whole ethical spine of the LFR. Untouched.

---

## 10 · Required corrections to already-committed docs

Honesty requirement — my own doc is now partly wrong:
1. **[lfm-data-model.md](lfm-data-model.md)** — revise to build on `family_archive`/`understandings`/`understanding_evidence` and the names in §1. Retire `lfm_signals`/`lfm_traits`/`lfm_understanding_snapshot`. Keep its *thinking* (provenance/permanence axes, consumer matrix) — re-expressed against the real tables.
2. **[observation-engine.md](observation-engine.md)** / **[rhythm-engine.md](rhythm-engine.md)** / **[project-generation-v2.md](project-generation-v2.md)** — retarget "reads `lfm_traits`" → "reads `understandings`", "writes `lfm_signals`" → "writes `family_archive`", "Moment" → "life-event archive entry + temporary understanding". The engine *logic* is unchanged; only the table names.

These are find-and-replace-scale edits, not redesigns — the engines were designed correctly against the wrong nouns.

---

## 11 · Recommended build order (revised)

Now that we know the substrate exists:
1. **Extend `understandings`** — add `provenance`, surfacing fields (`surfaced_at`/`surface_status`/`noticing`), `review_at`. One small migration (0031). *No new substrate tables.*
2. **Add `recommendations`** + unify `reports` (migration 0031/0032). Mind the 0030 RLS gotcha (no self-referential `SECURITY DEFINER` in SELECT policies).
3. **Wire the write path** — `quickstart-extract`, project decisions, parent/child inputs write `family_archive`; a distillation step promotes to `understandings` (the "understanding rises" behaviour, LFR Part Two).
4. **Migrate + retire** — backfill `understandings` from `learning_profile`; write-through `parent_observations`/`child_self_assessments`/`preference_signals` to Archive; then drop the five obsolete tables + `summarizePreferences` + `suggest-focus`.
5. **Cut consumers over** — Generation v2, Observation Engine, Rhythm Engine read `understandings`.

Only **after** step 1's migration is designed do we write SQL. Nothing here blocks starting — but we start by *extending 0027*, never beside it.

---

*Simplicity honoured: 6 proposed tables → 1 new; 5 existing tables retired; 3 report tables → 1; 3 AI actions → 2; `summarizePreferences` + client generation-marshalling deleted. The LFM leaves the architecture smaller than it found it.*
