# Homeschool OS

A personalised, AI-powered family learning operating system. Parents define the kind of children they're raising; the OS reverse-engineers a homeschool structure from that vision.

This is the first working MVP — built for one family first, architected so it can be replicated for others.

## What's in here

Open `index.html` in any modern browser (or serve the folder over `http://`) and the app boots with sample data for Noah (12) and Jett (4).

### Parent Portal
- **Dashboard** — at-a-glance progress per child, upcoming events, core-word recap
- **Family Vision** — mission, motto, core word + acronym, deeper-vision questions
- **Children** — profiles, passions, strengths, goals, faith toggle, access codes
- **Learning Style** — 1–10 slider (Explorer → Traditional Academic) + DIY-vs-buy slider, both with live explanations and material suggestions
- **Learning Domains** — Brain / Build / Money / House / Community / Body Gigs + optional Faith Gigs, with balance nudges
- **Suggested Materials** — heuristic suggestions per child with approve / reject / "add to cart"
- **Mock Cart + Checkout** — approved materials become a cart; mock checkout with shipping form (Stripe / Shopify / Amazon affiliate hooks come later)
- **Projects** — list, AI-style generator from a child's profile, manual builder, full detail with milestones + reflections
- **Term Planner** — bird's-eye view per child with domain-balance bars and nudges
- **Calendar** — month grid filtered by child and domain
- **Rewards & Tolls** — reward + toll (responsibility, not punishment) per project, frequency picker, child-agreement checkbox
- **Progress** — weekly stars + points, domain breakdown, badges
- **Portfolio** — completed projects as badges, reflections timeline
- **Settings** — family preferences, faith toggle, reset

### Child Portal
- Sign in with a parent-issued access code (e.g. `NOAH12`, `JETT04`) — no email required
- Today's missions
- Active projects with live countdown timers
- Tap-to-earn stars with sparkle animation
- Momentum Points pill
- Rewards they're working toward
- Reflections to write
- Completed badges

## Tech

- Vanilla HTML / CSS / ES modules — opens by double-click, zero install
- `localStorage` as the data store (`js/store.js`), wrapped in a tiny `update(fn) → persist → subscribe` pattern so a real backend can swap in
- Mock AI suggestion engine in `js/ai/suggestions.js` — every `suggest*` function is a pure function ready to be replaced by an LLM call
- Hash-based router (`js/router.js`)
- No build step

## Data model

See [`js/store.js`](js/store.js) for the canonical schema. Top-level collections:
`family`, `children`, `projects`, `milestones`, `reflections`, `materials`, `cart`, `rewardsTolls`, `notifications`, `domains`.

Each entity carries the fields specified in the build brief (e.g. a `Project` has `domains`, `passionConnection`, `learningOutcomes`, `momentumPoints*`, `stars*`, `reward`, `toll`, `status`).

## How to run

```bash
cd homeschool-os
python3 -m http.server 8765
# then open http://localhost:8765
```

Or just double-click `index.html`. Modules require an `http://` origin in some browsers — if so, use the server command above.

## What's mocked (replaceable)

| Mocked | Real-version path |
| --- | --- |
| AI suggestions | Replace `suggestMaterialsForChild` / `suggestProjectsForChild` / `suggestWellRoundedNudges` with LLM calls |
| Checkout | Swap mock checkout for Stripe / Shopify / Amazon affiliates |
| Notifications | Wire `addNotification` to a real push/email service |
| Auth | Replace `getChildByCode` + `localStorage` with a real auth + DB layer |

## What's real

- All data CRUD: family, children, projects, milestones, reflections, materials
- Stars + Momentum Points + status transitions (`active → ready-for-reflection → completed`)
- Live countdown timers (updated every 30s)
- Domain balance engine
- Per-child portal with PIN-style access
- Sample data demonstrating the full flow end-to-end

## Demo path through the app

1. Open `/` — see Noah's BRAVE-driven dashboard
2. Open `#/children` → click **Noah** → copy his access code
3. Open `#/projects/...` (his Ski Wax project) → click a star on any milestone — see the sparkle + toast
4. Open `#/materials` → approve a few items
5. Open `#/cart` → run the mock checkout
6. Open `#/kid/NOAH12` → see the kid view he'd actually use
7. Open `#/kid/NOAH12` → click an unearned star → reflect → watch the project move toward "ready for reflection"
8. Go to `#/portfolio` → see the growing record
