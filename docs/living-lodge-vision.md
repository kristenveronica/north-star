# North Star — The Living Lodge

> **Status:** Canonical vision. This is the guiding document for the child's Lodge home.
> Every lodge decision is measured against the Success Metric at the bottom.
> Naming note: the pets are **Samson** (German Shepherd) and **Maxi / Maximus** (tabby kitten).

## Vision

The North Star Lodge is not a dashboard. It is not a menu. It is not simply a background image.

It is a **living place** that children develop an emotional attachment to over many years.

Every design decision should reinforce one feeling:

> "This is my place."

The lodge should become as memorable to a child as Hogwarts, Bag End, The Burrow, or Animal Crossing's village. Children should genuinely look forward to returning because the lodge itself feels warm, welcoming, familiar and alive.

The lodge should never feel like software. It should feel like home.

---

## Core Philosophy

Do **not** attempt to create life through excessive animation. Create life through:

- changing seasons
- changing weather
- changing light
- subtle ambient movement
- persistent memories
- evolving decorations
- pets with personality
- guides that occasionally change state
- a world that remembers the child

Everything should be calm. Nothing should feel busy. The lodge should be a place where children naturally slow down.

---

## Technical Philosophy

Prioritise extremely lightweight systems. **Maximum atmosphere for minimum runtime cost.**

Prefer: sprite animations · looping effects · particle systems · lighting changes · PNG state swaps · environmental animation.

Avoid: expensive skeletal animation · runtime AI image generation · unnecessary GPU-heavy effects · complex simulations.

---

## Priority 1 — Ambient Environment

The room itself should always feel quietly alive: fireplace flames, glowing embers, occasional sparks, flickering warm light, moving shadows, curtains gently shifting, plants slowly swaying, dust motes in sunlight, birds outside windows, butterflies in summer, rain, snow, blowing autumn leaves, gentle cloud movement.

No movement should feel distracting.

## Priority 2 — Time & Seasons

The lodge changes through the day and the year.

- **Morning** — warm sunrise, long shadows
- **Midday** — bright natural light
- **Evening** — golden glow, fireplace more prominent
- **Night** — moonlight, stars, lanterns lit

- **Spring** — flowers, greener surroundings
- **Summer** — open windows, butterflies
- **Autumn** — orange leaves, pumpkins, richer colours
- **Winter** — snow, frost, optional Christmas decorations

## Priority 3 — Samson & Maxi

The pets are the emotional heartbeat of the lodge. They should feel like real companions: sleeping, stretching, walking, lying by the fire, looking out the window, watching birds, yawning, tail wagging, purring, cleaning paws, moving between favourite resting places, occasionally approaching the child, **randomly changing position each login**. Children should become attached to them.

## Priority 4 — The Guides

Guides do **not** need continuous animation. Each guide eventually has several **canonical poses** — reading, standing, walking, writing, looking outside, talking, observing. Each pose is simply another artwork; the app randomly selects one, and occasionally changes state after several minutes. Variety with technical simplicity.

## Priority 5 — Living Objects

Animate objects before people: steam rising from mugs, lantern flames, candles, clock pendulum, wind chimes, books slightly opening, paper gently moving, plants growing over time. Atmosphere at almost no computational cost.

## Priority 6 — A Lodge That Remembers

The lodge gradually becomes a visual history of the child's journey: completed projects displayed, maps pinned to walls, books collected, plants grown, artwork framed, new furniture unlocked, seasonal memories retained, pets receive gifts. The room evolves over months and years. A child should feel: **"I built this place."**

## Priority 7 — Delight

Occasionally, unexpected moments occur: Maxi steals a sock, Samson carries a stick, a bird lands outside, a butterfly enters, a rainbow after rain, the fire crackles, a shooting star passes the window. These exist purely to create delight.

## Success Metric

The child should never consciously think *"the lodge is animated."* They should simply feel:

> "This place feels alive."

That emotional response is the primary design objective.

---

# Implementation Phasing (engineering approach)

Proposed by the build, aligned to the technical philosophy above. Each layer is cheap and additive; none requires skeletal animation or runtime image generation. Layers ship independently and degrade gracefully.

**Layer 0 — Foundations (in progress).** Empty room render + guide cutouts (Apple Vision matting, likeness-preserving) + editable placement layout + pets painted in. This is the substrate everything else composites onto.

**Layer 1 — Light & Time of Day (cheapest, highest impact).** A single CSS/gradient overlay tint + fireplace-glow layer driven by local clock → morning / midday / evening / night. One data-URI vignette + an animated warm-light gradient. No new art. Ship first.

**Layer 2 — Ambient particles & object loops.** CSS/Canvas particle systems: dust motes in window light, fireplace embers/sparks, drifting snow/leaves by season. Pure looping effects, paused under `prefers-reduced-motion`. Steam/candle/lantern flicker as small looping opacity/transform on positioned sprites.

**Layer 3 — Pets with personality.** Samson & Maxi as separately-composited sprites (matte them out of a render, or dedicated art) with a small pose set. On each login: pick a resting spot + pose. Occasional idle swap (tail, yawn, purr) via PNG state swap on a long random timer.

**Layer 4 — Guide pose variety.** Extend the cutout system: per guide, per age band, a few canonical poses. App randomly selects one on load; optional state change after minutes. Directly reuses the age-folder + matting pipeline.

**Layer 5 — Seasons & weather.** Swap the outside-window content + seasonal decorations by real-world date (or a settable calendar). Snow/rain/leaves particle presets from Layer 2. Optional Christmas layer.

**Layer 6 — A Lodge That Remembers.** Persist child state → visible artefacts: framed completed projects, pinned maps, collected books, grown plants, unlocked furniture. This is where the lodge stops being decoration and becomes autobiography. Requires the real data layer (build in-app, not in the prototype).

**Layer 7 — Delight.** Rare, random, low-frequency scripted moments (shooting star, butterfly, Maxi steals a sock). Gated so they feel like surprises, never spectacle.

**Where this lives:** Layers 1–4 can be felt in the prototype to validate the direction, but Layers 6–7 and the persistence model belong in the real flag-gated portal wired to actual child data. Do not over-invest atmosphere into the throwaway Artifact mockup — prove the feeling cheaply, build it for real in the app.
