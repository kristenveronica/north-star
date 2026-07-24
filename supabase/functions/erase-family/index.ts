// ============================================================================
// North Star — erase-family (verify_jwt: ON — a signed-in parent only)
//
// RIGHT TO ERASURE / ACCOUNT CLOSURE (Trust Charter: "their work leaves with
// them… never create dependency through data lock-in", "custodians, not owners").
//
// An OWNER closes the family account. This function, in order:
//   1. Authorizes: the caller must be an ACTIVE OWNER of the family, and must
//      type the exact confirmation phrase — a deliberate, unmistakable act.
//   2. Snapshots the adult member user_ids (before anything is deleted).
//   3. Garbage-collects Storage: removes EVERY object under family-media/{familyId}/…
//      — because deleting DB rows does NOT delete the files. No orphaned bytes.
//   4. Deletes the entire DB footprint via the erase_family() SQL function
//      (ordered, transactional, overrides the child-story RESTRICT guards).
//   5. Best-effort account closure: deletes the auth login of any adult who,
//      after erasure, belongs to no other family and pays for no other family.
//   6. Writes an audit event (security_events survives the family delete).
//
// The binding part (2–4) is all-or-nothing; step 5 is best-effort and never
// fails the erasure. See docs/data-charter-compliance.md.
// ============================================================================

import { resolveCaller, isOwner, isActiveMember, admin } from "../_shared/authz.ts";
import { clientIp, logSecurityEvent } from "../_shared/security.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const BUCKET = "family-media";
const CONFIRM_PHRASE = "ERASE EVERYTHING";

// Recursively collect every object path under a prefix in the family-media
// bucket. Storage .list() is one level deep: entries with a null id are
// "folders" to recurse into; entries with an id are files. Our paths are only
// {familyId}/{childOrFamily}/{uuid.ext}, but we recurse generically (with a
// depth guard) so nothing is ever missed.
async function collectObjects(prefix: string, depth = 0): Promise<string[]> {
  if (depth > 6) return [];
  const out: string[] = [];
  const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error || !data) return out;
  for (const entry of data) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      // A folder — recurse.
      out.push(...await collectObjects(path, depth + 1));
    } else {
      out.push(path);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ip = clientIp(req);

  try {
    // 1. AuthZ — an active Owner, with the exact confirmation phrase.
    const caller = await resolveCaller(req);
    if (!caller || !isActiveMember(caller)) return json({ error: "unauthorized" }, 401);
    if (!isOwner(caller)) {
      await logSecurityEvent("family_erase_denied", { ip, identifier: caller.userId, meta: { familyId: caller.familyId, reason: "not_owner" } });
      return json({ error: "Only an account Owner can close and erase the family." }, 403);
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body */ }
    if (String(body?.confirm || "").trim().toUpperCase() !== CONFIRM_PHRASE) {
      return json({ error: `Type "${CONFIRM_PHRASE}" to confirm.`, needConfirm: true }, 400);
    }

    const familyId = caller.familyId;

    // 2. Snapshot adult member ids BEFORE deletion (family_members cascades away).
    const { data: members } = await admin.from("family_members")
      .select("user_id").eq("family_id", familyId);
    const memberIds = Array.from(new Set((members || []).map((m: any) => m.user_id).filter(Boolean)));

    // 3. Storage GC — remove every object under this family's prefix.
    let storageRemoved = 0;
    try {
      const paths = await collectObjects(familyId);
      // .remove() takes up to ~1000 paths per call; chunk to be safe.
      for (let i = 0; i < paths.length; i += 900) {
        const chunk = paths.slice(i, i + 900);
        const { data: removed, error: rmErr } = await admin.storage.from(BUCKET).remove(chunk);
        if (!rmErr && removed) storageRemoved += removed.length;
      }
    } catch (e) {
      // A storage hiccup must not block the DB erasure, but we surface it.
      await logSecurityEvent("family_erase_storage_error", { ip, identifier: caller.userId, meta: { familyId, error: String(e) } });
    }

    // 4. DB erasure — ordered, transactional, all-or-nothing.
    const { data: counts, error: dbErr } = await admin.rpc("erase_family", { p_family_id: familyId });
    if (dbErr) {
      await logSecurityEvent("family_erase_db_error", { ip, identifier: caller.userId, meta: { familyId, error: dbErr.message } });
      return json({ error: "Erasure failed — nothing was deleted from the database. Please try again.", detail: dbErr.message }, 500);
    }

    // 5. Account closure (best-effort): delete the login of any adult who now
    //    belongs to no other family AND pays for no other family.
    let usersDeleted = 0;
    for (const uid of memberIds) {
      try {
        const { count: famCount } = await admin.from("family_members")
          .select("id", { count: "exact", head: true }).eq("user_id", uid);
        if ((famCount || 0) > 0) continue;                       // still in another family
        const { count: payCount } = await admin.from("billing_payers")
          .select("id", { count: "exact", head: true }).eq("user_id", uid);
        if ((payCount || 0) > 0) continue;                       // still a payer elsewhere
        const { error: delErr } = await admin.auth.admin.deleteUser(uid);
        if (!delErr) usersDeleted++;
      } catch { /* best-effort; the family data is already gone */ }
    }

    // 6. Audit (this row outlives the family — security_events isn't family-scoped).
    await logSecurityEvent("family_erased", {
      ip, identifier: caller.userId,
      meta: { familyId, counts, storageRemoved, usersDeleted, members: memberIds.length },
    });

    return json({ ok: true, familyId, counts, storageRemoved, usersDeleted });
  } catch (e) {
    return json({ error: "Unexpected error", detail: String(e) }, 500);
  }
});
