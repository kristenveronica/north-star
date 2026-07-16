#!/usr/bin/env bash
# ============================================================================
# Quality check for the First Reflection engine (ai · family-reflection).
# Tests the REAL deployed function (real prompt, real key) — no drift.
#
# This is the crux of whether North Star's first unforgettable moment is
# authentic: a GENUINE input must yield a specific, non-Barnum observation, and
# a THIN or GENERIC input must yield NOTHING (sufficient:false). Silence on weak
# input is what makes the moment earned rather than generated.
#
# Run:
#   1. Sign in to North Star in your browser.
#   2. Copy your access token: DevTools → Application → Local Storage →
#      the supabase auth entry → "access_token".
#   3. NS_TOKEN=<paste> bash family-reflection-eval.sh
#
# Read the output by eye against the Observation Framework gold standard:
#   • Case A should feel like "…that's exactly us, and I hadn't said it that way."
#   • Cases B and C should return sufficient:false (no Barnum line forced).
# ============================================================================
set -euo pipefail

URL="https://dsioaopybvbfukouljej.supabase.co/functions/v1/ai"
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzaW9hb3B5YnZiZnVrb3VsamVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5OTQ4MTksImV4cCI6MjA5NzU3MDgxOX0.uAEgUzEX-2D7Jo4GDbsXNbogMFvWyFusRm_aXgzAjxo"
: "${NS_TOKEN:?Set NS_TOKEN to your signed-in access token (see header)}"

call () {
  local label="$1" payload="$2"
  echo "──────────────────────────────────────────────────────────"
  echo "▶ $label"
  curl -s "$URL" \
    -H "apikey: $ANON" \
    -H "Authorization: Bearer $NS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload" | (command -v jq >/dev/null && jq '.data // .' || cat)
  echo
}

# Case A — a rich, specific family. EXPECT sufficient:true + a through-line
# observation (not a restated fact, not a Barnum line).
call "A · rich input (expect a specific observation)" '{
  "action":"family-reflection",
  "payload":{
    "family":{"values":["perseverance","curiosity","togetherness"],"passions":["camping","building things","cooking together"]},
    "children":[
      {"name":"Noah","age":8,"passions":["Lego","taking apart gadgets","forts"],"howTheyLearn":"learns by doing and making; hates worksheets"},
      {"name":"Mia","age":5,"passions":["stories","drawing","dress-up"],"howTheyLearn":"turns everything into a story"}
    ],
    "freeform":"We are happiest outdoors doing things together. Noah is always building or taking something apart to see how it works. Mia turns everything into a story. We care most about them being curious and sticking with hard things."
  }
}'

# Case B — almost no signal. EXPECT sufficient:false (silence, not a guess).
call "B · thin input (expect sufficient:false)" '{
  "action":"family-reflection",
  "payload":{"children":[{"name":"Sam"}],"freeform":"Not sure really."}
}'

# Case C — only generic warmth (Barnum bait). EXPECT sufficient:false — the
# engine must refuse to dress "you love your kids" up as an insight.
call "C · generic input (expect sufficient:false — anti-Barnum)" '{
  "action":"family-reflection",
  "payload":{"family":{"values":["love","connection","kindness"]},"freeform":"We just really love our kids and want them to be happy and do their best."}
}'

echo "──────────────────────────────────────────────────────────"
echo "Judge by eye: A specific & true? B and C silent? That is the moment working."
