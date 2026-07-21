/* ============================================================
   account.js — account closure / right-to-erasure (Trust Charter).

   Calls the `erase-family` edge function with the signed-in Owner's session.
   The server re-checks Owner authorization, garbage-collects the family's
   Storage objects, deletes the whole DB footprint, and closes the logins.
   ============================================================ */

import { supabase } from "./supabase.js";

export const ERASE_CONFIRM_PHRASE = "ERASE EVERYTHING";

/**
 * Permanently erase this family's cloud account (DB + Storage) and close logins.
 * @param {string} confirm — must equal ERASE_CONFIRM_PHRASE (server re-checks).
 * @returns {Promise<{ok:boolean, counts?:object, storageRemoved?:number, usersDeleted?:number}>}
 */
export async function eraseAccount(confirm) {
  const { data, error } = await supabase.functions.invoke("erase-family", {
    body: { confirm },
  });
  if (error) {
    // functions.invoke surfaces non-2xx as an error; try to read the JSON body.
    let msg = error.message || "Could not erase the account.";
    try {
      const ctx = error.context && (await error.context.json?.());
      if (ctx?.error) msg = ctx.error;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
