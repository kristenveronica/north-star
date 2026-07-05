/* ============================================================
   dev-app.js — Development harness for the held-out learning apps.

   The MVP that ships to market does NOT include the Learning Apps
   catalog or the AI mentors (Polaris) — that code lives here in /dev
   while it's still being built. This harness boots the REAL North Star
   app (so you develop against real family/child data and the real
   shells) and then re-attaches the two routes the live app omits.

   Work on the learning apps by opening /dev/index.html locally — NEVER
   the root index.html. /dev is 404-blocked on the deployed site
   (see netlify.toml) so none of this reaches production.

     Parent — Learning Apps:  #/apps
     Child  — Polaris mentor:  #/kid/<ACCESS_CODE>/mentor/polaris
   ============================================================ */

// Importing app.js evaluates it fully: registers every live route and
// kicks off the boot sequence. We then add the dev-only routes on top.
import { withParentShell, withChildShell } from "../js/app.js";
import { registerRoute } from "../js/router.js";
import { renderApps } from "./views/apps.js";
import { renderPolaris } from "./views/polaris.js";
import { renderGuild, renderGuildSettings } from "./views/guild.js";

registerRoute("/apps", (c, p) => withParentShell(c, renderApps, p));
registerRoute("/kid/:code/mentor/:mentorId", (c, p) => withChildShell(c, renderPolaris, p));
// The Learning Guild (community) is held out of the MVP — reachable only here in dev.
registerRoute("/guild", (c, p) => withParentShell(c, renderGuild, p));
registerRoute("/guild/settings", (c, p) => withParentShell(c, renderGuildSettings, p));

console.info(
  "%c[North Star DEV]%c held-out routes attached — #/apps, #/guild, #/kid/<CODE>/mentor/polaris",
  "color:#E8B547;font-weight:700", "color:inherit"
);
