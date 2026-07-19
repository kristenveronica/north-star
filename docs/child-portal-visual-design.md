# North Star — Child Portal V1: Visual Design Package

*The design-to-engineering handoff. Not wireframes — production UI, in the real North Star tokens, for the frozen V1 ([spec](child-dashboard-v1-spec.md) · [story](child-dashboard-first-five-minutes.md) · [blueprint](child-dashboard-implementation-blueprint.md)). Nothing here changes product decisions. Values are exact; an engineer builds directly from this.*

---

## Design System (foundations — defined once, referenced by every screen)

All tokens exist today in `styles/main.css`. **Two registers coexist:** the **Sky** (aspiration — midnight/starlight, top of screen) fading into **Home** (belonging — warm cream, where content lives). Legibility rule: content never sits on the dark sky; the sky is an atmospheric header that fades to `--bg`.

**Colour**
- Surface: `--bg #FBF6EE` (Home) · card `--card` on `--shadow-md`.
- Sky gradient by local hour — Dawn (5–8): `--midnight #2A3954` → `--coral-soft #FBE0D4`. Day (8–17): `--sky #6FA9C4` → `--sky-soft #D9EAF2`. Dusk (17–20): `--midnight` → `--gold-soft #FAEABA`. Night (20–5): `--midnight-deep #1B2538` → `--midnight`. Stars: `--gold #E8B547` / `--starlight #F3EBD9`, 30–70% opacity.
- Primary/CTA: `--primary #C97B4E`, hover `#B36A3F`, on-press `--primary-ink #6B3B1F`; soft fill `--primary-soft #F4DECC`.
- Roles: **growth/positive → sage** `#7FA68A`; **light/achievement → gold** `#E8B547`; text `--text #2D2317`, muted `#7A6F60`, soft `#A89C8C`; hairlines `--border #EADFCD`.
- **No red anywhere in the child portal** (no error/alarm palette — nothing here shames).

