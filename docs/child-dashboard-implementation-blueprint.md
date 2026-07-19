# North Star — Child Dashboard V1: Implementation Blueprint

*Implementation planning, not vision. The [First Five Minutes](child-dashboard-first-five-minutes.md) is the acceptance test; the [V1 spec](child-dashboard-v1-spec.md) is frozen. This maps every story moment to components, reuse, new code, complexity, priority, and acceptance criteria, then sequences it into reviewable PRs. Anything I'd change is quarantined in **Future Improvements** — V1 is not touched.*

**The headline for engineering:** ~80% of V1 is composition and restyle over code that already works. There is exactly **one** genuinely new backend concern (the daily Guide line) and a handful of small new frontend components (Sky, Light, relive overlay, dashboard shell).

---

## Reuse-first inventory

| Need | Reuse (exists today) | Location |
|---|---|---|
| Begin mission · steps · evidence · complete | `openSubmissionModal(...)` → `completeMilestone(id)` + `addMilestoneSubmission(id, payload)` | `js/components/submission.js`, `js/store.js` |
| Capture upload | `uploadFamilyMedia(file, {familyId, childId})` | `js/lib/storage.js` |
| Show a creation (private) | `signedUrl(path)` · `hydrateEvidenceMedia(root)` · `[data-sp]` placeholders | `js/lib/storage.js` |
| Celebration + sound | `celebrateMilestone` · `celebrateProject` · `isSoundOn/toggleSound` | `js/components/celebrate.js` |
| Guide conversation (opt-in 💬) | `aiMentorTurn({mentor, child, history, message})` → `mentor-turn` | `js/lib/ai.js`, `supabase/functions/ai/index.ts` |
| Internal momentum ledger / earned badges | `getChildStats(childId)` → `{ totalMomentum, badges, … }` | `js/store.js` |
| Modal · toast · icons · read-aloud host | `openModal` · `toast` · `nsIcon` | `js/components/ui.js` |
| Voice input | `data-voice` attrs + `enableAutoVoice` | `js/components/voiceInput.js` |
| Child activity → Archive (LFM) | `setArchiveSink` (wired in `app.js`); `completeMilestone` emits events | `js/app.js`, `js/store.js` |
| Server read of Understanding | `admin.from("understandings").select(...).or('subject_id.eq.<child>,scope.eq.family')` | `supabase/functions/ai/index.ts` (pattern at generateProject) |

**Genuinely new code (all small):** a `daily-guide` edge action + cache; `SkyBackdrop` + `MomentumLight` (CSS/SVG); a `readAloud` util; the `renderChildPortal` shell rebuild; a relive overlay; a title→question transform.

---

## Moment-by-moment (chronological)

Each moment: **intent · component · motion · AI · engineering · reuse · new · complexity · priority · acceptance.**

### M0 — Arrival (0:00): calm, not empty
- **Intent:** shoulders drop; "this isn't school."
- **Component:** `SkyBackdrop` (dashboard shell).
- **Motion:** sky fades up (600ms); dawn/day/dusk/night gradient by local hour; one slow drifting star. `prefers-reduced-motion` → static.
- **AI:** none.
- **Engineering:** rebuild `renderChildPortal` top zone; delete metric row + dashboard calendar.
- **Reuse:** `renderChildPortal` scaffold, `nsIcon`.
- **New:** `SkyBackdrop` (CSS gradient keyed to hour buckets + SVG starfield).
- **Complexity:** Low.
- **Priority:** P1.
- **Acceptance:** on open, no metric row, no calendar, no loading wall; background reflects local time-of-day; reduced-motion shows a static sky.

