# Release Log

The deployment manifest for North Star. One row per production release. Append
newest at the top. See [release-management.md](release-management.md) for the
workflow. Fill `verified` only after `scripts/smoke-test.sh` is green.

| Date (UTC) | Frontend SHA | Latest migration | Edge fns deployed | Surfaces | Verified |
|------------|--------------|------------------|-------------------|----------|----------|
| 2026-07-17 | _pending merge of `chore/release-workflow`_ | 0027_living_family_record | — (none this release) | frontend | ⏳ after merge+deploy |
| 2026-07-17 | 326e296 | 0027_living_family_record | ai (Reflection engine, earlier) | frontend | ✅ smoke 7/8 (pre-build-stamp); frontend caught up to backend after 75-commit gap |

## Notes

- **2026-07-17 — release-workflow:** introduced this log, CI, deploy-preview
  boundary, build stamp, release-check + smoke-test. First release to carry a
  `build-info.json` deploy stamp.
- **2026-07-17 — frontend catch-up:** `sprint-1-security` (75 commits: Epics A & B,
  access-code redesign, LFM migration 0027, DIY/gender UI) fast-forwarded to `main`
  and deployed, resolving a split-brain where prod backend (migration 0027 + `ai`
  function) had been deployed ahead of the served frontend. The incident that
  motivated this workflow.
- **Open:** migration `0024` applied to prod but missing from repo — recover & commit.
