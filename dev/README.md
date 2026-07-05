# /dev — held-out learning apps & AI mentors

This folder holds the **Learning Apps** system and the **AI mentors** (Polaris)
that are **not part of the launch MVP**. They're still being built, so we keep
them in version control here but out of the live site.

## Why it's separate

- **No live code imports anything in `/dev`.** The launch build (`index.html` →
  `js/app.js`) has zero references to these modules, so shipping them can't
  affect the live app.
- **`/dev/*` is 404-blocked on Netlify** (see `netlify.toml`). Even though the
  files are in the repo, the deployed site never serves them.

## What's in here

| File | Was |
|------|-----|
| `appsCatalog.js` | `js/appsCatalog.js` |
| `lib/appsHub.js` | `js/lib/appsHub.js` |
| `views/apps.js` | `js/views/apps.js` — parent "Learning Apps" page |
| `mentors/registry.js` | `js/mentors/registry.js` — mentor persona registry |
| `mentors/whiteboard.js` | `js/mentors/whiteboard.js` — Polaris whiteboard + voice |
| `views/polaris.js` | `js/views/polaris.js` — child mentor chat |
| `views/guild.js` | `js/views/guild.js` — The Learning Guild (community) |
| `communityCatalogue.js` | `js/communityCatalogue.js` — Guild seed data |

The Learning Guild (community) is held out of the MVP too — an empty community
makes a young product feel hollow, so it ships once there's density. Its store
slices (`guildConfig`, `showcases`, `mentorshipRequests`, etc.) stay in the live
`js/store.js` (the dev harness imports them). Reachable in dev at `#/guild`.

These files still import shared modules (`store.js`, `router.js`, `ui.js`,
`ai.js`) from the live `js/` tree via `../../js/…` — so the dev app always runs
against the real app's state, auth, and edge functions.

## How to work on them

Run the site locally, then open **`/dev/index.html`** (NOT the root
`index.html`):

```
# from the north-star repo root
python3 -m http.server 8000
# then visit:
#   http://localhost:8000/dev/index.html
```

`dev-app.js` boots the real North Star app and re-attaches the two held-out
routes:

- **Parent — Learning Apps:** `#/apps`
- **Child — Polaris mentor:** `#/kid/<ACCESS_CODE>/mentor/polaris`

(The sidebar link and the child-portal tiles were removed from the live app, so
reach these by URL while developing.)

The Supabase `mentor-turn` edge action and the `mentorConversations` / `childApps`
store slices are **left in place** in the live codebase (inert without these
views) — so nothing server-side needs redeploying to keep developing here.

## Shipping them later

When a learning app is ready for GA, move its files back into `js/`, restore the
import + route in `js/app.js`, the nav item in `js/components/sidebar.js`, and the
tiles/invite in `js/views/childPortal.js`, and drop the `/dev/*` redirect (or the
specific path) from `netlify.toml`.