### M1 — Recognition (0:03): "I hear you've been building forts for Biscuit" — THE MOAT
- **Intent:** the "how did you know that" smile; parent's "it understands my child."
- **Component:** `GuidePresence` + `GuideGreeting` (one line + 🔊).
- **Motion:** Guide eases in (200ms after sky); the line appears within ≤3s of open.
- **AI:** the **daily Guide line** — one cached line/child/day from `mentor-turn`-style generation reading the child's Understanding (declared interests + recent activity + active circumstance). Day-one draws on **onboarding-declared interests** (there is no "yesterday").
- **Engineering:** new `daily-guide` edge action; small cache table keyed `(child_id, local_date)`; frontend fetch-or-evergreen.
- **Reuse:** understandings read pattern; `aiMentorTurn` transport; `ai_reports` caching shape.
- **New:** `daily-guide` action + cache; `GuideGreeting` component.
- **Complexity:** Medium.
- **Priority:** P1 (this is the referral hook).
- **Acceptance:** on first load the greeting names a *true, specific* thing from the child's Understanding; it is ≤1 sentence (Builder ≤2); if the cached line isn't ready, a warm evergreen line shows instantly and never blocks arrival; regenerates once per local day.

### M2 — One adventure (0:20): "Biscuit needs something to jump over"
- **Intent:** clarity + want; one obvious thing.
- **Component:** `TodayHero` → `MissionCard`.
- **Motion:** hero settles last with a gentle spring so it's *the* thing; Begin button breathes (~4s loop, paused under reduced-motion).
- **AI:** none (title→question is a copy transform; deeper phrasing is Future).
- **Engineering:** resolve current active project → first incomplete milestone from `store`; render title as a question.
- **Reuse:** store project/milestone selectors.
- **New:** `TodayHero`, `MissionCard`, `titleToQuestion()` (tiny, deterministic).
- **Complexity:** Low.
- **Priority:** P1.
- **Acceptance:** exactly one primary action visible; it maps to the child's next incomplete milestone; if none exists, the first-run state shows (M-edge); no project navigation required.

### M3 — Begin → into the yard (1:00): one step at a time
- **Intent:** effortless action; the interface disappears; he's sent off-screen.
- **Component:** the guided mission (existing modal), invoked from the hero.
- **Motion:** hero → mission feels like stepping forward (expand, not route change).
- **AI:** none in V1.
- **Engineering:** wire `Begin` → `openSubmissionModal({ milestone, project, onComplete, onSubmit })`.
- **Reuse:** **`openSubmissionModal`** (already does steps, evidence, complete), `completeMilestone`, `addMilestoneSubmission`.
- **New:** none (pass-through). Ensure single-step disclosure + a visible "ask Sol" stuck affordance (already present as the Guide).
- **Complexity:** Low.
- **Priority:** P1.
- **Acceptance:** tapping Begin opens the mission with no route change; a child can complete without ever opening a project screen; a "stuck" affordance is always reachable.

### M4 — He does the real thing (2:30): comes back, next step
- **Intent:** capability; a little bit hard, in the real world.
- **Component:** the guided mission (continue).
- **Motion:** step→step arrival (fade/slide, ~250ms).
- **AI:** none.
- **Engineering:** none beyond M3 (existing multi-step flow).
- **Reuse:** existing mission steps.
- **New:** none.
- **Complexity:** Low.
- **Priority:** P1.
- **Acceptance:** steps advance one at a time; nothing shows a wall of text; off-screen steps are explicit and the child can return and continue.

### M5 — Sol notices the true thing (3:15): NOT points
- **Intent:** "seen," not "rewarded."
- **Component:** completion celebration line.
- **Motion:** light rises from the hero into the sky + soft chime (size-calibrated).
- **AI:** **V1 = a warm, mission-aware templated line** (no per-completion AI). The *interpretive* "you made it small so Biscuit could be brave" noticing needs AI reading of what he did → **Phase 2** (non-blocking `mentor-turn` observation, shown after the instant celebration).
- **Engineering:** restyle `celebrateMilestone` to "light rises" and a warm line; **delete the `+X Momentum Points` toast.**
- **Reuse:** `celebrateMilestone`, `isSoundOn`.
- **New:** Light-rise animation; templated celebration copy.
- **Complexity:** Low (V1) / Medium (Phase-2 AI notice).
- **Priority:** P1 (templated) · P2 (AI notice).
- **Acceptance (V1):** completion shows light rising + a warm, mission-specific line with **no number and no "+points."** No trophy, no score.

