# North Star — UX Sprint 1: The Child Dashboard

*One screen. The place every adventure begins. Buildable on the current stack (vanilla ES-module views, CSS/SVG, Supabase, the `ai` edge function, `family-media` storage, Web Speech). This is the launchable expression of the [Child Portal V2 vision](child-portal-v2-experience-design.md) and it obeys the [LFM Constitution](LIVING_FAMILY_MODEL_CONSTITUTION.md).*

The dashboard has three jobs and nothing else: **(1) show me what matters today · (2) help me feel proud of who I'm becoming · (3) make me excited to come back tomorrow.** Every element below earns one of those or is cut.

---

## 1 · Dashboard Philosophy

The dashboard is **a doorway, not a desk.** A child opens it to *step into today's adventure*, not to review status. So the screen is mostly calm space with **one glowing thing to do**, a quiet sense of *who they're becoming* above it, and a whisper of *tomorrow* at the edge.

Three convictions drive every decision:

- **Today is the hero.** The current mission dominates the screen and is *fully actionable in place* — start, hear it, complete it, add what you made, ask the Guide — with **zero navigation** into projects and milestones. (Today, a child must dig: find project → open → find milestone → open → complete → return. We delete that entire chain.)
- **Pride, not statistics.** No score header. Progress is *felt* (light in a sky), never *counted* (247 pts, 3/8 milestones, 🏅 badges). Numbers make children manage themselves; light makes them feel themselves growing.
- **Warm, personal, calm, spacious.** Big touch targets, almost no text for the youngest, one primary action, generous quiet. If a child scans it and wonders "what do I press?", it has failed.

**Delete from the dashboard:** the metric row (Stars/Momentum/Badges/Milestones done), the month-grid calendar, project lists, statistics, menus, and any school word (assignment, grade, milestone-as-jargon, "0 badges").

---

## 2 · User Journey (the open-loop)

The dashboard owns the first two beats of the daily loop and hands off to the mission:

1. **Open → recognised (0–1s).** The world fades up in the child's time-of-day sky. The Guide is present. No login wall slammed shut, no spinner-of-doom.
2. **Greeted by memory (1–2s).** One warm line from the Guide that *only their Guide could say* — because it remembers yesterday. Spoken aloud for Explorers.
3. **Clarity (by 3s).** Exactly one thing glows: **Today's Adventure.** The eye cannot miss it.
4. **Want (3–4s).** It reads as a question/quest, not a task. The child *wants* to tap.
5. **Act (tap).** Begin / hear / complete / capture / ask — all from here. The dashboard becomes the mission without a route change for the young; steps arrive one at a time.
6. **Return brighter.** Completing walks them *back home under a brighter sky* — a new light, a true word from the Guide, and a wrapped hint of tomorrow. The last feeling is anticipation.

Total time from open to *doing* for a 5-year-old: **one tap.**

---

## 3 · Information Architecture

The dashboard is three stacked zones, in strict priority. On small screens they stack; on large screens Today still dominates and the rest becomes calm periphery.

```
┌─ SKY (ambient, glanceable) ─────────────────────────┐
│  who I'm becoming: gathered Light + forming/earned  │   ← pride, never a scoreboard
│  constellations · time-of-day gradient · the Guide  │
├─ TODAY (the hero — owns the screen) ────────────────┤
│  Today's Adventure card, fully actionable in place  │   ← the one job
│  ▶ begin · 🔊 read aloud · ✓ I did it · 📷 add · 💬  │
├─ HORIZON (a whisper) ───────────────────────────────┤
│  latest creation to be proud of · a hint of tomorrow│   ← pride + anticipation
└─────────────────────────────────────────────────────┘
```

**On the dashboard:** Sky (Light + constellations + Guide), Today's Adventure (inline-actionable), one recent creation, a tomorrow-whisper.
**Reachable but not resident:** the full Sky/constellation view, the Museum (portfolio), the project path, the Guide conversation — entered by *looking up* (sky) or *looking back* (a creation), never a nav bar of equal tabs. **Explorers get no menu at all** — only Today and the Guide.
**Not on the dashboard at all:** calendar grid, stats, settings, project management.

