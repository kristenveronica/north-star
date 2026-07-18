# LFM Implementation Gaps — tracked, not buried

**Purpose:** a durable, reviewable list of known gaps in the Living Family Model build so they shape roadmap decisions rather than getting lost in session reports. Update as gaps open and close. See [lfm-architecture.md](lfm-architecture.md) for the canonical model.

---

## Open

### G1 · Child-portal activity does not write Archive *(priority: high)*
**What:** Milestone completions performed in the **child portal** do not produce Archive evidence. The completion event flows through `completeMilestone` → the Archive sink (js/app.js), but the sink no-ops when there is no `family` in state, and a child-portal session (access-code auth, not a Supabase `authenticated` family member) both lacks that context **and** would be denied by `family_archive` RLS (`is_family_member`).

**Why it matters:** Understanding would be **disproportionately shaped by parent-side activity** and blind to what children actually do — the opposite of the LFM's intent. Interests/engagement inferred by distillation (migration 0032) would systematically under-weight child-driven completion.

**Likely fix (not yet designed):** a server-side path for child-portal writes — e.g. an edge function invoked by the child-portal session that writes `family_archive` under service role after validating the access-code→child→family binding; or a per-child RLS grant tied to the child portal's auth. Must preserve family isolation. Deferred deliberately; do not solve inside an unrelated slice.

**Introduced:** write-path slice 3 (milestone completion → Archive). **Tracked since:** 2026-07-18.

---

## Deferred (intentional scope cuts, revisit when needed)

### G2 · Distillation: rejection / edit-text categories *(distillation v1 scope cut)*
Distillation v1 (migration 0032) produces only **interest** (inferred) and **circumstance** (declared). Deliberately deferred:
- **Rejection patterns** (repeated declines in a domain) → an "avoid" signal. Held because decline ≠ topic dislike (often timing); needs care to avoid premature inference.
- **Parent-requested-modification meaning** — an edit's `requestedChange` free text is direct evidence of a preference, but extracting *what* preference needs the **bounded AI classification step** (the one place AI is genuinely warranted). v1 stays fully deterministic; add the AI step when rejection/edit signal is needed by generation.
- **Confirmed interests** are produced by the Observation Engine's confirm flow, not distillation; distillation only *respects* them.

### G6 · Rhythm capacity allocation — v1 SHIPPED; refinements deferred *(priority: high)*
**Done (v1, 2026-07-18):** Generation now allocates a realistic per-project capacity before generating (`supabase/functions/_shared/projectCapacity.js`): total weekly capacity from rhythm, committed from active-project count (transparent fallback — no stored workload), 30% open reserve, size-scaled share of remaining, capacity-reducing circumstances. It shapes the quest's sessions/weeks/total and runs a substance check (±50%, momentum-point estimate) with one targeted regeneration. Proven live: same request → 14h/7-milestone (12h, 0 active) vs 5h/4-milestone (4h, 2 active).

**Still deferred (the substantive remainder):**
- **Effective size should down-shift under tight capacity.** Live Scenario C showed the model floors at ~5h for a worthwhile "medium" even when the allocation asked for ~2h — so a `medium` request under scarce capacity should become a *small* project (or North Star should propose fewer/lighter projects), rather than fighting the substance check. This is the most important next refinement.
- **Real workload capture.** Milestone/project duration is not stored; committed capacity and the substance check both use coarse fallbacks (momentum-point ×3, per-project even-split). Capturing real estimated/actual minutes would raise `allocationConfidence` above "low".
- **Adaptive rescheduling** (rebalancing existing projects as capacity changes) — explicitly out of scope for v1.
- **Dashboard/calendar surfacing** of capacity — out of scope.

### G4 · Freshness / decay not implemented
Understanding confidence does not yet decay with time (the `last_reinforced_at` half-life from data-model §6). Interests that go quiet remain until contradicted. Add when the Observation Engine / rhythm work needs it.

### G5 · Backfill of existing families not run
Distillation has only been proven on controlled evidence. Backfilling the 3 live families' existing Archive is a **separate, explicit task** after the rules are trusted (per the distillation slice's requirement #14).

---

## Closed

### G3 · Distillation invocation *(closed 2026-07-18)*
Wired at the natural checkpoint: after a project accept/edit/decline, `fireArchive` (js/views/projects.js) records the Archive entry then calls `runDistillation(family, child)` — deferred/background, non-blocking, failure-isolated from the Archive write. The next generation reads fresh Understanding. (Milestone completions don't trigger distillation — they carry no domain signal for the current categories; revisit if completion-based Understanding is added.)
