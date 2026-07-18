# The Living Family Model — Canonical Architecture

**The implementation source of truth.** Date: 2026-07-18. Status: **locked — read before touching the schema or the engines.**

This document fixes the vocabulary and the shape of the Living Family Model. Every implementation doc ([lfm-data-model.md](lfm-data-model.md), [observation-engine.md](observation-engine.md), [rhythm-engine.md](rhythm-engine.md), [project-generation-v2.md](project-generation-v2.md)) uses these words and only these words. It sits beneath the constitution ([living-family-model.md](living-family-model.md), [living-family-record.md](living-family-record.md), [wisdom-model.md](wisdom-model.md), [observation-framework.md](observation-framework.md)) and above the SQL.

---

## The four nouns — North Star's entire domain language

North Star reasons with **four nouns.** Everything the product does is one of them. If a feature doesn't fit one, it is probably adding complexity we don't need.

| Noun | Meaning | Table | Scope |
|---|---|---|---|
| **Archive** | *what has happened* | `family_archive` | family · child · adult · relationship · project |
| **Understanding** | *what North Star currently believes* | `understandings` | family · child · adult · relationship · project |
| **Recommendation** | *what North Star suggests* | `recommendations` *(new)* | family · child |
| **Report** | *what North Star communicates back* | `reports` *(unified)* | family · child |

These are **product-level** words. The implementation-detail nouns we used to scatter around — *signals, traits, observations, preferences, summaries, profiles, insights* — are **retired.** They map onto the four:

| Retired word | Is really |
|---|---|
| signal | an **Archive** entry (Evidence) |
| trait | an **Understanding** |
| observation (shown to a parent) | a **surfaced Understanding** (produced by the Observation Engine) |
| preference | an **Understanding** (rhythm/learning kind) |
| summary | a **Report**, or assembled **Understanding** |
| profile (`learning_profile`) | a read cache of **Understanding** |
| insight | a **Report**, or a surfaced **Understanding** |

---

## The canonical tree

```
Living Family Model
│
├── Archive ─────────────── what has happened            (family_archive)
│     ├── Moments ─────────── life events (source_type = 'moment')
│     ├── Evidence ────────── source material linked to beliefs (understanding_evidence)
│     └── Reflections ─────── family / project / milestone reflections
│
├── Understanding ────────── what North Star believes     (understandings)
│     ├── Child ───────────── per-child beliefs
│     └── Family ──────────── family-scope beliefs
│
├── Recommendation ───────── what North Star suggests      (recommendations)
│
├── Report ────────────────── what North Star communicates (reports)
│
├── Observation Engine ────── surfaces Understanding, proposes Recommendation
├── Rhythm Engine ─────────── shapes the week from Understanding + active Moments
└── Project Generation ────── builds projects from assembled Understanding
```

**Archive and Understanding are the two data layers** (the blueprint's most important structural decision: history kept honestly, beliefs held provisionally, never merged). **Recommendation and Report are outputs.** **The three engines are operators** — they read the nouns and write the nouns; they are not nouns themselves.

---

## Archive — *what has happened*

The durable, faithful record of source material. Append-mostly; retention is family-governed (`retention_state`). North Star does **not** reason directly from the Archive in every context — it reasons from Understanding — but every Understanding traces back here. Three kinds, distinguished by `source_type`:

- **Moments** — life events North Star accompanies (a broken wrist, a move, a new sibling, a trip). `source_type = 'moment'`. A Moment's *meaning* is an Understanding; its `review_at` (carried on the derived Understanding) is how the Rhythm Engine remembers to restore what a passing Moment paused.
- **Evidence** — the provenance ground: source rows linked to the beliefs they support or contradict, via `understanding_evidence` (`stance = supporting | contradicting | neutral`). This is what lets North Star explain *why* it believes something and be corrected.
- **Reflections** — family reflections and project/milestone reflections, in the family's own voice — the richest input stream. Raw reflections live here; their *meaning* rises to Understanding, and periodic reflection documents shown back are **Reports**, not Archive.

## Understanding — *what North Star currently believes*

The provisional beliefs North Star reasons from: interests, capabilities, temperament, values, relationships, culture, growth, challenges, rhythm & learning preferences. **Child**-scoped or **Family**-scoped (plus adult/relationship/project). Every belief carries `lifespan` (permanent → momentary), `status` (emerging → retired), `confidence` (internal only), `provenance` (declared/inferred/confirmed/corrected), and `family_verdict`. A belief North Star chooses to *speak* is a **surfaced Understanding** (`surface_status`, `noticing`) — this is what we used to call an "observation." There is no separate observation record.

## Recommendation — *what North Star suggests*

The three-question contract as a record: *what changed · what it affects · what we suggest.* Nothing significant changes a family's projects or rhythm without one. The single genuinely new table in the whole model.

## Report — *what North Star communicates back*

A generated read over Understanding (and the Moments/projects behind it) for a period or milestone: growth reports, monthly/quarterly/annual reflections, the family's story over time. One `reports` table replaces the former `growth_reports` + `reflection_reports` + client `insightReports`.

---

## The three engines reference one model

Every engine reads and writes the **same four nouns** — no engine has its own private store:

| Engine | Reads | Writes |
|---|---|---|
| **Observation Engine** | Archive (Evidence, patterns) + Understanding | surfaces **Understanding** (`surface_status='offered'`, `noticing`); may create a **Recommendation** |
| **Rhythm Engine** | Understanding (rhythm/pace) + active **Moments** (Archive) | the weekly Rhythm Plan (assembled, not stored); **Recommendations** (lighten/restore) |
| **Project Generation** | assembled **Understanding** + Rhythm Plan + active Moments | projects; **Archive** entries (decisions, outcomes) that feed Understanding |

The learning loop is one cycle through the four nouns: a family acts → **Archive** records it → distillation raises **Understanding** → engines read Understanding to generate, notice, and shape → they emit **Recommendations** and **Reports** → the family responds → **Archive** records that. Understanding rises; history recedes but remains.

---

## The simplicity law

> **Every new feature must fit one of the four nouns.** It records something that happened (Archive), refines a belief (Understanding), proposes an action (Recommendation), or communicates back (Report). If it fits none, it is introducing complexity North Star doesn't need — stop and reconsider before building it.

This is the constitutional simplicity principle made operational. The LFM makes the architecture **smaller**: six proposed tables collapse to one new (`recommendations`) plus one unified (`reports`); five existing tables retire into Archive/Understanding (see [lfm-consolidation-audit.md](lfm-consolidation-audit.md)).

---

*Canonical. The data model implements these four nouns; the three engines operate over them; migration 0031 extends `understandings`, adds `recommendations`, and unifies `reports`. Nothing in the LFM exists outside this document's vocabulary.*
