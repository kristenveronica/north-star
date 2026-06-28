/* ============================================================
   pdf/content.js — turns project/child data into print-ready copy.

   Pure, dependency-light helpers shared by the section builders: human
   labels, duration, the "why this matters" framing, parent coaching notes,
   and the materials grouping (Already Have / Need to Get / Need to Borrow).
   Coaching notes are curated + personalised today; the function is the seam
   where an AI-generated version can slot in later without touching layout.
   ============================================================ */

import { domainDisplayName, domainShort } from "../../seed.js";

export const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "your child";

export function domainNames(project) {
  return (project.domains || []).map(d => domainDisplayName(d)).filter(Boolean);
}

// A friendly list: ["a", "b", "c"] → "a, b and c".
export function joinList(items) {
  const a = (items || []).filter(Boolean);
  if (a.length <= 1) return a[0] || "";
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
}

export function durationLabel(project) {
  if (project.durationDays) {
    const d = project.durationDays;
    if (d % 7 === 0) { const w = d / 7; return `${w} week${w === 1 ? "" : "s"}`; }
    return `${d} day${d === 1 ? "" : "s"}`;
  }
  if (project.startDate && project.dueDate) {
    const days = Math.max(1, Math.round((new Date(project.dueDate) - new Date(project.startDate)) / 86400000));
    if (days % 7 === 0) { const w = days / 7; return `${w} week${w === 1 ? "" : "s"}`; }
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  return "Flexible";
}

export function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch { return ""; }
}
export function fmtDateShort(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  } catch { return ""; }
}

// "Why this project matters" — woven from the child's passions, the capability
// domains it grows and its outcomes. Graceful when fields are sparse.
export function whyItMatters(project, child) {
  const name = firstName(child?.name);
  const doms = domainNames(project);
  const passion = (project.passionConnection || "").trim();
  const out = [];
  if (passion) {
    out.push(`This project meets ${name} where their curiosity already lives — ${passion} — and turns it into real, lasting growth.`);
  } else {
    out.push(`This project is designed around who ${name} is right now, turning genuine interest into real, lasting growth.`);
  }
  if (doms.length) {
    out.push(`Along the way ${name} strengthens ${joinList(doms.slice(0, 3))}${doms.length > 3 ? " and more" : ""} — not as isolated subjects, but as capabilities they can carry into the rest of life.`);
  }
  out.push("Because the learning is hands-on and purposeful, it tends to stick: ideas are discovered, applied and reflected on, rather than simply memorised.");
  return out.join(" ");
}

// Parent coaching notes — concrete, encouraging, lightly tailored to the
// project. (Swap this for an AI call later; the shape stays the same.)
export function coachingNotes(project, child) {
  const name = firstName(child?.name);
  const doms = domainNames(project);
  const notes = [
    `Let ${name} make mistakes before stepping in — the productive struggle is where the learning happens. Offer a hint, not the answer.`,
    `Encourage curiosity instead of giving answers. A simple "What do you think?" or "How could we find out?" keeps ${name} in the driver's seat.`,
    `Notice confidence and effort rather than perfection. Name what you see: "You kept going when that got tricky."`,
    `Follow ${name}'s pace. If a milestone needs an extra day, take it — depth matters more than speed.`,
  ];
  if (doms.length) {
    notes.push(`Watch for moments of growth in ${joinList(doms.slice(0, 2))}. Jot down anything surprising — it's gold for ${name}'s reflections and reports.`);
  }
  notes.push(`Celebrate the finish. Completing something they're proud of builds the identity of someone who follows through.`);
  return notes;
}

// A statement of who the child became through the project — for the certificate.
export function certificateStatement(project, child) {
  const name = firstName(child?.name);
  const doms = domainNames(project);
  const outcomes = (project.learningOutcomes || []).slice(0, 2);
  let s = `For seeing "${project.title}" through from start to finish`;
  if (doms.length) s += `, and growing in ${joinList(doms.slice(0, 3))}`;
  s += ".";
  if (outcomes.length) {
    s += ` Along the way, ${name} learned to ${joinList(outcomes.map(o => o.charAt(0).toLowerCase() + o.slice(1)))}.`;
  }
  s += ` Most of all, ${name} showed what it means to be curious, capable and someone who finishes what they start.`;
  return s;
}