---

## 4 · Desktop Wireframe (Builder shown; tier notes below)

Desktop is *not* a denser dashboard — it's the same calm, centred, with the Sky given room to breathe. Max content width ~880px, centered in the sky.

```
  ╭──────────────────────────────────────────────────────────────────────╮
  │   · ✦          ·                    ·         ✦        (living sky:    │
  │        ·   ✧ Courage        ·               ·    ·      time-of-day    │
  │   ·           (a forming constellation glows near completion)  gradient)│
  │                                                                        │
  │        🧭  "Morning, Ada. Yesterday you didn't give up on the          │
  │             bridge. I've been thinking about how you'll test it."      │
  │                                                                        │
  │      ╭────────────────────────────────────────────────────────╮       │
  │      │  TODAY'S ADVENTURE                                      │       │
  │      │                                                        │       │
  │      │   The Bridge Test                                      │       │
  │      │   "Will it hold your weight? Let's find out."          │       │
  │      │                                                        │       │
  │      │   [ ▶  Begin ]   🔊 Read aloud   💬 Ask Nima            │       │
  │      │   ─────────────────────────────────────────           │       │
  │      │   ✓ I did it        📷 Add what I made                 │       │
  │      ╰────────────────────────────────────────────────────────╯       │
  │                                                                        │
  │    ── look back ──                              ── tomorrow ──         │
  │    ◐ your bridge, day 2   (tap to relive)       ✦ something new waits  │
  ╰──────────────────────────────────────────────────────────────────────╯
```

Desktop adds *air*, not widgets. The Sky can be wider and more alive; the hero stays singular.

---

## 5 · Tablet Wireframe

The reference form factor (most family use). Single column, thumb-reachable, hero centered.

```
 ╭─────────────────────────────────────╮
 │  ·  ✦      ·        ·      ✦   ·     │  living sky, time-of-day
 │     ✧ Courage forming…    ·         │  gathered light (glanceable)
 │                                     │
 │   🧭  "Morning, Ada. Ready to test  │  Guide greeting (spoken on tap/auto)
 │        the bridge you built?"       │
 │                                     │
 │  ╭───────────────────────────────╮  │
 │  │  TODAY'S ADVENTURE            │  │
 │  │  The Bridge Test              │  │
 │  │  "Will it hold your weight?"  │  │
 │  │                               │  │
 │  │     [ ▶  Begin ]              │  │  ONE primary action, large
 │  │   🔊 read   💬 ask   📷 add    │  │  secondary inline actions
 │  │        ✓ I did it              │  │
 │  ╰───────────────────────────────╯  │
 │                                     │
 │  ◐ your latest creation  ✦ tomorrow │  proud glance + anticipation
 ╰─────────────────────────────────────╯
```

---

## 6 · Mobile Wireframe (Explorer shown — the extreme case)

Explorer mobile is **almost wordless and auto-voiced.** The greeting and mission read themselves aloud on open. The hero is a single enormous, joyful tap.

```
 ╭───────────────────────────╮
 │  ·   ✦    ·     ✦    ·     │  simple magic sky
 │                           │
 │        🧭  (waves)         │  Guide, big & warm; auto-speaks:
 │                           │  "Hi Ada! Let's build the bridge!"
 │   ╭─────────────────────╮ │
 │   │                     │ │
 │   │      🌉  (image)     │ │  the mission = a big picture
 │   │                     │ │
 │   │    ▶  L E T ' S  G O │ │  ONE giant tap (full-width)
 │   │                     │ │
 │   ╰─────────────────────╯ │
 │                           │
 │     🔊        💬           │  hear again · ask Nima (icons only)
 │                           │
 │   ⭐ (a star twinkles —    │  yesterday's light, felt not counted
 │       your sky is growing) │
 ╰───────────────────────────╯
```

