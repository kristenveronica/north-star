# North Star — Scaling Architecture

**Status:** In build — schema written (`supabase/migrations/0001_foundation.sql`)
**Date:** 2026-06-20
**Backend decision:** Supabase (Postgres + Auth + RLS + Edge Functions + Storage)
**AI:** Claude API (server-side)
**Beta target:** ~21 days, a handful of interested families. Scope = the "magic loop"
(onboarding → real AI projects → parent + child portals, cloud-synced, multi-family)
**plus AI Growth Reports**. Family-structure support in beta = **Unified mode only**,
but the schema accommodates all four structures + the full role model now.

---

## 1. The vision this architecture serves

North Star should grow from a one-family app into a platform that:

- serves **tens of thousands → millions** of families,
- lets **multiple communities** (churches, co-ops, values-led networks) offer it to their
  followers **under their own brand**, with the **same framework underneath**,
- gives every family a **parent portal linked to each child's portal**,
- uses **AI to generate unique projects and curriculum** from each family's values + each
  child's profile + their chosen learning style and structure,
- and does all of this **reliably across many users at once**, without data leaking between
  families and without "bugging out" under load.

Architecturally this is a **multi-tenant, white-label SaaS app with AI generation** — a
well-understood, well-trodden pattern. It does not require an app agency or exotic
technology. It requires a real backend (which the app does not have yet), disciplined data
isolation, and careful AI design.

---

## 2. Where the app is today (honest baseline)

The current app is a **complete, polished prototype for one family** — ~13,000 lines, full
parent + child portals, projects, rewards, councils, insights. But under the hood:

- **`localStorage` is the database.** All data lives in one browser on one device. There are
  no real accounts; opening the app elsewhere shows nothing. → Cannot scale to even 2 users.
- **AI is mocked.** `js/ai/suggestions.js` is hand-written rules, not a real LLM. It does not
  yet understand a family's values and generate unique curriculum.
- **No backend, no real auth.** Child "access codes" are strings checked in the browser.

This was the *right* way to prototype, and the code left clean swap points (see §7). Nothing
here is wasted — the entire UI is reused.

---

## 3. Target shape

```
┌─────────────────────────────────────────────────────────┐
│  BROWSER (existing UI — barely changes)                  │
│  views/  router  components   ← keep all of this          │
│  store.js  ← becomes a thin client that calls the backend │
└───────────────┬─────────────────────────────────────────┘
                │  HTTPS (authenticated)
┌───────────────▼─────────────────────────────────────────┐
│  SUPABASE (the backend we add)                           │
│  • Auth          — real parent accounts, child sessions  │
│  • Postgres      — one DB, millions of rows, RLS-isolated│
│  • RLS policies  — the wall that keeps families separate │
│  • Edge Functions— where Claude is called (keys hidden)  │
│  • Storage       — milestone photos / uploads            │
└───────────────┬─────────────────────────────────────────┘
                │  server-to-server (secret API key)
┌───────────────▼─────────────────────────────────────────┐
│  CLAUDE API — generates projects & curriculum            │
└──────────────────────────────────────────────────────────┘
```

**Core idea:** today the data lives in the browser; in the new model the browser holds
nothing permanent — it is a window onto a server every device shares. That single change
unlocks cross-device login, parent↔child linking, and millions of users.

---

## 4. Multi-tenancy + white-label

This is the heart of "communities brand it as their own, same framework underneath." It is a
standard pattern — one extra column, not a rebuild.

- One **`organizations`** table. Each community is one row: `name`, `logo`, `primary_color`,
  `subdomain` (e.g. `gracechurch.northstar.app`). Branding is loaded per org at runtime.
- Every other table carries an **`org_id`** and a **`family_id`**.
- **Row Level Security (RLS)** — a Postgres feature that enforces, *at the database level*,
  "you can only read/write rows belonging to your own family/org." It is not app code that can
  be forgotten; the database itself refuses. This is what lets tens of thousands of families
  safely share one database, and it is the primary defense against the "data leaks between
  users" class of bug at scale.

"Scale to millions without bugging out" = Postgres (volume) + RLS (isolation) + automated
tests (everything else). No magic.

---

## 5. Database schema (mapped from the actual `js/store.js`)

Today's `localStorage` collections map almost one-to-one onto tables. Every table gets
`id`, `org_id`, `family_id`, `created_at`.

