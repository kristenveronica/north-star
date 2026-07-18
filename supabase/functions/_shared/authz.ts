// ============================================================================
// Shared authorization: resolve the calling family member from the JWT and
// answer the questions edge functions need. The client is never trusted; every
// check reads the caller's real membership row server-side.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const env = (k: string) => Deno.env.get(k) || "";
// Service-role client for server-side reads/writes that RLS would otherwise gate.
// Exported so generation can assemble canonical context server-side.
export const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

export type Caller = {
  userId: string;
  familyId: string;
  role: string;
  status: string;
  permissions: string[];
  isPrimary: boolean;
} | null;

const OWNER_ROLES = new Set(["architect", "co_architect"]);

/** Resolve the caller from the Authorization header, or null if unauthenticated. */
export async function resolveCaller(req: Request): Promise<Caller> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return null;
  const userClient = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const { data } = await admin.from("family_members")
    .select("family_id, role, status, permissions, is_primary")
    .eq("user_id", user.id).order("created_at", { ascending: true }).limit(1);
  const row = data?.[0];
  if (!row) return null;
  return {
    userId: user.id,
    familyId: row.family_id,
    role: row.role,
    status: row.status || "active",
    permissions: row.permissions || [],
    isPrimary: !!row.is_primary,
  };
}

export function isActiveMember(c: Caller): boolean {
  return !!c && (c.status || "active") === "active";
}

export function isOwner(c: Caller): boolean {
  return !!c && OWNER_ROLES.has(c.role);
}

/** Owners implicitly hold every permission; contributors need the explicit key. */
export function hasPermission(c: Caller, key: string): boolean {
  if (!c) return false;
  if (isOwner(c)) return true;
  return (c.permissions || []).includes(key);
}

/** True only when the family has a live (active/trialing) subscription. */
export async function billingActive(familyId: string): Promise<boolean> {
  const { data } = await admin.from("family_billing").select("status").eq("family_id", familyId).maybeSingle();
  const s = data?.status || "none";
  return s === "active" || s === "trialing";
}
