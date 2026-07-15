# North Star — Commercial Architecture Proposal

**Subscriptions · Entitlements · Progressive Disclosure**

Status: **Proposal for review — no code changed.** · Owner: Kristen · Date: 2026-07-14 (rev. 2 — Foundation philosophy)
Supabase project `dsioaopybvbfukouljej` · Live schema is truth (migration history table is out of sync — see §H)

---

## Executive summary

The launch plan (Founding Family) is straightforward to ship. The problem is what sits underneath it.

**North Star currently has no entitlement system.** It has a *seat counter*. `entitlements.js` computes exactly one number — how many child profiles you may create — and that is the only thing in the entire product that a subscription controls. Every other feature is gated by the **permissions** engine, which answers a completely different question ("is this adult a contributor or an owner?") and is **free to anyone**.

Worse, the one gate that does exist **does not hold**:

> `family_profiles.child_profile_limit` is the column the database trigger reads to decide whether you may add another child. That column is **client-writable by any authenticated family member**. A contributor can run one `UPDATE` and give themselves fifty children. The migration that created it (`0010`) left a comment saying this must be locked down. **It never was.**

There are two further defects of the same severity (a privilege-escalation hole in `family_members`, and an entitlement trigger that *demotes* beta families to a 1-child limit the moment they convert to paid). All three are **commercial-launch blockers** and are detailed in §G.

The proposal below therefore does three jobs:

1. **Fix the foundation** — make server-side enforcement real, so entitlements mean something (§G).
2. **Build the entitlement system** — a centralized, extensible feature registry with four presentation states decoupled from plan rank (§B–D).
3. **Make the product unfold, not gate** — a per-family *disclosure* layer so Foundation feels like the beginning of the journey rather than a stripped-down edition, and premium capability reveals itself the moment it becomes useful (§0, §E, §F). *(Added in rev. 2 at your direction.)*

Recommended sequence is in §L. Nothing ships until you approve.

---

## 0. Product philosophy — Foundation is the beginning, not the cheap plan

> This section was added in rev. 2 and now governs everything below it. Where the earlier draft leaned on *gating*, the corrected principle is **progressive disclosure**: a family should never feel a feature was taken away — they should feel North Star growing with them.

**Parents don't drown in features. They drown in decisions.** The design goal is therefore not "remove features from Foundation" — it is **minimise cognitive load**. A feature can exist in Foundation and still not deserve permanent space on screen. Presence in the plan and presence in the navigation are two different questions, and we now answer them separately.

**The first week must feel remarkably simple.** Success for a new family is one clean loop:

> onboard → add children → generate a project → complete it → upload work → reflect.

That is the *entire* surface a family should have to reckon with in week one. Everything else emerges later, when it earns relevance.

**The three plans are three stages of maturity, not three SKUs:**

| Plan | The stage it represents | What the family feels |
|---|---|---|
| **Foundation** | The *beginning* of the journey | "This is simple, complete, and it works." |
| **Flourish** | North Star starts *actively adapting* to us | "It's starting to understand my child and my family." |
| **Legacy** | A deep family *operating system* built on accumulated understanding | "It knows us, and it's building something lasting." |

Foundation must feel like a **premium product experienced at its start** — no sidebar full of padlocks, no upgrade prompts, no artificial friction, no missing core workflow. Premium capability is not hidden *from* Foundation families to punish them; it is simply not yet *surfaced*, because it isn't useful yet. When it becomes useful, it appears — as help, never as a promo.