**Typography**
- Display/emotional: **Cormorant Garamond** (`--font-serif`), weight 500. Hero greeting 38/1.1 (reuse `.kid-hello`); mission title 28–32/1.15 (reuse `.t-headline`).
- UI/body: **Mulish** (`--font-sans`). Body 16/1.5; small 14 muted; micro 13. Buttons 16/600. Guide voice 18/1.45 (slightly larger, warm).
- Rule: **serif for feeling (titles, the Guide's spoken lines), sans for function (labels, buttons).** Never serif on a control.

**Spacing** — 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48. Card padding 24 (Explorer 28). Screen gutter 20 (mobile) / 32 (tablet) / auto-center at 720 max (desktop). Zone gap 32.

**Radii / elevation** — cards `--r-xl` (~20px); tiles/images `--r-lg` (~16px); buttons & chips `--r-pill`. Cards `--shadow-md`; floating/celebration `--shadow-lg`; pressed → `--shadow-sm`.

**Iconography** — the existing `nsIcon` line set, 22px, ~1.75 stroke, `--text-muted` idle / role-colour active. **Replace emoji controls with `nsIcon`** (speaker, chat, camera, check, star); reserve emoji for Explorer playfulness only.

**Motion tokens** — fast 150ms / base 250ms / slow 500ms / arrival 600ms. Entrances `ease-out`; hero settle spring (gentle overshoot); light-rise `cubic-bezier(.2,.7,.2,1)`. **`prefers-reduced-motion` → all motion becomes opacity fades ≤150ms.**

**Global accessibility** (per-screen notes only add deltas) — WCAG AA contrast; touch targets ≥48px (Explorer ≥64px); visible focus = 2px `--primary` ring + 2px offset; every text read-aloud via `nsIcon` speaker; full keyboard path; live-region announces celebrations; landmarks (`header`=Sky, `main`=Today); no meaning by colour alone; content max line-length ~60ch.

**Global responsive** — single column at every breakpoint. Mobile 360–430 base. Tablet 768–1024: more air, taller sky (~45vh), same single column. Desktop ≥1024: content centered at 720 max, sky full-bleed behind. Nothing reflows into multi-column; scale by air, not by adding columns.

**Global tiers** — Explorer: +1 type step, ≥64px targets, auto read-aloud, no eyebrows/menus, emoji-friendly. Builder: this spec as written (reference tier). Navigator: −1 serif step, tighter, calmer, less ornament, gold used sparingly.

---

## Screen 1 · Child Dashboard (Home)

**Purpose.** In three seconds: recognised, one obvious thing to do, calm.

**Layout (top→bottom).**
```
┌─ SKY HEADER  (full-bleed, ~40vh mobile / 45vh tablet) ───────────┐
│  time-of-day gradient + 12–20 stars (gold/starlight, parallax)   │
│  gathered Light: soft glow cluster, upper area (NO number)       │
│  Guide avatar (64px) lower-left, gentle idle                     │
│  Guide greeting line — serif 18, --starlight, max 2 lines        │
│  ⌄ soft fade into --bg begins at ~34vh                           │
├─ HOME  (--bg cream) ─────────────────────────────────────────────┤
│  ▸ TODAY'S ADVENTURE card  (Screen 2)          gap 32            │
│  ▸ "Look back" — Latest Light (one tile)       gap 24            │
│  ▸ (done-state only) Tomorrow whisper                            │
└──────────────────────────────────────────────────────────────────┘
```
**Component hierarchy.** `SkyBackdrop` › `MomentumLight` + `GuidePresence`(avatar)+`GuideGreeting` ⟶ `TodayHero` ⟶ `LatestCreation` ⟶ `TomorrowWhisper?`.

**Type.** Greeting: Cormorant 18/1.45 `--starlight`. (No page title — the greeting *is* the header; a "Dashboard" title would be chrome.) **Colour.** Sky per hour; Home `--bg`; one terracotta CTA is the only saturated element below the fold. **Spacing.** Sky content padded 20; Home gutter 20; zone gap 32. **Icon.** Only the speaker on the greeting + Guide avatar; nothing else competes. **Motion.** Arrival: sky fades up 600ms → stars settle → Guide eases in (+200ms) → greeting types/fades in → hero springs last so it's *the* thing. Stars drift slowly; ≤1 shooting star/session. **Empty.** No project → hero becomes the invite (Screen 9); Light empty → a clear sky (no "0"). **A11y.** `header`+`main` landmarks; greeting in a polite live-region on first load; sky is decorative (`aria-hidden`) except the greeting. **Breakpoints.** Mobile: sky 40vh, hero full-width. Tablet: sky 45vh, hero 560 centered. Desktop: content 720 centered, sky full-bleed. **Dev notes.** Rebuild `renderChildPortal` as this tree; **delete the `.metric` row and the dashboard calendar**; Sky = CSS gradient keyed to `new Date().getHours()` bucket + SVG starfield; greeting from the cached daily line (evergreen fallback).

---

## Screen 2 · Today's Adventure (the hero card)

**Purpose.** The one job — start today, from here, in one tap.

**Layout (top→bottom, inside the card).**
```
╭─ card: --card, --r-xl, --shadow-md, pad 24 ───────────────╮
│  eyebrow  "TODAY'S ADVENTURE"   (Builder/Nav only)        │
│  mission image   16:9, --r-lg                             │
│  title (a question)   serif 28–32                         │
│  hook   sans 16 --text-muted   (1 line)                   │
│                                                           │
│  [  ▸  Begin  ]   full-width pill, --primary, h56/64      │
│  ─ speaker Read aloud   ·   chat Ask Sol ─  (ghost row)   │
│  ·············································              │
│  check I did it (sage)   ·   camera Add what I made       │  ← Builder/Nav
╰───────────────────────────────────────────────────────────╯
```
**Hierarchy.** `MissionCard` › image › title › hook › `PrimaryAction` › `InlineActions`(read/ask) › divider › `InlineActions`(complete/add). **Type.** Eyebrow Mulish 12/700 `--text-soft` 0.08em uppercase; title Cormorant 28 (Explorer 32); hook 16 muted; Begin Mulish 16/700 white. **Colour.** Card cream; Begin `--primary`; secondary = ghost (`--primary-ink` text, transparent, `--primary-soft` on hover); "I did it" uses sage `--sage-ink`. **Spacing.** image→title 16; title→hook 8; hook→Begin 20; Begin→ghost row 12; divider 16. **Icon.** `nsIcon` speaker/chat/check/camera 22px. **Motion.** Begin breathes (scale 1→1.02, 4s, paused reduced-motion); press → scale .97 60ms + haptic; Begin → mission = card expands forward (Screen 3), not a route change. **Empty.** = Screen 9. **A11y.** Begin is the single primary control (`aria-label` includes the mission title); ghost actions labelled; title read aloud on 🔊. **Breakpoints.** Mobile Begin full-width h56; Explorer h64. Tablet card 560. Desktop 640, image 16:9. **Dev notes.** Resolve active project → first incomplete milestone (`store`); `titleToQuestion(title)`; **Begin → `openSubmissionModal({milestone, project})`**; "I did it" → `completeMilestone`; camera → `uploadFamilyMedia`→`addMilestoneSubmission`; Explorer hides complete/add here (they live in the mission).

---

## Screen 3 · Mission in Progress

**Purpose.** Do the thing; the interface disappears; one step at a time.

**Layout.** Full-screen takeover on `--bg`, Guide docked bottom-left (48px). Top: a slim, unlabelled progress of *dots* (one per step, current = `--primary`, done = sage, future = `--border`) — **not** a percentage bar. Center: **one step** — a picture/short clip (`--r-lg`), then a single spoken/written instruction (serif 22, ≤2 lines). Bottom: one primary — **"Done"** (pill, `--primary`) or *"I did it"* on the last step; a quiet ghost **"I'm not sure"** (speaker+chat) always present. **Hierarchy.** `MissionView`(reuses submission modal) › `StepDots` › `StepMedia` › `StepInstruction` › `PrimaryNext` + `StuckAffordance`. **Type.** Instruction Cormorant 22/1.3 `--text`; helper 14 muted. **Colour.** Calm cream; only "Done" saturated; dots carry state via colour+size. **Spacing.** media→instruction 20; instruction→button 24; generous 24 margins. **Icon.** speaker (auto for Explorer), chat for stuck; camera appears only when a step invites capture. **Motion.** step→step: outgoing fades/slides left 250ms, incoming eases in — *forward travel*; off-screen steps ("go to the yard") dim the screen with a warm "I'll be here" and a big Done when they return. **Empty.** n/a (steps come from the milestone). **A11y.** each step is a focus scope; "I'm not sure" reachable by keyboard; no timers; instruction always read-aloud. **Breakpoints.** Mobile full-bleed; Tablet centered 600 with sky peeking; Desktop centered 640. **Dev notes.** **Reuse `openSubmissionModal`** entirely — restyle to single-step disclosure + dots; do not rebuild completion/evidence.

---

## Screen 4 · Completion

**Purpose.** "I was seen" — celebrate character, never a score.

**Layout.** The step view yields to a brief celebration over a slightly darkened sky: a **light rises** from where the child worked up into the Sky and settles as a star; the Guide (centered, 72px) says **one** warm, mission-specific line (serif 20, `--starlight`); a single quiet **"Keep going"** / auto-returns Home after ~3s. **No number, no "+points", no trophy, no bar.** **Hierarchy.** `CompletionMoment` › `LightRise` › `GuideLine` › `DismissOrAuto`. **Type.** Guide line Cormorant 20/1.4. **Colour.** Sky-register moment: `--midnight` wash, gold light, `--starlight` text — visually distinct from doing, signalling *this matters*. **Spacing.** centered, generous; line max 2 lines. **Icon.** none (the rising light is the hero). **Motion.** light-rise 500ms `cubic-bezier(.2,.7,.2,1)` + soft chime (respects `isSoundOn`); gold bloom on settle; reduced-motion → light simply appears + line fades. Size-calibrated: small win = 1 star; mission = bloom (project-complete landmark = Phase 2). **Empty.** n/a. **A11y.** line announced in live-region; chime optional and off if sound disabled; not time-gated (a control to continue always exists). **Breakpoints.** identical, centered, scales with air. **Dev notes.** **Reuse `celebrateMilestone`**, restyle to light-rise + serif line on the sky wash; **delete the `+X Momentum Points` toast**; V1 line is templated from the milestone (the interpretive AI "noticing" is Phase-2 PR9, appended non-blocking).

---

## Screen 5 · Add What I Made

**Purpose.** Effortless capture; optional, never a gate.

**Layout.** Invoked inline (camera). A calm sheet from the bottom (`--r-xl` top corners): big **"Take a photo"** (primary) and **"Choose from device"** (ghost); on capture, a preview tile with **"Keep it"** (sage) / **"Retake"** (ghost). No captions, tags, or forms in V1. On "Keep it" the sheet dismisses and the tile **flies up into the Sky** (Screen 4/1). **Hierarchy.** `CaptureSheet` › `CaptureButtons` › `PreviewTile` › `Confirm`. **Type.** buttons 16/600; helper 14 muted ("This is just for you and your family."). **Colour.** neutral sheet on cream; primary terracotta; confirm sage. **Spacing.** 24 pad, 16 between buttons, target ≥56. **Icon.** camera, image, check. **Motion.** sheet slides up 250ms; preview scales in; "Keep it" → FLIP fly-up 500ms. **Empty.** n/a. **A11y.** native file/camera input (accessible by default); labels explicit; keyboard dismissible; large targets. **Breakpoints.** Mobile bottom-sheet; Tablet/Desktop centered modal (`openModal`), same content. **Dev notes.** **Reuse `uploadFamilyMedia`** (`{familyId, childId}`, ≤50MB) → `addMilestoneSubmission`; no new storage; strip any caption/tag UI for V1.

---

## Screen 6 · Latest Creation / Relive

**Purpose.** Pride, revisited — "look what I made."

**Layout.** On the dashboard: a **"Look back"** label (sans 13 `--text-soft`) + **one** glowing tile (Explorer) / up to three (Navigator) — the creation as a softly-lit, rounded tile with a faint gold rim (a "light," not a filesystem thumbnail). Tap → **relive overlay**: the media large (`--r-lg`), the Guide's remembered line beneath (serif 18), a quiet **"Close."** No metadata, no filename, no date-stamp chrome. **Hierarchy.** `LatestCreation` › `LightTile[]` › (overlay) `RelivePlayer` › `GuideMemoryLine`. **Type.** label 13 soft; overlay line Cormorant 18. **Colour.** tile on cream with `--gold` 30% rim; overlay dims to `--midnight` wash so the memory glows. **Spacing.** tile 1:1 or 4:5, 12 inset; overlay 24. **Icon.** none on tile (the image is the thing); play glyph only if video. **Motion.** tile: gentle breathing glow; tap → expands into overlay 300ms; video autoplays muted, tap to hear. **Empty.** no captures → a single dim "possibility" tile: *"The first thing you make will glow here."* (never an empty box). **A11y.** tile is a labelled button ("Relive: your bridge"); overlay traps focus, ESC closes; media has alt (Guide auto-caption). **Breakpoints.** Mobile 1 tile; Tablet up to 2; Desktop up to 3 in a row, still calm. **Dev notes.** newest 1–3 `evidence[]` rows via `signedUrl`/`[data-sp]`/`hydrateEvidenceMedia`; overlay via `openModal`.

---

## Screen 7 · Guide Conversation

**Purpose.** A trusted companion — opened on purpose, never a resident chatbot.

**Layout.** Opened by "Ask Sol." A calm panel (not a messenger): Guide avatar (56px) top, the current exchange as **large spoken-style lines** (serif 18, generous), the child's own words in a soft sage bubble. Bottom: a **big microphone** (primary, Explorer default) + a small text field (Builder/Nav) + 2–3 tappable **suggested thoughts** (ghost chips) from the Guide. No timestamps, no avatars-per-message, no "typing…" theatrics, no history wall — one warm exchange at a time. **Hierarchy.** `GuidePanel` › `GuideAvatar` › `ExchangeView` › `Composer`(mic/text) › `SuggestionChips`. **Type.** Guide Cormorant 18/1.45; child Mulish 16; chips 14/600. **Colour.** Guide lines `--text` on cream; child bubble `--sage-soft`; chips `--primary-soft`. **Spacing.** line spacing 16; composer pad 20; mic ≥64. **Icon.** microphone, speaker; send is implicit on voice. **Motion.** Guide reply eases in word-group by word-group (not char-by-char gimmick), ~250ms; mic pulses while listening. **Empty.** first open → the Guide opens warmly with 2 suggestions; never a blank thread. **A11y.** mic has a clear listening state + text fallback always; replies announced; reduced-motion disables the word-group reveal. **Breakpoints.** Mobile full-height sheet; Tablet/Desktop centered 520 panel. **Dev notes.** **Reuse `aiMentorTurn({mentor, child, history, message})`** → `{reply, suggestions[]}`; keep `history` short; enforce the ≤2-sentence cap in prompt + truncate; lazy-load the panel.

---

## Screen 8 · Achievement Moment (Constellation)

**Purpose.** A milestone of *becoming*, named — not a sticker.

**Layout (V1 minimal).** When an achievement is earned, the sky darkens to night, the child's relevant lights **draw into a pattern** (short line-draw), and the Guide names it: an eyebrow **"A new constellation"** (sans 12 gold), the **name** (Cormorant 30, e.g. *Creative Courage*), a one-line meaning (serif 18 `--starlight`), and **"See my sky"** / auto-returns. **Hierarchy.** `ConstellationMoment` › `LineDraw` › `Name` › `Meaning` › `Dismiss`. **Type.** name Cormorant 30/1.1 `--starlight`; meaning 18. **Colour.** full sky-register: `--midnight-deep` ground, `--gold` lines/stars, `--starlight` text — the most gold moment in the product (used *only* here, so it's rare and precious). **Spacing.** centered, name given 48 of vertical air. **Icon.** none. **Motion.** V1: lines draw between existing stars 700ms, name fades up, soft rising chime. (The full ceremony + tap-replay = Phase 2.) reduced-motion → pattern + name appear together. **Empty.** none yet → this screen never shows; the sky is possibility (no locked grid, no "0"). **A11y.** announced ("You earned a new constellation: Creative Courage"); not time-gated. **Breakpoints.** identical, centered; scales with air. **Dev notes.** V1 uses existing earned-badge triggers (`getChildStats().badges`) → render as named SVG lights; naming ceremony/replay is Phase-2 PR10.

