/* ============================================================
   resources.js — The Learning Resources engine.

   The intelligence layer that connects Learning Resources to the rest
   of the platform. It is a PURE read over state: given the family,
   children, projects and any stored resource records, it derives the
   five Learning Resources sections dynamically and keeps them in sync
   as projects, profiles and settings change.

   Stored resource records (state.materials) carry status + metadata.
   Catalog/derived items are merged with any matching stored record so
   ownership decisions ("approved", "I already have", "dismissed")
   persist and the page updates immediately.
   ============================================================ */

import { ageOf } from "../store.js";
import {
  ESSENTIALS, TOOLS, PRINTABLES, CHARACTER, SUPPLIERS, ageBand, countryCodeOf, COUNTRY_LABELS,
} from "./resourceCatalog.js";

/* The family's country code (from Family Settings location), used to prioritise
   local suppliers. Null when no location/country is set. */
export function familyCountry(state) {
  return countryCodeOf(state.family?.location?.country);
}

// Which age bands are present across the family's children.
function familyAgeBands(state) {
  return new Set((state.children || []).map((c) => ageBand(ageOf(c))).filter(Boolean));
}

/* ---------- keys + normalisation ---------- */

const lc = (s) => String(s || "").trim().toLowerCase();

// A stable key for matching a derived item to a stored record.
export function resourceKey({ section, catalogId, name }) {
  if (catalogId) return `cat::${catalogId}`;
  return `${section || "personalised"}::${lc(name)}`;
}

// Stored material/resource record → its key.
function recordKey(m) {
  return resourceKey({ section: m.section, catalogId: m.meta?.catalogId, name: m.name });
}

// Map a project material `source` to kind (diy vs ready-made).
function sourceToKind(source) {
  return ["build", "repurpose", "create"].includes(source) ? "diy" : "ready";
}

// Index stored records by key for fast merge.
function recordIndex(state) {
  const idx = new Map();
  (state.materials || []).forEach((m) => idx.set(recordKey(m), m));
  return idx;
}

// Merge a derived/catalog item with any stored record (status + ids win from record).
function mergeRecord(item, record) {
  if (!record) return { ...item, recordId: null, status: item.status || "suggested" };
  return {
    ...item,
    recordId: record.id,
    status: record.status || (record.approved ? "approved" : record.rejected ? "dismissed" : "suggested"),
    estimatedPrice: record.estimatedPrice ?? item.estimatedPrice,
    reasonSuggested: record.reasonSuggested || item.reasonSuggested,
    inCart: !!record.inCart,
  };
}

/* ---------- resource intelligence: what the family already has ---------- */

// Names (lowercased) the family has approved, purchased or marked owned —
// used to avoid re-suggesting resources they already have.
export function ownedResourceKeys(state) {
  const owned = new Set();
  (state.materials || []).forEach((m) => {
    const status = m.status || (m.approved ? "approved" : "");
    if (["approved", "owned"].includes(status) || m.approved || m.meta?.purchased) {
      owned.add(lc(m.name));
    }
  });
  return owned;
}

const isResolved = (status) => ["owned", "self-source", "dismissed", "borrow", "save"].includes(status);

/* ---------- 1. Learning Space Essentials ---------- */

export function buildEssentials(state) {
  const idx = recordIndex(state);
  const bands = familyAgeBands(state);
  // Tools sit inside Essentials, gated by the children's ages + parent approval.
  const catalog = [...ESSENTIALS, ...TOOLS];
  return catalog
    // Age-gated items only appear if a child is in an eligible band (or ages unknown).
    .filter((e) => !e.ageBands || !bands.size || e.ageBands.some((b) => bands.has(b)))
    .map((e) => mergeRecord({
      key: resourceKey({ catalogId: e.catalogId }),
      section: "essentials",
      catalogId: e.catalogId,
      name: e.name,
      category: e.category,
      description: e.description,
      reasonSuggested: e.category === "Tools"
        ? "Grows with your child's practical capability."
        : "Part of a well-equipped learning environment.",
      estimatedPrice: e.estimatedPrice,
      ageRange: e.ageBands ? e.ageBands.join(", ") : "all",
      kind: "ready",
      recommendation: "ready",
      format: "physical",
      frequency: e.frequency,
      capabilityDomains: e.capabilityDomains || [],
      unlocks: e.unlocks || [],
      requiresApproval: !!e.requiresApproval,
      projectIds: [],
      projectTitles: [],
      affiliateAvailable: true,
      forChildId: null,
      status: "suggested",
    }, idx.get(resourceKey({ catalogId: e.catalogId }))));
}

