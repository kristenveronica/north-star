# The Observation Engine — Design Spec

**Implementation-ready.** Date: 2026-07-18 (rev. 2 — consolidated). Status: **locked, ready to build.**

The engine that turns the **Archive** into the humble sentences a parent recognises — *"I've noticed Jett stays engaged much longer outdoors."* It is the machine behind the *Reflect / Notice* behaviour. It produces no record of its own: it **surfaces an Understanding.**

Vocabulary fixed by [lfm-architecture.md](lfm-architecture.md) (the four nouns). Governed by [observation-framework.md](observation-framework.md) (the 5-test gate, accuracy-not-flattery, the gold standard *"I hadn't noticed that… but that's exactly right"*), [wisdom-model.md](wisdom-model.md). Reads/writes the records in [lfm-data-model.md](lfm-data-model.md).

> **The engine's whole job:** find the few patterns in the **Archive** that are *true, kind, and worth saying*, phrase each as one humble noticing, and **surface the corresponding Understanding** (`surface_status='offered'`, `noticing`) at a calm moment — then learn from what the parent does with it. Most patterns it finds, it declines to say. Silence is a valid, common output. There is no "observation" table — an observation *is* a surfaced Understanding.

---

## 1 · Inputs (what it reads)

Per subject (child or family, per the scope model):

- **Archive** (`family_archive`) — the Evidence stream and feedback entries, windowed (default: last 90 days, weighted by recency and `metadata.weight`).
- **Understanding** (`understandings`) — current beliefs, so the engine doesn't "notice" what's already known/confirmed.
- Prior **surfaced Understandings** (`understandings` where `surface_status` is set), to enforce **anti-repetition** and cooldowns.
- Active **Moments** (Archive `source_type='moment'`), so it stays quiet on tender/hard subjects (a `hard` Moment mutes noticings for that subject).
- Rhythm health metrics from the Rhythm Engine (for family-scope rhythm noticings).

It reads the atomic Archive and Understanding rows, so provenance stays intact.

---

## 2 · The pattern detectors

Each detector scans an Archive window for one shape and emits a **candidate** `{subject, domain, statement_draft, evidence:{source_ids, pattern}, raw_confidence}`. Detectors are deliberately simple and inspectable — the intelligence is in the gate (§3) and the phrasing (§4).

| Detector | Understanding domain | Fires when |
|---|---|---|
| **Engagement-context** | `engagement_pattern` | `depth_reached` / `time_vs_estimate` Archive entries cluster far higher in one context (outdoors, hands-on, a domain) than the child's baseline |
| **Interest drift** | `interest` | repeated interest/project-decision entries toward a domain with no matching active interest Understanding — or a standing interest going quiet past its half-life |
| **Strength emerging** | `strength` | recurring `completed` + `wanted_more` + low `time_vs_estimate` in one capability |
| **Struggle** | `challenge` | `abandoned` / `lost_interest` / overruns clustered in one domain or format |
| **Growth movement** | `growth_goal` | Archive shows progress toward an existing `growth_goal` Understanding |
| **Rhythm health** (family) | `rhythm_preference` | Rhythm Engine reports sustained over/under-capacity or skipped weeks |

Detectors run over the window and produce zero-or-more candidates. Cheap, deterministic, no AI. New detectors are additive.

---

## 3 · The gate — the 5-test filter (why most candidates die)

Every candidate must pass **all five** Observation-Framework tests before it may be surfaced. Hard gate, applied in order; first failure keeps the belief **unsurfaced** (it may still exist as a low-confidence Understanding, but `surface_status` stays `draft`/null — never shown):

1. **True** — `raw_confidence ≥ domain threshold` AND ≥ N distinct supporting Archive entries (not one lucky day). Interests need less evidence than temperament/values.
2. **Not already known** — no active Understanding or recently-surfaced belief already says this. Anti-repetition: the same `(subject, domain, statement)` cannot re-surface within a cooldown (default 60 days) unless materially stronger.
3. **Kind & safe** — no active `hard`/`tender` Moment on the subject; never a deficit-framed noticing about the child's character.
4. **Useful** — it could plausibly change what a parent does or sees (Wisdom Model: does it deserve speech?). Trivia is dropped.
5. **Right moment** — not inside a quiet window; not exceeding the surfacing budget (§6).

Pass 1–4 but fail 5 → **held** (surfaced later). Fail 1–4 → stays an unsurfaced belief.