Explorer has **no ✓ / 📷 on the dashboard** — completion and capture happen *inside* the guided mission (voice-led), so the dashboard stays a single joyful doorway. Builder/Navigator surface ✓ and 📷 inline for speed and independence.

---

## 7 · Component Hierarchy (buildable tree)

Rebuild `renderChildPortal()` as a composition of small components. **Bold = new; plain = reuse existing.**

```
ChildDashboard(container, {childId})
├── **SkyBackdrop**            time-of-day CSS gradient + SVG starfield (reduced-motion aware)
│   └── **MomentumLight**      gathered light + nearest forming constellation (SVG)
├── **GuidePresence**          avatar (img/SVG) + idle micro-animation
│   └── **GuideGreeting**      one daily line (cached; mentor-turn) + 🔊 speak
├── **TodayHero**              the whole job — resolves current active project → next incomplete milestone
│   ├── **MissionCard**        title-as-question + one-line hook + hero image
│   ├── PrimaryAction "Begin"  → reuses the existing mission flow (handleMilestoneTap / mission modal)
│   └── **InlineActions**      🔊 read aloud · ✓ I did it (completeMilestone) · 📷 add (storage.js upload → addMilestoneSubmission) · 💬 ask (Guide panel → mentor-turn)
├── **LatestCreation**         1–3 recent evidence tiles as "glowing memories" (family-media signed URLs) → tap to relive
├── **TomorrowWhisper**        wrapped hint (only after today is done)
└── GuidePanel (lazy)          voice-first Guide conversation (mentor-turn), opened by 💬
```

Tier is a prop derived from the child's age band (Explorer/Builder/Navigator) that changes register, density, voice-default, and which InlineActions render on the dashboard vs inside the mission.

---

## 8 · Interaction Design (the core: act without navigating)

Everything a child needs to *do today* happens from the hero. None of these change route.

| Action | Behaviour | Buildable via |
|---|---|---|
| **Begin** | Enters the guided mission — steps one at a time. Explorer: full-screen, voice-led. Builder/Nav: expands in place or a focused overlay. | Reuse `handleMilestoneTap` → existing mission modal (already renders `instructions[]`, submission, complete) |
| **Read aloud** | Speaks the greeting + mission title + first step. Explorer auto-plays on open. | `speechSynthesis` now; swap to pre-generated Guide audio later. Existing `data-voice` infra |
| **I did it** | Marks the mission done → celebration (§9) → sky brightens. If a reflection is required, flows to a gentle voice reflection. | `completeMilestone(id)` (already emits Archive evidence) |
| **Add what I made** | Camera/file → attaches to the mission and flies up into the sky/Museum. | `js/lib/storage.js` upload → `addMilestoneSubmission` (existing) |
| **Ask [Guide]** | Opens the Guide panel; voice-first; the Guide *nudges, never answers*. | `js/lib/ai.js` → `mentor-turn` (existing) |

**Principle:** the dashboard *is* the entry to the mission, not a table of contents pointing at it. For Explorers the dashboard and the mission are one continuous, voice-led flow.

---

## 9 · Micro-interactions

Small, tasteful, meaningful — never gimmick.

- **Living primary action:** the Begin button has a faint breathing scale (≈4s loop, 1.0→1.02) so the eye finds it without a label. Pauses under `prefers-reduced-motion`.
- **Physical taps:** 60ms scale-down + soft haptic (`navigator.vibrate` on mobile) + a warm click. Feels like pressing something real.
- **Guide notices:** on open, the Guide does a small lean-in/wave; on completion, a proud straighten. Two sprite states + CSS, no rig.
- **Capture = pinning light:** an uploaded photo shrinks and *flies up into the sky*, landing as a glowing memory. (FLIP transition, ~500ms.)
- **Sky responds to time:** dawn/day/dusk/night gradient shifts by local clock; a shooting star occasionally crosses (rare, ≤1/session) — a tiny reason to look up.
- **Constellation forming:** when a mission's light brings a badge close, its stars pulse faintly — the child *feels* it forming before it's named.