/* ---------- 2. Current Project Resources (live from active projects) ---------- */

export function buildProjectResources(state) {
  const idx = recordIndex(state);
  const active = (state.projects || []).filter((p) => p.status && p.status !== "completed");
  const byName = new Map(); // name(lc) → aggregated derived item

  active.forEach((p) => {
    (p.materials || []).forEach((mat) => {
      const name = mat.name || mat;
      if (!name) return;
      const k = lc(name);
      const kind = mat.source ? sourceToKind(mat.source) : (mat.buyOrDIY === "diy" ? "diy" : "ready");
      if (byName.has(k)) {
        const existing = byName.get(k);
        if (!existing.projectIds.includes(p.id)) {
          existing.projectIds.push(p.id);
          existing.projectTitles.push(p.title || "Untitled project");
        }
      } else {
        byName.set(k, {
          key: resourceKey({ section: "project", name }),
          section: "project",
          name,
          category: "Project resource",
          description: mat.reasonSuggested || `Needed for ${p.title || "an active project"}.`,
          reasonSuggested: mat.reasonSuggested || `Required by ${p.title || "an active project"}.`,
          estimatedPrice: mat.estimatedPrice ?? 0,
          ageRange: "",
          kind: mat.format === "printable" ? "diy" : kind,
          recommendation: (mat.format === "printable" || kind === "diy") ? "diy" : "ready",
          format: mat.format === "printable" ? "printable" : "physical",
          frequency: mat.frequency || "occasional",
          capabilityDomains: Array.isArray(mat.capabilityDomains) && mat.capabilityDomains.length
            ? mat.capabilityDomains
            : (Array.isArray(p.domains) ? p.domains : []),
          projectIds: [p.id],
          projectTitles: [p.title || "Untitled project"],
          affiliateAvailable: kind === "ready",
          forChildId: p.childId || null,
          status: "suggested",
        });
      }
    });
  });

  return Array.from(byName.values()).map((item) => mergeRecord(item, idx.get(item.key)));
}

// How many active-project resources still need a decision (drives the notification).
export function newProjectResourceCount(state) {
  return buildProjectResources(state).filter((r) => r.status === "suggested").length;
}

/* ---------- 3. Personalised Learning Recommendations ---------- */

// Stored per-child recommendations (heuristic today, AI-enriched over time),
// minus anything the family has resolved (owned / dismissed / self-sourcing).
export function buildPersonalised(state) {
  return (state.materials || [])
    .filter((m) => (m.section || "personalised") === "personalised")
    .filter((m) => !isResolved(m.status))
    .map((m) => ({
      key: recordKey(m),
      recordId: m.id,
      section: "personalised",
      name: m.name,
      category: m.category || "",
      description: m.description || "",
      reasonSuggested: m.reasonSuggested || "",
      estimatedPrice: m.estimatedPrice ?? 0,
      ageRange: m.ageRange || "",
      kind: m.buyOrDIY === "diy" ? "diy" : "ready",
      format: m.meta?.format || "physical",
      frequency: m.meta?.frequency || "occasional",
      capabilityDomains: m.meta?.capabilityDomains || [],
      projectIds: m.meta?.projectIds || [],
      projectTitles: [],
      affiliateAvailable: m.meta?.affiliateAvailable ?? (m.buyOrDIY !== "diy"),
      forChildId: m.forChildId || null,
      status: m.status || (m.approved ? "approved" : "suggested"),
      inCart: !!m.inCart,
    }));
}

/* ---------- 4. Printable Resources (generatable) ---------- */