**This introduces one new architectural idea** (fully specified in §B.6): a feature has an **entitlement** (which plan includes it — the commercial axis) *and* a **disclosure state** (whether it's surfaced for this family right now — the maturity axis). A Foundation-included feature like Family Inventory can be fully entitled yet deliberately dormant until the family has run a few projects. Same engine, applied within a plan and across plans.

**The principle that governs every decision below:**

> **North Star is not software with three pricing tiers. It is a long-term relationship that gradually deepens.** Foundation is not the cheap version — it is simply the beginning of that relationship. The tiers are stages of a shared journey; disclosure is the pace of it (§F); the Purpose field (§B.2.1) keeps every part of it meaningful; and the moments of delight (§F.6) are its warmth. Wherever a design choice can either reinforce "you bought a plan" or "we're on a journey together," choose the journey.

---

## A. Current feature and route inventory

### A.1 Registered routes

| Path | View | Shell | In sidebar? |
|---|---|---|---|
| `/` | `dashboard.js` (or `marketing.js` home if logged out) | parent / public | ✅ Dashboard |
| `/vision` | `familyVision.js` | parent | ✅ Family North Star |
| `/family-settings` | `familySettings.js` | parent | ✅ Family |
| `/children` | `children.js` | parent | ✅ Children |
| `/children/:id`, `/children/:id/:tab` | `children.js` (child hub) | parent | via Children |
| `/domains` | `domains.js` | parent | ✅ Capability Domains |
| `/inventory` | `inventory.js` | parent | ✅ Family Inventory |
| `/materials` | `materials.js` | parent | ✅ Learning Resources |
| `/councils`, `/councils/:id` | `councils.js` | parent | ✅ Family Councils |
| `/projects`, `/projects/:id` | `projects.js` | parent | ✅ Projects |
| `/calendar` | `calendar.js` | parent | ✅ Calendar |
| `/rewards` | `rewards.js` | parent | ✅ Rewards & Tolls |
| `/reflections` | `reflections.js` | parent | ✅ Reflections |
| `/portfolio` | `portfolio.js` | parent | ✅ Portfolio |
| `/reports`, `/reports/:id` | `reports.js` | parent | ✅ Growth Reports |
| `/settings` | `settings.js` | parent | ✅ Settings |
| `/style` | `learningStyle.js` | parent | ❌ orphan — reachable only as child tab |
| `/insights` | `insights.js` | parent | ❌ orphan — reachable only as child tab |
| `/insights-reports`, `/insights-reports/:id` | `insights.js` | parent | ❌ orphan — in-page links only |
| `/technology/:childId` | `technology.js` | parent | ❌ orphan — child tab renders it embedded |
| `/planning` | `planningList.js` | parent | ❌ orphan — no sidebar item at all |
| `/discover` | `platformDiscovery.js` | bare | ❌ deliberate ghost page |
| `/onboarding`, `/start` | `onboarding.js`, `quickstart.js` | bare | n/a |
| `/invite/:token` | `inviteAccept.js` | bare | n/a |
| `/kid`, `/kid/:code`, `/kid/:code/project/:id`, `/kid/:code/calendar` | `childPortal.js` | child | per-child links |
| public marketing (`/welcome` `/about` `/how-it-works` `/features` `/trust` `/pricing` `/contact` `/login` `/signup` `/reset-password`) | `marketing.js` | public | n/a |

**Dead entries:** `/apps` has a permission rule (`permissions.js:80`) but **no registered route**. `sidebar.js:96` renders a `premium` badge, but **no sidebar item ever sets `premium: true`** — dead code path, ready to be reused.

### A.2 Sidebar as it stands (`sidebar.js:11–57`)

```
Home                → Dashboard
Set up your family  → Family North Star · Family · Children · Capability Domains
  (collapsible)        Family Inventory · Learning Resources · Family Councils
Plan                → Projects · Calendar · Rewards & Tolls
Track               → Reflections · Portfolio · Growth Reports
System              → Settings
[dynamic]           → Child Portals · Preview a portal
```

### A.3 Child profile hub (`children.js:567–572`)

Tabs: **Overview** (always) · **Learning Profile** (`/style`) · **Insights** (`/insights`) · **Technology** (`/technology`). Each non-overview tab is shown only if `canAccessPath(member, path)` passes.

### A.4 Roles, seats and onboarding state

- **Roles** (`family_role` enum): `architect` · `co_architect` · `contributor` · `observer` · `self_learner`. "Owner" = architect **or** co_architect. `is_primary` bool separately marks the billing guarantor.
- **Member status** (`member_status`): `active` · `pending` · `revoked`.
- **Permissions**: `family_members.permissions` is a **`text[]`** (not jsonb); per-child overrides in `member_child_access.permissions` + `access_level`.
- **Seats**: `family_billing.extra_seats` (child seats, bought via Stripe) → trigger → `family_profiles.child_profile_limit`. **Adult seats are computed for billing but never stored and never enforced.**
- **Onboarding completion**: `family_profiles.onboarded` (bool), mirrored to `state.meta.onboarded`. Written at `onboarding.js:437`, `quickstart.js:420`, `seed.js:230`; read at `app.js:74` (route guard), `sidebar.js:76` (collapse default), `dashboard.js:14` (resume banner). A separate device-local `localStorage["northstar::onboardingParked"]` lets a user defer onboarding.

### A.5 What "premium" means today

Nothing. `Child Insights` is labelled *"premium feature"* in Settings and gated on `state.insightsConfig.premiumEnabled` — **a local boolean the user can switch on themselves** with a free checkbox (`settings.js:246`), captioned *"Enable Child Insights (free for MVP)"*. It has zero connection to Stripe, `family_billing`, or entitlements. This must be removed.

---

## B. Proposed centralized entitlement model

### B.1 The core idea: three independent axes, one resolver

Today two axes exist and are tangled. I propose **three**, kept strictly orthogonal, joined by a single resolver function that every surface calls.

| Axis | Question | Source of truth | Existing? |
|---|---|---|---|
| **Permission** | *May this **person** do this?* (owner vs contributor) | `family_members.permissions[]`, `role` | ✅ `permissions.js` |
| **Entitlement** | *Does this **family's plan** include this?* | `family_billing.plan_code` → `plans` table | ❌ **new** |
| **Lifecycle** | *Is this **feature** ready to be seen at all?* | `features.state` | ❌ **new** |

**These never collapse into each other.** A Legacy family whose contributor lacks `contrib:generate` still cannot generate. A Foundation owner with every permission still cannot open a Legacy feature. A feature in `hidden` state is invisible to *everyone* regardless of plan — including Legacy.

### B.2 The feature registry

A single table, `features`, is the one place a feature's commercial identity is declared. **Nothing is hard-coded in a component, ever.**

```js
{
  key:        "child_insights",        // stable identifier
  purpose:    "Help parents understand their child through optional interpretive " +
              "lenses (Astrology, Human Design, Personality frameworks).",  // ← WHY it exists (required)
  min_plan:   "flourish",              // plan rank required   ← commercial axis
  state:      "available",             // presentation state    ← readiness axis
  surface:    "child_tab",             // where it naturally lives ← navigation axis
  at_launch:  false,                   // shipped in the launch set? ← founding-bundle axis
  founding_early_access: false,        // hand-picked for founders early? ← founding-bundle axis
  name:       "Child Insights",
  outcome:    "Understand who your child is becoming …",  // copy for the preview page
  includes:   ["Astrology", "Human Design", "Personality tendencies"],
}
```

Because `min_plan` and `state` are separate columns, you can do exactly what you asked: **mark a feature as Legacy-only while keeping it `hidden` until it is close enough to launch.** Flip one column to reveal it — no deploy. The `at_launch` / `founding_early_access` flags power the redesigned Founding bundle (§C.2); `purpose` is explained next.

### B.2.1 Every feature must declare a Purpose *(rev. 3)*

`purpose` is not documentation — it is **admission control**. Every feature row must answer, in one sentence, *why this feature exists for a family*. It is a required field: a feature with no clear purpose does not get a registry row, and a capability with no registry row does not ship. This makes "does this earn its place?" (§E) a check we run at *definition* time, not after we've already built the thing.

| Feature | Purpose |
|---|---|
| Projects | Answer "what should we learn today?" with a real, do-able learning experience. |
| Reflections | Give the family a place to notice and name how they're growing. |
| Family Inventory | Improve AI project generation by understanding the family's real-world environment. |
| Learning Resources | Bring the right materials to the parent in the flow of a project, so they never have to hunt. |
| Capability Domains | Express North Star's educational philosophy — the curriculum framework each child grows across over time. |
| Family Councils | Create a recurring rhythm for family reflection, planning and connection. |
| Child Insights | Help parents understand their child through optional interpretive lenses (Astrology, Human Design, Personality frameworks). |
| Growth Reports | Show how a child is developing over time, in language a parent can hold onto. |
| Living Family Model | Make everything North Star generates smarter about *this* family the longer they stay. |

**The discipline:** whenever we propose a future feature, we write its `purpose` first. If we can't answer "why does this exist?" cleanly, the feature probably shouldn't. This is the registry's contribution to keeping North Star from accreting features the way most software does.

### B.3 The resolver

One function, `resolveFeature(key)`, returns one of five verdicts. Every route guard, sidebar filter, tab strip and button asks it — and asks nothing else.

```
resolveFeature(key) →
  "off"       feature.state = hidden                    → render nothing, route 404s
  "soon"      feature.state = coming_soon               → contextual teaser, not navigable
  "locked"    plan_rank(family) < plan_rank(min_plan)   → contextual upgrade-preview page
  "denied"    entitled, but this member lacks the perm  → existing permission behaviour
  "on"        entitled + permitted                      → render the feature
```

Resolution order matters: **lifecycle first, plan second, permission third.** A hidden feature must not leak its existence through an upgrade prompt.

### B.4 Semantics of the four states

You specified the states; here is the precise meaning I propose, so they stay unambiguous in code and copy.

| State | Meaning | Entitled family sees | Un-entitled family sees |
|---|---|---|---|
| `available` | Shipped and supported | Full feature | Contextual upgrade preview |
| `preview` | Shipped but early — may change | Full feature + "Preview" badge | Contextual upgrade preview |
| `coming_soon` | Announced, not built | In-context teaser, not navigable | In-context teaser, names the plan |
| `hidden` | Exists only in the registry | Nothing | Nothing |

`hidden` is the default for every new feature. **A feature must be deliberately revealed, never accidentally.**

### B.5 Where the code lives

- `js/lib/features.js` — **new.** The registry cache + `resolveFeature()` + `planRank()`. Hydrated from the DB alongside the rest of state.
- `js/lib/entitlements.js` — **rewritten.** Keeps `canAddChild()` etc., but they become thin readers over the new plan limits rather than the sole entitlement concept. Adds `canAddAdult()`.
- `js/lib/permissions.js` — **untouched.** It keeps doing its one job.
- `supabase/functions/_shared/entitlements.ts` — **new.** The *same* resolver, server-side. Imported by the `ai` and `billing` functions. This is non-negotiable: the client copy is a UX convenience, the server copy is the enforcement.

### B.6 The disclosure axis — the fourth dimension *(rev. 2)*

The three axes above answer *may you have this?* They do **not** answer *should we show it to you yet?* That is the question §0 forces, and it needs its own axis — because it is **per-family and time-varying**, not a static property of a plan.

A feature therefore carries a **surface class** in the registry, plus (for the non-permanent classes) a **reveal rule**:

| Surface class | Meaning | Where it lives | Example |
|---|---|---|---|
| `anchor` | Answers a question a parent wakes up asking. Permanent nav. | Sidebar, always (once entitled) | Projects, Calendar, Reflections |
| `reference` | Foundational but low-frequency; visited during setup or occasional edits. | Collapsed "Your Family" / Settings cluster | Family North Star, Family, Settings |
| `contextual` | Real and useful, but its value is *in the flow of another task*, not as a place you visit. Surfaced by the AI in-context; no permanent nav home. | Inside Projects / child hub / councils | Learning Resources, Portfolio |
| `dormant` | Entitled and available, but not yet useful. Hidden until a **reveal rule** fires, after which it behaves as `contextual` (and may earn a home). | Nowhere, until revealed | Family Inventory |

**This composes with — does not replace — the entitlement resolver.** Order of resolution becomes:

```
resolveFeature(key)            → entitlement verdict (off / soon / locked / denied / on)   [§B.3]
  if on or locked-previewable:
    discloseFeature(key, fam)  → placement verdict (anchor / reference / contextual /
                                  dormant-hidden / newly-revealed)                          [new]
```

So a Foundation family that fully *owns* Family Inventory (`on`) can still see it `dormant-hidden` until they've completed a few projects — at which point `discloseFeature` returns `newly-revealed` and North Star offers it as help. And a Foundation family that does **not** own Child Insights (`locked`) still doesn't see it in the sidebar; it surfaces only as a contextual preview inside the child hub, at the moment the parent is looking at that child. **Same mechanism, one within-plan and one across-plan.**

**What drives `discloseFeature`:** a small, mostly-derived per-family progress signal — `projects_completed`, `reflections_written`, `uploads`, `days_active`, and lightweight pattern flags (e.g. "art-supply / woodworking domains recurring across projects"). Most of these are computable from tables that already exist; the only genuinely new state is a record of *what has already been revealed or dismissed*, so we never nag twice. Schema in §C.4, reveal rules in §F.2.

**The registry gains two columns** (`surface_class`, `reveal_rule`) — no new tables for the feature definitions themselves. Disclosure is therefore as data-driven and deploy-free as the presentation states: to make Family Inventory reveal after 3 projects instead of 5, you change a rule, not code.

---

## C. Proposed plan and seat schema

### C.1 Plans

```sql
create table plans (
  code        text primary key,          -- 'foundation' | 'flourish' | 'legacy' | 'founding'
  name        text not null,
  rank        int  not null,             -- ordering for >= comparisons
  max_children int not null,
  max_adults   int not null,
  allows_extra_seats boolean not null default false,
  is_purchasable boolean not null default true,   -- Founding Family: true now, false after launch window
  created_at  timestamptz not null default now()
);
```

| code | name | rank | children | adults | extra seats | purchasable |
|---|---|---|---|---|---|---|
| `foundation` | Foundation | 10 | 2 | 2 | ❌ | later |
| `flourish` | Flourish | 20 | 5 | 2 | ✅ $10/mo adult | later |
| `legacy` | Legacy | 30 | 5 | 2 | ✅ $10/mo adult | later |
| `founding` | Founding Family | 30* | 5 | 2 | ✅ $10/mo adult | **✅ now** |

*Founding's `rank` is used **only** for capacity math (it buys Flourish-level 5 + 2). Its *feature* access is a bundle — the launch set plus curated early-access grants — resolved by a dedicated branch, **not** by rank ≥ Legacy. See §C.2.

**Capacity decisions confirmed 2026-07-14:** Foundation is **2 children + 2 adults** (a two-parent family must be able to buy the entry stage). Flourish and Legacy are **5 + 2**. Legacy having the *same* household capacity as Flourish is **intentional** — Legacy is differentiated by **depth** (Living Family Model, community, insights, economy, legacy artifacts), not by seats. This fits the §0 maturity framing: you don't pay Legacy for *more room*, you pay it because North Star has become a family operating system. Additional active adults may later be **+$10/mo**; **observer-seat pricing is a separate open decision** (§K-6) — do not assume an observer consumes a paid seat.

### C.2 Founding Family — its own bundle, not "Legacy forever" *(redesigned rev. 3)*

**The earlier recommendation (Founding = Legacy rank forever) is withdrawn at your direction.** Promising every premium feature we invent over the next decade is a real liability: future Legacy capabilities may carry ongoing AI, moderation, storage, community and infrastructure cost, and an unconditional "everything forever" grant would hand all of that away at the launch price. Founding should be *generous*, not *open-ended*.

**Founding Family is therefore its own entitlement bundle**, defined by three concrete promises rather than a plan rank:

1. **Locked founding pricing — while continuously subscribed.** The launch price is held for as long as they don't lapse. A lapse ends the founding price (a normal grandfathering condition, and the reason `founding_since` / continuity is tracked).
2. **Everything released at launch.** Every feature with `at_launch = true` is theirs, permanently, at the founding price — this is the substance of the covenant and it's fully knowable today.
3. **Early access to *selected* future capabilities.** A hand-picked subset of post-launch features, each flagged `founding_early_access = true` — a deliberate gift we choose feature-by-feature, **not** a blanket claim on everything future.

Everything *not* in (2) or (3) — a future Legacy capability with heavy ongoing cost — is offered to founders as its own thing when it ships, exactly as it would be to anyone else. Founders feel first-class because they *are* (locked price, full launch set, curated early access), without mortgaging future product economics.

**How it resolves.** Founding is not `rank ≥ legacy`. The entitlement check gains one branch:

```
entitled(family, feature) =
     plan_rank(family) >= plan_rank(feature.min_plan)
  OR (family.plan_code = 'founding' AND
        (feature.at_launch OR feature.founding_early_access))
```

So Founding capacity stays at Flourish level (5 + 2, `rank` used only for the capacity math), but *feature* access is the launch set + curated early-access grants — a bundle, decoupled from the tier ladder. `is_purchasable` still flips to `false` when the launch window closes; existing founding rows keep working untouched.

**One new column** on `plans` is not enough here — the grant lives on the *feature* (`at_launch`, `founding_early_access` from §B.2), which is where it belongs: whether a feature is in the founding bundle is a property of the feature, tunable per feature, no migration.

### C.3 Seats

```sql
alter table family_billing
  add column plan_code    text not null default 'founding' references plans(code),
  add column extra_adults int  not null default 0 check (extra_adults >= 0);
-- existing: extra_seats (child seats), renamed conceptually to "extra children"
```

Effective capacity is **derived, never stored twice**:

```
max_children = plans.max_children + (allows_extra_seats ? family_billing.extra_seats : 0)
max_adults   = plans.max_adults   + (allows_extra_seats ? family_billing.extra_adults : 0)
```

This deletes `family_profiles.child_profile_limit` as a *writable* concept — see §G-1. It becomes a generated/derived value, or is dropped entirely and computed by a `SECURITY DEFINER` function that reads `family_billing` (which is service-role-write-only and therefore trustworthy).

### C.4 Disclosure state *(rev. 2)*

Two additive columns on the registry and one small table — the only new state the disclosure layer needs.

```sql
-- registry columns (on the `features` table from §B.2)
alter table features
  add column surface_class text not null default 'dormant',   -- anchor|reference|contextual|dormant
  add column reveal_rule   jsonb;                              -- e.g. {"signal":"projects_completed","gte":3}

-- per-family progress signals — mostly derived, refreshed on write; NOT a source of truth for anything billable
create table family_progress (
  family_id           uuid primary key references families(id) on delete cascade,
  projects_completed  int not null default 0,
  reflections_written int not null default 0,
  uploads             int not null default 0,
  first_active_at     timestamptz,
  pattern_flags       jsonb not null default '{}',   -- {"art_supplies":true,"woodworking":true}
  updated_at          timestamptz not null default now()
);

-- what has already been revealed or dismissed, so we never nag twice
create table family_disclosures (
  family_id   uuid not null references families(id) on delete cascade,
  feature_key text not null references features(key),
  state       text not null,          -- 'revealed' | 'dismissed' | 'activated'
  acted_at    timestamptz not null default now(),
  primary key (family_id, feature_key)
);
```

`family_progress` is a **convenience cache** — every counter is recomputable from existing rows (`projects` with a completed status, `reflections`, portfolio uploads, project domain tags). It carries **no entitlement authority** and is safe to be family-readable; nothing security-relevant depends on it, so a tampered counter at worst reveals a feature the family already owns slightly early. `family_disclosures` is owner-writable (a parent can dismiss a suggestion). Neither touches the enforcement surface in §G.

---

## D. Feature access matrix

Proposed. Everything currently shipped stays in Foundation unless there's a commercial reason to move it — **Foundation must feel complete, not crippled.**

Surface column uses the E-audit classes: **anchor** (permanent sidebar) · **hub** (permanent section in the child profile) · **contextual** (surfaced in-flow) · **reference** (low-emphasis "Your Family"). The **Founding** column reflects the redesigned bundle (§C.2): ✅ = in the launch set (`at_launch`), so permanently theirs; **EA** = a candidate for curated `founding_early_access` when it ships; **—** = not in the bundle (offered as its own thing later).

| Feature key | Surface | Foundation | Flourish | Legacy | Founding | State now |
|---|---|---|---|---|---|---|
| `family_north_star` | reference | ✅ | ✅ | ✅ | ✅ | available |
| `children` | anchor | ✅ (2) | ✅ (5) | ✅ (5) | ✅ (5) | available |
| `projects` (the magic loop) | anchor | ✅ | ✅ | ✅ | ✅ | available |
| `calendar` | anchor | ✅ | ✅ | ✅ | ✅ | available |
| `capability_domains` (Growth Map) | **hub** | ✅ | ✅ | ✅ | ✅ | available |
| `learning_resources` | contextual | ✅ | ✅ | ✅ | ✅ | available |
| `family_inventory` | contextual/dormant | ✅ | ✅ | ✅ | ✅ | available |
| `rewards` | contextual | ✅ | ✅ | ✅ | ✅ | available |
| `reflections` | anchor | ✅ | ✅ | ✅ | ✅ | available |
| `portfolio` | hub | ✅ | ✅ | ✅ | ✅ | available |
| `learning_profile` | hub | ✅ | ✅ | ✅ | ✅ | available |
| `tech_agreement` | hub | ✅ | ✅ | ✅ | ✅ | available |
| `family_councils` | sidebar | ✅ | ✅ | ✅ | ✅ | available |
| **`growth_reports`** | sidebar | — | ✅ | ✅ | ✅ | available |
| **`child_insights`** | child tab | — | ✅ | ✅ | ✅ | available |
| **`living_family_model`** | *invisible layer* | — | — | ✅ | EA? | **hidden** |
| **`family_economy`** | inside Councils | — | — | ✅ | EA? | **hidden** |
| **`community_hall`** | sidebar (future) | — | ? | ✅ | EA? | **hidden** |

The three future rows show **EA?** in the Founding column, not ✅ — under the redesigned bundle (§C.2), post-launch Legacy capabilities are **not** automatically owed to founders. Each is a *candidate* for curated early access, decided feature-by-feature when it ships, precisely because these are the features most likely to carry ongoing AI / moderation / storage / community cost.

**The gating logic** — *free/cheap gets the loop; paid gets the accumulated understanding of the child.* Foundation delivers the whole working product: plan projects, run them, reflect, build a portfolio. What Flourish adds is the thing that **compounds** — the system's growing understanding of each child (Insights + Growth Reports). That is the strongest possible recurring-revenue logic: the longer you stay, the more it's worth, and cancelling forfeits accumulated value.

**Child Insights** (Astrology · Human Design · optional Personality frameworks) sits **inside the child profile**, as you specified — never a top-level destination. Simplified and comprehensive views are a *within-feature* toggle, not separate entitlements. Personality frameworks must be presented as **tendencies, not classifications**, and remain **parent-selected interpretive lenses**, explicitly distinct from AI-observed patterns.

**Living Family Model** is not a page and never appears in the matrix as a destination. It is an entitlement key that the **`ai` edge function** reads to decide how much cross-family context and history to weave into projects, councils, reflections, reports and quarterly planning. Legacy families get a system that gets smarter about *the family*, not just the child. This is enforced server-side or it is not enforced at all.

**Family Economy** is a module *within* Family Councils, not a tab. Initial scope is educational and manually managed: goals, children's earnings, business income, Save/Spend/Invest/Give, allowances, project budgets. **No bank aggregation.**

**Community — from consumption to contribution** *(rev. 3).* Community stays `hidden` and firmly **out of launch scope** — but the long-term vision is bigger than a content feed, and the architecture should be shaped for it now so we don't wall ourselves in. The Community Hall's endgame is a place where families don't just *consume* but **contribute**: sharing successful family projects, offering project ideas back into the system, **mentoring newer families**, celebrating and showcasing each other's creations, running family challenges. Over time it becomes a **living ecosystem where families help build North Star together** — the network that makes the platform improve *because* people use it. Two implications to hold even while it's dormant: (1) a family's own projects/showcases are the raw material of Community, so the data model for projects and portfolio should keep "could this be shared, with consent?" in view; and (2) contribution and moderation carry real ongoing cost, which is exactly why Community is a prime example of a feature that should **not** be an unconditional Founding grant (§C.2). None of this is built in this task — it's the North Star for the Hall when its time comes.

---

## E. Navigation — every destination earns its place *(rewritten in rev. 2)*

> This section replaces rev. 1's "only three nav changes." You asked me to audit **every** destination against a single test, and that produces a deeper restructure. It is entirely **visibility** — no feature is removed, no data is touched, and it is fully reversible. That's why I'm comfortable recommending a bigger change here than I was before: the risk profile is "a menu item moved," not "a capability lost."

### E.1 The test

For every permanent navigation item, one question:

> **"What recurring question does a parent wake up asking?"**

If the item answers one, it's an **anchor** and earns permanent space. If it doesn't, it becomes **contextual** (surfaced in the flow of the task where it matters) or **reference** (present but low-emphasis, visited during setup or occasional edits). A feature can be fully included in Foundation and still fail this test — inclusion and navigation are different questions (§0).

### E.2 The audit — every current destination

| Destination | The recurring question? | Verdict |
|---|---|---|
| **Today** (Dashboard) | "What should we do now?" | **anchor** |
| **Projects** | "What should we learn today?" | **anchor** (the core loop) |
| **Calendar** | "What's happening this week?" | **anchor** (appears once there's anything to schedule) |
| **Reflections** | "How are we doing?" | **anchor** |
| **Children** (hub) | "How is each child?" | **anchor** — the hub holds Learning Profile, Insights, Technology, **Portfolio**, and per-child growth |
| **Family Councils** | "How do we gather and decide as a family?" (a recurring *ritual*, weekly/monthly) | **anchor (periodic)** — moves to **Plan** |
| **Growth Reports** | "How is my child growing over time?" (quarterly) | **periodic anchor**, Flourish+ |
| **Family North Star** (vision) | — identity, not a daily question | **reference** → "Your Family" |
| **Family** (settings / people) | — occasional edits | **reference** → "Your Family" |
| **Settings** | — occasional | **reference** → "Your Family" |
| **Family Inventory** | ✗ *no recurring question* | **dormant** → contextual after ~3 projects |
| **Learning Resources** | ✗ *no recurring question* | **contextual** — dissolve as a destination (see E.3) |
| **Capability Domains** | ~ "How is my child growing, and in what?" — a recurring *child* question | **permanent section inside each child's profile** — the curriculum backbone (see E.3.1) |
| **Rewards & Tolls** | ✗ — not a daily anchor | **contextual** — folds into the family-economy context within Councils |
| **Portfolio** | ~ "Let me see their work" (occasional) | **fold into the Children hub** as a tab; retire as top-level |

Four things that are currently permanent *top-level* sidebar items fail the test **as top-level items**: **Family Inventory, Learning Resources, Rewards & Tolls, Portfolio.** None are removed — each becomes contextual or moves into the child hub where it's actually used. **Capability Domains is the exception** — it earns a permanent home, but inside the *child*, not the sidebar (E.3.1).

### E.3 Learning Resources — should it disappear as a destination? **Yes.**

You asked me to evaluate this directly. My recommendation is to **dissolve Learning Resources as a primary destination.** Browsing a resource library is not something a parent wakes up wanting to do; finding the right resource *for the project in front of them* is. So the AI should bring resources **to** the parent, in context:

- inside an active project: *books they already own* (from Inventory), *resources already uploaded*, *printable worksheets North Star can generate now*, *recommended videos*, and *suggested purchases* — as a "Resources for this project" panel.
- a thin "Saved & owned resources" view remains reachable from within a project or the child hub for the rare deliberate browse — but it is **not** a top-level nav item.

This is the clearest single example of the whole philosophy: a feature that stays fully available, delivers *more* value than before, and stops taxing attention as a permanent destination.

### E.3.1 Capability Domains — the curriculum backbone, not a config screen *(rev. 3)*

Rev. 2 wrongly filed Capability Domains under "configuration" and moved to hide it. **That was a mistake, and you're right to push back.** Domains are not a settings panel — they are the *educational philosophy* of North Star made concrete: the framework every child grows across. Hiding them would hide what the whole product is *for*.

So Domains are neither a top-level sidebar item (a family doesn't wake up asking to browse a taxonomy) **nor** buried in config. They become a **permanent, prominent section inside each child's profile** — the child's **Growth Map**:

- A living view of **how *this* child is developing across the capability framework over time** — which domains are flourishing, which are quietly emerging, how the balance shifts across months and seasons.
- Built from real signal — every completed project, reflection and observation maps onto domains — so it *fills in as the family lives*, rather than being a form to complete up front.
- The place a parent goes to answer "how is my child growing, and in what ways?" — a genuinely recurring question, but a *per-child* one, which is why its home is the child hub, not the global sidebar.
- Still the layer generation reads from (weighting, balance) — but that's a consequence of it being the child's growth record, not its reason for existing.

This reframes Domains from *"a thing you set"* to *"the story of who your child is becoming, told through our framework."* It's the backbone the child hub is organised around, and it deepens naturally as North Star matures with the family — the single clearest expression of §0's "relationship that gradually deepens."

Concretely, the child hub becomes: **Overview · Growth Map (Domains) · Learning Profile · Portfolio · Insights\* · Technology** (\* Flourish+). The Growth Map is present from day one but, like everything else, *unfolds* — sparse at first, richer with every project.

### E.4 The resulting sidebar

**Foundation, week one** (deliberately sparse — matches the §0 first-loop):
```
Today · Projects · Reflections · Children
```
(Calendar joins the moment there's something scheduled.)

**Foundation, matured** (after the family has run several loops):
```
Today · Projects · Calendar · Family Councils · Reflections · Children
Your Family  (collapsed) → Family North Star · Family · Settings
```

**Flourish** adds **Growth Reports** under a **Track** grouping. **Legacy** adds nothing to the *permanent* nav by capacity — its depth (Living Family Model, Economy, Community) surfaces contextually or as its own late-stage destinations when built.

**Inside the child hub** (a permanent, per-child home, not the global sidebar): **Growth Map (Capability Domains)** · Learning Profile · Portfolio · Insights\* · Technology.

**Never permanent nav** (contextual, surfaced in-flow): Family Inventory · Learning Resources · Rewards & Tolls.

**The collapsible section label** still swaps on the `onboarded` flag: **"Set Up Your Family"** (task list) → **"Your Family"** (a place). And the orphan top-level Insights routes still redirect into the child hub.

### E.5 Rules by state (entitlement × disclosure)

An item appears in the sidebar only when it is **both** entitled (`resolveFeature = on`) **and** disclosed as an `anchor` for this family. The cross-plan `locked`/`soon` behaviour is unchanged from rev. 1:

| Verdict | Sidebar | Child-hub tab | In-flow entry point | Direct URL |
|---|---|---|---|---|
| `on` + `anchor` | Shown | Shown | Active | Renders |
| `on` + `contextual`/`dormant-hidden` | **Not shown** | Shown if in-hub | Surfaced in-flow when relevant | Renders |
| `locked` | **Not shown** | Shown, subtly marked | Routes to contextual preview | Preview page |
| `soon` | **Not shown** | Marked "Soon" | Inert teaser | Preview (soon variant) |
| `off` / `denied` | Not shown | Not shown | Not shown | Redirect to `/` |

The sidebar (global surface) never carries padlocks; the child hub (a local, already-scoped surface) is where a `locked` premium tab like Insights may sit quietly — that's its natural context.

---

## F. Progressive disclosure — how the product unfolds *(rev. 2)*

The disclosure engine (§B.6) and the nav audit (§E) exist to serve one experience: **North Star gets richer as the family gets more invested, and it never feels like anything was withheld.** This section specifies that experience.

### F.1 The first 90 days

Four stages, keyed off `family_progress`, not the calendar (a family that runs five projects in two weeks matures faster than one that runs five in two months). **The stage boundaries below are deterministic defaults for launch; the long-term goal is for North Star to sense readiness itself — see F.2.1.**

**Stage 1 — Simplicity (first loop, ~days 0–7).** The only things on screen are what the loop needs: Today, Children, Projects, Reflections. The explicit success target is your six steps — onboard → add children → generate a project → complete it → upload work → reflect. **No inventory, no resources browser, no domains, no upgrade anything.** If a family does only this and stops, they've had a complete, premium first experience.

**Stage 2 — Rhythm (~after the first completed loop).** Calendar earns its place (there's now something to schedule). Portfolio quietly begins collecting completed work inside the child hub. The first **Family Council** invitation appears — not as a feature to configure, but as "would you like to hold your first family gathering?" Reflections cadence establishes.

**Stage 3 — Personalisation (~after 3–5 projects).** North Star has enough signal to get *specific*. This is where **Family Inventory** reveals (F.2) and where **Learning Resources** are visibly being pulled into projects. The child's **Growth Map (Capability Domains)** — present in the hub from day one — now has enough history to become genuinely revealing, and North Star draws attention to it: "here's how {child} is growing across the framework." The family starts to feel the system adapting — which is precisely the **Flourish** promise, introduced *by experiencing it*, not by an ad.

**Stage 4 — Depth (~after 60–90 days / sustained use).** Enough history exists for **Growth Reports** to be meaningful and for **Child Insights** to have something real to say. For a Foundation family, this is the natural, earned moment a contextual **upgrade preview** appears — inside the child hub, at the moment the parent is asking a question the premium feature answers. For a Flourish/Legacy family, the depth simply switches on.

### F.2 Lifecycle triggers

Each trigger is a **reveal rule** in the registry (§B.6) → a single, dismissable, in-context suggestion. Fires **once**, logged in `family_disclosures`, never repeated. Copy is help, never promotion.

| Trigger (signal) | Feature revealed | The moment / copy |
|---|---|---|
| `projects_completed >= 3` | Family Inventory | *"I've noticed you're regularly using art supplies and woodworking tools. Want to tell me what your family already has, so I can build even better projects?"* |
| `projects_completed >= 1` | Portfolio (in hub) | *"Here's the first piece of work in {child}'s portfolio."* (ambient, not a prompt) |
| First completed loop | Family Councils | *"You've run your first project. Many families mark moments like this with a short family gathering — want to try one?"* |
| `pattern_flags.repeat_domain` | Growth Map spotlight (in hub) | *"{child} keeps returning to hands-on building — here's how that's growing across the framework."* |
| `projects_completed >= 5` | Understand-your-family nudge (→ deeper personalisation / Flourish) | *"You've completed five projects. Would you like to help me understand your family a little better?"* |
| `days_active >= 60` **and** enough reflections/reports data | Child Insights / Growth Reports **preview** (Foundation → Flourish) | Contextual preview inside the child hub, at the point of the parent's question |

**Governance (hard rules):**
- A trigger fires **at most once per feature per family**, and only when its feature is entitled-and-dormant **or** a genuinely-relevant locked preview.
- Triggers **never stack** — at most one suggestion surfaced at a time; if two are eligible, the earlier-stage one wins.
- Every suggestion is **dismissable**, and dismissal is remembered (`family_disclosures.state = 'dismissed'`).
- A suggestion appears **in the flow of the relevant task**, never as a modal, toast, or dashboard banner.
- The AI's tone is **assistive** — "so I can do X better for you" — never "upgrade to unlock."

### F.2.1 From thresholds to readiness — letting the AI own the timing *(rev. 3)*

The numbers above (3 projects, 5 projects, 60 days) are **sensible launch defaults, not the destination.** They're deliberately crude: every family is different, and a fixed threshold will introduce Family Inventory too early for one family and too late for another. The long-term vision you've set is that **North Star recognises when a family is genuinely ready for the next layer** — sometimes after two projects, sometimes after ten — and personalises the unfolding accordingly.

The architecture already supports this cleanly, because a trigger is a `reveal_rule` (§B.6), and a rule carries a **mode**:

```js
reveal_rule: { mode: "threshold", signal: "projects_completed", gte: 3 }   // launch default
reveal_rule: { mode: "ai_readiness", feature: "family_inventory" }          // later — model decides
```

- **Launch (`threshold`)** — deterministic, testable, predictable. Ships now. No model in the disclosure path, so nothing to go wrong under load.
- **Later (`ai_readiness`)** — a lightweight readiness assessment runs against the family's real signal (project cadence, the kinds of projects they choose, how much they reflect, whether they're hitting the *edges* of what Foundation does well) and answers a narrow question: *is this family ready to be offered X now?* It never changes *what* is offered or *whether* they're entitled — only *when* the moment lands.

**Guardrails carried into the AI era:** readiness only ever moves the *timing* of an offer, never entitlement or plan; the once-per-feature, dismissable, never-interrupt, assistive-tone rules from F.2 still bind; and every default has a deterministic fallback so a readiness model being unavailable degrades to "use the threshold," never to "nag." The `ai_readiness` path is explicitly **out of Phase-0/launch scope** — it's the direction the disclosure engine grows toward once the deterministic version has taught us what "ready" actually looks like.

### F.3 Contextual surfacing (the in-flow mechanism)

For `contextual` features, the surfacing lives **inside the host view**, not in navigation:

- **Learning Resources** → a "Resources for this project" panel on each project (owned → uploaded → generate-a-printable → recommend → purchase), per E.3.
- **Family Inventory** → once revealed, an "Add what you own" affordance appears inside project generation and the resources panel, not as a menu item.
- **Rewards & Tolls / Family Economy** → surfaced inside Family Councils (the future economy home) and the child's project HQ.

(Capability Domains is **not** in this list — per E.3.1 it's a permanent Growth Map section in the child hub, not a contextual surface.)

### F.4 Contextual upgrade preview (the cross-plan case)

The *same* surfacing machinery handles a feature the family isn't entitled to. One shared full-page component, `js/views/upgradePreview.js` (not a modal), reached **only by intent** — opening a `locked` tab in the child hub, or tapping a Stage-4 suggestion. Driven entirely by the `features` row:

1. **The outcome** — what this changes for your family, in their language. *"See the patterns in who your child is becoming — and get language for it."*
2. **What's included** — 3–5 items from `features.includes`.
3. **Which plan unlocks it** — named plainly; one plan, not a pricing grid.
4. **One primary action** — "Compare plans" → `/settings#plan`; one secondary — "Not now" → the exact previous screen.
5. **A real taste where honest** — Insights shows *one* genuine insight generated from data the family already has, the rest quietly out of reach. **A locked door persuades nobody; an open window does.**

### F.5 Rules of restraint (architectural constraints, not suggestions)

- Previews and suggestions are reached **only by intent or at a genuinely-earned moment**. They never interrupt the loop.
- **No upgrade modals. No toasts. No dashboard banners. No repeat prompts.**
- A given feature's preview/suggestion is shown **at most once per session**, and once dismissed, not again.
- The back affordance is always present and returns to **the exact previous screen**.
- `coming_soon` previews carry **no purchase action** — you cannot sell what does not exist; "Notify me" at most.
- **Foundation must be walkable end-to-end — the entire magic loop — without meeting a single upgrade prompt.** This is the acceptance test for the whole philosophy (§J).

### F.6 Moments of delight — emotional design *(rev. 3)*

Progressive disclosure makes North Star *more capable* over time. That is necessary but not sufficient. It must also become **more emotionally rewarding** — because §0's core truth is that North Star is a *relationship*, and relationships are carried by feeling, not features. A family should sense that North Star notices them, is quietly proud of them, and is glad to be on the journey with them.

**These moments run on the same engine as disclosure** — a signal fires a single, in-context response — but the payload is *acknowledgement*, not a feature. Examples of the moments worth marking:

| Moment | Signal | The feeling to create |
|---|---|---|
| First completed project | `projects_completed == 1` | *"You did it — your first project, start to finish."* Pride, momentum. |
| A child's first capability milestone | first domain crosses a growth threshold on the Growth Map | *"Something's taking root in {child}."* Recognition of the child. |
| First Family Council held | first council completed | *"You gathered as a family. That matters."* Connection. |
| First month together | `days_active == 30` with a completed loop | A short, warm look back at what they've made. Belonging. |
| Seasonal / annual celebration | school-year or anniversary boundary | A "year with North Star" acknowledgement — the emotional cousin of the keepsake video. |
| A meaningful AI acknowledgement | the AI notices something true and specific (a child's persistence, a value lived out) | *"I noticed {child} kept going when it got hard."* Being seen. |

**Rules — so delight never curdles into manipulation:**

- **Reinforce, never reward-loop.** These mark progress, connection and purpose. **No points, streaks, badges, leaderboards, or "don't break your streak" pressure.** The moment we make a parent feel they'll *lose* something by stepping away, we've betrayed the philosophy.
- **Earned and true, never manufactured.** A moment fires only when the thing genuinely happened. A hollow "great job!" is worse than silence — it teaches the family the praise is noise.
- **Specific beats generic.** "I noticed {child} kept going when it got hard" lands; "Achievement unlocked" does not. Acknowledgement should reference *their* real story.
- **Quiet and infrequent.** Restraint (F.5) applies fully. A moment is a gentle in-context note, never a modal or confetti-bomb. Rare enough that each one still means something.
- **Never a disguised upsell.** A celebration is a celebration. It does not carry an upgrade CTA. (A Stage-4 *preview* is a separate, later, clearly-different moment.)

This is not decoration — it's the emotional layer of the same "relationship that deepens" the whole product is built to be. It costs little and it's a large part of why a family stays.

---

## G. Server-side enforcement requirements

> **This section contains the launch blockers.** Everything else in this proposal is architecture. This is liability.

UI-only enforcement is not enforcement. Every rule below must hold against a user with a browser console, because the client is fully in the customer's hands.

### G.1 🔴 CRITICAL — the child limit is self-service

`family_profiles.child_profile_limit` is the column the `enforce_child_profile_limit` BEFORE-INSERT trigger reads. Column grants:

```
authenticated | family_profiles | child_profile_limit | UPDATE   ← any member, any role
anon          | family_profiles | child_profile_limit | UPDATE
```

The only policy is `family_profiles_rw ALL USING/WITH CHECK (is_family_member(family_id))`. **Any authenticated member — contributor, observer, even self_learner — can `update family_profiles set child_profile_limit = 50` and then add fifty children.** The trigger dutifully reads the limit from a row the attacker controls. Migration `0010` explicitly notes this must be locked down; it never was.

**Fix:** entitlements must be derived from `family_billing` (service-role-write-only) — never from a client-writable table. Revoke the column grant, and compute the limit in a `SECURITY DEFINER` function.

### G.2 🔴 CRITICAL — privilege escalation via `family_members`

```sql
fm_update UPDATE USING (is_family_member(family_id))   -- WITH CHECK: NULL
```

No `WITH CHECK`. **Any active member can update any member row in their family — including setting their own `role` to `architect`.** A revoked-in-spirit contributor promotes themselves to owner and gains billing control. This is independent of billing and should be fixed regardless of this project.

**Fix:** `WITH CHECK (is_family_owner(family_id))` on writes, plus a trigger forbidding self-promotion and protecting the `is_primary` owner.

### G.3 🔴 CRITICAL — beta families are demoted on conversion

`apply_billing_entitlement` (migration `0023`):

```sql
if new.status = 'active' then
  child_profile_limit = 1 + coalesce(new.extra_seats, 0);      -- ← no greatest()
elsif new.status = 'trialing' then
  child_profile_limit = greatest(child_profile_limit, 10 + coalesce(new.extra_seats,0));
```

A beta family with 3 children (limit 10, `trialing`) converts to `active` with no purchased seats → **limit drops to 1.** Their existing children survive (the trigger only gates INSERT) but they are permanently 3-over-cap, can never add a child, and the UI reads "3 of 1". **Every beta family converting to paid hits this.**

**Fix:** the new plan-based derivation removes this branch entirely. Founding Family = 5 children, no arithmetic.

### G.4 🟠 HIGH — the AI function enforces nothing

`supabase/functions/ai/index.ts` (1,152 lines) has **zero entitlement or permission checks**. Any active member can generate, regardless of plan, seat, subscription status, or whether they hold `contrib:generate`. The existing design doc (`membership-billing-design.md:19`, `:315`) *asserts* that this function "independently re-verifies membership + permissions before spending AI credits". **It does not.** This is the actual cost centre — an unpaid or cancelled family can generate indefinitely.

**Fix (required before any AI-related feature is tier-gated):** the `ai` function must, on every call: resolve the caller's member row → check `status = 'active'` → check the required permission → check `family_billing.status ∈ (active, trialing)` → check the requested capability against the family's plan. Living Family Model depth is decided **here**, not in the client.

### G.5 🟠 HIGH — billing actions are not owner-gated

In `billing/index.ts`, only `sync-ai-seats` checks the caller's role. **`create-checkout`, `add-seat`, `pause`, `cancel`, `create-portal` are callable by any active family member** — a contributor can cancel the family's subscription or open the billing portal.

**Fix:** owner check (`architect`/`co_architect`) on every mutating billing action.

### G.6 🟡 MEDIUM — other findings

| # | Finding | Fix |
|---|---|---|
| a | `children` has **no DELETE policy** — children cannot be deleted via the API at all | Add owner-gated DELETE policy |
| b | `family_billing.status` is **free text, no CHECK** — a typo'd status falls silently into the `else` branch | Add CHECK constraint |
| c | `public-checkout` offers a **`quarter`** interval that `billing/index.ts` and the `base_interval` CHECK don't support — it silently collapses to `month`, and seats then bill monthly | Remove `quarter`, or support it end-to-end |
| d | Adult AI seats are computed and billed but **never stored or enforced** | `family_billing.extra_adults` + enforcement |
| e | The signup paywall (`marketing.js:1921`) is **client-side** | Enforce at the server on family creation |
| f | `billing_payers` table is **entirely dead** (0 rows, zero reads/writes) | Leave dormant or drop |

### G.7 The enforcement contract

Every entitlement must be enforced at **the layer that owns the resource**:

| Resource | Enforced by |
|---|---|
| Child count | DB trigger reading a service-role-only table |
| Adult count | DB trigger on `family_members` INSERT |
| AI generation | `ai` edge function, before spending a token |
| Feature routes | Client for *UX*; server for anything that reads or writes gated data |
| Billing mutations | `billing` edge function, owner-gated |

The client resolver is a **convenience, not a control**. Assume every client check is bypassed and ask: *what would it cost us?* If the answer isn't "nothing", it needs a server check.

---

## H. Database migration plan

⚠️ **The `supabase_migrations` history table is out of sync with the repo.** Migrations `0010–0020` exist as files and their objects are live in the database, but they are **absent from the history table** (applied out-of-band). Migration `0024_children_mobility_profile_jsonb` is in the history but **has no repo file**. **Treat the live schema as truth**; do not trust `list_migrations`. Next number: **`0025`**.

**Recommended: three migrations, sequenced so the security fixes can ship independently of the commercial work.**

### `0025_security_hardening.sql` — ship first, ship alone
- Revoke `UPDATE` on `family_profiles.child_profile_limit` from `authenticated`/`anon` (G.1)
- Add `WITH CHECK (is_family_owner(family_id))` to `fm_update`; trigger blocking self-promotion and demotion of the primary owner (G.2)
- Owner-gated DELETE policy on `children` (G.6a)
- CHECK constraint on `family_billing.status` (G.6b)

**This migration is independently valuable and carries no commercial risk. It should go in regardless of what you decide about the rest.**

### `0026_plans_and_features.sql`
- `create table plans` + seed the four rows (§C.1)
- `create table features` + seed the registry (§D)
- Both **publicly readable, service-role-write-only** — the client must never author its own entitlements
- `family_billing.plan_code text not null default 'founding' references plans(code)`
- `family_billing.extra_adults int not null default 0`
- Backfill: every existing family → `plan_code = 'founding'`

### `0027_entitlement_enforcement.sql`
- `SECURITY DEFINER fn family_capacity(family_id) → (max_children, max_adults)`, derived from `plans` ⋈ `family_billing`
- Rewrite `enforce_child_profile_limit` to read `family_capacity()` instead of `family_profiles.child_profile_limit`
- New `enforce_adult_limit` trigger on `family_members` INSERT
- **Drop** `apply_billing_entitlement` (the demotion bug, G.3) and deprecate `family_profiles.child_profile_limit` (keep the column, stop reading it, drop in a later migration once nothing references it)

**Rollback:** each migration is additive and reversible. `0025` can be reverted by re-granting; `0026`/`0027` by dropping the new tables/triggers and restoring the old trigger. **Take a snapshot before `0027`** — it changes how an existing, revenue-bearing constraint behaves.

---

## I. Billing integration boundaries

**Boundary 1 — Stripe owns money. The database owns entitlements. They meet in exactly one place: the webhook.**

```
Stripe subscription
  → stripe-webhook (service role, no JWT)
    → writes family_billing { plan_code, status, extra_seats, extra_adults, … }
      → everything else derives from that row
```

Nothing else may write `family_billing`. It has no client write policy today — **keep it that way.**

**Boundary 2 — plan_code comes from the Stripe price, not the client.** The webhook maps `price_id → plan_code` via a lookup seeded in `plans`. A client may *request* a checkout for a plan; it may never *assert* that it has one.

**Boundary 3 — what NOT to build yet.** Per your instruction, I am proposing no payment changes beyond what's needed to carry `plan_code`. Specifically **not** proposing: new products/prices for Foundation/Flourish/Legacy (they aren't purchasable at launch), split billing (`billing_payers` stays dormant), or any change to the 12-month commitment / beta trial logic.

**What launch actually requires of Stripe:** one product, the existing base + child-seat + adult-seat prices, and **one new metadata field** (`plan_code: "founding"`) on the subscription. That's it. The three-tier price structure gets built when you decide to sell three tiers.

**Existing beta families** (`is_beta`, `trialing`, limit 10) map to `founding` and keep a 5-child capacity — **check this against the live beta family that currently has 10** before applying `0027` (see §K-4).

---

## J. Test plan

**Server enforcement (the part that must not fail).** Each of these is an attack, run with a real JWT against the live API — not a UI click-through:

1. Contributor attempts `update family_profiles set child_profile_limit = 50` → **must be rejected** (currently succeeds)
2. Contributor attempts `update family_members set role = 'architect' where user_id = me` → **must be rejected** (currently succeeds)
3. Foundation family (2 children) attempts to insert a 3rd child → **must be rejected by the trigger**
4. Foundation family (2 adults) attempts to insert a 3rd adult → **must be rejected**
5. Family with `status = 'canceled'` calls the `ai` function → **must be rejected**
6. Contributor without `contrib:generate` calls the `ai` function → **must be rejected**
7. Contributor calls `billing` `cancel` → **must be rejected**
8. Foundation family requests a Legacy-gated AI capability → **must degrade to their tier, not error**

**Entitlement resolution:** unit tests over `resolveFeature()` covering the full cross-product of {4 plans} × {4 states} × {owner, contributor-with-perm, contributor-without-perm}. The matrix in §B.3/§E.2 *is* the test oracle.

**Lifecycle transitions:** flip a feature `hidden → coming_soon → preview → available` and assert the sidebar, child tabs, in-page entry points and direct-URL behaviour all change with no deploy.

**The beta-conversion regression (G.3):** take a beta family with 3 children on `trialing`, convert to `active`, assert capacity does **not** drop. This is the bug that will hit real paying customers first.

**Progressive disclosure:** a Foundation family walks the entire product and must encounter **zero padlocks in the sidebar**, and must be able to complete the full magic loop (create child → generate project → run it → reflect → portfolio) without meeting a single upgrade prompt. If they can't, Foundation isn't a product.

---

## K. Risks, assumptions and unanswered decisions

**Decisions resolved 2026-07-14 / rev. 3:**

- ✅ **Foundation = 2 children + 2 adults** (was 1 adult). A two-parent family can buy the entry stage.
- ✅ **Flourish & Legacy = 5 + 2, identical capacity, intentional.** Legacy is differentiated by *depth* (Living Family Model, community, insights, economy, legacy), not seats — consistent with the §0 maturity framing.
- ✅ **Progressive disclosure is the governing principle** (§0). Foundation is the beginning of the *relationship*, not the cheap plan; features unfold, they are not gated-then-revealed as punishment.
- ✅ **Learning Resources dissolves as a destination**; resources become contextual (§E.3).
- ✅ **Founding Family = its own bundle, NOT Legacy-forever** (§C.2). Locked founding price while continuously subscribed + all launch features permanently + curated early access to *selected* future capabilities. Reverses rev. 1.
- ✅ **Capability Domains = the Growth Map** — a permanent, prominent section *inside each child's profile*, not hidden and not a config screen (§E.3.1). It's the curriculum backbone.
- ✅ **Every feature carries a `purpose`** — required, admission-controlling (§B.2.1).
- ✅ **Disclosure timing: deterministic thresholds at launch, AI-driven readiness later** (§F.2.1).
- ✅ **Moments of delight are part of the architecture** (§F.6) — reinforcing, never gamified.
- ✅ **Community = contribution, not just consumption** — long-term ecosystem vision captured; launch scope unchanged (`hidden`).

**Decisions still open:**

1. **The live beta family** currently has `child_profile_limit = 10`. Under Founding (5 children) they'd be *reduced*; they have 0 children today so it's harmless now — confirm the beta cohort lands on 5, not grandfathered at 10.
2. **Growth Reports moving to Flourish** removes something Foundation families can currently see. Nobody is paying yet, so there's no revocation — confirm this is the Foundation/Flourish line you want. (Under §0, the *cleaner* story is that Growth Reports don't even become meaningful until Stage 4, so a Foundation family rarely misses them before the moment they'd upgrade anyway.)
3. **Which post-launch features enter the Founding early-access set** (`founding_early_access`) — a per-feature call to make as each ships; nothing to decide now, but worth naming the principle (favour low-marginal-cost delighters; be cautious with heavy-ongoing-cost capabilities).
4. **Community's plan** — Legacy-only, or eventually a cross-plan destination? Kept `hidden` either way until built.
5. **Observer-seat pricing** — do observers consume a paid adult seat, or are they free? Held as a separate decision per your note; the schema treats adult *capacity* and observer status independently so this can go either way later.

**Assumptions** (flag any wrong): pricing unchanged at launch; Founding price = existing base price; Community is genuinely post-launch (`hidden`); the 12-month commitment and beta trial logic carry over untouched.

**Risks:**

- **The three CRITICAL holes (§G.1–G.3) are live in production right now.** The child-limit hole means the paywall is currently decorative. I'd ship `0025` this week regardless of what happens to the rest of this proposal.
- **The `ai` function is unenforced** (§G.4) and is the real cost centre. Any AI-differentiated tier is unsellable until it enforces.
- **Migration history drift** (§H) means tooling can't be trusted to tell you what's applied. Verify against the live schema before every migration.
- **Building tiers before validating demand.** The registry makes tiers *cheap to add later* — the point of the design is that you don't have to guess now.

---

## L. Recommended sequence

**Phase 0 — Security (this week, independent of everything else).**
Migration `0025`. Owner-gate the billing edge function. Add real enforcement to the `ai` function. Remove the free "Enable Child Insights" toggle. **This is the only phase I'd call urgent.** It ships alone, needs no product decisions, and closes three live holes.

**Phase 1 — Entitlement foundation.**
Migrations `0026` + `0027`. `plans` + `features` tables. `js/lib/features.js` resolver + shared server module. Everything on Founding Family, everything currently visible stays visible. **Zero user-visible change** — that's how you know it worked.

**Phase 2 — Progressive disclosure & navigation.**
`discloseFeature()` + `family_progress`/`family_disclosures` (§B.6, §C.4). The nav restructure from the recurring-question audit (§E): the leaner anchor set, "Your Family" reference cluster, Family Councils → Plan, Learning Resources dissolved into project context, Family Inventory made dormant, Portfolio folded into the child hub, orphan Insights routes retired. `upgradePreview.js` and the lifecycle-trigger surfacing (§F). Everyone is still Founding, so **zero gating is visible** — but the product now *unfolds*, and it's all testable by flipping registry rows and progress counters.

**Phase 3 — Prove it, then sell it.**
Flip one feature to a higher `min_plan` on a test family and drive a `family_progress` up through the four stages. Walk it. If Foundation feels complete at Stage 1 and the Stage-4 preview makes you *want* to upgrade, the system works. **Only then** build the three Stripe price sets and turn on the tiers.

**Phase 4 — The future features, when you're ready.**
Child Insights modules (Astrology / Human Design / Personality tendencies, simplified + comprehensive views). Living Family Model as an AI-context depth entitlement. Family Economy inside Councils. Community Hall. Each is already declared in the registry as `hidden` — each ships by flipping one column.

---

**Nothing in this proposal has been implemented.** On your approval I'd start with Phase 0, which I'd recommend regardless of what you decide about the commercial architecture.

---

## Appendix M. Long-term vision — the Living Family Model as a trusted family guide *(rev. 4)*

> **Documentation only. Not launch scope. No navigation. No implementation.** This appendix records where the **Living Family Model** (§D — the Legacy-tier intelligence layer) is ultimately headed, so that architectural decisions made now leave room for it. Nothing here is built in Phase 0–4. Its only near-term influence is a *negative* constraint: don't make a schema or model choice that forecloses these directions.

**The arc.** North Star begins as an educational planner. Over the life of the relationship (§0) it should evolve into something larger: a system that personalises not only *learning* but *family life* — recognising opportunities for learning, connection, celebration and growth across the whole family. Both capabilities below are **expressions of the one Living Family Model**, not new products or new tabs. The Model is the substrate; these are what it grows to understand.

### M.1 Family Culture (supersedes "Family Traditions")

"Family Traditions" is too small a frame. The real concept is **Family Culture** — the accumulated, living understanding of *how this family actually lives*. Over time North Star should come to know a family's:

- celebrations · rituals · weekly rhythms · seasonal rhythms · annual traditions · holidays
- adventures · service traditions · learning traditions · health traditions · financial traditions
- recurring family activities · meaningful locations · important dates · family sayings and customs

**The point is not storage — it's influence.** Family Culture is not a form to fill in or a page to visit; it is context the Living Family Model *absorbs* and then lets shape **every** recommendation it makes: project generation, calendar suggestions, Family Councils, celebrations (§F.6), annual reviews, reflection prompts. A family that serves at a food bank each Advent, hikes every first-of-month, and has a saying about "finishing what we start" should find those woven back into what North Star proposes — unprompted, and correctly.

The goal, stated plainly: **North Star fits around the family's life, instead of asking the family to fit around the software.**

*Architectural room to preserve now (constraints, not builds):* keep family-level context a first-class, extensible part of the Living Family Model's input — not a fixed set of columns. Culture is open-ended and grows; whatever captures it must be additive (a flexible context layer the `ai` function reads), never a rigid enum. This is consistent with how §D already frames the Model as server-side context the AI weaves in.

### M.2 Relationship Intelligence

The second capability: North Star should gradually understand not only each **individual child** but the **relationships** within the family —

- **Parent ↔ Child** · **Sibling ↔ Sibling** · **the Whole Family**

— and recognise opportunities to *strengthen* them: cross-child projects, one-on-one parent-child experiences, family adventures, collaborative service projects, creative activities, traditions worth continuing, rituals worth introducing.

**The objective is not educational outcomes — it's stronger families.** Relationship Intelligence is explicitly **another expression of the Living Family Model**, not a separate product: the same layer that today decides how much family context to weave into a project grows, over time, to reason about the *relational* fabric of the family and to surface connection opportunities alongside learning ones.

*Architectural room to preserve now:* the relationship map already exists in the data model (`family_members`, relationships, per-child records). Leave room for the Living Family Model to read *across* children and adults — reasoning about pairs and the whole, not just one child at a time — rather than hard-wiring every generation path to a single `child_id`. Don't build it; just don't design it out.

### M.3 The product principle this serves

> North Star should not only personalise **learning**. It should gradually personalise **family life** — becoming increasingly able to recognise opportunities for learning, connection, celebration and growth across the entire family, and ultimately evolving from an educational planner into a **trusted family guide.**

This is the far end of the §0 relationship arc. It lives entirely at the Legacy tier and beyond, entirely inside the Living Family Model, and entirely in the future. Recording it here is a promise to our future selves: **when we make near-term choices, leave the door open to it.**

### M.4 The Weekly Conversation

The Living Family Model needs a way to *learn* that isn't a form. The Weekly Conversation is that channel: a gentle, optional, roughly-weekly invitation — typically at the start of the week — for the parent to talk with North Star about how the family is doing.

> *"Before we begin this week, would you like to check in on how the last week went?"*

**Interaction:** the parent can **speak naturally (dictate)**, **type a short note**, or **skip with no penalty** — skipping must be as first-class as answering; a missed week is never nagged or held against them. This is voice-first-friendly and consistent with the multimodal direction.

**The objective is relationship, not journaling.** North Star learns *through conversation* rather than configuration. What naturally surfaces over time: new family interests, challenges, celebrations, trips, traditions, relationships, emotional wellbeing, new goals, learning breakthroughs, changing circumstances. The AI quietly folds these into future project generation, Family Councils, calendar recommendations, reflections, reports, relationship suggestions (M.2), Family Culture (M.1), and the Living Family Model itself.

**The questions must evolve, never repeat by rote.** North Star should rarely ask the same thing twice; questions grow increasingly personal, grounded in the family's own history:

> *"What brought your family the most joy this week?"* · *"Did anyone surprise you this week?"* · *"Has one of your children become interested in something new?"* · *"Were there any moments you'd like your family to remember?"*

It should never feel like homework. It should feel like **talking with someone who genuinely remembers your family** — which is only possible because the Living Family Model *does* remember (§M.1–M.2), so each week's question is informed by everything before it.

*Architectural room to preserve now (constraint, not build):* the conversation is an **input stream into the Living Family Model**, not a standalone journaling feature bolted on the side. Whatever memory layer the Model eventually uses must accept free-form conversational input (voice-transcribed or typed) as first-class context — the same durable family-memory substrate M.1/M.2 assume. Don't design a rigid weekly-check-in table that the rest of the Model can't read from.

### M.5 Product rhythm — plan rarely, relate often

Underneath all of Appendix M is a cadence principle that should guide future product design broadly (not just Legacy):

> **Planning should happen infrequently. Relationship should happen regularly.**

The intended shape of family life inside North Star:

- **At the start of a term**, a family organises the term's projects, calendar and learning direction in one focused sitting. This is the heavy, deliberate act — and it happens a few times a year, not weekly.
- **After that, North Star should require very little administration.** The family's ongoing interaction is *living life, completing projects, uploading memories, and having brief conversations* (M.4). **The AI carries the burden of adapting the experience over time** — re-balancing, suggesting, noticing — so the parent doesn't have to re-configure anything.

This is the operational face of §0's "relationship, not software": a trusted guide reduces your workload, it doesn't hand you recurring chores. **The design test for any future feature:** does it *reduce* work for parents, or does it create another recurring administrative task? If it's the latter, it's probably the AI's job to absorb, not the parent's job to do. This principle also reinforces why the disclosure engine (§F) surfaces things *when they're useful* rather than presenting a backlog of setup — the platform should feel like it's doing the work, quietly, alongside the family.
