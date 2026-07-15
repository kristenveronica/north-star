# North Star — Phase 0 Security Remediation

**Scope: security only.** No visual, navigation, entitlement-tier or commercial changes. Reviewable and deployable in isolation.

Status: **Plan for review — NO code changed yet.** · Date: 2026-07-14 · Supabase `dsioaopybvbfukouljej`
Live schema is truth (migration history table is out of sync — see Risk R1). Next migration number: **`0025`**.

---

## 0. What changed since the first audit

You scoped Phase 0 around three holes (child-limit tampering, role self-promotion, missing `WITH CHECK`). The deeper sweep confirmed all three **and** found a cross-family data-breach chain that is more severe than any of them. Phase 0 must close that chain too — it's the same class of bug (authorization enforced in the wrong place, or not at all).

**The worst finding is a three-link chain that lets any anonymous person read and write another family's children:**

```
C3  Anonymous brute-force of a child's access code (name-derived, ~512 guesses
    for a known first name, no rate limit) returns the FULL child row —
    including child_id, family_id, the portal PIN and date of birth.
        │  leaks child_id + family_id
        ▼
C2  Any signed-in user can INSERT themselves into ANY family as `architect`
    (the fm_insert policy's `user_id = auth.uid()` branch never checks family_id;
     role defaults to 'architect').
        │  now an owner of the victim family
        ▼
C1  member_child_access binds nothing to family_id, and can_access_child()
    never checks it — so an owner can grant themselves access to any child
    UUID in any family. Persistent read/write of that child's projects,
    reflections, reports, observations, portfolio.
```

Each link is independently exploitable. This is a minor's PII (name, DOB, notes) and account-takeover exposure, live in production now.

### One technical correction to the earlier framing

I previously said the `family_members` update policy was exploitable because `WITH CHECK` is NULL. That's imprecise: **for an UPDATE policy, a NULL `WITH CHECK` falls back to the `USING` expression — it is not unchecked.** The real defect is that the expression is *row-scoped, never column-scoped*: `is_family_member(family_id)` controls *which family's rows* you may touch, but nothing controls *which columns* you may change. RLS in Postgres cannot compare OLD vs NEW, so it structurally **cannot** express "role must not change." That is why several fixes below are **BEFORE-UPDATE triggers**, not policy edits — a policy alone cannot close a column-escalation hole.

### The systemic root cause

Every table grants `ALL` (`arwdDxtm`) to both `anon` and `authenticated`, and there are **zero column-level grants** anywhere. RLS is therefore the *only* control, and RLS is row-scoped. Any row a member may UPDATE, they may UPDATE *every column of* — `role`, `is_primary`, `child_profile_limit`, `access_code`, `family_id`, `self_user_id`. The durable fix pattern for privileged columns is a **BEFORE-UPDATE guard trigger** that rejects changes to protected columns unless the caller is `service_role` or a suitably-privileged owner.

---

## 1. Findings folded into Phase 0 (ranked)

| ID | Sev | Finding | Your item # |
|---|---|---|---|
| **C1** | 🔴 CRIT | `can_access_child()` / `member_child_access` ignore `family_id` → cross-family child read/write | 7 (new) |
| **C2** | 🔴 CRIT | `fm_insert` lets any user join any family as `architect` | 2, 7 |
| **C3** | 🔴 CRIT | `child-portal`: brute-forceable access code, and `select("*")` leaks PIN + DOB | 5, 7 (new) |
| **C4** | 🔴 CRIT | `fm_update` self-promotion to `architect` / `is_primary` | 2, 3 |
| **C5** | 🔴 CRIT | `family_profiles.child_profile_limit` member-writable; limit trigger trusts it | 1 |
| **H1** | 🟠 HIGH | `children.child_upd` lets a child user re-parent their row into another family + rewrite `access_code` | 7 (new) |
| **H2** | 🟠 HIGH | `billing` edge fn: every mutating action callable by any member, incl. `revoked` | 4 |
| **H3** | 🟠 HIGH | `ai` edge fn: zero auth/entitlement/permission checks; unbounded spend | 5 |
| **H4** | 🟠 HIGH | `apply_billing_entitlement` demotes beta families to limit 1 on conversion | 6 |
| **M1** | 🟡 MED | `send-invite`: open brand-backed email relay (any recipient, any link) | 7 |
| **M2** | 🟡 MED | `accept_invitation` / `preview_invitation` have `EXECUTE` to `anon` | 7 |
| **M3** | 🟡 MED | 10 policies granted to role `public` (incl. `anon`) instead of `authenticated` | 7 |
| **M4** | 🟡 MED | `family_profiles_rw` is `ALL` → any member can DELETE the family's North Star | 7 |
| **M5** | 🟡 MED | `families.fam_update` lets architect change `org_id` / `ns_locked` | 7 |
| **L1** | ⚪ LOW | `public-checkout check-subscription` is an unthrottled email-enumeration oracle | 7 |