| Collection today | Becomes | Notes |
|---|---|---|
| `auth` | **`auth.users`** (Supabase built-in) | password hashing + sessions handled for us |
| *(new)* | **`organizations`** | the white-label tenant |
| *(new)* | **`families`** | the family unit; belongs to an org; carries `structure` + `ns_locked` |
| *(new)* | **`family_members`** | **the multi-adult model** — many adults per family, each with a `role` (architect / co_architect / contributor / observer) |
| *(new)* | **`family_ns_versions`** | append-only North Star version history (restore / Family Lock) |
| `family` | **`family_profiles`** | mission, motto, core word, vision answers, learning style, modules, rhythm |
| `children` | **`children`** | includes `access_code` for the child portal |
| `projects` | **`projects`** | |
| `milestones` | **`milestones`** | |
| `reflections` | **`reflections`** | |
| `materials` / `cart` | **`materials`**, **`cart_items`** | |
| `parentObservations` | **`parent_observations`** | |
| `childSelfAssessments` | **`child_self_assessments`** | |
| `growthReports` / `insightReports` | **`growth_reports`** / **`insight_reports`** | |
| `showcases` | **`showcases`** | |
| `mentorshipRequests` | **`mentorship_requests`** | |
| `challengeParticipants` | **`challenge_participants`** | |
| `familyCouncils` | **`family_councils`** | |
| `guildConfig` / `insightsConfig` | columns on **`family_profiles`** (or own tables) | |
| milestone `evidence` (photos) | **Supabase Storage** + an **`evidence`** table | files don't belong in DB rows |

Behavioral change: authoritative logic like `completeMilestone()` (points/stars math) moves
to the server so it can't be tampered with from the browser.

---

## 6. Auth — parent portal ↔ child portal

- **Adults:** real Supabase Auth account (email + password, or Google sign-in). An adult joins
  a family via a **`family_members`** row carrying a **role**. A family can have *many* adults
  (both parents, co-parents across households, plus observer roles for grandparents / mentors /
  step-parents / coaches). This replaces the earlier "one parent = one family" assumption —
  see §6a.
- **Children:** keep the no-email `access_code` idea (`NOAH12`). Behind the scenes the child
  portal exchanges the code for a **limited, scoped session** that can only see that child's
  own missions and submit work — never parent settings. Same UX as today, safe at scale.

---

## 6a. Family structures, roles & the child-owned layer (from the Co-Parenting Framework)

The folder's **Family Structures & Co-Parenting Framework** is load-bearing for the data model.
We design for it now; beta ships **Unified mode** only.

**Four structures** (`families.structure`): `unified`, `collaborative`, `parallel`,
`independent`. Families can move between them without losing data.

**Four roles** (`family_members.role`):
- `architect` — full admin: vision, values, child profiles, AI generation, rewards.
- `co_architect` — equal authority, shared editing.
- `contributor` — view + add observations / photos / journal / celebrate; cannot alter
  foundational settings.
- `observer` — view only (grandparents, mentors, step-parents, coaches, therapists).

In **parallel** mode one member is the **Primary Architect** (`is_primary`); the other parent
is a contributor. The **North Star** is protectable via `families.ns_locked`, with every change
captured in `family_ns_versions` (restore supported, nothing lost).

**Child-owned layer (non-negotiable).** Reflections, milestone evidence, self-assessments and
growth reports *belong to the child*. The schema enforces this two ways: their child FKs use
`on delete restrict` (a child's story can't be cascade-deleted), and **their RLS policies grant
no DELETE** — no parent can hard-delete them via the API. The child eventually inherits this
record (future Adult Portal).

---

## 7. AI generation pipeline (the hard, valuable part)

Today `js/ai/suggestions.js` is rules. The real version is a **server-side Claude call** that
turns each family's unique inputs into unique curriculum:

```
Family vision + child profile + learning-style sliders + chosen domains + faith settings
        │  (assembled into a structured prompt on the server)
        ▼
   Claude API  ──►  returns a project as strict JSON
        │
        ▼  VALIDATION GATE  ← reject/repair malformed output before saving
   Save to projects + milestones tables  ──►  appears in the portal
```

Three things make this reliable, not flaky:

1. **Structured output** — Claude returns JSON matching the exact `project`/`milestone` shape,
   validated before saving. No free-text surprises.
2. **Guardrails** — family values + faith settings are hard constraints in every prompt, so
   generated content always respects them.
3. **Cost & rate control** — generation runs server-side with caching and per-family limits,
   so no single family runs up a huge bill and load stays bounded.

The North Star framework docs (in `co-work/`) become the **system prompt** — the fixed
pedagogy every family's generation is built on. That is the product's moat.

---

## 8. Migration path (no big-bang rewrite)

`js/store.js` already has the perfect seam: views call `addProject()`, `getChildStats()`,
`update()`, etc. — **they never touch `localStorage` directly.** So we rewrite the *inside* of
`store.js` to call Supabase; the ~30 view files barely change and the whole UI is reused.

Sequence (each step is shippable):

1. **Stand up Supabase** — create the project, the tables above, and RLS policies.
   *(No UI change yet.)*