---

## 10 · Animation Concepts

- **Arrival:** sky fades up (600ms), Guide eases in (200ms delay), hero settles last (spring, gentle overshoot) so it lands as *the* thing.
- **Begin → mission:** the hero expands/steps *walk out onto the path* — a forward spatial move, never a page swap.
- **Completion celebration (size-calibrated):** light rises from the hero into the sky, a soft chime, the Guide's true line. Small win = one star + chime; mission done = a bloom; project done = the fullest moment (deferred to a later sprint).
- **Return home:** camera "walks back" under a visibly brighter sky; the new light is where the child left it.
- **Reduced-motion path:** all of the above degrade to opacity fades. Motion is delight, never a dependency.

Buildable entirely with CSS transitions/keyframes + a tiny lightweight confetti/particle (canvas) for the big moments. No game engine.

---

## 11 · AI Guide Behaviours — the un-copyable layer

The Guide is present, never intrusive: it welcomes, notices effort, celebrates, and sometimes fades into the background. **Not a chatbot** — the dashboard opens to a *line*, not a chat box; conversation is opt-in via 💬.

**The daily line** (the magic, made cheap): once per child per day, generate **one** Guide line via `mentor-turn`, reading the child's **Understanding** (interests, recent activity, active circumstances) — then **cache it** (same pattern as `ai_reports`). Instant on load, ~1 generation/child/day. It does one of:

- **Remembers yesterday:** *"Yesterday you didn't give up on the bridge — today we test it."*
- **Notices improvement:** *"Your drawings have gotten braver this week. I've noticed."*
- **Connects across time:** *"This reminds me of the shelter you built last summer."* (Understanding → a past interest.)
- **Gently adjusts for a hard week:** *"Let's keep today light and kind."* (An active `circumstance` in Understanding softens the day.)

**Guard rails (Constitution, load-bearing):** every line is **true in the evidence** — no manufactured warmth (Art. V/VII), and the Guide's observations become **Archive evidence about the child**, which is how the portal finally *sees* what children do (closes the child-portal blind spot). The Guide **hands thinking back** — nudges, not answers — to grow capability, never dependency (Art. XIV). What a parent has confirmed/corrected shapes what it says (Art. XIII).

**"If AI vanished" test:** the sky, the craft, the celebrations remain lovely — so it's never hollow. AI adds only what an exceptional mentor adds: *being deeply known.* That's where it's spent, and nowhere on arithmetic.

---

## 12 · Momentum — redesign (replace points with Light)

**Should Momentum Points exist? As a visible, chased number — no. As an internal signal — keep it, hidden.**

Replace the number with **Light**: acts that matter add light to the child's sky, weighted toward *character over completion* — persistence, courage, curiosity, initiative, reflection, helping others, and (honoured most) **returning after a failure**. The child never sees "+10 pts." They see the sky brighten, a star appear, and the Guide say the one *true* reason.

- **Buildable:** keep the existing `momentumPoints`/stars as the internal ledger (no schema change); render it as light — an SVG cluster of soft dots near the top that grows. Delete the "+X Momentum Points" toasts and the metric row.
- **Explorer:** a literal star twinkles in with a chime.
- **Builder:** light gathers visibly toward the next unnamed constellation.
- **Navigator:** a quiet "ways you've shown up lately" read — closer to a personal insight than a game.

You cannot game a sky. There is no leaderboard because the only comparison is to yesterday's self, offered gently.

---

## 13 · Achievements — redesign (Constellations, never empty)

