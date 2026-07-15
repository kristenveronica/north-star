# Sprint 1 — First 25 Paying Families

**Lead Engineer plan · for review · no implementation until approved.**

Date: 2026-07-15 · Executes the opening of [the Six-Month Cut](six-month-focus.md) / Phases 0–1 of [the Build Roadmap](build-roadmap.md).

---

## Objective

Prepare North Star for its **first 25 paying families** — and make their experience extraordinary. We are explicitly **not** building for 25,000. Every task is judged against one question:

> **What is the minimum engineering required for 25 families to experience the North Star flywheel?**

## Definition of done — the sprint delivers a product that can

- onboard a family · accept payment · generate a project · complete a project
- capture meaningful context · safely store family data · **begin** the Living Family Model

…with **no unnecessary complexity.**

## Explicitly OUT of scope (and why)

| Not building | Why |
|---|---|
| Three-tier commercial system, features registry, disclosure engine, upgrade previews | 25 families are all on one Founding plan — there is nothing to gate. Premature. |
| Supabase Storage migration (files stay base64-in-rows) | Fine at 25 families; the roadmap migrates it around Phase 3–4 when portfolios grow. |
| Memory-aware generation, the Observation engine, the Weekly Conversation | The flywheel *engine* is Sprint 2 — and it is gated on the validation experiments (Epic E) passing. Sprint 1 *begins* the LFM by capturing durable context, not by building the engine. |
| Child Insights, Community, Family Economy, Rewards depth, adult add-seat flows | None are required for the loop; all deferred. |
| Frontend framework rewrite / build step | The vanilla SPA works; rewriting is pure cost. |

"Begin the Living Family Model" in Sprint 1 means **the substrate exists and is durably filling with real family context** — not that memory changes generation yet. That comes next sprint, once we've *proven* it should (Epic E).

---

## Epics

| # | Epic | Delivers |
|---|---|---|
| **A** | Security & Safety Foundation (Phase 0) | Safe to charge money and hold children's data |
| **B** | Durable Data & Context Substrate | No data loss; the LFM begins accumulating |
| **C** | Single-Plan Founding Payments | Accept payment for one plan |
| **D** | The Working Loop | onboard → generate → complete → reflect → upload, end-to-end |
| **E** | Flywheel De-risk (validation) | Prove context & observation work before Sprint 2 builds the engine |

Epic A is the long pole and the root dependency. Epic E runs in parallel as a mostly-non-engineering track.

---

## Epic A — Security & Safety Foundation

*The license to operate. Nothing ships to a paying family until this is green. This is the already-scoped Phase 0.*

**A1 · Reconcile migration-history drift + take a backup baseline.**
Priority P0 · Effort 1d · Deps none · Parallel-safe.
AC: live schema diffed against repo; a documented known-good baseline; a restore point before any DDL.
Testing: verify live `pg_policies`/`pg_proc` match the captured baseline.
Deploy risk: touching prod migration bookkeeping — read-only until the backup exists.

**A2 · Regression harness (attacks + legitimate-workflow tests).**
P0 · 2–3d · Deps none · Parallel-safe — start immediately.
AC: every known attack (child-limit tamper, role self-promotion, cross-family child access, portal injection, unguarded AI, contributor billing) is scripted and **currently passing** (proving the hole is open); every legitimate role workflow (architect/contributor/observer/child) passes. Runs in staging; read-only probes against prod.
Testing: this *is* the test infrastructure for the whole sprint.
Deploy risk: needs a way to simulate roles (RLS via set-claims in SQL for DB attacks; a test JWT for edge-fn attacks).

**A3 · Migration `0025_security_hardening.sql` (+ rollback).**
P0 · 2–4d · Deps A1, A2, A8 · **critical path.**
Scope: lock `child_profile_limit` to service-role; guard triggers vs role self-promotion / limit tamper / child re-parenting; fix `can_access_child` + `member_child_access` cross-family binding; owner-scope `fm_insert`/`fm_update`; fix `apply_billing_entitlement` beta-demotion; CHECK constraints; tighten over-broad grants and `public`-role policies.
AC: every A2 attack now **fails**; every legitimate workflow still passes; beta-conversion capacity no longer drops; fully reversible.
Testing: A2 harness green in staging, then prod.
Deploy risk: **highest in the sprint** — drifted schema, possible over-lock of a legit flow. Mitigated by A1 + staging + rollback.

**A4 · Edge fn: `_shared/authz` + owner-gate all mutating billing actions.**
P0 · 1–2d · Deps A2.
AC: `create-checkout`/`add-seat`/`pause`/`cancel`/`create-portal` require owner + active status; revoked members rejected.
Testing: harness billing attacks fail; a real owner still manages billing.
Deploy risk: blocking a legitimate owner action — covered by harness.

**A5 · Edge fn: AI endpoint auth + permission + billing-status gate + lightweight abuse throttle.**
P0 · 2–3d · Deps A2.
AC: unauthenticated / canceled-family / permission-lacking callers get 403; a per-family throttle caps runaway usage; a permitted member still generates.
Testing: harness AI attacks fail; throttle test; legit generation passes for every action.
Deploy risk: **false-negative lockout** of a legit contributor, and throttle tuning. Mitigate with a table-driven action→permission map; test every action with owner + permitted contributor.