---

## Screen 9 · Empty State (First-run / No adventure)

**Purpose.** A warm beginning, never an empty or broken screen.

**Layout.** Same Sky header; the Guide is a touch more present (72px, centered) and introduces itself in one line. Where the hero would be: a gentle invite card — serif title *"Your first adventure is on its way"* + one line (*"Sol is getting to know you."*) + a single soft action **"Meet Sol"** (opens Screen 7) — **no** empty grids, **no** "0", **no** spinner. If a first project is generating, a calm shimmer stands in for the hero. **Hierarchy.** `FirstRunHero` › `GuideIntro` › `InviteCard` › `MeetGuideCTA`. **Type.** title Cormorant 28; body 16 muted. **Colour.** as Home; the invite card cream with `--sage-soft` accent (growth, beginnings). **Spacing.** generous; single centered action. **Icon.** none but the Guide avatar. **Motion.** Guide waves once; card fades in. **Empty.** this *is* the empty state — and it feels like a welcome. **A11y.** the single CTA is the primary control; greeting announced. **Breakpoints.** identical. **Dev notes.** shown when no active project/milestone; first project comes from the existing quickstart/generate flow; day-one greeting rides onboarding-declared Understanding.

---

## Screen 10 · Returning Child (Day 2+)

**Purpose.** "It remembers me" — the moat, felt on arrival.

