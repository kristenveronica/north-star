#!/usr/bin/env bash
# ============================================================
# smoke-test.sh — post-deploy production smoke test.
#
# Run this AFTER a frontend deploy to earn the "verified live" status. It
# checks that production actually serves the app, the critical modules load,
# the deploy stamp is present, and the Supabase backend is reachable. Fast,
# read-only, no secrets required.
#
#   ./scripts/smoke-test.sh                 # check https://northstar-family.com
#   EXPECT_SHA=<sha> ./scripts/smoke-test.sh  # also assert the live commit
# ============================================================
set -uo pipefail

PROD_URL="${PROD_URL:-https://northstar-family.com}"
SUPABASE_URL="${SUPABASE_URL:-https://dsioaopybvbfukouljej.supabase.co}"
EXPECT_SHA="${EXPECT_SHA:-}"

pass=0; fail=0
ok()   { printf "  \033[32m✓\033[0m %s\n" "$*"; pass=$((pass+1)); }
bad()  { printf "  \033[31m✗\033[0m %s\n" "$*"; fail=$((fail+1)); }
head_bold() { printf "\033[1m%s\033[0m\n" "$*"; }

code() { curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$1" 2>/dev/null || echo "000"; }

head_bold "── Smoke test: $PROD_URL ──────────────────────────────"

# 1. App shell + critical modules resolve (200).
for path in "/" "/index.html" "/js/app.js" "/js/lib/config.js" "/js/lib/supabase.js"; do
  c=$(code "$PROD_URL$path")
  [ "$c" = "200" ] && ok "GET $path → 200" || bad "GET $path → $c (expected 200)"
done

# 2. Deploy stamp present and parseable.
BI=$(curl -fsS --max-time 15 "$PROD_URL/build-info.json?cb=$(date +%s)" 2>/dev/null || echo "")
if [ -n "$BI" ]; then
  LIVE_SHA=$(printf '%s' "$BI" | grep -o '"commit"[^,]*' | head -1 | sed 's/.*: *"//;s/"//')
  LIVE_SHORT=$(printf '%s' "$BI" | grep -o '"commitShort"[^,]*' | head -1 | sed 's/.*: *"//;s/"//')
  ok "build-info.json present (live commit ${LIVE_SHORT:-?})"
  if [ -n "$EXPECT_SHA" ]; then
    if [ "$LIVE_SHA" = "$EXPECT_SHA" ] || [ "${LIVE_SHA:0:7}" = "${EXPECT_SHA:0:7}" ]; then
      ok "live commit matches expected ($EXPECT_SHA)"
    else
      bad "live commit $LIVE_SHORT != expected ${EXPECT_SHA:0:7} (deploy may still be building)"
    fi
  fi
else
  bad "build-info.json missing or unparseable"
fi

# 3. Supabase backend reachable. The REST root without an apikey returns 401 —
#    that's a *reachable* backend (a network/DNS failure gives 000).
c=$(code "$SUPABASE_URL/rest/v1/")
if [ "$c" = "401" ] || [ "$c" = "200" ] || [ "$c" = "404" ]; then
  ok "Supabase REST reachable ($c)"
else
  bad "Supabase REST unreachable ($c)"
fi

# 4. AI edge function reachable (unauthenticated → expect 401, not 000/5xx).
c=$(code "$SUPABASE_URL/functions/v1/ai")
if [ "$c" = "401" ] || [ "$c" = "400" ] || [ "$c" = "405" ]; then
  ok "ai edge function reachable ($c)"
else
  bad "ai edge function returned $c (expected 401/400/405)"
fi

echo
if [ "$fail" -eq 0 ]; then
  printf "\033[32m✓ SMOKE PASS\033[0m — %d checks green\n" "$pass"
  exit 0
else
  printf "\033[31m✗ SMOKE FAIL\033[0m — %d passed, %d failed\n" "$pass" "$fail"
  exit 1
fi