Deliberately **out of Phase 0** (tracked, not fixed here): lengthening access-code entropy (schema + child-portal UX change — needs its own migration and a re-code of existing children); split-billing/`billing_payers` hardening (table is dead); the whole commercial-tier system.

---

## 2. Exact change inventory

### 2.1 Database — one migration: `supabase/migrations/0025_security_hardening.sql`

Nothing is dropped. Every change is a policy replacement, a new guard trigger, a constraint, or a `REVOKE`. All are reversible (see §5).

| # | Object | Current | Change | Closes |
|---|---|---|---|---|
| D1 | fn `can_access_child(uuid)` | MCA branch omits `family_id` | Rewrite so the MCA grant must share the child's `family_id`; add same-family join | C1 |
| D2 | constraint on `member_child_access` | none tying rows together | Add trigger `mca_same_family` (BEFORE INS/UPD): reject unless `child_id` and `member_id` both belong to `family_id` | C1 |
| D3 | policy `mca_write` | `is_family_owner(family_id)` | Keep owner scope, but the D2 trigger now blocks foreign `child_id`; no policy text change needed beyond confirming | C1 |
| D4 | policy `fm_insert` | `WITH CHECK ((user_id = auth.uid()) OR is_family_member(family_id))` | Replace with `WITH CHECK (is_family_owner(family_id))`. (Self-signup & invite-accept go through `SECURITY DEFINER` RPCs that bypass RLS, so legit flows are unaffected — verified in §4.) | C2 |
| D5 | policy `fm_update` | `USING (is_family_member(family_id))` | Replace: `USING (is_family_owner(family_id)) WITH CHECK (is_family_owner(family_id))` | C4 |
| D6 | trigger `fm_guard` on `family_members` | none | New BEFORE UPDATE: reject if `role`, `is_primary`, `family_id`, or `user_id` changed unless caller is `is_primary_owner(family_id)`; a member may never change **their own** `role`/`is_primary`/`status` | C4, M5-class |
| D7 | trigger `family_profiles_guard` | none | New BEFORE UPDATE on `family_profiles`: reject any change to `child_profile_limit` unless `auth.role() = 'service_role'` | C5, item 1 |
| D8 | policy `family_profiles_rw` | `ALL … is_family_member` | Split into: `SELECT` = `is_family_member`; `INSERT/UPDATE` = `is_family_owner`; **no DELETE policy** (fail-closed) | M4, C5 |
| D9 | policy `child_upd` | `USING/CHECK (is_family_owner OR self_user_id = auth.uid())` | Keep, **plus** new trigger `children_guard` (BEFORE UPDATE): reject changes to `family_id`, `access_code`, `self_user_id` unless `is_family_owner`; a `self` child may edit only their own non-privileged fields | H1 |
| D10 | trigger `trg_enforce_child_profile_limit` | BEFORE **INSERT** only | Also fire BEFORE UPDATE OF `family_id` (blocks the re-parent seat bypass) — belt-and-braces with D9 | H1 |
| D11 | fn `apply_billing_entitlement` | `active` branch: `child_profile_limit = 1 + extra_seats` (absolute) | Change to `greatest(child_profile_limit, 1 + coalesce(extra_seats,0))`. Now that D7 makes the column service-role-only, `greatest()` reads a trustworthy value → capacity never drops on conversion | H4, item 6 |
| D12 | `EXECUTE` on `accept_invitation`, `preview_invitation` | granted to `anon` | `REVOKE EXECUTE … FROM anon` (keep `authenticated`) | M2 |
| D13 | 10 `public`-role policies (`calendar_events`, `family_settings`, `inventory_items`, `family_locations`, `travel_destinations`, `faith_settings`, `child_mobility_settings`, `media_assets`, `preference_signals`, `reflection_reports`) | role `public` | Recreate `TO authenticated` | M3 |
| D14 | policy `fam_update` on `families` | `WITH CHECK NULL` | Add `WITH CHECK` equal to `USING`, and trigger to freeze `org_id` (defense-in-depth; low risk) | M5 |
| D15 | `family_billing.status` | free text, no CHECK | Add `CHECK (status IN ('none','active','trialing','past_due','canceled','incomplete','unpaid','paused'))` | (hardening) |

> **Not changed:** `stripe-webhook` signature verification (already correct), `family_billing` RLS (already SELECT-only — service-role writes only, correct), `create_family_for_current_user` (already validates `auth.uid()`).

### 2.2 Edge functions

