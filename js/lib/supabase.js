/* ============================================================
   supabase.js — the single Supabase client for the app.

   No build step: supabase-js is loaded from a CDN as an ES module.
   The publishable (anon) key is SAFE to ship in the frontend — it is
   public by design and every table is protected by Row Level Security.

   Project: "North Star (Sydney)"  (ap-southeast-2)
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://dsioaopybvbfukouljej.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dtIyt5aJ-7ZRUaxMw2Mseg_uG65wyfv";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "northstar.auth",
  },
});

/** Quick connectivity check used during setup/dev. Resolves to true if the
 *  public `organizations` row is reachable (proves URL + key + RLS read work). */
export async function checkConnection() {
  const { data, error } = await supabase
    .from("organizations")
    .select("slug")
    .limit(1);
  if (error) return { ok: false, error: error.message };
  return { ok: true, org: data?.[0]?.slug ?? null };
}
