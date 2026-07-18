/* Unit tests for the server-side GenerationContext assembly
   (supabase/functions/_shared/generationContext.js). Pure → `node --test`.
   Isolation / unauthorized / distillation-after-decision / e2e are covered live
   in the edge deploy + the live verification run. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGenerationContext, renderContextBlocks } from "../supabase/functions/_shared/generationContext.js";

const NOW = "2026-07-18T00:00:00.000Z";
const u = (o) => ({ statement: "s", status: "emerging", provenance: "inferred", family_verdict: null, excluded_from_ai: false, metadata: {}, ...o });

/* ---------- no Understanding → sparse fallback ---------- */
test("no Understanding: empty block (falls back to child/family data)", () => {
  const ctx = buildGenerationContext({ understandings: [], recentProjects: [], nowIso: NOW });
  assert.equal(ctx.hasUnderstanding, false);
  const { understandingBlock } = renderContextBlocks(ctx, "Ada");
  assert.equal(understandingBlock, "");
});

/* ---------- one inferred interest → gentle nudge, provisional ---------- */
test("one inferred interest: surfaced as a GENTLE nudge, never a fact", () => {
  const ctx = buildGenerationContext({
    understandings: [u({ domain: "interest", provenance: "inferred", statement: "Shows repeated interest in science", metadata: { interestDomain: "science" } })],
    recentProjects: [], nowIso: NOW,
  });
  assert.deepEqual(ctx.inferredInterests, ["science"]);
  assert.equal(ctx.confirmed.length, 0);
  const { understandingBlock } = renderContextBlocks(ctx, "Ada");
  assert.match(understandingBlock, /GENTLE nudge/);
  assert.match(understandingBlock, /provisional/i);
  assert.match(understandingBlock, /breadth, novelty/);      // requirement #6 — don't overfit
  assert.doesNotMatch(understandingBlock, /rely on these/);  // inference is never presented as fact
});

/* ---------- confirmed Understanding → rely on ---------- */
test("confirmed Understanding: presented as rely-on, in its own section", () => {
  const ctx = buildGenerationContext({
    understandings: [u({ domain: "value", provenance: "confirmed", statement: "Values perseverance" })],
    recentProjects: [], nowIso: NOW,
  });
  assert.deepEqual(ctx.confirmed, ["Values perseverance"]);
  const { understandingBlock } = renderContextBlocks(ctx, "Ada");
  assert.match(understandingBlock, /rely on these.*Values perseverance/);
});

/* ---------- confirmed outweighs inference (both present, ranked) ---------- */
test("confirmed outranks inferred: strong section separate from gentle section", () => {
  const ctx = buildGenerationContext({
    understandings: [
      u({ domain: "interest", provenance: "confirmed", statement: "Loves horses" }),
      u({ domain: "interest", provenance: "inferred", statement: "Shows repeated interest in science", metadata: { interestDomain: "science" } }),
    ], recentProjects: [], nowIso: NOW,
  });
  assert.deepEqual(ctx.confirmed, ["Loves horses"]);         // strong
  assert.deepEqual(ctx.inferredInterests, ["science"]);      // gentle
});

/* ---------- active temporary circumstance changes the brief ---------- */
test("active circumstance: injects a concrete constraint into the brief", () => {
  const ctx = buildGenerationContext({
    understandings: [u({ domain: "circumstance", provenance: "declared", status: "established", statement: "Broken wrist", review_at: "2026-08-15T00:00:00Z", metadata: { momentKind: "injury" } })],
    recentProjects: [], nowIso: NOW,
  });
  assert.equal(ctx.circumstances.length, 1);
  assert.match(ctx.circumstances[0].constraint, /two hands|physical/);
  const { understandingBlock } = renderContextBlocks(ctx, "Ada");
  assert.match(understandingBlock, /design AROUND these/);
  assert.match(understandingBlock, /Broken wrist/);
});

/* ---------- expired circumstance is ignored ---------- */
test("expired circumstance (review_at in the past): dropped entirely", () => {
  const ctx = buildGenerationContext({
    understandings: [u({ domain: "circumstance", provenance: "declared", statement: "Broken wrist", review_at: "2026-07-01T00:00:00Z", metadata: { momentKind: "injury" } })],
    recentProjects: [], nowIso: NOW,   // NOW is 2026-07-18, review was 07-01
  });
  assert.equal(ctx.circumstances.length, 0);
  assert.equal(ctx.hasUnderstanding, false);
});

/* ---------- contradicted / excluded / corrected are ignored ---------- */
test("contradicted, excluded, and corrected beliefs never reach the context", () => {
  const ctx = buildGenerationContext({
    understandings: [
      u({ domain: "interest", provenance: "inferred", status: "contradicted", metadata: { interestDomain: "history" } }),
      u({ domain: "interest", provenance: "inferred", excluded_from_ai: true, metadata: { interestDomain: "music" } }),
      u({ domain: "interest", provenance: "inferred", family_verdict: "incorrect", metadata: { interestDomain: "art" } }),
      u({ domain: "interest", provenance: "inferred", family_verdict: "no_longer_true", metadata: { interestDomain: "sport" } }),
    ], recentProjects: [], nowIso: NOW,
  });
  assert.deepEqual(ctx.inferredInterests, []);
  assert.equal(ctx.hasUnderstanding, false);
});

/* ---------- interests influence but do not dominate ---------- */
test("interest framing preserves breadth/novelty/challenge (does not overfit)", () => {
  const ctx = buildGenerationContext({
    understandings: [u({ domain: "interest", provenance: "inferred", metadata: { interestDomain: "science" } })],
    recentProjects: [], nowIso: NOW,
  });
  const { understandingBlock } = renderContextBlocks(ctx, "Ada");
  assert.match(understandingBlock, /never as an identity or a cage/);
  assert.match(understandingBlock, /stretch/);
});

/* ---------- domain balance + avoid titles ---------- */
test("recent projects → domain balance (top 3) + titles to avoid", () => {
  const ctx = buildGenerationContext({
    understandings: [],
    recentProjects: [
      { domains: ["science", "digital"], title: "Robot Lab" },
      { domains: ["science"], title: "Volcano" },
      { domains: ["art"], title: "Mural" },
    ], nowIso: NOW,
  });
  assert.equal(ctx.recentDomains[0], "science");     // most frequent first
  assert.deepEqual(ctx.recentTitles, ["Robot Lab", "Volcano", "Mural"]);
  const { balanceLine } = renderContextBlocks(ctx, "Ada");
  assert.match(balanceLine, /leaned on science/);
});

/* ---------- rhythm capacity ---------- */
test("rhythm setting → weekly capacity line", () => {
  const ctx = buildGenerationContext({ understandings: [], recentProjects: [], rhythm: { daysPerWeek: 3, hoursPerDay: 2 }, nowIso: NOW });
  assert.equal(ctx.rhythmCapacity.weeklyHours, 6);
  const { understandingBlock } = renderContextBlocks(ctx, "Ada");
  assert.match(understandingBlock, /about 6h\/week across 3/);
});