| File | Change | Closes |
|---|---|---|
| `supabase/functions/_shared/authz.ts` **(new)** | Shared helper: `resolveCaller(req)` → `{ user, member, familyId, role, status }` (reads `family_members`, filters `status='active'`); `requireOwner(member)`; `requirePermission(member, key)`; `familyBillingActive(familyId)` | H2, H3 |
| `supabase/functions/billing/index.ts` | Import `authz`. Reject `status !== 'active'`. Gate `create-checkout`, `add-seat`, `create-portal`, `pause`, `resume`, `cancel`, `keep` behind `requireOwner`. (Read-only `get-prices`/`get-subscription`/`claim-*` unchanged.) | H2, item 4 |
| `supabase/functions/ai/index.ts` | At line 1131 (right after `const { action, payload } = await req.json()`): resolve caller → require active membership → for generative actions (`generate-project`, `growth-reflection`, `generate-printable`, `quickstart-extract`, `suggest-*`) require `contrib:generate` (or `contrib:reports` for report actions) → require `familyBillingActive`. Reject otherwise with 403. **Add a minimal per-family/per-minute call guard** (see §3 note). | H3, item 5 |
| `supabase/functions/child-portal/index.ts` | Replace `select("*")` with an explicit safe column list (exclude `learning_profile`, or strip `pin`/`birthData`/`gender` before returning); add a simple IP+code attempt throttle (fail after N tries/window) | C3 |
| `supabase/functions/send-invite/index.ts` | Require the caller (JWT) to own a `pending` invitation in their family whose `email` matches the request `email`; derive the link server-side from that invitation rather than trusting the body; basic rate limit | M1 |
| `supabase/functions/public-checkout/index.ts` | Throttle `check-subscription`; return a constant-shape response (optional, LOW) | L1 |
| `supabase/config.toml` | No change (verify_jwt settings are already correct) | — |

### 2.3 Client — the minimum to stay consistent (no behaviour change for legit users)

The client changes are **not** security fixes (the server is now authoritative) — they only prevent the UI from *attempting* writes the DB will now reject, which would otherwise surface as confusing errors.

