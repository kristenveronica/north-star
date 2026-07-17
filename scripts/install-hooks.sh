#!/usr/bin/env bash
# Install North Star's local git hooks (symlinks, so they track the repo copy).
set -euo pipefail
cd "$(dirname "$0")/.."
ln -sf ../../scripts/hooks/pre-push .git/hooks/pre-push
chmod +x scripts/hooks/pre-push
echo "✓ Installed pre-push hook (branch-ahead warning)."
