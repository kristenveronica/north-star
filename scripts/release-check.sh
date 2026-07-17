#!/usr/bin/env bash
# ============================================================
# release-check.sh — the pre-deploy gate. Run this BEFORE deploying any
# backend surface (a migration via apply_migration, or an edge function via
# `supabase functions deploy`) and before/after a frontend release.
#
# It exists because of one specific incident: backend was deployed from a
# branch that was 75 commits ahead of main, so production ran a stale frontend
# against a newer backend. The cardinal rule this enforces:
#
#     NEVER deploy a production surface from code that isn't on main.
#
# Read-only. Exits non-zero if it is NOT safe to deploy backend, so it can gate
# a script. Pass --allow-unmerged only for a deliberate, explained hotfix.
# ============================================================
set -euo pipefail

PROD_URL="${PROD_URL:-https://northstar-family.com}"
ALLOW_UNMERGED=0
[ "${1:-}" = "--allow-unmerged" ] && ALLOW_UNMERGED=1

red()   { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
bold()  { printf "\033[1m%s\033[0m\n" "$*"; }

bold "── North Star release check ──────────────────────────────"

git fetch origin main --quiet 2>/dev/null || yellow "  (could not fetch origin — using local refs)"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
HEAD_SHA=$(git rev-parse HEAD)
HEAD_SHORT=$(git rev-parse --short HEAD)
MAIN_SHA=$(git rev-parse origin/main 2>/dev/null || echo "unknown")

AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")

echo "  branch        : $BRANCH"
echo "  HEAD          : $HEAD_SHORT"
echo "  origin/main   : $(git rev-parse --short origin/main 2>/dev/null || echo unknown)"
echo "  ahead / behind: $AHEAD / $BEHIND"

# Is this exact commit already on main?  (safe to deploy backend from)
MERGED=0
if git merge-base --is-ancestor "$HEAD_SHA" origin/main 2>/dev/null; then
  MERGED=1
fi

# ---- Frontend: what is actually live? ------------------------------------
echo
bold "Frontend (production)"
LIVE_JSON=$(curl -fsS --max-time 10 "$PROD_URL/build-info.json?cb=$(date +%s)" 2>/dev/null || echo "")
if [ -n "$LIVE_JSON" ]; then
  LIVE_SHA=$(printf '%s' "$LIVE_JSON" | grep -o '"commit"[^,]*' | head -1 | sed 's/.*: *"//;s/"//')
  LIVE_SHORT=$(printf '%s' "$LIVE_JSON" | grep -o '"commitShort"[^,]*' | head -1 | sed 's/.*: *"//;s/"//')
  LIVE_AT=$(printf '%s' "$LIVE_JSON" | grep -o '"builtAt"[^,]*' | head -1 | sed 's/.*: *"//;s/"//')
  echo "  live commit   : ${LIVE_SHORT:-?}  (built $LIVE_AT)"
  if [ "$LIVE_SHA" = "$MAIN_SHA" ]; then
    green "  ✓ live frontend == origin/main"
  else
    yellow "  ! live frontend differs from origin/main"
    yellow "    live=$LIVE_SHORT  main=$(git rev-parse --short origin/main 2>/dev/null)"
    yellow "    → a Netlify deploy may be pending, or main has unreleased commits."
  fi
else
  yellow "  (no build-info.json live yet — deploy the frontend once to enable this check)"
fi

# ---- Backend deploy safety verdict ---------------------------------------
echo
bold "Backend deploy safety (migrations / edge functions)"
echo "  latest local migration: $(ls supabase/migrations/*.sql 2>/dev/null | grep -v _rollback | sort | tail -1 | xargs -n1 basename 2>/dev/null || echo none)"
echo "  edge functions        : $(ls -d supabase/functions/*/ 2>/dev/null | xargs -n1 basename | grep -v '^_' | paste -sd' ' -)"
echo
if [ "$MERGED" = "1" ]; then
  green "  ✓ SAFE — HEAD ($HEAD_SHORT) is on origin/main. Deploying backend keeps prod coherent."
  exit 0
elif [ "$ALLOW_UNMERGED" = "1" ]; then
  yellow "  ⚠ OVERRIDE — HEAD is NOT on main, but --allow-unmerged was passed."
  yellow "    Only valid for a deliberate hotfix. Log it in docs/RELEASES.md and merge to main ASAP."
  exit 0
else
  red "  ✗ STOP — HEAD ($HEAD_SHORT) is NOT on origin/main (ahead $AHEAD)."
  red "    Deploying a migration or edge function now would put backend ahead of the"
  red "    served frontend — the exact split-brain we are preventing."
  red "    Fix: open a PR, merge to main, THEN deploy. (Hotfix? re-run with --allow-unmerged.)"
  exit 1
fi