### M6 — Sol asks (3:30): a question, not a quiz
- **Intent:** hands thinking back; plants tomorrow.
- **Component:** optional check-in after completion.
- **Motion:** gentle fade-in; skippable.
- **AI:** V1 = a gentle templated prompt (reuse reflection prompts), voice-answerable, never graded. Guide-voiced dynamic question → Phase 2.
- **Engineering:** reuse the existing check-in/reflection surface; make it optional and skippable.
- **Reuse:** `REFLECTION_PROMPTS`, `data-voice`, existing reflection flow.
- **New:** none of substance.
- **Complexity:** Low.
- **Priority:** P1.
- **Acceptance:** the prompt is optional, answerable by voice, never blocks, never graded; skipping is frictionless.

### M7 — First light (4:15): capture rises into the sky
- **Intent:** "what I made matters"; the first thing in a sky that's only his.
- **Component:** capture (in mission) → `MomentumLight`.
- **Motion:** the photo lifts off and flies up to settle as one glowing point (FLIP, ~500ms). **No "forming constellation" tease from a single light** (Sprint-3 fix; Constitution Art. VII/XI).
- **AI:** none.
- **Engineering:** on submission with media, animate the captured tile into the Sky; render accumulated Light from `getChildStats` (no number shown).
- **Reuse:** `uploadFamilyMedia`, `addMilestoneSubmission`, `getChildStats`.
- **New:** `MomentumLight` (SVG) + fly-up transition.
- **Complexity:** Medium.
- **Priority:** P1.
- **Acceptance:** capturing adds one visible light to the sky with a fly-up; **no number, no "+points," no progress bar/forming tease**; reduced-motion → the light simply appears.

### M8 — Relive (4:15b): tap the light
- **Intent:** pride, revisited.
- **Component:** `LatestCreation` relive overlay.
- **Motion:** light expands into a small playback card.
- **AI:** none in V1 (Guide's line is the cached/celebration line; child's-own-voice narration is Phase 2).
- **Engineering:** newest 1–3 evidence rows → tap → overlay with signed media + the line.
- **Reuse:** `signedUrl` / `hydrateEvidenceMedia` / `[data-sp]`, `openModal`.
- **New:** `LatestCreation` + relive overlay.
- **Complexity:** Low.
- **Priority:** P1.
- **Acceptance:** the newest creation is shown as a light; tapping replays the media with a warm line; nothing requires the child to manage files.

### M9 — Tomorrow whisper (4:45): a thread, not a streak
- **Intent:** anticipation; no guilt.
- **Component:** `TomorrowWhisper` (all-done state) + Guide sign-off.
- **Motion:** a soft wrapped shimmer on the horizon.
- **AI:** V1 = warm templated sign-off; day-2 personalisation comes from the next daily line.
- **Engineering:** when today's mission is complete, swap the hero for a calm done-state with a wrapped hint. **No streak counter, no "come back to keep your streak."**
- **Reuse:** hero container.
- **New:** `TomorrowWhisper` (small).
- **Complexity:** Low.
- **Priority:** P1.
- **Acceptance:** the done-state is calm and celebratory with a forward hint; **no streak/guilt UI anywhere**.

### M10 — Close wanting more (5:00)
- **Intent:** "I want to come back."
- **Component:** whole-screen restraint.
- **Motion:** none.
- **AI:** none.
- **Engineering:** ensure nothing nags on exit; no notifications.
- **Reuse:** n/a.
- **New:** none.
- **Complexity:** Low.
- **Priority:** P1.
- **Acceptance:** no exit interstitial, no notification prompt, no "rate us"; the last thing seen is the tomorrow-whisper.

### M-edge — Day-one / first-run states (cross-cutting)
- **Intent:** never an empty or broken first impression.
- **Component:** `TodayHero` first-run + empty variants; achievement empty sky.
- **AI:** the day-one greeting rides onboarding-declared Understanding (M1).
- **Engineering:** first-run ("your first adventure is being prepared / let's meet Sol"); all-done; no-captures ("Latest Light" possibility state); offline evergreen greeting; **never render "0 badges"** — empty achievement sky = possibility.
- **Reuse:** first project comes from the existing quickstart/generate flow.
- **New:** the empty/first-run variants.
- **Complexity:** Medium.
- **Priority:** P1.
- **Acceptance:** with no project, no captures, or offline, the child sees a warm invitation — never an empty grid, a "0", or a spinner-of-doom.

