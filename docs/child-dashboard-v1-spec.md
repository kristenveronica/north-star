# North Star — Child Dashboard V1: Production Spec

*Decisions are final. This is what engineering builds. Design rationale lives in [child-dashboard-v2-design.md](child-dashboard-v2-design.md); it is not re-argued here. Stack: existing ES-module views (`js/views/childPortal.js`), `store.js`, `js/lib/storage.js`, `js/lib/ai.js` (`mentor-turn`), Web Speech, CSS/SVG, Supabase, the `ai` edge fn, `family-media`. Constitution-bound ([LIVING_FAMILY_MODEL_CONSTITUTION.md](LIVING_FAMILY_MODEL_CONSTITUTION.md)).*

One rule governs the whole build: **the dashboard has one job the child can see — today's adventure — and everything else is calm periphery.** `tier` (Explorer 4–7 / Builder 8–12 / Navigator 13–18) is a single prop derived from age; one component set, parameterised.

---

## 1 · Dashboard

**Decision.** A single-column, three-zone vertical stack, centered (max ~880px), no navigation bar: **Sky** (ambient, glanceable) → **Today's Adventure** (the hero, owns the screen) → **Latest Light + tomorrow-whisper** (periphery). Rebuild `renderChildPortal()` as this composition.

**Why this wins.** It delivers all three dashboard jobs with one primary action and the least surface area. A child's eye lands on exactly one thing in under three seconds. It is less code than today's metric-row-plus-grid, and it reuses the existing mission engine.

**Why we rejected the alternatives.** A multi-panel/columned dashboard reintroduces the LMS density we're deleting. A bottom tab bar makes five destinations equal-weight and dilutes the one job. Keeping the metric row (`⭐ Stars · pts · 🏅 Badges · Milestones done`) is a school report card — it optimises for self-management, not wonder.

**Build recommendation.** Replace the header/grid in `renderChildPortal` with `SkyBackdrop → GuidePresence+GuideGreeting → TodayHero → LatestCreation → TomorrowWhisper`. Keep the existing route. No tab bar. Explorer renders no menu at all.

---

## 2 · Today's Adventure

**Decision.** The hero resolves to the child's current active project's **next incomplete milestone** and is fully actionable in place. **Begin** enters the guided mission (reusing the existing mission modal). **Completion is one tap — `I did it` → `completeMilestone(id)`** — never gated by evidence or reflection. **Evidence is optional:** a single `📷 Add what I made` → `storage.js` upload → `addMilestoneSubmission`. **Voice:** read-aloud via `speechSynthesis` (auto on open for Explorer; tap for others); spoken input via existing `data-voice`.

**Why this wins.** It deletes the entire find-project → open → find-milestone → open → complete → return chain — the single biggest friction in the current portal — while reusing code that already works. Optional evidence keeps completion frictionless; a four-year-old can finish with one tap and one word.

**Why we rejected the alternatives.** Requiring the child to enter a project first is the status quo we're removing. Gating completion on uploaded evidence or a written reflection punishes the youngest and the honest. A separate upload screen adds a navigation hop for no gain.

**Build recommendation.** `TodayHero` reads active project → first incomplete milestone from `store`. Title rendered as a question (small copy transform of the milestone title). `Begin` → existing `handleMilestoneTap`/mission modal (already does steps, submission, complete). `I did it` → `completeMilestone`. `📷` → `storage.js` → `addMilestoneSubmission`. Explorer completes *inside* the voice-led mission; Builder/Navigator may also complete from the hero. If a reflection is required, it folds in after completion as an optional, skippable voice check-in.

---

## 3 · The Guide

**Decision.** The Guide is a **one-line presence plus opt-in conversation — never a persistent chat.** It speaks at most **twice unprompted per session**: once on arrival (a remembered greeting), once at a meaningful moment (a completion or a genuine "I noticed"). It is **silent during the doing of a mission** and **never sends notifications or nags.** Messages are hard-capped: **one sentence for Explorer, two maximum for older.** Conversation happens only when the child taps `💬` (→ `mentor-turn`). Celebration names the **specific, true** thing (character over completion). Encouragement is a **nudge, never the answer** — question first. Memory comes from the cached daily line (§8).

**Why this wins.** A mentor who occasionally walks beside you builds trust; a bot that talks constantly becomes wallpaper and then annoyance. Scarcity makes each line land. The hard length cap keeps it un-chatbot-like and voice-friendly.

**Why we rejected the alternatives.** A persistent chat thread *is* the chatbot we're told to avoid. Proactive push/notifications train children to feel obligation and interrupt real life. Narrating every tap turns presence into noise and erases the moments that should matter.

