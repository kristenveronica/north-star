/* ============================================================================
   GenerationContext — the server-side context for Project Generation v2.

   PURE functions (no imports) so they run in the Deno edge function AND under
   `node --test`. The edge function fetches canonical rows (understandings,
   recent projects, rhythm) via the service-role client, then calls these.

   Design (docs/project-generation-v2.md), narrow to what materially improves a
   generated project:
     • provenance-aware Understanding — declared/confirmed rely-on; inferred is a
       GENTLE nudge only (never a fact, never an identity, never overfit);
     • active temporary circumstances that must reshape the brief (injury/travel/…);
     • current rhythm capacity (scope & prep burden);
     • recent-domain balance + titles to avoid repetition.

   It NEVER lets an inference masquerade as a fact, and drops anything the parent
   corrected/excluded or that has expired.
   ============================================================================ */

// Circumstance kind → a concrete generation constraint (materially affects the brief).
const CIRCUMSTANCE_CONSTRAINT = {
  injury:  "avoid tasks needing two hands or heavy physical effort; keep it low-strain",
  travel:  "prefer portable or place-based learning; minimal special materials or setup",
  move:    "keep it self-contained and low-setup; the home base is unsettled",
  capacity:"reduce complexity and preparation burden; fewer moving parts",
  illness: "keep it gentle and low-energy; short sessions",
};

const isExpired = (reviewAt, now) => !!reviewAt && new Date(reviewAt).getTime() < now;

/**
 * buildGenerationContext — turn canonical rows into a structured context.
 * @param understandings  rows from `understandings` (already family+subject scoped by the caller)
 * @param recentProjects  recent project rows for this child: [{domains:[], title, status}]
 * @param rhythm          family rhythm setting: {daysPerWeek, hoursPerDay}
 * @param nowIso          ISO timestamp (injected for testability)
 */
export function buildGenerationContext({ understandings = [], recentProjects = [], rhythm = null, nowIso } = {}) {
  const now = nowIso ? new Date(nowIso).getTime() : 0;

  // Usable = active, not suppressed, not corrected, not expired. This is the single
  // gate that enforces provenance requirement #4 (ignore incorrect/no-longer-true/
  // expired/excluded) — nothing filtered here can ever reach the prompt.
  const usable = understandings.filter((u) => {
    if (!u || !u.statement) return false;
    if (u.excluded_from_ai) return false;
    if (["retired", "contradicted"].includes(u.status)) return false;
    if (["no_longer_true", "incorrect"].includes(u.family_verdict || "")) return false;
    if (u.domain === "circumstance" && isExpired(u.review_at, now)) return false;  // expired → ignored
    return true;
  });

  const strong = (u) => u.provenance === "declared" || u.provenance === "confirmed";

  // Declared/confirmed beliefs to rely on (excluding circumstances, handled separately).
  const confirmed = usable
    .filter((u) => u.domain !== "circumstance" && strong(u))
    .map((u) => u.statement);

  // Inferred interests → a gentle nudge. We surface the domain, not a confident claim.
  const inferredInterests = usable
    .filter((u) => u.domain === "interest" && !strong(u))
    .map((u) => (u.metadata && u.metadata.interestDomain) || u.statement);

  // Active temporary circumstances → hard constraints on the brief.
  const circumstances = usable
    .filter((u) => u.domain === "circumstance")
    .map((u) => {
      const kind = u.metadata && u.metadata.momentKind;
      return {
        statement: u.statement,
        constraint: (kind && CIRCUMSTANCE_CONSTRAINT[kind]) || null,
        reviewAt: u.review_at || null,
      };
    });

  // Recent-domain balance + titles to avoid.
  const domainCounts = {};
  const recentTitles = [];
  for (const p of recentProjects) {
    (p.domains || []).forEach((d) => { if (d) domainCounts[d] = (domainCounts[d] || 0) + 1; });
    if (p.title) recentTitles.push(p.title);
  }
  const recentDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => d);

  let rhythmCapacity = null;
  if (rhythm && (rhythm.daysPerWeek || rhythm.hoursPerDay)) {
    const days = Number(rhythm.daysPerWeek) || 0;
    const hours = Number(rhythm.hoursPerDay) || 0;
    const weekly = Math.round(days * hours * 10) / 10;
    rhythmCapacity = { days, hoursPerDay: hours, weeklyHours: weekly };
  }

  return {
    confirmed,            // strong — rely on
    inferredInterests,    // gentle nudge — provisional
    circumstances,        // temporary — reshape the brief
    recentDomains,        // for gentle balance
    recentTitles,         // avoid repetition
    rhythmCapacity,       // scope & prep burden
    hasUnderstanding: confirmed.length > 0 || inferredInterests.length > 0 || circumstances.length > 0,
  };
}

/**
 * renderContextBlocks — turn the structured context into prompt text.
 * Returns { understandingBlock, balanceLine, hasUnderstanding }. When there is
 * nothing to say, understandingBlock is "" — generation falls back to the
 * declared child/family data already in the prompt (the sparse-data path).
 */
export function renderContextBlocks(ctx, childName = "this child") {
  const lines = [];
  if (ctx.confirmed.length) {
    lines.push(`- Confirmed / told directly (rely on these): ${ctx.confirmed.join("; ")}`);
  }
  if (ctx.inferredInterests.length) {
    lines.push(
      `- Emerging interests — a GENTLE nudge only (provisional and low-confidence; a parent may have accepted past projects because they were merely good enough, not proof of a lasting interest). Use these for RELEVANCE, never as an identity or a cage: ${ctx.inferredInterests.join(", ")}. Still bring breadth, novelty, a real stretch, and any growth goals and family values named above.`
    );
  }
  if (ctx.circumstances.length) {
    const parts = ctx.circumstances.map((c) => {
      const review = c.reviewAt ? ` (until ~${String(c.reviewAt).slice(0, 10)})` : "";
      return c.constraint ? `${c.statement} → ${c.constraint}${review}` : `${c.statement}${review}`;
    });
    lines.push(`- Right now, temporary — design AROUND these; they will pass: ${parts.join("; ")}`);
  }
  if (ctx.rhythmCapacity && ctx.rhythmCapacity.weeklyHours) {
    lines.push(`- Current weekly capacity — keep scope and preparation burden within this: about ${ctx.rhythmCapacity.weeklyHours}h/week across ${ctx.rhythmCapacity.days} day(s)`);
  }

  const understandingBlock = lines.length
    ? `WHAT NORTH STAR REMEMBERS ABOUT ${childName} (from this family's real history — let the project quietly show it remembered, without boxing ${childName} in):\n${lines.join("\n")}`
    : "";

  const balanceLine = ctx.recentDomains.length
    ? `QUIET CAPABILITY BALANCE: this child's recent projects have leaned on ${ctx.recentDomains.join(", ")}. Without ever overriding the child's interest, if it fits naturally, gently weave in a capability area that's been lighter lately. Interest is the doorway; balance is woven through — never forced.`
    : "";

  return { understandingBlock, balanceLine, hasUnderstanding: ctx.hasUnderstanding };
}