/* ---- Identity-first language for the redesigned certificate ---- */
// Map a project's leading capability domain to the "person they became".
const ROLE_BY_DOMAIN = {
  literacy: "communicator", maths: "problem-solver", science: "investigator",
  creativity: "maker", music: "performer", digital: "creator", practical: "contributor",
  enterprise: "entrepreneur", health: "carer", sport: "athlete",
  relationships: "friend", leadership: "leader", nature: "steward",
  faith: "soul", travel: "explorer",
};
const TRAITS_BY_DOMAIN = {
  practical:     ["capable", "confident", "helpful"],
  creativity:    ["imaginative", "expressive", "bold"],
  science:       ["curious", "careful", "inventive"],
  maths:         ["logical", "persistent", "precise"],
  literacy:      ["thoughtful", "articulate", "curious"],
  enterprise:    ["resourceful", "determined", "bold"],
  leadership:    ["responsible", "courageous", "caring"],
  sport:         ["determined", "disciplined", "resilient"],
  nature:        ["observant", "caring", "responsible"],
  health:        ["caring", "mindful", "responsible"],
  music:         ["expressive", "dedicated", "confident"],
  digital:       ["inventive", "careful", "creative"],
  relationships: ["kind", "thoughtful", "brave"],
  leadership_:   ["responsible", "courageous", "caring"],
  default:       ["capable", "confident", "curious"],
};

// ONE powerful, identity-affirming line — celebrates WHO the child became,
// never "participation". e.g. ‘Jetty completed "The Little Kitchen Keeper" and
// grew as a capable, confident and helpful contributor.’
export function certAffirmation(project, child) {
  const name = firstName(child?.name);
  const primary = (project.capabilityMap?.primary?.[0]) || (project.domains || [])[0] || "default";
  const role = ROLE_BY_DOMAIN[primary] || "young person";
  const traits = TRAITS_BY_DOMAIN[primary] || TRAITS_BY_DOMAIN.default;
  const art = /^[aeiou]/i.test(traits[0]) ? "an" : "a";
  return `${name} completed “${project.title}” and grew as ${art} ${traits[0]}, ${traits[1]} and ${traits[2]} ${role}.`;
}

// A short, warm parent affirmation the parent can keep, edit, or replace.
// (Local generator — labelled as North Star; an AI version can slot in later.)
const PARENT_MESSAGES = [
  "We're so proud of how hard you worked on this.",
  "We loved watching your confidence grow.",
  "We're proud of your determination from start to finish.",
  "We noticed how carefully you kept going, even when it was tricky.",
  "We love the person you're becoming.",
  "Watching you see this through made us so proud.",
];
export function suggestParentMessage(project, child) {
  const i = Math.floor(Math.random() * PARENT_MESSAGES.length);
  return PARENT_MESSAGES[i];
}

// A tight overview for the Quick Summary (1–2 sentences).
export function quickOverview(project, child) {
  const desc = (project.description || "").trim();
  if (desc) {
    const cut = desc.length > 300 ? desc.slice(0, 297).replace(/\s+\S*$/, "") + "…" : desc;
    return cut;
  }
  // Fall back to the first sentence of the "why it matters" framing.
  return whyItMatters(project, child).split(". ")[0].replace(/\.?$/, ".");
}

// The inviting cover lede — prefer the child-facing description (speaks TO the
// child), then the AI "why this fits", then the woven "why it matters".
export function coverLede(project, child) {
  const childFacing = (project.childDescription || "").trim();
  if (childFacing) return childFacing;
  const purpose = (project.purpose || "").trim();
  if (purpose) return purpose;
  return whyItMatters(project, child);
}

// Group a project's materials into checklist buckets using any ownership
// signal we have (resource records + family inventory). Best-effort: anything
// we can't classify defaults to "Need to Get".
export function groupMaterials(project, state) {
  const mats = (project.materials || [])
    .map(m => (typeof m === "string" ? { name: m } : m))
    .filter(m => (m?.name || "").trim());
  const have = [], get = [], borrow = [];
  const records = (state?.materials || []);
  const inventory = (state?.inventory || []);
  const norm = (s) => String(s || "").trim().toLowerCase();

  for (const m of mats) {
    const n = norm(m.name);
    const rec = records.find(r => norm(r.name) === n);
    const owned = inventory.some(it => norm(it.name) === n) ||
      (rec && (rec.status === "owned" || rec.status === "approved"));
    if (m.status === "owned" || owned) have.push(m.name);
    else if (m.status === "borrow" || rec?.status === "borrow") borrow.push(m.name);
    else get.push(m.name);
  }
  return { have, get, borrow };
}

export { domainShort };
