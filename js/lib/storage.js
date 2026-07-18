/* ============================================================
   storage.js — Supabase Storage access for family media (milestone evidence).

   Files live in the private "family-media" bucket under a family-scoped path
   ({familyId}/{childId|family}/{uuid.ext}); RLS on the bucket guarantees a
   family can only ever touch its own files (see migration 0029). The database
   stores only the path — never the bytes — so nothing bloats and the data is
   durable + cross-device.

   Public surface:
     • uploadFamilyMedia(file, {familyId, childId})  → { path, fileName, fileType, fileSize }
     • signedUrl(path)                                → temporary viewable URL (cached)
     • removeFamilyMedia(path)                        → best-effort delete
     • hydrateEvidenceMedia(rootEl)                   → fill [data-sp] elements with signed URLs
   ============================================================ */

import { supabase } from "./supabase.js";

const BUCKET = "family-media";
export const MAX_FILE_BYTES = 50 * 1024 * 1024; // keep in lockstep with the bucket limit (0029)

const safeExt = (name) =>
  ((name || "").split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";

const newId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

/**
 * Upload one file/blob to the family's folder. Returns the stored metadata.
 * Throws on failure so the caller can surface it (never silently drops evidence).
 */
export async function uploadFamilyMedia(file, { familyId, childId } = {}) {
  if (!familyId) throw new Error("Can't upload without a family. Please try again once signed in.");
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The limit is 50 MB.`);
  }
  const scope = childId || "family";
  const path = `${familyId}/${scope}/${newId()}.${safeExt(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return { path, fileName: file.name, fileType: file.type, fileSize: file.size };
}

// Signed-URL cache: paths are stable, signatures expire — reuse until near expiry.
const _urlCache = new Map(); // path -> { url, exp }

/** Temporary, authorised URL for a private object. null if it can't be signed. */
export async function signedUrl(path, expiresIn = 3600) {
  if (!path) return null;
  const now = Date.now();
  const hit = _urlCache.get(path);
  if (hit && hit.exp > now + 60_000) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  _urlCache.set(path, { url: data.signedUrl, exp: now + expiresIn * 1000 });
  return data.signedUrl;
}

/** Best-effort delete. Never throws — a failed cleanup must not break the UI. */
export async function removeFamilyMedia(path) {
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
    _urlCache.delete(path);
  } catch (_e) {
    /* best-effort */
  }
}

/**
 * After a view renders, resolve every stored-media placeholder to a signed URL.
 * Elements opt in with  data-sp="<path>"  and  data-sp-kind="src|href".
 * Batched + cached, so repeated paths cost one request.
 */
export async function hydrateEvidenceMedia(root) {
  if (!root) return;
  const els = [...root.querySelectorAll("[data-sp]")];
  await Promise.all(
    els.map(async (el) => {
      const url = await signedUrl(el.getAttribute("data-sp"));
      if (!url) return;
      if (el.getAttribute("data-sp-kind") === "href") el.setAttribute("href", url);
      else el.setAttribute("src", url);
    }),
  );
}