**Build recommendation.** Arrival line = the cached daily line (§8), rendered instantly with a `🔊` speak control (auto-speak for Explorer). Completion line = a short client-side celebration template *seeded by* the real event (the specific character shown), not a fresh AI call per completion. `💬` lazy-loads `GuidePanel` → `mentor-turn` (existing `js/lib/ai.js`), voice-first, nudge-tuned prompt. No notification system. Enforce the length cap in the prompt and truncate defensively.

---

## 4 · Momentum

**Decision.** Momentum **survives as an internal signal and disappears as a number.** Keep `momentumPoints`/stars as the hidden ledger; the child experiences it only as **Light** — the sky quietly brightens, and a single star appears on a meaningful act (weighted to character: persistence, courage, returning after failure). **No number, no toast, no leaderboard, ever.**

**Why this wins.** The ledger still powers achievements and internal logic (no schema change), while the child chases *the feeling of growing*, not a score. You cannot game a sky, and there is no one to beat but yesterday.

**Why we rejected the alternatives.** Visible points (`+10 Momentum Points`) make children optimise the number and invite comparison. Deleting momentum entirely throws away the internal signal that drives achievements and pacing. A real-time constellation-physics engine is over-scope for launch.

**Build recommendation.** Keep the existing ledger. Delete the `+X Momentum Points` toasts and the metric row. `MomentumLight` (SVG) renders accumulated light in the Sky; on `completeMilestone`, animate one star rising into the sky with a soft chime. `prefers-reduced-motion` → fade. No new tables.

---

## 5 · Achievements

**Decision.** **Constellations are the one achievement system** — named marks of *becoming* (Creative Courage, Natural Explorer, The One Who Came Back), shown as named lights in the child's Sky. **Never an empty grid, never "0":** a child with none sees a clear sky of possibility with the nearest one faintly forming. **V1 ships the minimal form** — earned achievements appear as named lights with a simple celebration, driven by the existing badge/achievement triggers. The full naming *ceremony* and tap-to-replay are §"Build shortly after."

**Why this wins.** One committed system, coherent with Momentum (Light accumulates → a Constellation is named), tied to identity rather than sticker-collecting, and buildable now on existing triggers. The never-empty rule turns the beginner's state into anticipation instead of inadequacy.

**Why we rejected the alternatives.** A sticker/badge grid is exactly the "digital stickers" we reject, and it renders empty for new children — advertising failure. Shipping no achievements at launch guts job #2 (pride in becoming). Two parallel reward systems (points *and* badges) is duplication the Constitution forbids.

**Build recommendation.** Map the current badge/achievement source to an earned-Constellations set; render as named SVG lights in the Sky. On earn: a simple bloom + the Guide names it in one line. Empty state = possibility sky + one faintly-pulsing "forming" hint near the hero. No locked-grid UI anywhere.

---

## 6 · Portfolio

**Decision.** The dashboard shows **"Latest Light"** — the single most recent creation (up to three for Navigator), tappable to **relive** the moment. The full walkable Museum is post-launch. **Parents** experience the collection through the existing parent-side portfolio/keepsake surface (no new child-facing management). The **Guide references past work** via the daily line and on relive.