---

## New code required (consolidated)

1. **`daily-guide` edge action** (`supabase/functions/ai/index.ts`) — reads the child's Understanding slice, returns one ≤1–2 sentence line; **cache** table keyed `(child_id, local_date)`; regenerate at day rollover. *(The only new backend concern.)*
2. **`SkyBackdrop`** — CSS gradient by local-hour bucket + SVG starfield; reduced-motion aware.
3. **`MomentumLight`** — SVG light from `getChildStats` (no number) + fly-up on capture/complete.
4. **Achievement sky (minimal)** — earned Constellations as named lights from `getChildStats().badges`; never-empty possibility state.
5. **`TodayHero` / `MissionCard` / `titleToQuestion()`** — resolve next milestone; Begin → `openSubmissionModal`.
6. **`GuidePresence` / `GuideGreeting`** — avatar + the daily line + 🔊.
7. **`LatestCreation` + relive overlay** — signed media playback.
8. **`readAloud` util** — `speechSynthesis` wrapper; Explorer auto-read.
9. **`renderChildPortal` shell rebuild** — compose the above into the 3-zone dashboard, `tier` prop; delete metric row, dashboard calendar, `+pts` toasts.

---

## Roadmap

| Task | Cx | Depends on | Effort | User value | Risk |
|---|---|---|---|---|---|
| Dashboard shell + `SkyBackdrop` (delete metric row/calendar) | Low | — | 1–2d | High (calm arrival) | Low |
| `TodayHero` + Begin→`openSubmissionModal` | Low | shell | 2–3d | **Highest** (kills nav chain) | Low |
| `MomentumLight` + celebration→Light (drop `+pts`) | Med | hero | 1–2d | High (felt progress) | Low |
| `LatestCreation` + relive | Low | shell | 1–2d | High (pride) | Low |
| `daily-guide` action + cache + `GuideGreeting` | Med | shell | 2–3d | **Highest** (moat/referral) | Med (AI copy quality, cost) |
| `readAloud` + tier auto-voice | Low | shell | 1d | Med (accessibility) | Low |
| First-run / empty / offline states | Med | hero | 1–2d | High (no bad first impression) | Med |
| Never-empty achievement sky | Low | shell, Light | 1–2d | Med (job-2) | Low |
| *(P2)* AI "noticing" line at completion | Med | daily-guide, hero | 2d | High (the seen moment) | Med (cost/latency) |
| *(P2)* Constellation naming ceremony + replay | Med | Light, achievements | 3d | High | Low |
| *(P2)* Real Guide TTS | Med | greeting | 3d | High (voice magic) | Med (cost) |
| *(P3)* Full Museum · Book of Childhood · helping-lights · deep memory | High | above | — | High | — |

**Phase 1 (must ship):** the first eight rows. ≈ **10–17 dev-days**, one engineer, ~2–3 weeks.
**Phase 2 (shortly after):** AI noticing · naming ceremony · real TTS.
**Phase 3 (future):** Museum, Book of Childhood, helping-lights, deep multi-year memory.

**Cross-cutting dependency/risk to flag now:** the deeper "it noticed you *improved*" magic needs child activity to reach the **Archive** — but child-portal (access-code) sessions don't currently write `family_archive` (gap **G1**). Day-one referral works without G1 (it rides parent-declared onboarding interests). Anything beyond day-one memory should be sequenced after G1 is solved. Don't let Phase 2 assume child-side Archive writes exist yet.

---

## GitHub-ready PR checklist

Small, independently testable, each shipping visible value. Suggested branch names in brackets.

### Phase 1 — must ship before launch

