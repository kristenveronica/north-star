# Security Regression Harness

Proves that the Phase 0 authorization holes are **open today** and **closed after** migration `0025_security_hardening`. This is the safety net every later security change is validated against (Sprint 1, task A2).

## Two layers

| File | What it checks | Safe on prod? | Status |
|---|---|---|---|
| `config_assertions.sql` | The *shape* of the defences — policies, grants, triggers, function bodies. Read-only catalog inspection. | ✅ Yes (read-only) | **`0025` APPLIED to prod 2026-07-15 — all 10 GREEN on the live DB.** (Was 10 RED before.) |
| `rls_behavioral.sql` | Real attacker behaviour at the RLS layer — simulates `authenticated` users with forged JWT claims and attempts each exploit. All fixtures synthetic; wrapped in a single `ROLLBACK`. | ✅ Yes (rolled back), but intended for staging | Written; role-sim mechanism validated. **Run in staging during A3.** |

## How to run

```bash
psql "$DATABASE_URL" -f config_assertions.sql      # prints a RED/GREEN table
psql "$DATABASE_URL" -f rls_behavioral.sql         # prints [ATTACK]/[LEGIT] NOTICEs
```

Or paste into the Supabase SQL editor.

## The contract

- **Before `0025`:** `config_assertions.sql` returns **all RED**; every `[ATTACK]` in `rls_behavioral.sql` prints **RED**; every `[LEGIT]` prints **GREEN**.
- **After `0025`:** every config check must be **GREEN**; every `[ATTACK]` must be **GREEN (blocked)**; every `[LEGIT]` must remain **GREEN**.

**`0025` is not "done" until `config_assertions.sql` returns 10/10 GREEN and no `[LEGIT]` regressed.** This is the acceptance oracle for task A3 — do not merge the migration otherwise.

## RED baseline (recorded 2026-07-15, pre-0025)

All ten config checks RED: `A-C1 A-C2 A-C4 A-C5 A-CD A-H1 A-H4 A-M2 A-M5 A-ST`. Mapping to the audit findings is in `../../../docs/phase0-security-remediation.md`.

## Mechanism note

RLS simulation works by `set local role authenticated` + `set_config('request.jwt.claims', …, true)`, which makes `auth.uid()` return the forged `sub`. Validated benign on 2026-07-15 (a simulated stranger correctly reads `is_family_member = false`). No exploit *writes* were run against production; the behavioural layer is run in staging alongside the migration.
