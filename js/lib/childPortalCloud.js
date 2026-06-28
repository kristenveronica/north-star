/* ============================================================
   childPortalCloud.js — cross-device child portal access.

   A child opening their portal on their own device has no local family data.
   This looks them up by access code via the `child-portal` edge function and
   loads ONLY their data (profile + projects + milestones) into the store, so
   the existing portal views render anywhere. Reuses the same row-mappers the
   parent hydrate uses, so the shape is identical.
   ============================================================ */

import { supabase } from "./supabase.js";
import { fromChildRow, fromProjectRow, fromMilestoneRow } from "./repo.js";
import { loadChildPortalSession } from "../store.js";

/** Look up a child by access code in the cloud and load their portal session.
    Returns the mapped child on success; throws Error("not_found") etc. */
export async function childPortalLogin(code) {
  const { data, error } = await supabase.functions.invoke("child-portal", {
    body: { action: "login", payload: { code } },
  });
  if (error) {
    let msg = error.message || "Lookup failed";
    try { const b = await error.context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.child) throw new Error("not_found");

  const child = fromChildRow(data.child);
  const projects = (data.projects || []).map(fromProjectRow);
  const milestones = (data.milestones || []).map(fromMilestoneRow);
  loadChildPortalSession({ children: [child], projects, milestones });
  return child;
}