**A6 · Child-portal hardening.**
P0 · 2–3d · Deps A2.
Scope: exact-match lookup (kill the `ilike` `%` injection); strip PIN/DOB from the response; attempt throttle; higher-entropy access codes + rotate the existing codes.
AC: `%` no longer matches any child; response contains no PIN/birth data; brute force is throttled; existing children can still log in after rotation.
Testing: injection test, PII-absence test, brute-force throttle test, child-login regression.
Deploy risk: rotation could break a child's saved link — only 2 children exist today; coordinate the swap.

**A7 · `send-invite` ownership check + security event logging.**
P1 · 1–2d · Deps A4, A5.
AC: `send-invite` only sends for a caller-owned pending invite; privilege-escalation, portal brute-force, billing-abuse and repeated-AI-abuse events are logged.
Testing: relay-abuse blocked; log entries appear for each event class.
Deploy risk: low.

**A8 · Client: stop writing `child_profile_limit`; remove the free "Enable Child Insights" toggle.**
P0 · 0.5d · Deps none · **must ship before A3.**
AC: the client never writes the limit; the free toggle is gone.
Testing: sync succeeds post-change; no client write to the limit column.
Deploy risk: **sequencing** — if A3 lands first, child sync errors. Ship A8 first.

---

## Epic B — Durable Data & Context Substrate

*Safely storing family data, and beginning the LFM.*

**B1 · Harden cloud sync — no data loss.**
P0 · 2–3d · Deps A3 (RLS changes affect sync).
AC: add a child → refresh / new device → it persists; the anti-clobber merge holds; nothing is silently dropped; projects/reflections/context round-trip reliably.
Testing: multi-device hydrate test; the specific "added child sticks after refresh" regression; run under the new A3 policies.
Deploy risk: interaction between sync and the tightened RLS — a real emergent-surprise candidate.

**B2 · Durable, extensible context substrate (begin the LFM).**
P1 · 2–3d · Deps B1.
AC: onboarding answers, project history, and reflections are captured in a durable, **extensible** structure the LFM can later accumulate from — free-form-capable, **no rigid enums** that would foreclose Family Culture / Relationship Intelligence; readable server-side.
Testing: context round-trips; schema changes are additive; a family's context is retrievable as one coherent picture.
Deploy risk: **over-engineering** — keep it minimal; this is a substrate, not the engine.

**B3 · DECISION (no build): defer Supabase Storage; keep base64-in-rows.**
P2 · 0d · Deps none.
AC: documented deferral with the size limits that keep it safe at 25 families.
Rationale: migrating storage now is premature work — roadmap does it ~Phase 3–4.

---

## Epic C — Single-Plan Founding Payments

*Accept payment — one plan, cleanly.*

**C1 · Seed minimal `plans` (founding) + `plan_code`/`extra_adults`; derive capacity server-side.**
P0 · 1–2d · Deps A3.
AC: capacity (5 children / 2 adults) derived from `plans ⋈ family_billing` and enforced by the trigger; a 3rd child/adult is rejected.
Testing: capacity-enforcement attacks (from A2) fail; a founding family fits within 5/2.
Deploy risk: interaction with the A3 triggers.

**C2 · Stripe single Founding plan end-to-end.**
P0 · 2–3d · Deps C1, A4.
Scope: `plan_code` metadata on the subscription; webhook price→plan mapping; checkout + pricing flow polish; verify beta families map to founding and keep capacity.
AC: a family completes a real Founding purchase; the webhook writes `plan_code`; idempotent.
Testing: checkout happy + failure paths in Stripe test mode; webhook idempotency; beta-family mapping.
Deploy risk: **real money** — payment/webhook edge cases are fiddly and high-severity.

**C3 · (Optional) Minimal capability-flag mechanism.**
P2 · 1d · Deps none.
AC: a single capability can be dark-launched to a subset (internal test / founding cohort). **No plans, tiers, ranks, or Stripe modelled** — flag mechanism only.
Testing: flag on/off changes behaviour.
Deploy risk: scope creep into the full registry — hard guardrail, or **defer entirely** if the loop doesn't need dark-launch this sprint. *Recommend: build only if Epic B/D wants to gate the LFM-beginnings behind a flag; otherwise cut.*

**C4 · DELETE: full entitlement registry, tier ranks, 3 Stripe price sets, upgrade previews, disclosure engine.**
Premature for 25 single-plan families. Not in Sprint 1.

---

## Epic D — The Working Loop

*onboard → generate → complete → reflect → upload — end-to-end and durable. Most of this exists; the work is hardening and wiring, not new build.*

**D1 · Onboarding hardening.**
P0 · 2d · Deps B2.
AC: Quick Start + Full both complete without dead ends, produce durable context (B2), and land the family in the product ready to generate.
Testing: full onboarding walkthrough, both paths, context persists.
Deploy risk: interaction with sync/onboarding-parked state.

