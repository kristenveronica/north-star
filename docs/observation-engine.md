# The Observation Engine — Design Spec

**Implementation-ready.** Date: 2026-07-18. Status: **frozen philosophy, ready to build.**

The engine that turns the LFM's raw evidence into the humble sentences a parent recognises — *"I've noticed Jett stays engaged much longer outdoors."* It is the machine behind the *Reflect / Notice* behaviour.

Governed by, and must not re-open: [observation-framework.md](observation-framework.md) (the 5-test gate, accuracy-not-flattery, the gold standard *"I hadn't noticed that… but that's exactly right"*), [wisdom-model.md](wisdom-model.md) (what deserves attention/speech/silence), [living-family-model.md](living-family-model.md). Reads/writes the records defined in [lfm-data-model.md](lfm-data-model.md).

> **The engine's whole job:** find the few patterns in `lfm_signals` that are *true, kind, and worth saying*, phrase each as one humble noticing, and offer it back at a calm moment — then learn from what the parent does with it. Most patterns it finds, it will decline to say. Silence is a valid, common output.

---

## 1 · Inputs (what it reads)

Per subject (`child` or `family`, per §2 of the data model):

- `lfm_signals` — the evidence stream, windowed (default: last 90 days, weighted by recency and `weight`).
- `lfm_traits` — current standing understanding, so the engine doesn't "notice" what's already known/confirmed.
- `lfm_observations` — prior noticings, to enforce **anti-repetition** and cooldowns.
- `lfm_moments` — active moments, so it stays quiet on tender/hard subjects (a `hard` moment mutes noticings for that subject).
- Rhythm health metrics from the Rhythm Engine (for `rhythm_health` observations at family scope).

It never reads the assembled snapshot as source of truth; it reads atomic records so provenance is intact.

---

## 2 · The pattern detectors

Each detector scans a signal window for one shape and emits a **candidate** `{subject, category, noticing_draft, evidence:{signal_ids, pattern}, raw_confidence}`. Detectors are deliberately simple and inspectable — the intelligence is in the gate (§3) and the phrasing (§4), not in clever detection.

| Detector | Category | Fires when |
|---|---|---|
| **Engagement-context** | `engagement_pattern` | `depth_reached` / `time_vs_estimate` cluster far higher in one context (outdoors, hands-on, a domain) than the child's baseline |
| **Interest drift** | `interest_shift` | repeated `interest_expressed` / `project_choice` toward a domain with no matching active interest Trait — or a standing interest Trait going quiet (no affirming signals past its half-life) |
| **Strength emerging** | `strength_emerging` | recurring `completed` + `wanted_more` + low `time_vs_estimate` in one capability domain |
| **Struggle** | `struggle` | recurring `too_easy` inverse — `abandoned` / `lost_interest` / overruns clustered in one domain or format |
| **Growth movement** | `growth` | signals show progress toward an existing `growth_goal` Trait (evidence of the thing the parent said they wanted) |
| **Rhythm health** (family) | `rhythm_health` | Rhythm Engine reports sustained over/under-capacity, or a stretch of skipped weeks |

Detectors run over the window and produce zero-or-more candidates. Cheap, deterministic, no AI. New detectors are additive.

---

## 3 · The gate — the 5-test filter (why most candidates die)

Every candidate must pass **all five** tests from the Observation Framework before it may be surfaced. This is a hard gate, applied in order; the first failure drops the candidate to `status = draft` (kept for evidence accrual, never shown):

1. **True** — `raw_confidence ≥ category threshold` AND ≥ N distinct supporting signals (not one lucky day). Interests need less evidence than temperament/values.
2. **Not already known** — no active Trait or recent Observation already says this. Anti-repetition: same `(subject, category, label)` cannot re-surface within a cooldown (default 60 days) unless materially stronger.
3. **Kind & safe** — subject has no active `hard`/`tender` Moment; category isn't on the never-notice list (never a deficit-framed noticing about the child's character).
4. **Useful** — it could plausibly change what a parent does or sees (per Wisdom Model: does it deserve speech?). Pure trivia is dropped.
5. **Right moment** — not inside a quiet window; not exceeding the surfacing budget (§6).