Badges become **Constellations the Guide names** when enough light gathers around a *way of being* — identity, not stickers: *Creative Courage, Natural Explorer, Problem Solver, Kitchen Capable, The One Who Came Back.* Tapping one *replays the moments* that formed it (real captures + the Guide's memory). Years later the child remembers the night it was named.

**Never "0 badges."** A child with none sees **a clear night sky full of possibility** — and, near the hero, the *nearest forming* constellation faintly pulsing. The empty state is *anticipation*, not inadequacy. Collecting begins only after the first real achievement, which is itself a landmark moment.

**Buildable:** reuse whatever currently drives `stats.badges` as the earned-set; render as connected SVG star patterns; the "forming" hint = progress toward the next threshold, shown as light, not a bar.

---

## 14 · Portfolio Integration — "Latest Light"

Yes — recent creations belong on the dashboard, but **not as a thumbnail strip.** Show **one to three most-recent creations as glowing memories** ("look back"), each tappable to *relive* the moment — the capture plays with the Guide's line and (where it exists) the child's own recorded voice. It says *"what you made matters,"* which is job #2.

- **Explorer:** one, big, joyful — tap to hear the Guide remember it.
- **Builder:** up to three; can favourite one.
- **Navigator:** a refined "recent work" that doubles as real portfolio material.

**Buildable:** the newest 1–3 rows from existing milestone `evidence[]` / `family-media` (signed URLs already implemented). No new storage.

---

## 15 · Accessibility

Non-negotiable, because a four-year-old must succeed alone.

- **Voice-first, reading-optional:** everything readable aloud (`speechSynthesis`); Explorer auto-reads; every input speakable (existing `data-voice`).
- **Huge targets:** ≥64px primary on Explorer, ≥48px elsewhere; generous spacing; one-thumb mobile reach.
- **Contrast & type:** WCAG AA minimum; large, humane type; a dyslexia-friendly setting; no essential meaning by colour alone (light also changes size/motion).
- **Reduced motion:** `prefers-reduced-motion` collapses all animation to fades; nothing depends on motion.
- **Screen readers:** semantic landmarks, the hero as a clear single primary control, live-region for celebrations, alt text on creations (Guide can auto-caption).
- **Motor & focus:** full keyboard path, visible focus, forgiving hit areas, no timed interactions.
- **Cognitive:** one primary action, plain language, no jargon, no dense text — accessibility and the design goal are the same thing here.

---

## 16 · Edge Cases

- **First-ever visit / no project yet:** the hero becomes a warm *invitation* ("Your first adventure is being prepared — let's meet your Guide"), never an empty dashboard. The Guide introduces itself. Parent-side prompted to generate the first project.
- **All of today done:** hero flips to a calm *celebration + tomorrow-whisper*, sky brighter, Guide proud — not an empty "nothing to do."
- **Missed days:** no guilt, no red. The Guide welcomes them back warmly and offers to pick up where they left off.
- **No captures yet:** "Latest Light" shows a gentle prompt-of-possibility, not an empty box.
- **No Guide chosen / not set up:** default warm Guide; prompt to choose one as a delightful early moment, not a blocker.
- **Daily line not yet generated / AI slow:** show a warm *evergreen* greeting instantly; swap in the personal line when ready. Never block arrival on a network call.
- **Offline / flaky:** last state renders; actions queue; capture stores locally and syncs. Arrival never depends on the network.
- **Very long mission / low capacity week:** the day stays light (Constitution capacity ceiling); the hero shows a *fitting* next step, never an overwhelming wall.
- **Shared device / multiple children:** fast, friendly child-switch (avatars), each with their own sky; no password gymnastics for the young.
- **Reflection due:** folds into completion as a gentle voice check-in, skippable, never a gate.

---

## 17 · Developer Implementation Notes

Grounded in the current stack; mostly composition + restyle, little new plumbing.

- **Rebuild `js/views/childPortal.js › renderChildPortal`** into the component tree in §7. Keep the route; replace the metric-row header and card grid with `SkyBackdrop + GuidePresence + TodayHero + LatestCreation`.
- **TodayHero data:** resolve current active project → first incomplete milestone (already derivable from `store` milestones/projects). Title/hook come from the milestone; render title as a question (small copy transform).
- **Reuse the mission engine:** `Begin` calls the existing `handleMilestoneTap` / mission modal (it already does steps, submission, upload, complete). `✓ I did it` → `completeMilestone(id)`. `📷` → `js/lib/storage.js` upload → `addMilestoneSubmission`. No new completion logic.
- **Guide line (new, small):** a `daily-guide` concern — call `mentor-turn` (via `js/lib/ai.js`) once/child/day, **cache** it (mirror the `ai_reports` cache table + a `date` key). Serve cached instantly; regenerate at local day-rollover. Reads Understanding server-side (already available to the `ai` fn).
- **Momentum/Badges:** no schema change — keep `momentumPoints`/stars/badges as the internal ledger; render as Light/Constellations (SVG components). Remove the "+pts" toasts and metric row.
- **Sky:** CSS gradient keyed to local hour buckets (dawn/day/dusk/night) + a static SVG starfield with CSS twinkle; `prefers-reduced-motion` disables motion. No assets pipeline needed for v1.
- **Voice:** `speechSynthesis` for read-aloud now (zero cost); Explorer auto-reads on mount. Existing `data-voice`/`enableAutoVoice` for spoken input. (Upgrade path: pre-generated Guide TTS.)
- **Tiers:** derive band from child age; a single `tier` prop switches register, density, auto-voice, and which inline actions render on the dashboard. Not three codebases — one component set, tier-parameterised.
- **Perf/cost:** arrival is 100% local render + cached line = instant, offline-tolerant, ~1 AI call/child/day. Celebrations are CSS/canvas. Nothing here needs a framework or a build step.

---

## 18 · Recommendation — What to Build First

**Ship the smallest thing that delivers all three jobs.** One slice, one sprint:

> **The Today Hero on a calm sky, fully actionable in place, with one personal Guide line.**

Concretely, in order:

1. **TodayHero + inline actions** (Begin/read/complete/capture/ask) reusing the existing mission engine — *this alone kills the find-project→milestone→return chain and is the single highest-impact change.*
2. **SkyBackdrop** (time-of-day gradient + starfield) replacing the metric row — instant emotional shift, near-zero cost.
3. **Cached daily Guide line** (`mentor-turn` + cache) — the un-copyable "remembers me" moment; cheap.
4. **Momentum-as-Light + never-empty sky** (render existing ledger as light; empty state = possibility).
5. **Latest Light** (recent creation, tap-to-relive) from existing evidence.

**Defer** to later sprints: full walkable Museum, constellation-naming ceremonies, pre-generated Guide TTS, the shooting-star polish, project-complete landmark moment. They deepen delight but aren't needed to make the dashboard *loved* at launch.

---

## Self-Critique

*Does this make North Star simpler, more emotionally engaging, more valuable, and harder to copy?*

- **Simpler — yes.** It deletes a metric row, a navigation chain (project→milestone→return), a month-grid calendar, and every statistic, and replaces them with **one actionable hero.** Fewer components, fewer decisions, less code than today.
- **More emotionally engaging — yes.** It leads with recognition and want, not status; celebrates character over completion; and ends on anticipation. A child opens it to *step into a story about themselves*.
- **More valuable — yes.** It removes the biggest friction (dig-to-do), turns the portal into a source of **Archive evidence about the child** (feeding the whole LFM), and produces the "Latest Light" pride loop parents treasure.
- **Harder to copy — yes.** The daily Guide line — *remembers yesterday, notices improvement, connects across months, softens a hard week* — requires the accumulated Understanding only North Star has. A competitor can clone the sky; they cannot clone a Guide that has known this child for a year.

**Weakest points, honestly:** (a) `speechSynthesis` voices are robotic — acceptable for v1, but pre-generated Guide TTS is the real magic and should follow fast. (b) The sky risks feeling static if under-animated on desktop — invest in *one* alive detail (the shooting star, the forming constellation) rather than many. (c) "Latest Light relive" needs the child's own voice to truly sing — wire voice-capture into missions early so there's something to replay. None of these block launch; all are fast-follows.

*Verdict: it clears the bar. Build the Today Hero first — everything else deepens a screen that already does its three jobs.*
