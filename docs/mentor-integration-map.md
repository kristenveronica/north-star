# Mentor Integration Map

*How the "App Development for North Star" vision integrates with the existing platform.*

Source: `co-work/APP DEVELOPMENT FOR NORTH STAR.pdf` · Status: **map only — phased, not yet built** · Last updated: 2026-07-01

---

## The vision in one line

Not 20 educational apps. **One world, many named AI mentors** — one login, one child profile, one shared AI memory, one journey — inside which live mentors, each embodying a capability (Polaris/Maths, Atlas/Literacy, Maestro/Music…). Mentors reference each other's activity ("Atlas told me you've been reading about volcanoes" → Explorer suggests Iceland → Polaris computes the flight time). The moat isn't any single mentor — it's that they **share one brain and one story**. And critically: don't call them apps. *Academies, Studios, Mentors.*

Guiding constraints from the document:
- **Build what specialists can't.** Don't rebuild Duolingo / TypingClub / Mavis Beacon. Build the thing they can't: AI conversation, shared memory, cross-domain narrative.
- **Everything connects. Nothing feels isolated.**
- **One coherent world**, "like Hogwarts" — different classrooms, different teachers, same school.

## The core insight

A "mentor" is **not a new app or object type**. It's a **persona bound to a Capability Domain**, plus an AI voice and access to shared memory. North Star already has the spine this needs — the Capability Domain catalogue (`js/seed.js:24`, 13 foundation + faith/travel).

## Mentor → Domain crosswalk

| Document mentor | Existing domain | Mapping |
|---|---|---|
| **Polaris** — Maths | `maths` | Clean 1:1 |
| **Atlas** — Reading & Literacy | `literacy` | Clean 1:1 |
| **Mercury** — Typing & Digital Fluency | `digital` | Clean 1:1 |
| **Maestro** — Music | `music` | Clean 1:1 |
| **Edison** — Science | `science` | Clean 1:1 |
| **Creator** — Photo/Film/Design/Writing | `creativity` | Clean 1:1 |
| **Entrepreneur** — Business | `enterprise` | Clean 1:1 |
| **Craftsman / Chef** — making, cooking, repair | `practical` | Two mentors → one domain (sub-skills) |
| **Adventure** — camping, survival, navigation | `nature` + `sport` | Spans two domains |
| **Character** — integrity, resilience, empathy | `leadership` + `relationships` | Cross-cutting |
| **Explorer** — Geography & Cultures | `travel` (optional) + `nature` | Partly the optional travel domain |
| **Builder** — Coding | sub-skill of `digital` | Overlaps Mercury |
| **Money** — Financial literacy | sub-skill of `enterprise` | Overlaps Entrepreneur |
| **Polyglot** — Languages | **none today** | Genuine gap: new domain or literacy sub-branch |
| **Inventor** — Engineering | sub-skill of `science` / `practical` | New sub-branch |

Two consequences:
1. ~9 mentors map 1:1 onto foundation domains — the natural first wave, and exactly the document's priority order (Polaris, Atlas, Mercury, Maestro, Edison…).
2. Mentors and domains are **not** 1:1 in cardinality. Some domains want two mentors; some mentors span domains; one (Polyglot) has no home. The mentor registry must reference domains **many-to-many**.

## The three hooks already in the codebase

1. **The reserved `guideId` field is the socket.** Every child record carries `guideId: null` (`js/store.js:427`) — defined, synced, unused. Reconcile "many mentors" vs single `guideId`: `guideId` = the child's chosen **home Guide** (homeroom face; orchestrates and hands off; satisfies the existing "children journey with a chosen Guide, never raw AI" design lock). Specialist mentors are who the child *visits*. This is the Hogwarts model: one home, many teachers.

2. **The "one AI memory" is the missing piece — and the moat.** Per-child context today is real but scattered: `reflectionReports`, `preferenceSignals`, `mediaAssets`, `parentObservations`, project `capabilityMap`. Nothing unifies them. The document's "everything connects" is a **shared child-context layer** every mentor reads and writes. It's what lets Atlas tell Polaris what the child's been reading — and what competitors assembling standalone apps cannot replicate. Must be designed *inside* the Trust Charter's commitments from day one.