2. **Real auth** — replace mock login with Supabase Auth. Multiple real parents can sign up.
3. **Swap `store.js` internals** — reads/writes go to Postgres; add a one-time importer to
   migrate the existing demo family up from localStorage.
4. **One real AI flow** — replace *just* `suggestProjectsForChild` with a real Claude edge
   function, end to end, with validation.
5. **Prove it with two families on two devices.** A clean loop here means the architecture is
   sound for a million.
6. **Then** layer white-label theming, billing, and the remaining AI surfaces.

---

## 9. Non-negotiables to design in from the start

- **Children's data privacy is legally serious.** An app holding kids' profiles, offered by
  communities, falls under COPPA (US) and GDPR-K (EU). Privacy and parental-consent flows must
  be designed in, not bolted on. Manageable, but non-negotiable.
- **Automated tests** around the money/points logic, RLS isolation, and the AI validation gate
  — this is what "without significant bugs at scale" actually comes from.
- **Operational ownership** (security, uptime, support, billing) is the one area a solo founder
  + AI eventually needs a trusted human engineer for — best added once there is traction, not
  a reason to hand the whole build to an agency.

---

## 10. Build vs. agency — recommendation

**Build it together, not via an agency.** The vision is a standard architecture, the tooling
(Supabase + Claude API) is already wired into this environment, and the value is in the
*details* of a values-driven product that you understand better than any agency would. An
agency would be slower, six-figures expensive, and would dilute your control of the vision.
Bring in one trusted engineer later for operations; keep the vision and the build in-house.

---

## Repositioning (2026-06-21): Guide-led human development platform

North Star is **not an AI curriculum generator** — it is a human-development platform where
children journey alongside **Guides** (illustrated characters), mentors and real experiences.
The AI works backstage for *parents*; **children never see "AI generated" language** — all
child-facing content is voiced as the child's chosen Guide. Source: the 8 framework PDFs in
`co-work/` dated 2026-06-21 (Product Bible, Human Development / Learning Frameworks, Family
Operating System, Family Structures & Co-Parenting, AI Architecture, Strategic Roadmap,
Community & Movement Blueprint).

**Phasing:** Strategic Roadmap puts the full Guide System in Phase 2 (2027); Phase 1 / beta is
the "Family Operating System". Implementation order (founder): data model → backend →
onboarding → Guide foundations → voice-first → localization → community → avatars later.

### Migration 0008 — repositioning foundation (additive, non-breaking)
- **`guides`** — 18 seeded illustrated personas (3 age bands `3-7 / 8-12 / 13-18` × 6), with
  `archetype`, `gender`, `blurb`, `persona` jsonb, and a `media_tier` ladder
  (`image → voice → interactive_avatar → conversational → video_avatar → companion`). Global
  reference data, readable by anon + authenticated.
- **`children`** — `guide_id` (the chosen Guide), `learning_profile` jsonb
  (`[{profile,status}]` — ADHD/dyslexia/ASD `diagnosed|suspected`, executive-function, anxiety,
  sensory differences, giftedness, other; personalizes, never labels), `mobility_profile`
  (freedom level: supervised / parent_drives / walk_local / bike_independent / public_transport
  / drives).
- **`family_profiles`** — `travel` jsonb (off / short_trip / long_stay / worldschool + dates +
  scope), `location` jsonb (precise address kept private + coarse city/region/country),
  `family_type`. **Faith stays family-level** (`faith_enabled` already existed); per-child faith
  columns are now unused.
- **Relationship Map** — `family_members.relationship_type` for app-user adults, plus
  **`family_relationships`** for the child's wider "village" incl. non-login people (grandparents,
  siblings, mentors, caregivers). Drives rewards/celebrations that reflect the real family.
- **`households`** — co-parenting Independent/Parallel scoping (available, unused in Unified beta).
- **`projects`** — `project_category` (enterprise/service/creative/adventure/…) and
  `experience_type` (project/business/mentorship/apprenticeship/worldschooling/nature/…); these
  supersede/extend the 7 "gigs".

Client mappers (`js/lib/repo.js`) and `store.js` child defaults updated for all new fields.
Capability taxonomy is treated as an **open set** (keep the 12 slugs, refresh display names,
allow additions). Capability progression has two scales: learning ladder
(Exposure→Practice→Competence→Confidence→Leadership→Mentorship) and growth-report status
(Emerging→Strengthening→Demonstrated→Leading).

### Still to design (founder brief, not in the framework docs)
`mobility_profile` UX, the Relationship-Map onboarding flow, and the AI **`voice-as-guide`**
post-process (re-voice all child-facing text in the chosen Guide's persona). Read
`co-work/NORTH STAR FAMILY SOVEREIGNTY & DATA CHARTER.docx` before privacy/export work.