**D2 · Generation reliability (against the now-guarded endpoint).**
P0 · 1–2d · Deps A5.
AC: a family reliably generates a project; it saves; errors are handled gracefully.
Testing: generation happy path + failure handling; works for a permitted contributor.
Deploy risk: AI latency/cost under the new throttle.

**D3 · Completion / reflection / upload persist durably (the signal capture).**
P0 · 2–3d · Deps B1.
AC: complete a project, add a reflection, upload work → all persist, survive refresh, correctly family-scoped; this is the signal the LFM will accumulate.
Testing: loop persistence; RLS scoping; base64 upload within size limits.
Deploy risk: upload payload size — enforce sane limits (fine at 25 families).

**D4 · End-to-end loop acceptance.**
P0 · 1d · Deps D1–D3.
AC: onboard → child → generate → complete → upload → reflect is walkable start-to-finish for one family with **zero dead ends and zero upgrade prompts.**
Testing: scripted E2E walkthrough as the sprint's headline acceptance test.
Deploy risk: integration surprises across the seams.

---

## Epic E — Flywheel De-risk (validation experiments)

*Parallel, mostly non-engineering. Gates the Sprint 2 flywheel engine. Full protocols in [the experiments doc](lfm-validation-experiments.md).*

**E1 · Run Experiment 1 — does context make generation dramatically better?**
P1 · concierge (~1wk elapsed, low eng) · Deps: D2 helpful, but manual generation works.
AC: pre-registered thresholds evaluated with 5–8 families → clear go/no-go on memory-aware generation.
Testing: blind paired protocol.
Deploy risk: recruiting families; confound control.

**E2 · Run Experiment 2 — do observations feel understood (not Barnum)?**
P1 · concierge · Deps: some real family context.
AC: pre-registered thresholds → go/no-go on the observation engine.
Testing: blind mixed-set (true / Barnum / wrong-decoy) protocol.
Deploy risk: crafting fair control sets; small n.

---

## What can run in parallel

- **Immediately, together:** A1, A2, A8, and recruiting for E1/E2.
- **After A2 (harness green-as-failing):** develop A3, A4, A5, A6 concurrently — they share the harness but touch different surfaces.
- **After A3:** B1, then B2 and C1 in parallel.
- **After C1/A4:** C2 (Stripe) develops alongside D1–D3.
- **Throughout:** Epic E is an independent track; it needs only some generation capability, not the finished product.

## Recommended implementation order (waves)

1. **Wave 0 —** A1, A2, A8 (parallel). Kick off E-recruiting.
2. **Wave 1 —** A3 (critical path); A4, A5, A6 developed in parallel; then B1.
3. **Wave 2 —** A7 logging; C1 capacity; B2 substrate; start E1/E2.
4. **Wave 3 —** C2 Stripe; D1 onboarding; D2 generation; D3 completion/upload.
5. **Wave 4 —** D4 end-to-end acceptance; E1/E2 readout; sprint review.

Rough size: ~4–6 focused weeks for a small team, with Epic A the long pole. Security ships the moment it's green — never batched behind feature work.

## Unnecessary work / deletions (called out on purpose)

- **DELETE C4** (entitlement registry / tiers / 3 price sets / disclosure engine) — premature architecture for 25 single-plan families.
- **DEFER B3** (Supabase Storage) — base64 is fine at this scale.
- **CUT-OR-MINIMISE C3** (flag mechanism) — build only if the LFM-beginnings need dark-launching this sprint; the thin version at most, never the registry.
- **No** adult add-seat flows, Insights, Community, Economy, Rewards depth, or any new breadth.

---

## The three tasks most likely to cause unexpected delays

*Flagged now so we can de-risk them early rather than be surprised.*

1. **A3 — Migration `0025` against a drifted, out-of-band-applied schema.** The migration history doesn't match the live database, so the migration meets conditions we can't fully predict, and any policy can over-lock a legitimate flow. *De-risk early:* do A1 (reconcile + backup) first; build A2 (harness) before touching anything; apply in staging and diff live policies before prod; keep the rollback ready.
2. **B1 — Cloud sync correctness *under the new RLS*.** The data-loss class of bug (children not persisting) is subtle on its own, and A3 changes the very policies sync depends on — a classic place for "looked done, then a subtle case bites." *De-risk early:* write the multi-device persistence test as part of A2, and run B1 explicitly against the post-A3 policies, not the old ones.
3. **C2 — Stripe single-plan checkout + webhook.** Real money, idempotency, beta-family mapping, and `plan_code` correctness are individually simple and collectively fiddly; payment bugs are high-severity and easy to miss until a real card is used. *De-risk early:* exhaust Stripe test mode, write idempotency tests, and validate the beta-family mapping before any live purchase.

*(Honorable mention: A5 AI-endpoint throttle tuning — a known risk, but more estimable than the three above.)*

---

**Sprint 1 stops here, at planning.** No implementation begins until this plan is approved. On approval, Wave 0 (A1, A2, A8) starts — with the regression harness first, so every fix that follows is provable.
