/* ============================================================
   preferences.js — Aggregate the family learning loop into a compact
   summary the project generator can act on.

   Combines EXPLICIT signals (rejection reasons + notes) and IMPLICIT
   signals (accepted/regenerated/edited…) into a small object passed to
   generation: lean into what's preferred, avoid past rejection reasons.
   ============================================================ */

const topKeys = (counts, n) =>
  Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

export function summarizePreferences(state, childId = null) {
  const sigs = (state.preferenceSignals || []).filter(s => !childId || s.childId === childId);
  const byType = (t) => sigs.filter(s => s.type === t);
  const rejected = byType("rejected");
  const accepted = byType("accepted");

  const reasonCounts = {};
  rejected.forEach(s => (s.reasons || []).forEach(r => { reasonCounts[r] = (reasonCounts[r] || 0) + 1; }));

  const tally = (list, pick) => {
    const c = {};
    list.forEach(s => (pick(s) || []).forEach(v => { if (v) c[v] = (c[v] || 0) + 1; }));
    return c;
  };
  const preferredDomains = topKeys(tally(accepted, s => s.projectSnapshot?.domains), 5);
  const rejectedDomains = topKeys(tally(rejected, s => s.projectSnapshot?.domains), 5);

  return {
    counts: {
      accepted: accepted.length,
      rejected: rejected.length,
      regenerated: byType("regenerated").length,
      edited: byType("edited").length,
      completed: byType("completed").length,
    },
    topRejectionReasons: topKeys(reasonCounts, 5),
    preferredDomains,
    rejectedDomains,
    recentNotes: sigs.filter(s => s.note).slice(-3).map(s => s.note),
    // True once there's enough signal to lean on (keeps early generations neutral).
    hasSignal: sigs.length >= 2,
  };
}