- [ ] **PR1 · Dashboard shell + Sky** `[feat/child-dashboard-shell]`
  Rebuild `renderChildPortal` into the 3-zone shell; add `SkyBackdrop` (time-of-day gradient + starfield, reduced-motion aware); **delete the metric row and the dashboard calendar.** *Test:* open at different local hours → gradient changes; no metric row/calendar; reduced-motion static.
- [ ] **PR2 · Today Hero (actionable in place)** `[feat/today-hero]`
  `TodayHero`/`MissionCard`; resolve next incomplete milestone; `titleToQuestion`; **Begin → `openSubmissionModal`**; complete/upload via existing flow. *Test:* one primary action; complete a mission without opening a project; first-run shows invite when no milestone.
- [ ] **PR3 · Momentum as Light** `[feat/momentum-light]`
  `MomentumLight` from `getChildStats` (no number); restyle `celebrateMilestone` to light-rise; **remove `+X Momentum Points` toasts and any visible count.** *Test:* completing adds a light with fly-up; no number anywhere; reduced-motion → light appears.
- [ ] **PR4 · Latest Light + relive** `[feat/latest-light]`
  `LatestCreation` (newest 1–3 evidence via `signedUrl`); tap → relive overlay. *Test:* newest capture appears; tap replays media; no file-management UI.
- [ ] **PR5 · Daily Guide line (the moat)** `[feat/daily-guide]`
  New `daily-guide` edge action reading Understanding; cache keyed `(child_id, local_date)`; `GuidePresence`+`GuideGreeting` with 🔊; evergreen fallback that never blocks arrival. *Test:* greeting names a true onboarding-declared interest; ≤1–2 sentences; missing cache → instant evergreen; one regeneration/day.
- [ ] **PR6 · Read-aloud + tier auto-voice** `[feat/read-aloud]`
  `readAloud` (`speechSynthesis`); Explorer auto-reads greeting+mission; `tier` prop wiring. *Test:* Explorer auto-reads on open; Builder/Navigator read silently unless 🔊 tapped.
- [ ] **PR7 · First-run / empty / offline states** `[feat/dashboard-empty-states]`
  First-adventure-waiting; all-done + `TomorrowWhisper` (no streak UI); no-captures possibility; offline evergreen greeting. *Test:* new child (no project) sees an invite; all-done shows calm forward hint; offline still renders + greets.
- [ ] **PR8 · Never-empty achievement sky** `[feat/constellations-min]`
  Earned Constellations as named lights from `getChildStats().badges`; empty = possibility sky (never "0"/locked grid). *Test:* child with no badges sees a possibility sky, not "0 badges"; earned ones render as named lights.

### Phase 2 — shortly after launch
- [ ] **PR9 · AI "noticing" at completion** `[feat/guide-notice]` — non-blocking `mentor-turn` observation appended after the instant celebration; gated for cost. *Depends:* PR2, PR5.
- [ ] **PR10 · Constellation naming ceremony + replay** `[feat/constellation-ceremony]` — Guide draws the lines + tap-to-replay the forming moments. *Depends:* PR3, PR8.
- [ ] **PR11 · Real Guide TTS** `[feat/guide-tts]` — pre-generated voice replacing `speechSynthesis` on the key lines. *Depends:* PR5, PR6.

### Phase 3 — future evolution
- [ ] Full walkable Museum · Book of Childhood (print) · cross-sibling helping-lights · deep multi-year memory (**after G1**: child-portal Archive writes).

---

## Future Improvements *(not V1 — parked deliberately)*

- **Per-completion AI "noticing"** (the exact *"you made it small so Biscuit could be brave"* line) — emotionally central but needs an interpretive AI call; V1 ships a warm templated celebration + the daily line, and this lands in **Phase 2 (PR9)** with a non-blocking swap so the celebration stays instant.
- **G1 — child-portal Archive writes.** The richest memory ("noticed you improved") requires child-side activity in the Archive. Solve G1 before Phase-2 memory features assume it.
- **Real Guide voice (TTS).** `speechSynthesis` is a placeholder; the intimacy of the moat wants a real recorded voice (Phase 2).

*None of the above change the frozen V1. Engineering can begin at PR1 immediately; PR2 is the highest-value first merge.*