export function buildPrintables(state) {
  const idx = recordIndex(state);
  const bands = new Set((state.children || []).map((c) => ageBand(ageOf(c))).filter(Boolean));
  // Capability domains the family is actively pursuing (across children + active projects).
  const activeDomains = new Set();
  (state.children || []).forEach((c) => (c.domains || []).forEach((d) => activeDomains.add(d)));
  (state.projects || []).filter((p) => p.status !== "completed")
    .forEach((p) => (p.domains || []).forEach((d) => activeDomains.add(d)));

  return PRINTABLES
    .filter((pr) => !bands.size || pr.ageBands.some((b) => bands.has(b)))
    .map((pr) => {
      const relevant = !activeDomains.size || pr.capabilityDomains.some((d) => activeDomains.has(d));
      return mergeRecord({
        key: resourceKey({ catalogId: pr.catalogId }),
        section: "printable",
        catalogId: pr.catalogId,
        name: pr.name,
        category: "Printable",
        description: pr.description,
        reasonSuggested: relevant ? "Matches your children's current domains." : "Available whenever you need it.",
        estimatedPrice: 0,
        ageRange: pr.ageBands.join(", "),
        kind: "diy",
        format: "printable",
        frequency: "occasional",
        capabilityDomains: pr.capabilityDomains,
        projectIds: [],
        projectTitles: [],
        affiliateAvailable: false,
        forChildId: null,
        status: "suggested",
        _relevant: relevant,
      }, idx.get(resourceKey({ catalogId: pr.catalogId })));
    })
    // Most-relevant printables first.
    .sort((a, b) => (b._relevant === true) - (a._relevant === true));
}

/* ---------- 6. Character, Identity & Wisdom ---------- */

// Tools that shape values, identity and emotional maturity. Personalised by the
// children's ages and the capability domains the family is pursuing; printable
// items North Star generates, the rest are physical decks/books/games.
export function buildCharacter(state) {
  const idx = recordIndex(state);
  const bands = familyAgeBands(state);
  const activeDomains = new Set();
  (state.children || []).forEach((c) => (c.domains || []).forEach((d) => activeDomains.add(d)));

  return CHARACTER
    .filter((ch) => !ch.ageBands || !bands.size || ch.ageBands.some((b) => bands.has(b)))
    .map((ch) => {
      const relevant = !activeDomains.size || ch.capabilityDomains.some((d) => activeDomains.has(d));
      const printable = ch.format === "printable";
      return mergeRecord({
        key: resourceKey({ catalogId: ch.catalogId }),
        section: "character",
        catalogId: ch.catalogId,
        name: ch.name,
        category: ch.category,
        description: ch.description,
        reasonSuggested: "Helps your family's values become lived, not just written.",
        estimatedPrice: ch.estimatedPrice || 0,
        ageRange: ch.ageBands ? ch.ageBands.join(", ") : "all",
        kind: printable ? "diy" : "ready",
        recommendation: printable ? "diy" : "ready",
        format: printable ? "printable" : "physical",
        frequency: ch.frequency || "occasional",
        capabilityDomains: ch.capabilityDomains || [],
        projectIds: [],
        projectTitles: [],
        affiliateAvailable: !printable,
        forChildId: null,
        status: "suggested",
        _relevant: relevant,
      }, idx.get(resourceKey({ catalogId: ch.catalogId })));
    })
    .sort((a, b) => (b._relevant === true) - (a._relevant === true));
}

/* ---------- 5. Partner Marketplace ---------- */

export function buildMarketplace(state) {
  // Prioritise suppliers LOCAL to the family's country, then those whose domains
  // the family is pursuing. International suppliers (countries: ["*"]) always show.
  const country = familyCountry(state);
  const activeDomains = new Set();
  (state.children || []).forEach((c) => (c.domains || []).forEach((d) => activeDomains.add(d)));
  return SUPPLIERS
    .map((p) => {
      const international = p.countries.includes("*");
      const local = !!country && p.countries.includes(country);
      return {
        ...p,
        local,
        international,
        countryLabel: country ? COUNTRY_LABELS[country] : null,
        relevant: p.domains.length ? p.domains.some((d) => activeDomains.has(d)) : false,
        // Hide country-specific suppliers that don't serve the family's country
        // (once we know it); keep everything when country is unknown.
        _show: !country || local || international,
      };
    })
    .filter((p) => p._show)
    // Local first, then domain-relevant, then the rest.
    .sort((a, b) => (Number(b.local) - Number(a.local)) || (Number(b.relevant) - Number(a.relevant)));
}

/* ---------- top-level builder ---------- */

export function buildLearningResources(state) {
  return {
    essentials: buildEssentials(state),
    project: buildProjectResources(state),
    personalised: buildPersonalised(state),
    character: buildCharacter(state),
    printable: buildPrintables(state),
    marketplace: buildMarketplace(state),
  };
}
