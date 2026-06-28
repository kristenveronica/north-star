/* ============================================================
   invites.js — create contributor invitations.

   The Owner configures a person's Access Level + permissions in Family
   Settings, then invites them by email. This writes an `invitations` row
   (RLS lets only owners insert) and returns a shareable accept link. Email
   delivery is best-effort via the `send-invite` edge function — if no email
   provider is configured it simply returns sent:false and the UI falls back
   to the copyable link.
   ============================================================ */

import { supabase } from "./supabase.js";
import { currentUserId } from "../auth.js";

// Relationship access level → DB family_role. The Primary Owner can never be
// granted via invite, so an "owner" invite becomes a Co-Owner (co_architect).
function roleForAccessLevel(level) {
  return level === "owner" ? "co_architect" : "contributor";
}

export function inviteLink(token) {
  return `${location.origin}${location.pathname}#/invite/${token}`;
}

function randomToken() {
  return (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "");
}

export async function createInvite({ familyId, familyName, person }) {
  const email = (person.email || "").trim().toLowerCase();
  if (!email) throw new Error("Add an email address first.");
  if (!familyId) throw new Error("Save your family first.");

  // Per-child grants — owners reach all children (no rows needed); a contributor
  // is scoped to the children the owner selected (person.childIds, already
  // resolved to explicit ids by the caller).
  const perms = person.accessLevel === "owner" ? [] : (Array.isArray(person.permissions) ? person.permissions : []);
  const childAccess = person.accessLevel === "owner"
    ? []
    : (Array.isArray(person.childIds) ? person.childIds : []).map(cid => ({
        child_id: cid, access_level: "contributor", permissions: perms,
      }));

  const token = randomToken();
  const { error } = await supabase.from("invitations").insert({
    family_id: familyId,
    email,
    intended_role: roleForAccessLevel(person.accessLevel),
    intended_permissions: perms,
    intended_child_access: childAccess,
    token,
    invited_by: currentUserId(),
  });
  if (error) throw new Error(error.message || "Could not create the invitation.");

  // Best-effort email (no-op if no provider configured).
  let emailed = false;
  try {
    const { data } = await supabase.functions.invoke("send-invite", {
      body: { email, link: inviteLink(token), familyName: familyName || "" },
    });
    emailed = !!data?.sent;
  } catch { emailed = false; }

  return { token, link: inviteLink(token), emailed };
}
