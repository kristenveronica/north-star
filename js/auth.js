/* ============================================================
   auth.js — Real parent auth via Supabase Auth.

   Replaces the old localStorage/PBKDF2 layer. Public API is kept
   the same shape so views (marketing.js, settings.js, sidebar.js)
   don't change:
     validateEmail, validatePassword,
     hasAccount(), isLoggedIn(), currentUserEmail(),   (sync)
     signup(), login(), logout(), changePassword(),
     attachAccountToExistingFamily(), initAuth(), onAuthChange()

   A module-level `_session` cache makes the sync getters work; it is
   primed by initAuth() at boot and kept fresh by onAuthStateChange.
   ============================================================ */

import { supabase } from "./lib/supabase.js";
import { ensureFamilyAndHydrate } from "./lib/repo.js";

let _session = null;
let _authChangeCb = null;

/* ---------- validation (unchanged) ---------- */
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
}
export function validatePassword(pw) {
  if (!pw || pw.length < 8) return { ok: false, reason: "Password must be at least 8 characters." };
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return { ok: false, reason: "Use letters and at least one number." };
  return { ok: true };
}

/* ---------- session state (sync getters) ---------- */
export function isLoggedIn() {
  return !!_session?.user;
}
// With cloud auth there is no per-device "account exists" concept; for the
// views that gate on it, "has an account" == "is signed in".
export function hasAccount() {
  return isLoggedIn();
}
export function currentUserEmail() {
  return _session?.user?.email || null;
}
export function currentUserId() {
  return _session?.user?.id || null;
}

/* ---------- boot ---------- */
export async function initAuth() {
  const { data } = await supabase.auth.getSession();
  _session = data.session;
  supabase.auth.onAuthStateChange((_event, session) => {
    _session = session;
    // Arriving via a password-reset email → send them to set a new password.
    if (_event === "PASSWORD_RECOVERY") { location.hash = "#/reset-password"; }
    if (_authChangeCb) _authChangeCb(session);
  });
  return _session;
}

/* ---------- password reset ---------- */
export async function requestPasswordReset(email) {
  const redirectTo = `${location.origin}${location.pathname}`;
  const { error } = await supabase.auth.resetPasswordForEmail((email || "").trim().toLowerCase(), { redirectTo });
  if (error) throw new Error(error.message);
  return true;
}
// Set a new password for the current (recovery or signed-in) session.
export async function updatePassword(next) {
  const pw = validatePassword(next);
  if (!pw.ok) throw new Error(pw.reason);
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw new Error(error.message);
  return true;
}
// app.js registers a callback to re-hydrate + re-render on login/logout.
export function onAuthChange(cb) { _authChangeCb = cb; }

/* ---------- signup ---------- */
export async function signup({ email, password, parentName }) {
  if (!validateEmail(email)) throw new Error("Please enter a valid email address.");
  const pw = validatePassword(password);
  if (!pw.ok) throw new Error(pw.reason);

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { parentName: parentName?.trim() || "" } },
  });
  if (error) throw new Error(error.message);

  // If email confirmation is OFF, we get a session immediately → hydrate now
  // so the app can proceed straight into onboarding.
  if (data.session) {
    _session = data.session;
    await ensureFamilyAndHydrate();
    if (parentName) await applyParentName(parentName.trim());
    return { email, needsConfirmation: false };
  }
  // Confirmation ON → no session yet; the user must verify their email.
  return { email, needsConfirmation: true };
}

/* ---------- login ---------- */
export async function login({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: (email || "").trim().toLowerCase(),
    password,
  });
  if (error) throw new Error(mapAuthError(error.message));
  _session = data.session;
  await ensureFamilyAndHydrate();
  return { email: data.user?.email };
}

/* ---------- logout ---------- */
export async function logout() {
  await supabase.auth.signOut();
  _session = null;
}

/* ---------- change password ---------- */
export async function changePassword({ current, next }) {
  const pw = validatePassword(next);
  if (!pw.ok) throw new Error(pw.reason);
  // Re-authenticate to confirm the current password.
  const email = currentUserEmail();
  if (email) {
    const { error: reauth } = await supabase.auth.signInWithPassword({ email, password: current });
    if (reauth) throw new Error("Current password didn't match.");
  }
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw new Error(error.message);
}

/* ---------- legacy shim: just a signup ---------- */
export async function attachAccountToExistingFamily({ email, password }) {
  return signup({ email, password, parentName: "" });
}

/* ---------- helpers ---------- */
async function applyParentName(name) {
  // Set display_name on the membership row (best-effort).
  const uid = currentUserId();
  if (!uid) return;
  const { data: m } = await supabase.from("family_members")
    .select("family_id").eq("user_id", uid).limit(1);
  if (m?.[0]) {
    await supabase.from("family_members")
      .update({ display_name: name })
      .eq("user_id", uid).eq("family_id", m[0].family_id);
  }
}

function mapAuthError(msg) {
  if (/invalid login credentials/i.test(msg)) return "Email or password didn't match.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first — check your inbox.";
  return msg;
}
