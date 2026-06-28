/* ============================================================
   media.js — Memory & media aggregation (foundation).

   Every project/milestone can capture memories (photos, videos, voice,
   documents). Two sources exist today:
     • formal media_assets (store: mediaAssets) — the future, Storage-backed path
     • milestone evidence uploads (already captured as data URLs in the portal)
   This module gives the Annual Reflection + Annual Video a SINGLE,
   normalized stream of a child's memories for a school year, regardless of
   where they were captured. As Supabase Storage is wired, only the source
   layer changes — consumers keep using collectMediaForChild().
   ============================================================ */

const guessKind = (e) => {
  const t = (e.fileType || "").toLowerCase();
  if (t.startsWith("video")) return "video";
  if (t.startsWith("audio")) return "voice";
  if (t.startsWith("image")) return "photo";
  if (t.includes("pdf") || t.includes("doc")) return "document";
  return e.kind || "photo";
};

const norm = (a) => ({
  id: a.id,
  kind: a.kind,
  caption: a.caption || "",
  dataUrl: a.dataUrl || null,
  storagePath: a.storagePath || null,
  capturedAt: a.capturedAt || a.createdAt || null,
  projectId: a.projectId || null,
  milestoneId: a.milestoneId || null,
  source: a.source || "media-asset",
});

/**
 * All memories for a child, oldest → newest. Pass { schoolYear } to scope.
 * Merges formal media_assets with milestone evidence uploads.
 */
export function collectMediaForChild(state, childId, { schoolYear } = {}) {
  const out = [];

  (state.mediaAssets || [])
    .filter(m => m.childId === childId && (!schoolYear || m.schoolYear === schoolYear))
    .forEach(m => out.push(norm(m)));

  const projectIds = new Set((state.projects || []).filter(p => p.childId === childId).map(p => p.id));
  (state.milestones || [])
    .filter(m => projectIds.has(m.projectId))
    .forEach(m => (m.evidence || [])
      .filter(e => e.kind !== "note")
      .forEach(e => out.push(norm({
        id: e.id, kind: guessKind(e), caption: m.title, dataUrl: e.dataUrl,
        capturedAt: e.createdAt, projectId: m.projectId, milestoneId: m.id, source: "milestone-evidence",
      }))));

  return out.sort((a, b) => new Date(a.capturedAt || 0) - new Date(b.capturedAt || 0));
}

/** Quick counts for storage/usage surfaces. */
export function mediaSummaryForChild(state, childId, opts) {
  const items = collectMediaForChild(state, childId, opts);
  return {
    total: items.length,
    photos: items.filter(i => i.kind === "photo").length,
    videos: items.filter(i => i.kind === "video").length,
    voice: items.filter(i => i.kind === "voice").length,
    documents: items.filter(i => i.kind === "document").length,
  };
}
