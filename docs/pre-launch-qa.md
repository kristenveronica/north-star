# North Star — Pre-Launch QA & Data-Integrity Sweep

**Purpose:** plug the holes a *first real paying customer* could fall into before
we onboard them — with a bias toward the **"disappearing projects" class of bug**
(data written locally that silently fails to round-trip to Supabase, or gets
clobbered on the next cloud hydrate).

This complements [`beta-test-checklist.md`](./beta-test-checklist.md) — that doc
is the full manual pass; **this** doc is the findings log from a code-level sweep
plus a short first-customer go/no-go. Keep both green before charging anyone.

Sweep date: **2026-07-04** · verified against code **and** live Supabase
(`dsioaopybvbfukouljej`).

---

## A. Findings from the code sweep

Severity: **S1** data corruption · **S2** silent data loss · **S3** silent
failure · **S4** fragile edge · **S5** limits/billing.

### ✅ FIXED — shipped in this pass

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 1 | S1 | **`children.mobility_profile` corrupted** — app wrote an object `{permissions,notes}` but the column was `text`, so supabase-js stored it as a *JSON string*. On the next re-hydrate the app read a string, so `mobilityProfile.permissions` was `undefined` → **every mobility/independence checkbox silently reset**, re-saving overwrote it, and the AI lost mobility context for project suggestions. (Same class as the pathway bug.) | **Migration `0024`** converts the column to `jsonb` (existing data parsed in place — verified intact). `repo.js` now sends a real object / null and reads back tolerantly (`asObj`, also recovers any legacy string). |
| 2 | S2 | **Child `pin`, `printPermission`, `birthData` were never synced** — `toChildRow` omitted them. Worst case: the **portal PIN silently disappeared** on any second device / after re-hydrate (a security downgrade — the child portal became ungated); print permission reset to "approval"; birth data (Child Insights) was lost. | `repo.js` now tucks all three into the existing `learning_profile` jsonb (the same trick already used for `gender`) — **no migration needed**. Round-trip unit-tested (incl. cross-device + new-child cases). |

### 🔧 OPEN — recommended before/soon after first customer

| # | Sev | Finding | Recommended fix |
|---|-----|---------|-----------------|
| 3 | S2 | **Parent-authored & paid content is local-only** — these slices are persisted locally but **never reach the cloud** (no mapper in `syncCore`), so they vanish on logout / second device even though their DB tables exist: `parentObservations` → `parent_observations`, `childSelfAssessments` → `child_self_assessments`, `growthReports` → `growth_reports`. Milestone **`evidence`** (uploaded photos/voice/notes) is also dropped on hydrate (`fromMilestoneRow` hard-codes `evidence:[]`; the typed `submission` *does* survive). | Wire these three into `syncCore` + hydrate (tables are ready with RLS). Highest value: `growth_reports` (paid AI compute) and `parent_observations`/`child_self_assessments` (feed the growth reports). Evidence files are heavier (base64) — decide storage strategy (Supabase Storage) before syncing. **This is the top follow-up.** |
| 4 | S3 | **Family/profile writes swallow errors** — in `syncCore`, the `families` / `family_profiles` / `family_members` writes run outside the per-row retry loop and are only caught by an outer `console.error`. A rejected profile write is dropped with **no user signal**. (The core collections got per-row retry after the pathway incident; these did not.) | Capture `{ error }` from those three calls; on failure show a "changes not saved" toast and re-arm the dirty flag (don't drop the batch). |
| 5 | S3 | **A failed sync flush is silent** — `syncCore`'s outer `catch` logs and returns with no retry flag; a failed flush on tab-hide loses the last edits. | On failure keep a dirty flag / re-schedule instead of dropping. |
| 6 | S4 | **`reflections.child_id` is `NOT NULL`** but a family-level project can have `child_id = null`; a reflection on such a project would fail its row insert (per-row retry means only that one reflection is skipped, not a batch loss). Latent — 0 family-level projects exist today. | Guard in `toReflectionRow` (coerce/skip when `childId` is null) or make the column nullable. Low priority. |

### 🟢 Checked and SOUND (don't re-investigate)

- **Enum/type round-trips** — every `toXxxRow` column audited against live column
  types. `pathway` and `status` normalizers are robust (unknown → `null`/`"active"`,
  so one stray value can never reject the whole insert). All jsonb array columns
  receive real arrays. `calendar_events.title`, `family_profiles.*` NOT NULLs are
  satisfied.
- **Child seat limit** — the "same-id upsert guard" (migrations `0015`/`0023`)
  means re-syncing an existing child never trips the cap (this was the old
  "can't-save" bug; fixed and re-asserted). Beta `child_profile_limit` default is
  **10**; a fresh signup can add their whole family and is **never** blocked on
  their first child.
- **Family creation** is idempotent and always creates a `family_profiles` row —
  hydrate never hits a missing profile.
- **Empty-state (new account, zero children/projects)** — the render paths that
  read `children[0].id` (`projects.js`, `reports.js`, `domains.js`, `insights.js`,
  `learningStyle.js`, `portfolio.js`) all guard with an early return / `&&` check.
  No confirmed first-load crash.

---

## B. First-customer smoke test (the 15-minute go/no-go)

Run in a **fresh incognito profile** (no cached state). This is the minimum that
must pass before a real customer; the full pass is in `beta-test-checklist.md`.

1. **Sign up** new email + password → land in onboarding.
2. **Onboarding**: complete it *and* (separately, fresh profile) test **park &
   return** — both reach a working dashboard with the family name.
3. **Add a child** with: birthday, gender, passions, **a portal PIN**, print
   permission, and **at least one Mobility checkbox** + a mobility note.
4. **Hard reload.** ✅ Child still there; **PIN still set**; **mobility checkboxes
   still ticked**; print permission unchanged. *(This is the regression test for
   fixes #1 and #2 — if any of these reset, stop and investigate.)*
5. **Generate a project** (short/medium/long selector works) → **Accept** → wait
   ~2s → **hard reload** → project still in Active with its rich fields. Then
   **Save as Draft** → reload → still in Drafts. *(Regression test for the
   original disappearing-projects bug.)*
6. **Log out, log back in** (or a different browser) → children **and** projects
   are all still there, PIN intact.
7. **Open the child portal** by access code + PIN → child sees their project/
   missions, can mark a milestone complete (star + points awarded).
8. **Console is clean** — no red errors during the whole run.

> Cross-device caveat until finding #3 ships: **growth reports, parent
> observations, child self-assessments, and uploaded evidence do NOT yet travel
> between devices / survive logout.** Don't demo those as cross-device features
> and don't rely on a growth report persisting after logout until #3 is wired.

---

## C. Owner / config to-dos before GA (not code)

- **Stripe:** move out of sandbox, real prices in, live keys + webhook secret set
  (see `stripe-supabase-setup.md`). *(Items #1/#2 on the launch list.)*
- Revert beta `child_profile_limit` base **10 → 1** after the beta window.
- Enable Supabase **Leaked Password Protection**.
- Reconcile browser STT (child voice → vendor) with the Trust Charter before any
  learning-app / mentor GA *(those are held in `/dev` for the MVP)*.

---

## Sign-off

- [ ] Section B smoke test fully green (fresh profile, desktop **and** phone).
- [ ] Findings #1/#2 regression steps (B4, B5) pass.
- [ ] Decision recorded on finding #3 (cross-device sync) — shipped, or explicitly
      accepted as a known limitation for the first customer.

Date: __________ · Tester: __________ · Commit: __________