A candidate that passes 1–4 but fails 5 is **held**, not dropped (surfaced later). Failing 1–4 means `draft`.

**Confidence is internal only** (data model §6). It gates surfacing; it is never rendered as a number/bar.

---

## 4 · Phrasing — one AI step, tightly bounded

Only candidates that pass the gate reach the model. New `ai` action **`compose-observation`**: input = the candidate's pattern + evidence summary + child's name; output = one sentence meeting the Framework's voice (humble, specific, evidence-anchored, no flattery, no jargon, no metrics). Schema-constrained to a single `noticing` string + a one-line `why` (the plain-language evidence shown on request).

The model **phrases**, it does not **decide** — detection and the gate already decided this is worth saying. This keeps cost negligible (only survivors hit the API) and keeps the judgement in inspectable code, not a prompt.

Writes an `lfm_observations` row: `status = offered`, `noticing`, `evidence`, internal `confidence`, `surfaced_at`.

---

## 5 · Surfacing & the feedback loop

Offered observations appear on **Today** and in Growth surfaces — calm, never a badge or nag. The parent can **Confirm**, **Correct**, or ignore. This closes the loop back into the LFM:

| Parent action | Observation → | LFM effect |
|---|---|---|
| **Confirm** | `confirmed` | Strengthens or creates a Trait, `provenance = confirmed`, confidence raised (data model §4) |
| **Correct** | `corrected` | Supersedes the mistaken Trait (`supersedes_id`); the correction becomes `declared`-strength; records so it won't re-infer |
| **Acts on it** (accepts a linked recommendation) | stays `confirmed` | implicit strong affirmation signal |
| **Ignores past window** | `expired` | never nags; a quiet non-event (a valid, common ending) |

An observation may set `led_to_recommendation_id` when it warrants a proposal — but **many observations lead nowhere, and that is a complete outcome** (Framework rule). The engine must be comfortable noticing without recommending.

---

## 6 · Cadence, budget, and calm

Anti-nag is a first-class constraint, not a nicety:

- **Trigger:** periodic sweep (default weekly, per subject) **plus** natural-checkpoint triggers — project completed, season boundary, milestone reached. Not event-on-every-signal (that would be twitchy). *Recommend: weekly cron sweep + checkpoint hooks.*
- **Budget:** at most **one surfaced observation per subject per surfacing window** (default: one child-scoped every ~1–2 weeks; family-scoped rarer). Excess survivors are `held` and re-evaluated next sweep (freshest/strongest wins).
- **Quiet windows:** suppressed during active `hard` Moments; suppressed for a new family still in their first weeks (let the relationship earn it).
- **Expiry:** offered-but-ignored observations expire silently after their window.

---

## 7 · Implementation shape

- **Detectors:** deterministic TS in a new `observation-sweep` edge function (or a module in `ai`'s shared layer), reading the LFM tables. No AI.
- **Gate:** pure function over candidate + current Traits/Observations/Moments. Unit-testable in isolation — this is where correctness lives.
- **Compose:** new `ai` action `compose-observation`, schema-constrained, batched (only survivors).
- **Scheduler:** Supabase cron invokes the sweep weekly per active family; checkpoint hooks call the same entry with a `trigger` reason.
- **Writes:** `lfm_observations`; on confirm/correct, the existing confirm handler writes `lfm_traits` (shared with the data model's promotion logic).
- **Cost:** near-zero — detection is free; only gated survivors (a handful per family per week) hit the model.

## 8 · What this consolidates

Supersedes the ad-hoc, one-off reflection actions (`growth-reflection`, `family-reflection`) as the *standing* noticing mechanism: those remain for their moment-in-time uses, but recurring "I've noticed…" now flows through this engine and the `lfm_observations` lifecycle rather than being regenerated statelessly each view.

---

## 9 · Open implementation questions (none block starting)

1. **Detector thresholds** — start conservative (prefer silence to a weak noticing); tune from real confirm/correct rates. *Recommend: log candidate→outcome to calibrate.*
2. **Sweep vs. checkpoint weighting** — begin weekly sweep only; add checkpoint hooks once the sweep is proven calm.
3. **Family-scope rhythm observations** — depend on the Rhythm Engine's health metrics (§1); wire after the Rhythm Engine lands.
