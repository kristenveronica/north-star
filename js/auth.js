/* ============================================================
   auth.js — Local-only parent auth.

   PBKDF2 with 150k iterations + per-account random salt.
   Stored in localStorage. Since the data lives on the device,
   this is a UX layer, not a security boundary against someone
   with physical access — but it gives the platform a real
   account-and-session feel.

   When a real backend is wired:
     - signup() → POST /auth/signup
     - login()  → POST /auth/login (returns JWT)
     - the session check stays the same shape.
   ============================================================ */

import { getState, update } from "./store.js";

const ITERATIONS = 150_000;
const KEY_LEN = 256;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/* ---------- Hashing ---------- */
function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
function randomSaltHex(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(password),
    { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key, KEY_LEN
  );
  return bufToHex(bits);
}

/* ---------- Email + password validation ---------- */
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
}
export function validatePassword(pw) {
  if (!pw || pw.length < 8) return { ok: false, reason: "Password must be at least 8 characters." };
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return { ok: false, reason: "Use letters and at least one number." };
  return { ok: true };
}

/* ---------- Account state ---------- */
export function hasAccount() {
  const a = getState().auth;
  return !!(a && a.email && a.passwordHash);
}

export function isLoggedIn() {
  const s = getState().auth?.session;
  if (!s || !s.active || !s.expiresAt) return false;
  return new Date(s.expiresAt).getTime() > Date.now();
}

export function currentUserEmail() {
  return getState().auth?.email || null;
}

/* ---------- Signup ---------- */
export async function signup({ email, password, parentName }) {
  if (!validateEmail(email)) throw new Error("Please enter a valid email address.");
  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) throw new Error(pwCheck.reason);
  if (hasAccount()) throw new Error("An account already exists on this device. Log in instead.");

  const salt = randomSaltHex();
  const passwordHash = await hashPassword(password, salt);
  const session = freshSession();

  update(s => {
    s.auth = {
      email: email.trim().toLowerCase(),
      passwordHash, salt,
      parentName: parentName?.trim() || "",
      createdAt: new Date().toISOString(),
      session,
    };
  });

  return { email, session };
}

/* ---------- Login ---------- */
export async function login({ email, password }) {
  const a = getState().auth;
  if (!a || !a.email) throw new Error("No account on this device yet. Create one first.");

  const want = (email || "").trim().toLowerCase();
  if (want !== a.email) throw new Error("Email or password didn't match.");

  const hash = await hashPassword(password, a.salt);
  if (hash !== a.passwordHash) throw new Error("Email or password didn't match.");

  const session = freshSession();
  update(s => {
    s.auth.session = session;
    s.auth.lastLoginAt = new Date().toISOString();
  });
  return { email: a.email, session };
}

/* ---------- Logout ---------- */
export function logout() {
  update(s => {
    if (s.auth) s.auth.session = { active: false, since: null, expiresAt: null };
  });
}

/* ---------- Change password ---------- */
export async function changePassword({ current, next }) {
  const a = getState().auth;
  if (!a || !a.email) throw new Error("No account on this device.");
  const cur = await hashPassword(current, a.salt);
  if (cur !== a.passwordHash) throw new Error("Current password didn't match.");
  const pwCheck = validatePassword(next);
  if (!pwCheck.ok) throw new Error(pwCheck.reason);
  const newSalt = randomSaltHex();
  const newHash = await hashPassword(next, newSalt);
  update(s => {
    s.auth.passwordHash = newHash;
    s.auth.salt = newSalt;
    s.auth.passwordUpdatedAt = new Date().toISOString();
  });
}

/* ---------- "Set up local login" for legacy onboarded users ---------- */
export async function attachAccountToExistingFamily({ email, password }) {
  return signup({ email, password, parentName: getState().family?.parentName || "" });
}

function freshSession() {
  const now = Date.now();
  return {
    active: true,
    since: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
}
