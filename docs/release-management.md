# Release Management

*How North Star ships without letting production drift. Small team, minimal
process — the goal is a clear release boundary and an observable production, not
bureaucracy.*

## Governing rule

**`main` is production.** A task is not done because it is built or committed.
For customer-facing or production-dependent work, **done** means the whole chain:

> built → tested → pushed → reviewed in preview (where appropriate) → merged to `main` → deployed → **verified live**

Use those words literally in engineering updates. Never say *shipped / complete /
done* unless the intended surfaces are deployed and verified — or say plainly that
the work is **intentionally dark / unreleased**.

## The three deployment surfaces

North Star deploys three surfaces *independently*. Most of our incidents come from
letting them drift apart.

| # | Surface | How it deploys | Reads from |
|---|---------|----------------|-----------|
| 1 | **Netlify frontend** | Auto-deploys on push to `main` (and builds a preview per PR) | git `main` |
| 2 | **Supabase migrations** | `apply_migration` (MCP) / `supabase db push` | your working code |
| 3 | **Supabase edge functions** | `supabase functions deploy <name>` | your working code |

The trap: surfaces **2 and 3 deploy from whatever code you have checked out**, with
no link to `main`. Surface **1 only ever serves `main`.** So deploying a migration
or function from an unmerged branch silently puts the backend ahead of the served
frontend. **That is the split-brain we are preventing.**

### Cardinal rule for backend

> **Never deploy a migration or edge function from code that is not on `main`.**
> Merge first, then deploy. `scripts/release-check.sh` enforces this.

## Standard flow

```
short-lived feature branch
  → push            (CI runs: syntax, deno check, migration lint, ahead-warning)
  → open PR         (Netlify posts a deploy-preview URL)
  → review preview  (for any customer-facing UX change)
  → merge to main   (frontend auto-deploys)
  → deploy backend  (run release-check.sh first — must say SAFE)
  → smoke-test.sh   (earns "verified live")
  → log it in docs/RELEASES.md
```

Keep branches short. If a branch passes ~15 commits ahead of `main` without a
reason, that's a smell — CI and the pre-push hook will warn.

## Per-release checklist

For every release, state:

- [ ] **Frontend deploy required?** (any change under `js/`, `styles/`, `*.html`)
- [ ] **Migration required?** (new file in `supabase/migrations/`)
- [ ] **Edge-function deploy required?** (change under `supabase/functions/`)
- [ ] **Order** — when both frontend and backend change, deploy the
      backwards-compatible side first so the two are never mutually incompatible:
      - *Additive migration* (new table/column, nothing removed): deploy **migration → function → frontend**. New backend is invisible to the old frontend, so order is safe.
      - *Breaking migration* (drops/renames the frontend still uses): make it **two releases** — first ship a frontend that tolerates both shapes, then migrate. Never drop a column the live frontend still reads.
- [ ] **Compatibility risk** — does the live frontend understand the new backend, and vice-versa?
- [ ] **Rollback plan** — migrations ship with a `_rollback.sql`; functions roll
      back by redeploying the previous commit; frontend rolls back via Netlify's
      "Publish previous deploy".
- [ ] **Live verification** — `scripts/smoke-test.sh` green, build stamp in
      Settings shows the merged commit.

## The tools

| Tool | When | What it does |
|------|------|--------------|
| `.github/workflows/ci.yml` | every PR / feature push | `node --check` all JS, `deno check` all functions, migration lint, branch-ahead warning |
| `scripts/release-check.sh` | **before any backend deploy** | STOPs unless HEAD is on `main`; reports live frontend commit vs `main` |
| `scripts/smoke-test.sh` | **after any frontend deploy** | production shell + modules + deploy stamp + Supabase reachability |
| `scripts/lint-migrations.mjs` | CI + ad-hoc | duplicate/orphan/gap detection on migrations |
| `scripts/gen-build-info.mjs` | Netlify build (automatic) | stamps `build-info.json` with the live commit |
| `scripts/install-hooks.sh` | once, per clone | installs the pre-push branch-ahead warning |
| Settings → About → **Build** | anytime | shows which commit is live, from `build-info.json` |
| `docs/RELEASES.md` | after each release | the human deployment log |

## Verifying production identity

Every deploy stamps `build-info.json` (via the Netlify build command). Confirm what's
live from either end:

- **In-app:** Settings → *About this MVP* → **Build** shows `commit · branch · deployed`.
- **CLI:** `curl -s https://northstar-family.com/build-info.json`
- **Assert a specific commit:** `EXPECT_SHA=<sha> ./scripts/smoke-test.sh`

## Known drift to reconcile

- **Migration `0024` is applied to prod but its `.sql` is not in the repo** (see
  memory: mobility_profile). `lint-migrations.mjs` flags the gap. Recover the SQL
  from the Supabase migration history and commit it so the repo is authoritative.