3. **The AI plumbing is already mentor-shaped.** The edge function (`supabase/functions/ai/index.ts`) runs a persona system prompt ("SOUL") with prompt caching and action routing (`generate-project`, `growth-reflection`…). A mentor = SOUL + a per-mentor persona fragment + injected shared memory, via a new `mentor-turn` action. No new AI infrastructure.

## Proposed layering (conceptual)

```
SHARED SPINE (exists)         one auth · family · child profile · journey
                              Family North Star (mission/core word) — the seed
─────────────────────────────────────────────────────────────────────────────
SHARED CHILD MEMORY (new)     aggregates reflectionReports + preferenceSignals
  ← the moat piece            + mediaAssets + observations + capabilityMap into
                              one context every mentor reads/writes
─────────────────────────────────────────────────────────────────────────────
HOME GUIDE (guideId — unbuilt) the child's chosen face; greets, orchestrates
─────────────────────────────────────────────────────────────────────────────
MENTOR REGISTRY (new)         persona ⇢ domain(s), many-to-many
                              Polaris·Atlas·Mercury·Maestro·Edison·Creator…
                              each = SOUL prompt + persona fragment + memory
─────────────────────────────────────────────────────────────────────────────
CAPABILITY DOMAINS (exists)   13 foundation + faith/travel · subSkills
─────────────────────────────────────────────────────────────────────────────
PROJECTS / MILESTONES / REFLECTIONS (the magic loop)
                              already span domains via capabilityMap → mentors
                              become the *voice* of a capability in a project
```

## Phasing (post-beta — not in the 21-day beta scope)

- **Phase 0 (now):** Nothing built. Lock naming + the Guide-vs-mentor reconciliation; reserve the shared-memory design. Keep out of the beta (magic loop + growth reports only).
- **Phase 1 — Prove the pattern with one mentor:** Build **Polaris (Maths)** end-to-end on the existing edge function + `guideId` socket. One mentor, real conversation, writing to shared memory.
- **Phase 2 — Shared memory layer:** The unifying context — build it *before* mentors #3–4 so cross-mentor references work from the start rather than being retrofitted.
- **Phase 3 — Tier-1 wave:** Atlas, Mercury, Polyglot (decide the language gap: new domain or literacy sub-branch).
- **Phase 4 — Capability builders:** Maestro, Edison, Builder, Creator — where the multimodal magic lives ("AI listens / corrects pitch", "virtual Spanish village"); leverages the existing media-tier concept.
- **Phase 5 — North Star exclusives:** Entrepreneur, Money, Character — hardest and most differentiating, most aligned with the mission.

## Open questions / tensions to decide early

1. **Naming collisions.** "Guild" already = community hub (`js/views/guild.js`); "Mentor" already = external peer coach (`js/communityCatalogue.js:44`). Use **Academies / Studios** for the AI ones to avoid overloading.
2. **Build vs. partner discipline.** Make "don't rebuild commodity drill software" an explicit product rule so mentor scope doesn't sprawl.
3. **One memory vs. the Trust Charter.** The single shared memory is the moat *and* exactly the rich child profile the Trust Charter promises to protect. Design the memory layer inside the charter's commitments (family data sovereignty, no profiling-for-profit, child-first) from the start.
4. **Mentor ≠ domain cardinality.** Model the registry many-to-many from day one (Character spans domains; `practical` hosts two mentors; Polyglot needs a home).
5. **Model choice.** The edge function currently runs `claude-sonnet-4-6`. Conversational mentors that must hold persona, remember, and hand off may warrant `claude-opus-4-8` on the mentor turn — a per-action decision.

---

*This isn't a new direction so much as the natural next expression of the Capability Domain + Guide architecture already in place — the `guideId` socket is literally sitting empty for it, and the one genuinely new (and most defensible) piece is the shared child-memory layer.*