**Layout.** Identical structure to Screen 1, but the greeting **references yesterday truthfully** ("Yesterday you didn't give up on the bridge — today we test it."), the Sky already **holds the child's lights** from before (so the sky is visibly *theirs*, not blank), and the hero is the next step of the ongoing journey. The done-state adds the **Tomorrow whisper** (serif 16 `--text-muted`, a wrapped-gift `nsIcon`, no streak counter). **Hierarchy.** as Screen 1 with a populated `MomentumLight` and a memory-bearing `GuideGreeting`. **Type/Colour/Spacing/Icon.** as Screen 1. **Motion.** on arrival the existing lights fade up *first* (recognition), then the greeting, then the hero. **Empty.** all-done → calm celebration + Tomorrow whisper; **never** a streak/guilt UI. **A11y.** greeting announced; the "yesterday" reference must be evidence-true (no fabrication — Constitution). **Breakpoints.** as Screen 1. **Dev notes.** greeting from the cached daily line (remember/notice/connect/soften); populated sky from `getChildStats`; the richer "noticed you improved" depends on child activity reaching the Archive (**G1**) — day-2 "remember yesterday" works from the prior session's completion event.

---

## UX Review (and the fixes made above)

I reviewed all ten as a design lead. Seven issues; each is already corrected in the specs above.

