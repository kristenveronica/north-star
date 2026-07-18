# Release Log

The deployment manifest for North Star. One row per production release. Append
newest at the top. See [release-management.md](release-management.md) for the
workflow. `verified` = smoke green at deploy; `observed` = healthy after a window
(get_advisors + get_logs). The two are distinct — see release-management.md.

| Date (UTC) | Frontend SHA | Latest migration | Edge fns deployed | Surfaces | Verified | Observed |
|------------|--------------|------------------|-------------------|----------|----------|----------|
| 2026-07-18 | c86ac0f | **0030_fix_children_select_rls** | — | migration (RLS) | ✅ CRITICAL fix: children SELECT policy blocked INSERT…RETURNING (STABLE self-ref) → no family synced. Inlined check; isolation preserved | ✅ Ivany family fully synced: 2 children, 2 projects, 15 milestones, video pointer linked to storage |
| 2026-07-17 | 4f1da6c | **0029_family_media_storage** | — | frontend + migration + Storage bucket | ✅ smoke 9/9; **cross-family isolation test passed** (A sees own=1, other=0; predicate true/false); bucket private, 50MB, 4 RLS policies | ⏳ live: needs a signed-in end-to-end upload (upload → reload → still there) |
| 2026-07-17 | 9146f9c | **0028_ai_usage_log** | **ai** (usage logging + project-prompt caching) | migration + edge fn | ✅ migration applied, fn deployed, table structurally correct (RLS on, service-role-only, ready) | ⏳ live: next `generate-project` should write a row + show `cache_read_tokens>0` on 2nd call |
| 2026-07-17 | (repo-only) | 0024 recovered | — | repo reconciliation | ✅ table 37/37 + 237 cols traced; 0024 committed | ✅ no schema regressions |
| 2026-07-17 | 803ef0a | 0027_living_family_record | — (none this release) | frontend | ✅ smoke 9/9, live commit asserted; first deploy carrying build stamp | ⚠️ see RLS-denial burst note |
| 2026-07-17 | 326e296 | 0027_living_family_record | ai (Reflection engine, earlier) | frontend | ✅ smoke 7/8 (pre-build-stamp); frontend caught up to backend after 75-commit gap | ⚠️ see RLS-denial burst note |

## Notes

- **2026-07-17 — release-workflow:** introduced this log, CI, deploy-preview
  boundary, build stamp, release-check + smoke-test. First release to carry a
  `build-info.json` deploy stamp.
- **2026-07-17 — frontend catch-up:** `sprint-1-security` (75 commits: Epics A & B,
  access-code redesign, LFM migration 0027, DIY/gender UI) fast-forwarded to `main`
  and deployed, resolving a split-brain where prod backend (migration 0027 + `ai`
  function) had been deployed ahead of the served frontend. The incident that
  motivated this workflow.
- **2026-07-17 — reconciliation:** migration `0024` recovered from prod and
  committed; repo↔prod schema alignment verified (37/37 tables, 237 columns traced).
  Stray duplicate Netlify site `incandescent-babka-30ebd3` deleted — single
  production target (`north-star-discovery` → northstar-family.com), previews intact.
  Added the `observed` release stage and the authoritative-repository rule.
- **Observed — RLS-denial burst (2026-07-17, ~30–40 min after the frontend deploy).**
  Postgres logs showed a cluster of ~40 `ERROR`s: RLS-policy denials on `children`,
  `projects`, `milestones`, `materials`, plus `preference_signals` FK violations —
  all in write-dependency order, i.e. one flow trying to persist a whole family
  dataset and being rejected at each step. **Not data loss:** no row landed (latest
  successful write to those tables is 2026-07-06 or earlier; the 3 existing families'
  data is intact). Diagnosis: the app's "seed sample data → sync" path ran under a
  session not authorised for the target family (most likely a fresh/logged-out load
  of the newly-deployed site) and RLS correctly denied every write. **Risk: none to
  data integrity.** Open question: confirm this was a test/fresh-session load and not
  a real onboarding flow silently failing to save — a client should not be attempting
  writes it isn't allowed to make. Tracked as a UX/robustness item, not a launch blocker.
- **Advisors (2026-07-17):** all pre-existing, none introduced by today's releases.
  `security_events` RLS-enabled-no-policy is deny-all-by-design (audit log). The
  SECURITY DEFINER `anon`-EXECUTE warnings on trigger functions (`apply_billing_entitlement`,
  `enforce_*`) are non-exploitable — they reference `NEW` and error outside trigger
  context. Genuine cheap hardening: enable Auth leaked-password protection. Perf lints
  (unindexed FKs, RLS initplan) are immaterial at beta scale. See
  [[north-star-phase0-security]].