**Why this wins.** One emotional artifact — "look what I made" — delivers pride (job #2) with near-zero build (it reads existing evidence). It creates the return-and-be-proud loop without asking a child to manage files.

**Why we rejected the alternatives.** A thumbnail strip/file browser turns a childhood into admin and is emotionally flat. Building the full Museum for launch is over-scope. Asking the child to curate adds work and cognitive load.

**Build recommendation.** `LatestCreation` reads the newest 1–3 rows from milestone `evidence[]`/`family-media` (signed URLs already implemented). Tap → lightweight relive overlay (the capture + the Guide's one-line memory; child's own voice where present). No new storage, no curation UI in V1.

---

## 7 · Calendar

**Decision.** **No calendar on the dashboard.** Today's Adventure replaces it. The only future-time element is a single **tomorrow-whisper** shown *after* today is complete. The existing month-grid child calendar is removed from the child's daily path (kept, if needed, as a parent/older-child utility off the dashboard).

**Why this wins.** Young children don't think in months; a grid is foreign and administrative. Removing it protects the single-job clarity and deletes a whole component from the critical screen.

**Why we rejected the alternatives.** A month grid is LMS furniture that competes with the hero. A week strip on the dashboard is quieter but still splits attention from the one thing that matters today.

**Build recommendation.** Do not render any calendar in `renderChildPortal`. `TomorrowWhisper` appears only in the all-done state as a wrapped hint. Leave `renderChildCalendar` reachable only outside the child daily flow (or retire for Explorer/Builder).

---

## 8 · AI Memory (the moat)

**Decision.** V1 memory = **one cached daily Guide line per child**, generated by `mentor-turn` reading a small, already-existing slice of the child's **Understanding** (top interests + most-recent activity + any active circumstance). Each day it does exactly one of: **remembers yesterday · notices a simple improvement · connects to a known interest · softens a hard week.** Cached like `ai_reports`; ~1 AI call per child per day.

**Why this wins.** It is the maximum emotional payoff for the minimum new infrastructure — it rides entirely on the LFM (Archive → Understanding) we already built, so the moat ships now. It is the one thing competitors cannot copy: a Guide that remembers *this* child. Caching makes it instant, offline-tolerant, and cheap.

**Why we rejected the alternatives.** A large real-time memory engine is over-scope and slow, and would block launch. Per-interaction AI calls are costly and add latency to arrival. A hand-authored greeting is copyable and hollow — it isn't memory.

**Build recommendation.** New `daily-guide` concern: an edge path calling `mentor-turn` with the child's Understanding slice, cached in a small table keyed `(child_id, local_date)`; regenerate at local day rollover. Serve cached instantly on dashboard load; if absent, render a warm evergreen line immediately and swap in the personal one when ready (never block arrival). Every line must be **true in the evidence** (Constitution Art. V/VII); the Guide's observations are recorded as **Archive evidence about the child**, closing the child-portal blind spot.

---

## Build for Version One

**Must build before launch**
- Dashboard rebuild: three-zone single column, `tier` prop, no nav bar (§1).
- Today Hero + inline actions — Begin (reuse mission engine), `I did it` (`completeMilestone`), `📷` (optional, `storage.js`+`addMilestoneSubmission`), `💬` (`mentor-turn`) (§2).
- Read-aloud via `speechSynthesis`; Explorer auto-reads; `data-voice` input (§2).
- Cached **daily Guide line** — the memory moat (§8).
- Sky backdrop: time-of-day CSS gradient + SVG starfield; replaces the metric row (§1,4).
- Momentum-as-Light (internal ledger kept; delete `+pts` toasts + metric row) (§4).
- Never-empty achievement Sky: earned Constellations as named lights + simple celebration, from existing triggers (§5).
- Latest Light: newest creation, tap-to-relive (§6).
- No dashboard calendar (§7).
- Accessibility baseline: voice, ≥64/48px targets, `prefers-reduced-motion`, WCAG AA contrast (design §15).

**Build shortly after launch**
- Constellation naming *ceremony* (Guide draws the lines) + tap-to-replay moments.
- Full walkable Museum (portfolio as a place).
- Pre-generated Guide **TTS** (real voice) replacing `speechSynthesis`.
- Richer "notices improvement" signals; child's-own-voice narration on relive.
- Project-complete landmark celebration.

**Future evolution (intentionally wait)**
- The printed **Book of Childhood**.
- Cross-sibling "helping lights."
- Deep multi-year memory / connections across many months.
- Ambient polish: shooting stars, seasonal skies; deeper Guide personality selection.

---

## Final Product Decisions

| # | Component | V1 Decision | Rejected | Ships |
|---|---|---|---|---|
| 1 | **Dashboard** | Single-column, three zones (Sky → Today → Latest Light), no nav bar, `tier`-parameterised | Multi-panel LMS; tab bar; metric row | **Launch** |
| 2 | **Today's Adventure** | Hero = next incomplete milestone, actionable in place; **1-tap complete** (`completeMilestone`); optional evidence; read-aloud | Project-first navigation; evidence-gated completion; separate upload screen | **Launch** |
| 3 | **The Guide** | One-line presence + opt-in `💬`; ≤2 unprompted lines/session; 1–2 sentences; silent while doing; no notifications | Persistent chat; proactive push; narrate-every-tap | **Launch** |
| 4 | **Momentum** | Survives internally; shown only as **Light** (no number, no toast, no leaderboard) | Visible points; delete entirely; real-time physics engine | **Launch** |
| 5 | **Achievements** | **Constellations** — named lights of becoming; **never "0"/empty**; minimal form at launch, ceremony later | Sticker grid; empty locked grid; ship none; dual point+badge systems | **Launch** (ceremony → Soon) |
| 6 | **Portfolio** | **Latest Light** on dashboard (newest creation, tap-to-relive); full Museum later | Thumbnail/file browser; full Museum at launch; child-curated | **Launch** (Museum → Soon) |
| 7 | **Calendar** | **None on dashboard**; Today replaces it; tomorrow-whisper only when done | Month grid; week strip | **Launch** (removed) |
| 8 | **AI Memory** | **One cached daily Guide line** from Understanding (remember/notice/connect/soften); ~1 call/child/day | Large real-time engine; per-interaction calls; hand-authored greeting | **Launch** |

*Everything above is decided. Engineering can begin with the Today Hero (§2) — it is the highest-impact, lowest-risk first PR and unblocks the rest.*
