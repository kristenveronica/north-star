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

**Down-shift refinement (2026-07-18):** `effectiveSize` resolves the size↔capacity band choice deterministically BEFORE generation (steps down from the requested size until the child's weekly slot can sustain a band's floor). Bands calibrated to real generator output (small ~350 / medium ~750 / large ~1400 min).

**Hard-cap correction — DONE (2026-07-19):** the down-shift alone still let a below-floor allocation raise its target to the small-band FLOOR (200), manufacturing time the family didn't have (Scenario C: ~112 real minutes → ~300-min project marked "ok"). Fixed by enforcing the invariant **`finalTargetMinutes ≤ availableProjectMinutes`** via three explicit quantities: `availableProjectMinutes` (real capacity across the window = the hard ceiling), `desiredBandMinutes` (band typical), `finalTargetMinutes = min(desired, available)`. The band floor now informs only the down-shift *decision*, never the target. Substance check validates against BOTH target and ceiling, with distinct statuses `ok | thin | large_for_target | exceeds_capacity | insufficient_capacity` (exceeds_capacity is a hard fail, never folded into ±50%).

Two honest modes: **`standard`** (band fits; target capped at real available time) and **`insufficient`** (below the smallest worthwhile project → do NOT generate; short-circuit before any model call and return a structured `insufficient_capacity` result offering defer / rebalance). A sub-small "compact" tier was tried and **rejected on evidence**: the generator's smallest genuinely-worthwhile quest lands ~150–210 min even when explicitly asked to be compact (verified live), i.e. its real floor ≈ the small-band floor, so a compact tier would overshoot and flag every time. "The rhythm is already full" is the honest answer.

Live proof (real parent JWT, current build, all 6 respect the ceiling): A (12h/0/med)→ standard medium, est 540 ≤ 2016, ok; **B (12h/2/med)→ medium CAPPED at 672 not 750, est 450, ok + capacity note**; **C (4h/2/med) & D (4h/2/large)→ insufficient_capacity, 0 generation, ~3s, defer message** (the old 300-min defect is gone); E (24h/0/large)→ large, est 1080 ≤ 8064, ok; F (0.5h/0/med)→ insufficient (42 avail). **The project-sizing / capacity-ceiling problem is closed.**

**Still deferred (separate from sizing):**
- **Sub-small "activity" tier** *(future option, not built)*: a genuinely compact, self-contained experience (~40–120 min, 1–2 touchpoints) for families whose window is below the small floor. Needs a generator that can build below ~200 min without overshooting; today those families get `insufficient_capacity` (defer/rebalance) instead. Revisit if below-floor families are common.
- **Real workload capture.** Milestone/project duration is not stored; committed capacity and the substance check use coarse fallbacks (momentum-point ×3, per-project even-split). Capturing real estimated/actual minutes would raise `allocationConfidence` above "low" and sharpen the substance check.
- **Adaptive rescheduling** (rebalancing existing projects as capacity changes) — out of scope.
- **Rebalance action** wired to the `insufficient_capacity` result (pause/replace an active project inline, then generate) — the result already returns `options: ["defer","rebalance"]`; the UI flow is unbuilt.
- **Dashboard/calendar surfacing** of capacity — out of scope.

### G4 · Freshness / decay not implemented
Understanding confidence does not yet decay with time (the `last_reinforced_at` half-life from data-model §6). Interests that go quiet remain until contradicted. Add when the Observation Engine / rhythm work needs it.

### G5 · Backfill of existing families not run
Distillation has only been proven on controlled evidence. Backfilling the 3 live families' existing Archive is a **separate, explicit task** after the rules are trusted (per the distillation slice's requirement #14).

---

## Closed

### G3 · Distillation invocation *(closed 2026-07-18)*
Wired at the natural checkpoint: after a project accept/edit/decline, `fireArchive` (js/views/projects.js) records the Archive entry then calls `runDistillation(family, child)` — deferred/background, non-blocking, failure-isolated from the Archive write. The next generation reads fresh Understanding. (Milestone completions don't trigger distillation — they carry no domain signal for the current categories; revisit if completion-based Understanding is added.)
