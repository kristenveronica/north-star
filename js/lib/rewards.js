/* ============================================================
   rewards.js — Reward intelligence.

   North Star always encourages a HEALTHY BALANCE of reward types —
   experience, purchase and contribution — never only purchases.
   Purchase rewards can unlock capability domains (a toolbox unlocks
   practical/creativity), which the project generator uses to escalate
   future projects. Contribution rewards reinforce the family's values.
   ============================================================ */

import { REWARDS, REWARD_TYPES } from "./resourceCatalog.js";

const REWARD_TYPE_META = {
  experience: { label: "Experience", blurb: "Adventures and outings that grow capability and memory.", icon: "🎟️" },
  purchase: { label: "Purchase", blurb: "Tools and kit — many unlock whole new capabilities.", icon: "🎁" },
  contribution: { label: "Contribution", blurb: "Choosing service over payment — generosity and values.", icon: "💛" },
};
export { REWARD_TYPE_META };

function scoreReward(rw, childDomains) {
  if (!rw.domains.length) return 0.5;
  return rw.domains.filter((d) => childDomains.has(d)).length;
}

// A balanced set of reward ideas for a child, grouped by type. Honours faith
// setting and leans toward the child's active capability domains.
export function suggestRewards(state, child, perType = 3) {
  const fam = state.family || {};
  const faithOn = !!(child?.faithEnabled || fam.faithEnabled);
  const childDomains = new Set(child?.domains || []);
  (state.projects || [])
    .filter((p) => p.childId === child?.id && p.status !== "completed")
    .forEach((p) => (p.domains || []).forEach((d) => childDomains.add(d)));

  const eligible = REWARDS.filter((rw) => !(rw.faith === true && !faithOn));
  const byType = {};
  REWARD_TYPES.forEach((t) => {
    byType[t] = eligible
      .filter((rw) => rw.type === t)
      .map((rw) => ({ ...rw, _score: scoreReward(rw, childDomains) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, perType);
  });
  return byType;
}