1. **Split attention on the Dashboard** — a "Dashboard"/page title plus the greeting was two headers. **Fixed:** deleted the title; the greeting *is* the header.
2. **Weak hierarchy on the hero** — four inline actions competed with Begin. **Fixed:** Begin is the only saturated element; read/ask are ghost; complete/add sit *below a divider* and are hidden entirely for Explorer.
3. **Unnecessary text** — mission "eyebrow," filenames/dates on creations, timestamps in the Guide panel, percentage labels on progress. **Fixed:** eyebrow is Builder/Nav-only; all metadata/timestamps/percentages deleted; progress is unlabelled dots.
4. **Missing delight at capture** — "upload" was mechanical. **Fixed:** the creation *flies up into the sky* (FLIP), tying capture to the Sky that is the product's soul.
5. **Friction in the Guide panel** — it read like a messenger (bubbles, typing dots, history). **Fixed:** one warm exchange, spoken-style serif, mic-first, suggestion chips — never a chat log.
6. **Emotional flatness in Completion** — risked reading as "task done." **Fixed:** it shifts to the *sky register* (midnight wash, gold light, starlight serif) so completion visibly *matters* and is distinct from doing.
7. **Overuse of gold would cheapen achievement** — gold sprinkled everywhere makes the Constellation moment ordinary. **Fixed:** gold is reserved for **light and achievement only**; the Constellation screen is the single most-gold moment in the product, so it stays rare and precious.

**Remaining honest risks (not V1 blockers):** `speechSynthesis` voice quality (Phase-2 real TTS); the Sky needs *one* genuinely alive detail per session (the shooting star / a drifting star) so it never reads static; and the interpretive "noticed the true thing" completion line is templated until Phase-2 PR9. None change the visuals above.

*This is the package. Every screen has exact tokens, hierarchy, motion, and states; engineering can implement directly, starting with Screens 1–2 (PR1–PR2 in the blueprint).*
