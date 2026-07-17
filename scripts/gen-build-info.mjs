#!/usr/bin/env node
/* ============================================================
   gen-build-info.mjs — stamp the deployed frontend with its identity.

   Runs as the Netlify [build] command (see netlify.toml). It writes
   build-info.json to the site root so the live app can fetch it and show
   exactly which commit is serving (Settings → "About this MVP"), and so
   the smoke test can confirm production is serving the commit we merged.

   Best-effort by contract: this must NEVER throw, because a metadata hiccup
   must never fail a production deploy. On Netlify the values come from the
   build environment (COMMIT_REF, BRANCH, CONTEXT…); run locally it falls
   back to git so `node scripts/gen-build-info.mjs` still produces a sane file.
   build-info.json is gitignored — it is generated per deploy, never committed.
   ============================================================ */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const git = (args) => {
  try {
    return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
};

const env = process.env;
const commit = env.COMMIT_REF || git("rev-parse HEAD") || "unknown";

const info = {
  commit,
  commitShort: commit === "unknown" ? "unknown" : commit.slice(0, 7),
  branch: env.BRANCH || git("rev-parse --abbrev-ref HEAD") || "unknown",
  // production | deploy-preview | branch-deploy | local
  context: env.CONTEXT || "local",
  deployId: env.DEPLOY_ID || null,
  deployUrl: env.DEPLOY_PRIME_URL || env.URL || null,
  builtAt: new Date().toISOString(),
};

try {
  const out = new URL("../build-info.json", import.meta.url);
  writeFileSync(out, JSON.stringify(info, null, 2) + "\n");
  console.log(`[build-info] ${info.context} ${info.commitShort} @ ${info.builtAt}`);
} catch (e) {
  // Never fail the deploy over build metadata.
  console.error("[build-info] write failed (non-fatal):", e && e.message);
}
