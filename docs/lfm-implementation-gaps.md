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

### G3 · Distillation invocation is not wired
`distill_family` exists and is verified, and `runDistillation()` (js/lib/lfm.js) can call it, but nothing invokes it automatically yet. Wire to a natural checkpoint (after a project decision, or a periodic sweep) — a small next step, intentionally not bundled into the rules slice.

### G4 · Freshness / decay not implemented
Understanding confidence does not yet decay with time (the `last_reinforced_at` half-life from data-model §6). Interests that go quiet remain until contradicted. Add when the Observation Engine / rhythm work needs it.

### G5 · Backfill of existing families not run
Distillation has only been proven on controlled evidence. Backfilling the 3 live families' existing Archive is a **separate, explicit task** after the rules are trusted (per the distillation slice's requirement #14).

---

## Closed

*(none yet)*
