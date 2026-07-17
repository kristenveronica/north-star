#!/usr/bin/env node
/* ============================================================
   lint-migrations.mjs — cheap structural checks on the migration set.

   NOT a SQL validator (that needs a real Postgres). It catches the mistakes
   that actually bite a small team managing migrations by hand:
     • duplicate migration numbers (two people grabbed 00NN) — ERROR
     • a _rollback with no matching forward migration            — ERROR
     • a malformed filename that won't sort/apply predictably     — ERROR
     • gaps in the sequence (a migration that never got committed) — WARN

   Exit non-zero on any ERROR so CI blocks the PR. Warnings are printed but
   don't fail — we have one legitimate historical gap (0024).
   ============================================================ */

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

let files;
try {
  files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
} catch (e) {
  console.error(`[migrations] cannot read ${dir}: ${e.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];
const forward = new Map(); // number -> filename
const rollbacks = new Set();

const NAME_RE = /^(\d{4})_([a-z0-9_]+?)(_rollback)?\.sql$/;

for (const f of files) {
  const m = NAME_RE.exec(f);
  if (!m) {
    errors.push(`Malformed migration name: ${f} (expected 0000_snake_case[_rollback].sql)`);
    continue;
  }
  const num = m[1];
  const isRollback = !!m[3];
  if (isRollback) {
    rollbacks.add(num);
  } else if (forward.has(num)) {
    errors.push(`Duplicate migration number ${num}: ${forward.get(num)} and ${f}`);
  } else {
    forward.set(num, f);
  }
}

// Every rollback needs a forward migration to roll back.
for (const num of rollbacks) {
  if (!forward.has(num)) errors.push(`Rollback ${num}_*_rollback.sql has no matching forward migration`);
}

// Gaps in the sequence — a migration number that was skipped may mean a file
// was never committed (exactly the drift we're guarding against). Warn only.
const nums = [...forward.keys()].map(Number).sort((a, b) => a - b);
if (nums.length) {
  for (let n = nums[0]; n < nums[nums.length - 1]; n++) {
    if (!forward.has(String(n).padStart(4, "0"))) {
      warnings.push(`Gap in sequence: no migration ${String(n).padStart(4, "0")} (was it never committed?)`);
    }
  }
}

for (const w of warnings) console.warn(`  WARN  ${w}`);
for (const e of errors) console.error(`  ERROR ${e}`);

const forwardCount = forward.size;
console.log(
  `[migrations] ${forwardCount} forward, ${rollbacks.size} rollback · ${errors.length} error(s), ${warnings.length} warning(s)`,
);
if (nums.length) console.log(`[migrations] latest: ${forward.get(String(nums[nums.length - 1]).padStart(4, "0"))}`);

process.exit(errors.length ? 1 : 0);
