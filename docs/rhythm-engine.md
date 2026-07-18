# The Rhythm Engine — Design Spec

**Implementation-ready.** Date: 2026-07-18. Status: **frozen philosophy, ready to build.**

The engine behind the *Accompany* behaviour at the level of the week. It decides **how much North Star asks of a family right now**, and reshapes that ask as life moves — lightening in a hard season, restoring when it passes. It is the layer that makes North Star feel like it *lives with* a family rather than handing them a fixed plan.

Governed by: [living-family-model.md](living-family-model.md), [wisdom-model.md](wisdom-model.md) (what deserves waiting), the three-outcome lens (*lighter, more energised, more capable*). Reads/writes the records in [lfm-data-model.md](lfm-data-model.md). Consolidates the current static budget in [learningCapacity.js](../js/lib/learningCapacity.js).

> **The core inversion:** rhythm today is a *setting* (`daysPerWeek × hoursPerDay`). In v2 the family's stated preference is only the **baseline**; the *actual* rhythm North Star asks for is **assembled** each week from that baseline, minus the drag of active Moments, adjusted by observed pace — and it **restores itself** when a passing Moment ends. Rhythm becomes a living quantity, not a stored number.

---

## 1 · What rhythm is (the assembled quantity)

Rhythm is **not stored**; it is computed (mirroring the data model's assembled-understanding rule). For a family in a given week:

```
rhythm(family, week) =
    baseline_capacity            // from rhythm_preference Traits (the family's stated ideal)
  × pace_factor                  // from observed time_vs_estimate signals (are we over/under-reaching?)
  × moment_multiplier            // active passing/hard Moments lighten the ask
  − calendar_encroachment        // school-year, travel, known busy weeks (calendarFeed/schoolYear)
  ⊕ season_shape                 // school term vs break, per schoolYear.js
```

The output is a **Rhythm Plan** for the week: a target workload (hours/sessions), a suggested cadence, and a *stance* (`full` / `steady` / `light` / `resting` / `restoring`). Everything downstream (project sizing, Today's ask, reminders) reads the Plan, never the raw baseline.

---

## 2 · Inputs (what it reads from the LFM)

| Input | Source | Role |
|---|---|---|
| **Baseline capacity** | `lfm_traits` · `rhythm_preference` / `pace` (family scope) | the family's stated ideal week — the ceiling, not the demand |
| **Pace signals** | `lfm_signals` · `time_vs_estimate`, `too_easy`, `wanted_more`, `abandoned` | is the current ask calibrated? drives `pace_factor` |
| **Active Moments** | `lfm_moments` · `passing` / `hard_season` / `lasting` | the drag — a broken wrist or a hard season lightens the ask (data model §7) |
| **Calendar** | `calendarFeed.js`, `schoolYear.js` | term/break shape, known-busy weeks, travel |
| **Per-child constraints** | `lfm_traits` · `circumstance` / `sensitivity` | mobility, health, load ceilings a child can't exceed |

---

## 3 · The four functions

### 3.1 Assemble — produce the weekly Rhythm Plan

Runs the formula in §1. Deterministic. Output stance drives tone everywhere:

- `full` — baseline, life is calm.
- `steady` — slight trim (mild calendar pressure or a lasting Moment easing).
- `light` — a passing or hard Moment is active; ask visibly reduced, framed as care.
- `resting` — North Star proposes pausing the ask entirely for a defined window.
- `restoring` — a passing Moment just ended; ramping back toward baseline, not snapping back.

### 3.2 Detect strain / slack — feed the Observation Engine

Compares recent completion against the Plan. Sustained under-delivery → a `rhythm_health` observation candidate (*"the last few weeks have been heavier than they needed to be"*). Sustained slack + `wanted_more` → capacity to gently offer more. **The engine does not silently change the ask on strain — it surfaces a noticing / recommendation** (§4).

### 3.3 Reshape on Moments — lighten now

When a `passing` or `hard` Moment activates, the `moment_multiplier` drops and the Plan shifts to `light`/`resting`. This is a *significant* change → it flows through a **Recommendation** (the three-question contract), never silently:

> 1. *what changed* (Noah's wrist) · 2. *what it affects* (this week's outdoor missions, the build project) · 3. *the proposal* (pause the build, swap in something one-handed, we'll pick it back up).

### 3.4 Restore itself — the signature behaviour

A `passing` Moment carries a `review_at` (data model §5). The Rhythm Engine **schedules its own return**: at `review_at`, it re-checks the Moment; if resolved, it moves the Plan to `restoring` and proposes bringing the paused work back — *"Noah's cast is off this week — ready to pick the build back up?"* This is the thing families never get from static plans: North Star remembers to un-pause.

---

## 4 · Nothing significant changes silently

Rhythm honours the same contract as the rest of North Star:

- **Small calibrations** (a mission sized 40 min instead of 30 because pace ran hot) — silent, absorbed into the next Plan.
- **Meaningful reshapes** (lightening a week, pausing a project, restoring after a Moment) — always a **Recommendation** the parent accepts/edits/declines. `decision_note` on a decline is itself a `feedback` signal that re-tunes future Plans.

The line between "calibration" and "reshape" is a configurable threshold (default: >25% workload change, or any project pause/restore, is a reshape).

---

## 5 · Outputs (what it writes / exposes)

- **Rhythm Plan** — assembled on read (cache per week if hot). Consumed by: Project Generation v2 (sizing), Today (the week's ask + stance/tone), reminders/cadence, the calendar feed.
- **`rhythm_health` observation candidates** → Observation Engine.
- **Recommendations** (`resize_rhythm` / `lighten` / `restore` / `pause_project`) → `lfm_recommendations`.
- **`review_at` wake-ups** → the restore scheduler.

It does **not** write Traits directly; changes to the family's stated baseline are parent-driven (a `declared` rhythm_preference Trait) or arise from a confirmed observation.

---

## 6 · Implementation shape

- **Assembler:** pure TS function `assembleRhythm(family, week)` in a new `js/lib/rhythmEngine.js` (client) with a mirrored server function for generation/cron. Replaces/absorbs `learningCapacity.js` (`weeklyLearningBudgetHours` becomes the `baseline_capacity` term).
- **Strain/restore scheduler:** Supabase cron — a weekly pass that (a) re-assembles Plans, (b) checks `review_at` on active passing Moments and emits restore recommendations, (c) feeds strain/slack candidates to the Observation Engine.
- **Recommendation issuance:** shared with the data model's `lfm_recommendations` writer.
- **Tone:** the Plan's `stance` is passed to every surface so copy matches the season (a `hard`-season week never uses cheerful "let's go!" language).

## 7 · What this consolidates

| Existing | Becomes |
|---|---|
| `learningCapacity.js` (static `days × hours`) | the `baseline_capacity` term inside `assembleRhythm` |
| `family_profiles.rhythm` (jsonb setting) | source of the `rhythm_preference` baseline Trait; the *assembled* Plan is computed, not stored |
| `schoolYear.js` / `calendarFeed.js` | the `season_shape` / `calendar_encroachment` terms |
| implicit "the plan is fixed" behaviour | a weekly living Plan that lightens and restores |

---

## 8 · Open implementation questions (none block starting)

1. **Pace-factor smoothing** — how many weeks of `time_vs_estimate` before `pace_factor` moves (avoid whiplash). *Recommend: rolling 3-week weighted mean, clamp per-week movement.*
2. **Calibration vs. reshape threshold** — start at 25% / any-pause; tune from decline rates.
3. **Restore proactivity** — do we auto-nudge at `review_at`, or wait for the parent to open the app? *Recommend: surface on next open + one gentle notification, never more.*
4. **Multi-child aggregation** — family week vs. per-child asks; start with per-child Plans summed to a family view, capped by family baseline.