| File | Change |
|---|---|
| `js/lib/repo.js` | Stop writing `child_profile_limit` from the client on sync (it's now service-role-only; D7 would reject it). Confirm no client path writes `family_members.role`/`is_primary` directly. |
| `js/views/children.js` | The optimistic `bumpChildLimit()` local-only bump (`children.js:210`) already gets overwritten on hydrate; leave as-is but confirm it never round-trips to the DB. |

No visual, copy, routing, or sidebar changes. The free "Enable Child Insights" toggle removal is **explicitly deferred** to the commercial phase (it's a product change, not a security hole — it grants nothing gated).

---

## 3. Notes on two judgment calls

**AI rate limiting (item 5).** The cleanest full fix is a `ai_usage_log` table + per-plan quotas — but that's entitlement architecture, which you've deferred. For Phase 0 I propose the *authorization* gate now (active member + permission + active billing), plus a **lightweight in-function guard** (e.g. reject if the same family has made more than N generative calls in the last minute, tracked in a tiny `ai_rate` table). That closes the unbounded-spend vector without pulling in the tier system. If you'd rather ship zero new tables in Phase 0, we do auth-only now and add the ledger in the entitlement phase — say which.

**Access-code entropy (C3).** Phase 0 stops the *data leak* (no more PIN/DOB in the response) and adds throttling, which defeats practical brute force. Actually *lengthening* codes and re-issuing them to existing children is a schema + UX change I'd keep out of the security migration so it can be reviewed on its own. Flag if you want it pulled forward.

---

## 4. Confirming legitimate workflows still work

Each tightening was checked against the real flow that needs it:

| Workflow | Still works because |
|---|---|
| New user signs up → becomes architect of a new family | Goes through `create_family_for_current_user` (`SECURITY DEFINER`, bypasses RLS) — unaffected by the D4 `fm_insert` tightening |
| Owner invites an adult → they accept | `accept_invitation` (`SECURITY DEFINER`) inserts the member row — bypasses `fm_insert`; D12 only removes the **anon** execute grant, `authenticated` keeps it |
| Owner edits a contributor's role/permissions | D5/D6 permit it: the caller is an owner and is not editing *their own* row |
| Contributor with `contrib:generate` generates a project | H3 gate passes: active member + has permission + family billing active |
| Observer views projects/reports | Read policies unchanged; observers never had write/billing/AI-generate rights to lose |
| Architect manages billing | H2 `requireOwner` passes for architect/co_architect |
| Beta family converts trial → paid | D11 `greatest()` keeps their existing capacity — the bug that demoted them is gone |
| Child logs into their portal with a code | Still works; response just no longer contains PIN/DOB, and is throttled |
| Stripe webhook writes entitlements | Runs as `service_role` → passes D7; `family_billing` RLS unchanged |

**Explicit regression targets** (must remain green): architect full CRUD across their own family; contributor scoped read + permitted writes; observer read-only; child-portal login; invite create→accept; base checkout + add-seat by an owner.

---

## 5. Rollback & migration risk

**Rollback.** `0025` is a single migration composed of `CREATE OR REPLACE`, `DROP POLICY`/`CREATE POLICY`, `CREATE TRIGGER`, `REVOKE`, and `ADD CONSTRAINT`. A companion `0025_rollback.sql` will restore each prior policy body and drop each new trigger/constraint verbatim (the current definitions are all captured in this audit). Edge functions roll back by redeploying the previous version (git revert of the function dir + `supabase functions deploy`).

**Risk register:**
- **R1 — migration-history drift.** `supabase_migrations` is missing `0010–0020` and has a `0024` with no repo file. **Do not trust `list_migrations`; diff against live `pg_policies`/`pg_proc` before and after applying.** Apply `0025` via a reviewed SQL script, not an ORM that reconciles history.
- **R2 — D4/D5 could over-lock if a legit flow writes members outside the RPCs.** Mitigation: grep confirmed the only member-row writers are the two `SECURITY DEFINER` RPCs and owner-driven Family-Settings edits (which pass `is_family_owner`). Verify in staging before prod.
- **R3 — D7 will reject any client sync that still sends `child_profile_limit`.** The §2.3 `repo.js` change must ship *with or before* the migration, or child sync will start erroring. **Sequence: client change → deploy → migration.**
- **R4 — AI-gate false negatives.** If the permission-key mapping for an action is wrong, a legitimate contributor could be blocked from generating. Mitigation: table-drive the action→permission map and test every action with an owner and a permitted contributor before prod.
- **R5 — throttle tuning.** Child-portal / AI throttles set too tight could block real use. Start generous, log, tighten.
- **No data migration, no destructive DDL, no column drops.** Lowest-risk class of change; the exposure is behavioural (a wrong policy locks someone out), caught by the §4 regression set in staging.

---

## 6. Test plan (regression proving each hole is closed)

Every test is an **API-level attack with a real JWT** (or anonymous), not a UI click — because the UI is no longer the boundary.

**Attacks that must now FAIL (currently succeed):**
1. Anonymous: brute `child-portal` → response must **not** contain `pin`/`birthData`; must throttle after N attempts (C3)
2. Signed-in user: `insert into family_members(family_id=<other>, user_id=me, role='architect')` → rejected (C2)
3. Signed-in owner: `insert into member_child_access(family_id=mine, member_id=mine, child_id=<foreign>)` → rejected (C1)
4. Member: `update family_members set role='architect' where user_id=me` → rejected (C4)
5. Member: `update family_profiles set child_profile_limit=999` → rejected (C5)
6. Child user: `update children set family_id=<other>` / `set access_code='X'` → rejected (H1)
7. Contributor: `billing` `cancel` / `pause` / `add-seat` / `create-portal` → 403 (H2)
8. `canceled`-status family: `ai` `generate-project` → 403 (H3)
9. Contributor without `contrib:generate`: `ai` `generate-project` → 403 (H3)
10. `revoked` member: any `billing` mutating action → 403 (H2)
11. Signed-in user: `send-invite` to an arbitrary email with an arbitrary link they don't own → rejected (M1)
12. Anonymous: `accept_invitation`/`preview_invitation` RPC → no execute (M2)
13. Member: `delete from family_profiles where family_id=mine` → rejected (M4)

**Regressions that must PASS (from §4):** the eight legitimate workflows, run for architect / co_architect / contributor(+perm) / observer / child.

**The beta-conversion test (H4):** beta family, 3 children, `trialing`, limit 10 → flip `family_billing.status='active'`, `extra_seats=0` → assert `child_profile_limit` still ≥ 3 (was dropping to 1).

---

## 7. Proposed sequence

1. **Write regression harness first** (the §6 attacks) against current prod → they should mostly *pass* today, proving the holes. This is the oracle.
2. **Ship client change §2.3** (`repo.js` stops writing `child_profile_limit`) → deploy. (Risk R3.)
3. **Apply `0025` in staging** → run harness → attacks now fail, regressions pass.
4. **Deploy edge functions** (`_shared/authz.ts`, `billing`, `ai`, `child-portal`, `send-invite`) in staging → re-run.
5. **Diff live prod policies** (R1) → **apply `0025` to prod** → **deploy edge functions to prod** → re-run harness against prod.
6. Monitor logs for false-negative lockouts (R4/R5) for 48h.

---

**Nothing here touches visual design, navigation, or the commercial-tier architecture.** On approval I'll start with step 1 (the regression harness) so we can prove the holes are real before and closed after.