**Confidence is internal only.** It gates surfacing; never rendered as a number/bar.

---

## 4 · Phrasing — one AI step, tightly bounded

Only candidates that pass the gate reach the model. New `ai` action **`compose-observation`**: input = the candidate's pattern + Evidence summary + child's name; output = one sentence meeting the Framework's voice (humble, specific, evidence-anchored, no flattery, no jargon, no metrics). Schema-constrained to a `noticing` string + a one-line `why` (the plain-language evidence shown on request).

The model **phrases**, it does not **decide** — detection and the gate already decided this is worth saying. Cost is negligible (only survivors hit the API) and the judgement stays in inspectable code.

Output = **surface an Understanding**: upsert the `understandings` row for this belief (create it if new, `provenance='inferred'`), set `surface_status='offered'`, `statement` (the internal belief), `noticing` (the shown sentence), `surfaced_at`, and link supporting Archive rows via `understanding_evidence`.

---

## 5 · Surfacing & the feedback loop

Surfaced Understandings appear on **Today** and in Growth surfaces — calm, never a badge or nag. The parent can **Confirm**, **Correct**, or ignore. This closes the loop back into Understanding:

| Parent action | `surface_status` → | Understanding effect |
|---|---|---|
| **Confirm** | `confirmed` | `family_verdict='accurate'`, `provenance='confirmed'`, confidence raised, `status` strengthens |
| **Correct** | `corrected` | `family_verdict='no_longer_true'/'incorrect'`; belief `contradicted`/`retired`; the correction is `declared`-strength; recorded so it won't re-infer |
| **Acts on it** (accepts a linked Recommendation) | stays `confirmed` | implicit strong affirmation (an Archive `feedback` entry) |
| **Ignores past window** | `expired` | never nags; a quiet non-event (a valid, common ending) |

A surfaced Understanding may spawn a **Recommendation** when it warrants a proposal — but **many noticings lead nowhere, and that is a complete outcome** (Framework rule). The engine must be comfortable noticing without recommending.

---

## 6 · Cadence, budget, and calm

Anti-nag is a first-class constraint:

- **Trigger:** periodic sweep (default weekly, per subject) **plus** natural-checkpoint triggers — project completed, season boundary, milestone reached. Not event-on-every-Archive-write. *Recommend: weekly cron sweep + checkpoint hooks.*
- **Budget:** at most **one surfaced Understanding per subject per surfacing window** (default: one child-scoped every ~1–2 weeks; family-scoped rarer). Excess survivors are **held** and re-evaluated next sweep (freshest/strongest wins).
- **Quiet windows:** suppressed during active `hard` Moments; suppressed for a new family in their first weeks (let the relationship earn it).
- **Expiry:** offered-but-ignored beliefs `expire` silently after their window.

---

## 7 · Implementation shape

- **Detectors:** deterministic TS in a new `observation-sweep` edge function (or a module in the `ai` shared layer), reading Archive + Understanding. No AI.
- **Gate:** pure function over candidate + current Understandings + active Moments. Unit-testable in isolation — this is where correctness lives.
- **Compose:** new `ai` action `compose-observation`, schema-constrained, batched (only survivors).
- **Scheduler:** Supabase cron invokes the sweep weekly per active family; checkpoint hooks call the same entry with a `trigger` reason.
- **Writes:** upserts `understandings` (surfacing fields) + `understanding_evidence`; on confirm/correct, updates `family_verdict`/`provenance`/`status` (shared with the distillation logic).
- **Cost:** near-zero — detection is free; only gated survivors (a handful per family per week) hit the model.

## 8 · What this consolidates

Replaces the stateless one-off reflection actions (`growth-reflection`, `family-reflection`, `coreword-living`) as the *standing* noticing mechanism. Recurring "I've noticed…" now flows through this engine and the **surfaced-Understanding** lifecycle rather than being regenerated statelessly each view. Periodic multi-belief documents shown back are **Reports** (§ data-model 3.5), composed by `compose-report`, not this engine.

---

## 9 · Open implementation questions (none block starting)

1. **Detector thresholds** — start conservative (prefer silence to a weak noticing); tune from real confirm/correct rates. *Recommend: log candidate→outcome to calibrate.*
2. **Sweep vs. checkpoint weighting** — begin weekly sweep only; add checkpoint hooks once proven calm.
3. **Family-scope rhythm noticings** — depend on the Rhythm Engine's health metrics (§1); wire after the Rhythm Engine lands.
