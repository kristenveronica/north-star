/* ============================================================
   marketing.js — North Star public marketing site.
   7 pages: Home, About, How It Works, Features, Pricing,
   Contact, Login.
   ============================================================ */

import { esc, toast, nsIcon } from "../components/ui.js";
import { getChildByCode } from "../store.js";
import { navigate, currentPath } from "../router.js";
import { hasAccount, isLoggedIn, signup, login, logout, currentUserEmail } from "../auth.js";
import { logoLockup, logoStacked } from "../components/logo.js";

const NAV_LINKS = [
  { path: "/welcome",      label: "Home" },
  { path: "/about",        label: "About" },
  { path: "/how-it-works", label: "How It Works" },
  { path: "/features",     label: "Features" },
  { path: "/pricing",      label: "Pricing" },
  { path: "/contact",      label: "Contact" },
];

/* ============================================================
   PUBLIC SHELL
   ============================================================ */
export function renderPublicShell(container, viewFn) {
  const root = document.createElement("div");
  root.className = "public-shell";
  root.innerHTML = `
    ${publicHeader()}
    <div class="public-main" id="public-main"></div>
    ${publicFooter()}
  `;
  container.appendChild(root);
  viewFn(root.querySelector("#public-main"));
  wireHeader(root);
}

function publicHeader() {
  const path = currentPath();
  const loggedIn = isLoggedIn();
  const accountExists = hasAccount();
  return `
    <header class="public-header">
      <div class="public-header-inner">
        ${logoLockup({ size: 40, variant: "light", href: "#/welcome", className: "public-brand-lockup" })}
        <nav class="public-nav">
          ${NAV_LINKS.map(n => `<a href="#${n.path}" class="${path === n.path ? "active" : ""}">${esc(n.label)}</a>`).join("")}
          ${loggedIn
            ? `<a href="#" id="nav-logout" class="">Logout</a>
               <a href="#/" class="btn btn-sm btn-primary" style="margin-left:8px;text-decoration:none">Open my portal →</a>`
            : `<a href="#/login" class="${path === "/login" ? "active" : ""}">Login</a>
               <a href="#${accountExists ? "/login" : "/signup"}" class="btn btn-sm btn-primary" style="margin-left:8px;text-decoration:none">${accountExists ? "Login →" : "Start free"}</a>`}
        </nav>
      </div>
    </header>
  `;
}

function publicFooter() {
  return `
    <footer class="public-footer">
      <div class="public-footer-inner">
        <div class="public-footer-cols">
          <div>
            ${logoStacked({ size: 52 })}
            <p style="opacity:0.85; margin-top:16px; max-width:280px; font-size:14px">A personalised family learning platform for parents who want more than curriculum.</p>
          </div>
          <div>
            <h4>Platform</h4>
            <div class="stack mt-1" style="gap:6px">
              <a href="#/welcome">Home</a>
              <a href="#/how-it-works">How it works</a>
              <a href="#/features">Features</a>
              <a href="#/pricing">Pricing</a>
            </div>
          </div>
          <div>
            <h4>Family</h4>
            <div class="stack mt-1" style="gap:6px">
              <a href="#/about">Our philosophy</a>
              <a href="#/contact">Contact</a>
              <a href="#/login">Login</a>
              <a href="#/signup">Start free</a>
            </div>
          </div>
          <div>
            <h4>Built for</h4>
            <div class="stack mt-1" style="gap:6px; opacity:0.85; font-size:14px">
              <span>Homeschool</span>
              <span>Hybrid school</span>
              <span>Worldschool</span>
              <span>Montessori / Waldorf families</span>
              <span>Project-based learners</span>
            </div>
          </div>
        </div>
        <div class="public-footer-bottom">
          <div>© ${new Date().getFullYear()} North Star · Built for families with intention.</div>
          <div>Made with care, not algorithms.</div>
        </div>
      </div>
    </footer>
  `;
}

function wireHeader(root) {
  root.querySelector("#nav-logout")?.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
    toast("Logged out", { type: "success" });
    navigate("/welcome");
  });
}

/* ============================================================
   HOME PAGE  —  9-section emotional journey
   Problem → Philosophy → Solution → Product → Process → Invitation
   ============================================================ */
export function renderHome(container) {
  container.innerHTML = `
    <!-- ───────────── 1. HERO ───────────── -->
    <section class="hero">
      <div>
        <span class="hero-eyebrow">${nsIcon("compass", { size: 14 })} For Families With Intention</span>
        <h1>Your homeschool should reflect the child in front of you, not the system behind you.</h1>
        <p class="lede">North Star helps values-led families create a personalised learning journey around their children's gifts, their family values, and the life they're nurturing together.</p>
        <div class="ctas">
          <a class="btn btn-primary btn-lg" href="#/signup">Start Building Your North Star</a>
          <a class="btn btn-lg" href="#/how-it-works">See How It Works</a>
        </div>
      </div>
      <div class="hero-art">
        <div class="compass-art">
          <span class="hero-star hero-star-tr" aria-hidden="true">${heroMiniStar(34)}</span>
          <span class="hero-star hero-star-br" aria-hidden="true">${heroMiniStar(20)}</span>
          <span class="hero-star hero-star-bl" aria-hidden="true">${heroMiniStar(14)}</span>
          ${compassSVG()}
        </div>
      </div>
    </section>

    <!-- ───────────── 2. THE PROBLEM ───────────── -->
    <section class="section">
      <span class="section-eyebrow">The problem</span>
      <h2>Most homeschool tools start with curriculum. North Star starts with the child.</h2>
      <p class="lede">Families are often piecing together curriculum, planners, worksheets, apps, projects, values, life skills and passions from a dozen different places.</p>
      <p class="problem-lead">North Star brings everything together around one guiding question:</p>
      <figure class="problem-quote">
        <span class="problem-quote-mark" aria-hidden="true">${nsIcon("compass", { size: 16 })}</span>
        <blockquote>Who is this child, and how can we best support their growth?</blockquote>
      </figure>
    </section>

    <!-- ───────────── 3. PHILOSOPHY ───────────── -->
    <section class="section">
      <div class="section-philosophy">
        <span class="section-eyebrow">Our philosophy</span>
        <h2 style="max-width:760px">Stop building your homeschool around subjects. Start building it around your child.</h2>
        <p class="philosophy-line">We believe every child is already a whole person.</p>
        <p class="philosophy-line muted">Our role is not to mould children into someone they are not.</p>
        <p class="philosophy-line muted">It is to observe, understand, nurture, cultivate, and create meaningful learning experiences aligned with our family values.</p>
      </div>
    </section>

    <!-- ───────────── 4. NORTH STAR DIFFERENCE ───────────── -->
    <section class="section">
      <span class="section-eyebrow">The North Star difference</span>
      <h2>A homeschool built around your child, your values, and the life you're nurturing together.</h2>
      <div class="comparison">
        <div class="comparison-card them">
          <h3>Traditional tools</h3>
          <ul>
            <li><span class="marker"></span>Curriculum first</li>
            <li><span class="marker"></span>Subjects first</li>
            <li><span class="marker"></span>Grades first</li>
            <li><span class="marker"></span>Checklists first</li>
            <li><span class="marker"></span>Outsource the journey</li>
          </ul>
        </div>
        <div class="comparison-card us">
          <h3>North Star</h3>
          <ul>
            <li><span class="marker"></span>Child first</li>
            <li><span class="marker"></span>Values first</li>
            <li><span class="marker"></span>Vision first</li>
            <li><span class="marker"></span>Projects first</li>
            <li><span class="marker"></span>Growth first</li>
            <li><span class="marker"></span>Whole-child development</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ───────────── 5. PROCESS PREVIEW ───────────── -->
    <section class="section">
      <span class="section-eyebrow">The process</span>
      <h2>A simple rhythm. Repeated. Compounding.</h2>
      <p class="lede">Define the North Star. Understand each child. Choose a learning style. Build real projects. Reflect honestly. Grow over years.</p>
      <a class="btn btn-lg" href="#/how-it-works" style="margin-top:6px">See How It Works →</a>
    </section>

    <!-- ───────────── 6. PARENT PORTAL PREVIEW ───────────── -->
    <section class="preview-row">
      <div>
        <span class="section-eyebrow">Parent Portal</span>
        <h2 style="font-size:30px">A calm command centre — not a busy LMS.</h2>
        <p class="lede">One place to clarify what your family is for, design who each child is learning to become, and gently keep the rhythm of the year.</p>
      </div>
      <div class="portal-preview">
        ${[
          ["compass",    "Family North Star",   "Mission · motto · core word · values"],
          ["vision",     "Family Vision",       "Desired character, capabilities, learning priorities"],
          ["child",      "Child Profiles",      "Passions, strengths, goals, learning style"],
          ["target",     "Projects",            "Real work, real deadlines, real outcomes"],
          ["growth",     "Growth Reports",      "Evidence-based developmental reviews"],
          ["candle",     "Family Councils",     "Monthly + termly gatherings that keep alignment"],
        ].map(([ic, title, sub]) => `
          <div class="portal-preview-row">
            <span class="ns-icon-wrap" style="width:36px;height:36px;border-radius:10px">${nsIcon(ic, { size: 18 })}</span>
            <div style="flex:1"><div class="fw-700">${esc(title)}</div><div class="small text-muted">${esc(sub)}</div></div>
          </div>
        `).join("")}
      </div>
    </section>

    <!-- ───────────── 7. CHILD PORTAL PREVIEW ───────────── -->
    <section class="preview-row flipped">
      <div>
        <span class="section-eyebrow">Child Portal</span>
        <h2 style="font-size:30px">North Star is the hub for the journey, not the journey itself.</h2>
        <p class="lede">The platform helps families plan, organise, reflect and celebrate. The actual learning happens through books, projects, conversations, community, nature, life skills, creativity, exploration and service.</p>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:12px">
          ${["books","projects","conversations","community","nature","life skills","creativity","exploration","service"].map(t => `<span class="chip" style="cursor:default">${esc(t)}</span>`).join("")}
        </div>
      </div>
      <div class="preview-mock">
        <div class="preview-mock-bar"><span></span><span></span><span></span></div>
        <div class="small text-muted" style="letter-spacing:0.12em;text-transform:uppercase">Today's missions</div>
        <div class="stack mt-1" style="gap:6px">
          ${[
            ["Create a product name and brand", false, 20],
            ["Design a sales poster",            false, 20],
            ["Present the business idea",        true,  25],
          ].map(([t, done, pts]) => `
            <div class="row" style="gap:10px;padding:8px 0;border-bottom:1px solid var(--divider)">
              <span class="star-btn ${done ? "earned" : ""}" style="width:28px;height:28px;color:${done ? "#fff" : "var(--text-soft)"}">${nsIcon("star", { size: 14 })}</span>
              <span style="flex:1;font-size:14px;${done ? "text-decoration:line-through;color:var(--text-muted)" : ""}">${esc(t)}</span>
              <span class="points-pill" style="font-size:11px">+${pts}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </section>

    <!-- ───────────── 8. GROWTH REPORTS & FAMILY COUNCILS ───────────── -->
    <section class="section">
      <span class="section-eyebrow">Reflection · alignment · celebration</span>
      <h2>The rituals that turn months into a journey.</h2>
      <div class="comparison">
        <div class="comparison-card" style="background:linear-gradient(135deg, var(--card-elev), var(--card))">
          <span class="ns-icon-wrap warm" style="margin-bottom:14px">${nsIcon("growth", { size: 22 })}</span>
          <h3>Growth Reports</h3>
          <p class="text-muted">An evidence-based, mentor-voiced developmental review. What did this child genuinely learn? What's emerging? What's still developing? Where is the next focus?</p>
        </div>
        <div class="comparison-card" style="background:linear-gradient(135deg, var(--card-elev), var(--card))">
          <span class="ns-icon-wrap gold" style="margin-bottom:14px">${nsIcon("candle", { size: 22 })}</span>
          <h3>Family Councils</h3>
          <p class="text-muted">A guided gathering at month-end or term-end. Wins. Challenges. Growth noticed. Vision alignment. Goal-setting. Print it. Light a candle. Walk through it together.</p>
        </div>
      </div>
    </section>

    <!-- ───────────── 9. FINAL CTA ───────────── -->
    <div class="cta-strip">
      <h2>Begin building your family's North Star.</h2>
      <p>Ten minutes to set up. A lifetime to walk it. The sample family — Noah, 12, and Jett, 4 — is already loaded so you can feel the full flow before committing to anything.</p>
      <div class="row" style="justify-content:center;gap:12px;flex-wrap:wrap">
        <a class="btn btn-primary btn-lg" href="#/signup">Start Building Your North Star</a>
        <a class="btn btn-lg" style="background:transparent;color:var(--starlight);border-color:rgba(244,233,197,0.4)" href="#/how-it-works">See How It Works</a>
      </div>
    </div>
  `;
}

/* ============================================================
   HERO COMPASS — rebuilt from first principles.

   ONE shared centre point: (200, 200) in a 400×400 viewBox.
   Every element uses ABSOLUTE coordinates. There is no nested
   transform on the rose, so CSS animations (which override SVG
   transform attributes) can't drift any layer off-centre.

   Layered, from outer-most inwards:
     1. Outer warm halo
     2. Navy bezel (with depth + highlight + inner shadow)
     3. Compass face (deeper navy)
     4. Concentric ring details (drift slowly)
     5. 72 graded tick marks (0°/5°/10°/30°/90° hierarchy)
     6. Cardinal labels (N E S W) — polar-positioned at radius 178
     7. Intercardinal labels (NE SE SW NW) — same radius 178
     8. Tight central glow (supports, doesn't obscure)
     9. Compass rose (8 blades + north diamond + highlight ridge)
     10. Gold centre pivot
   ============================================================ */
function compassSVG() {
  const CX = 200, CY = 200;

  // Polar helper: angle 0 = N (12 o'clock), 90 = E (3 o'clock), etc.
  const polar = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return { x: CX + Math.sin(a) * r, y: CY - Math.cos(a) * r };
  };

  // Blade kite generator — absolute coords centred on (200, 200).
  const blade = (deg, length, shoulder, halfWidth) => {
    const a = (deg * Math.PI) / 180;
    const dx = Math.sin(a), dy = -Math.cos(a);
    const px = Math.cos(a), py = Math.sin(a);
    const tip = { x: CX + dx * length, y: CY + dy * length };
    const sh  = { x: CX + dx * shoulder, y: CY + dy * shoulder };
    return [
      `${tip.x.toFixed(2)},${tip.y.toFixed(2)}`,
      `${(sh.x + px * halfWidth).toFixed(2)},${(sh.y + py * halfWidth).toFixed(2)}`,
      `${CX},${CY}`,
      `${(sh.x - px * halfWidth).toFixed(2)},${(sh.y - py * halfWidth).toFixed(2)}`,
    ].join(" ");
  };

  // ── Tick marks — 72 positions, graded ─────────────────────────
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const deg = i * 5;
    const a = (deg * Math.PI) / 180;
    const r1 = 158;
    let r2, sw, opa;
    if (deg % 90 === 0)       { r2 = 134; sw = 1.8; opa = 1.0;  }
    else if (deg % 30 === 0)  { r2 = 144; sw = 1.1; opa = 0.85; }
    else if (deg % 10 === 0)  { r2 = 150; sw = 0.7; opa = 0.55; }
    else                      { r2 = 154; sw = 0.4; opa = 0.32; }
    const sin = Math.sin(a), cos = Math.cos(a);
    const x1 = CX + sin * r1, y1 = CY - cos * r1;
    const x2 = CX + sin * r2, y2 = CY - cos * r2;
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke-width="${sw}" opacity="${opa}"/>`;
  }).join("");

  // ── Direction labels — all at the same radius (178), polar-positioned ─
  const LABEL_R = 178;
  const cardinal = (deg) => polar(deg, LABEL_R);
  const nP  = cardinal(0);
  const eP  = cardinal(90);
  const sP  = cardinal(180);
  const wP  = cardinal(270);
  const neP = cardinal(45);
  const seP = cardinal(135);
  const swP = cardinal(225);
  const nwP = cardinal(315);
  const fmt = p => `x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}"`;

  // ── Compass rose dimensions ──────────────────────────────────
  // Face radius is ~165. Rose cardinal tip at r=78 (north at r=86).
  // Rose diameter ≈ 156, about 40% of the 392-px compass diameter — in spec.
  const CARDINAL_LEN = 78;
  const NORTH_LEN    = 86;     // slightly longer — north emphasis
  const INTER_LEN    = 54;
  const CARDINAL_SHOULDER = 14;
  const INTER_SHOULDER    = 10;
  const CARDINAL_HW = 5;
  const INTER_HW    = 3.5;

  // North antique diamond — sits on top of the north blade tip.
  // North blade tip is at (200, 114). Diamond extends from y=100 (top)
  // through (204, 108) and (196, 108) to y=114 (bottom, touching the tip).
  const NORTH_TIP_Y = CY - NORTH_LEN;        // 114
  const ND_TOP_Y    = NORTH_TIP_Y - 14;      // 100
  const ND_MID_Y    = NORTH_TIP_Y - 6;       // 108
  const northDiamond = `${CX},${ND_TOP_Y} ${CX + 4},${ND_MID_Y} ${CX},${NORTH_TIP_Y} ${CX - 4},${ND_MID_Y}`;

  return `
    <svg class="compass-svg" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <!-- Outer warm halo (radiates beyond the bezel) -->
        <radialGradient id="cmp-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stop-color="#F4E9C5" stop-opacity="0.32"/>
          <stop offset="55%" stop-color="#E8B547" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="#E8B547" stop-opacity="0"/>
        </radialGradient>

        <!-- Bezel: softer, less metallic, more atmospheric navy with gentle depth -->
        <radialGradient id="cmp-bezel" cx="38%" cy="30%" r="80%">
          <stop offset="0%"  stop-color="#4A5E82"/>
          <stop offset="45%" stop-color="#2F4060"/>
          <stop offset="82%" stop-color="#1B2538"/>
          <stop offset="100%" stop-color="#101828"/>
        </radialGradient>

        <!-- Bezel highlight (top crescent) — softer -->
        <linearGradient id="cmp-bezel-hi" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"  stop-color="#FFFFFF" stop-opacity="0.12"/>
          <stop offset="55%" stop-color="#FFFFFF" stop-opacity="0"/>
        </linearGradient>

        <!-- Face: deeper night sky -->
        <radialGradient id="cmp-face" cx="50%" cy="44%" r="68%">
          <stop offset="0%"  stop-color="#2E3F60"/>
          <stop offset="65%" stop-color="#1A2538"/>
          <stop offset="100%" stop-color="#0E1626"/>
        </radialGradient>

        <!-- Central warm glow — tight, supports the rose without obscuring -->
        <radialGradient id="cmp-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stop-color="#FFF8E0" stop-opacity="0.5"/>
          <stop offset="35%"  stop-color="#F4E0B5" stop-opacity="0.25"/>
          <stop offset="70%"  stop-color="#E8B547" stop-opacity="0.06"/>
          <stop offset="100%" stop-color="#E8B547" stop-opacity="0"/>
        </radialGradient>

        <!-- Cardinal cross gradient (cream → soft cream → deep cream) -->
        <linearGradient id="cmp-cardinal-grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"   stop-color="#FFF8E0"/>
          <stop offset="50%"  stop-color="#F4E9C5"/>
          <stop offset="100%" stop-color="#D8C798"/>
        </linearGradient>

        <!-- Intercardinal X gradient (gold) -->
        <linearGradient id="cmp-inter-grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"   stop-color="#F5D078"/>
          <stop offset="55%"  stop-color="#E8B547"/>
          <stop offset="100%" stop-color="#8C6612"/>
        </linearGradient>

        <!-- Central jewel -->
        <radialGradient id="cmp-jewel" cx="35%" cy="30%" r="65%">
          <stop offset="0%"  stop-color="#FFFAE0"/>
          <stop offset="55%" stop-color="#E8B547"/>
          <stop offset="100%" stop-color="#6E4A0A"/>
        </radialGradient>

        <!-- Soft glow filter for the N letter — luminous, engraved feel -->
        <filter id="cmp-n-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- 1. Outer halo (beyond the bezel) -->
      <circle class="compass-halo" cx="200" cy="200" r="200" fill="url(#cmp-halo)"/>

      <!-- 2. Bezel ring + depth + top-light highlight -->
      <g class="compass-bezel">
        <circle cx="200" cy="200" r="196" fill="url(#cmp-bezel)"/>
        <circle cx="200" cy="200" r="196" fill="url(#cmp-bezel-hi)"/>
        <!-- Bezel inner shadow (depth into face) -->
        <circle cx="200" cy="200" r="168" fill="none" stroke="#070C18" stroke-width="2.5" opacity="0.55"/>
        <!-- Bezel inner highlight (delicate gold rim) -->
        <circle cx="200" cy="200" r="171" fill="none" stroke="rgba(244,233,197,0.18)" stroke-width="0.6"/>
        <!-- Bezel outer edge -->
        <circle cx="200" cy="200" r="196" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="0.8"/>
      </g>

      <!-- 3. Face -->
      <circle cx="200" cy="200" r="165" fill="url(#cmp-face)"/>

      <!-- 4. Concentric ring details (slowly drift on the face) -->
      <g class="compass-rings">
        <circle cx="200" cy="200" r="156" fill="none" stroke="rgba(244,233,197,0.16)" stroke-width="0.7"/>
        <circle cx="200" cy="200" r="132" fill="none" stroke="rgba(244,233,197,0.09)" stroke-width="0.5" stroke-dasharray="1 4"/>
        <circle cx="200" cy="200" r="104" fill="none" stroke="rgba(244,233,197,0.12)" stroke-width="0.5"/>
        <circle cx="200" cy="200" r="68"  fill="none" stroke="rgba(244,233,197,0.22)" stroke-width="0.6"/>
      </g>

      <!-- 5. Tick marks (72 positions, graded) -->
      <g class="compass-ticks" stroke="#F4E9C5" stroke-linecap="round">
        ${ticks}
      </g>

      <!-- 6. Faint celestial dots in the bezel band -->
      <g class="compass-dots" fill="#F4E9C5">
        <circle cx="260" cy="68"  r="1.1" opacity="0.55"/>
        <circle cx="328" cy="132" r="1.4" opacity="0.65"/>
        <circle cx="332" cy="262" r="0.9" opacity="0.45"/>
        <circle cx="248" cy="332" r="1.0" opacity="0.5"/>
        <circle cx="72"  cy="260" r="1.2" opacity="0.55"/>
        <circle cx="76"  cy="142" r="0.9" opacity="0.45"/>
        <circle cx="148" cy="68"  r="0.7" opacity="0.35"/>
      </g>

      <!-- 7. Cardinal labels — all at radius 178, polar-positioned.
              N is the focal moment: slightly larger, brighter, with a soft glow filter. -->
      <g class="compass-cardinals" font-family="Fraunces, Georgia, serif" fill="#F4E9C5" font-weight="600">
        <text ${fmt(nP)} text-anchor="middle" dominant-baseline="central"
              font-size="24" font-weight="600" letter-spacing="3"
              filter="url(#cmp-n-glow)" class="compass-n">N</text>
        <text ${fmt(eP)} text-anchor="middle" dominant-baseline="central"
              font-size="15" letter-spacing="2.5" opacity="0.6">E</text>
        <text ${fmt(sP)} text-anchor="middle" dominant-baseline="central"
              font-size="15" letter-spacing="2.5" opacity="0.6">S</text>
        <text ${fmt(wP)} text-anchor="middle" dominant-baseline="central"
              font-size="15" letter-spacing="2.5" opacity="0.6">W</text>
      </g>

      <!-- 8. Intercardinals — same radius 178, polar-positioned at exact diagonals -->
      <g class="compass-intercardinals" font-family="Inter, system-ui, sans-serif" fill="#F4E9C5" font-weight="500" font-size="9.5" letter-spacing="2" opacity="0.45">
        <text ${fmt(neP)} text-anchor="middle" dominant-baseline="central">NE</text>
        <text ${fmt(seP)} text-anchor="middle" dominant-baseline="central">SE</text>
        <text ${fmt(swP)} text-anchor="middle" dominant-baseline="central">SW</text>
        <text ${fmt(nwP)} text-anchor="middle" dominant-baseline="central">NW</text>
      </g>

      <!-- 9. Central glow — TIGHT halo around the pivot, supports the rose without obscuring it -->
      <circle class="compass-center-glow" cx="${CX}" cy="${CY}" r="72" fill="url(#cmp-glow)"/>

      <!-- 10. COMPASS ROSE — absolute coordinates, single shared centre (200, 200).
            • 4 cardinal cream blades (cross), N slightly longer
            • 4 intercardinal gold blades (X)
            • Antique diamond at the north blade tip
            • Subtle highlight ridge on the north blade for luminosity
            • Centre jewel pivot
      -->
      <g class="compass-rose">

        <!-- North antique diamond — sits at the tip of the north blade -->
        <polygon class="cr-north-diamond" points="${northDiamond}"
                 fill="url(#cmp-cardinal-grad)" opacity="0.98"/>

        <!-- Cardinal blades (cream cross) — N slightly longer for emphasis -->
        <g class="cr-cardinals" fill="url(#cmp-cardinal-grad)">
          <polygon points="${blade(0,   NORTH_LEN,    CARDINAL_SHOULDER, CARDINAL_HW)}"/>
          <polygon points="${blade(90,  CARDINAL_LEN, CARDINAL_SHOULDER, CARDINAL_HW)}"/>
          <polygon points="${blade(180, CARDINAL_LEN, CARDINAL_SHOULDER, CARDINAL_HW)}"/>
          <polygon points="${blade(270, CARDINAL_LEN, CARDINAL_SHOULDER, CARDINAL_HW)}"/>
        </g>

        <!-- Intercardinal blades (gold X) -->
        <g class="cr-inter" fill="url(#cmp-inter-grad)">
          <polygon points="${blade(45,  INTER_LEN, INTER_SHOULDER, INTER_HW)}"/>
          <polygon points="${blade(135, INTER_LEN, INTER_SHOULDER, INTER_HW)}"/>
          <polygon points="${blade(225, INTER_LEN, INTER_SHOULDER, INTER_HW)}"/>
          <polygon points="${blade(315, INTER_LEN, INTER_SHOULDER, INTER_HW)}"/>
        </g>

        <!-- Subtle highlight ridge — runs the length of the north blade for extra luminosity -->
        <line class="cr-n-highlight" x1="${CX}" y1="${ND_TOP_Y}" x2="${CX}" y2="${CY}"
              stroke="#FFFCE5" stroke-width="0.6" opacity="0.55"/>

        <!-- Centre jewel pivot -->
        <circle cx="${CX}" cy="${CY}" r="7.5" fill="url(#cmp-jewel)" stroke="#4E3206" stroke-width="0.5"/>
        <circle cx="${CX - 2}" cy="${CY - 2}" r="1.8" fill="#FFFCE5" opacity="0.9"/>
      </g>
    </svg>
  `;
}

/* A small luminous star used around the compass in the hero. */
function heroMiniStar(size = 22) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">
    <path d="M12 1.5 L13.6 9.4 L21.5 11.2 L13.7 13 L12 22.5 L10.3 13 L2.5 11.2 L10.4 9.4 Z" opacity="0.95"/>
    <circle cx="12" cy="12" r="1.2" fill="#FFF8E0" opacity="0.9"/>
  </svg>`;
}


/* ============================================================
   ABOUT PAGE
   ============================================================ */
export function renderAbout(container) {
  container.innerHTML = `
    <section class="hero" style="grid-template-columns:1fr;padding-top:60px">
      <div>
        <span class="hero-eyebrow">Our philosophy</span>
        <h1 style="font-size:42px;max-width:840px">North Star does not exist to mould children. It exists to help families understand them.</h1>
      </div>
    </section>

    <section class="section">
      <div class="core-quote">
        We believe every child is already a whole person.<br><br>
        Our role is not to mould children into someone they are not.<br><br>
        Our role is to observe them, understand them, nurture their strengths, support their growth, cultivate character, and create meaningful learning experiences aligned with our family values.<br><br>
        North Star helps families do that with intention.
      </div>
    </section>

    <section class="section">
      <span class="section-eyebrow">For whom</span>
      <h2>Built for families who choose education with intention.</h2>
      <p class="lede">Homeschool, hybrid-school, worldschool, wildschool, Montessori-inspired, Waldorf-inspired, project-based, values-led — if you've stepped off the default track to design something more meaningful, North Star was built for you.</p>
      <div class="feature-grid">
        <div class="feature-card"><div class="ico">🏡</div><h3>Homeschool families</h3><p>Full structure when you want it; full freedom when you don't.</p></div>
        <div class="feature-card"><div class="ico">🌏</div><h3>Worldschool / wildschool</h3><p>Project-led learning that travels with you.</p></div>
        <div class="feature-card"><div class="ico">🌿</div><h3>Montessori &amp; Waldorf-inspired</h3><p>Honours real-life skills, sensorial work, and rhythm.</p></div>
        <div class="feature-card"><div class="ico">🏫</div><h3>Hybrid school families</h3><p>Wrap your school days with what they don't cover.</p></div>
        <div class="feature-card"><div class="ico">⛪</div><h3>Faith-formed families</h3><p>Faith integration is fully optional and parent-controlled.</p></div>
        <div class="feature-card"><div class="ico">💼</div><h3>Entrepreneurial families</h3><p>Real business projects, real money skills, real outcomes.</p></div>
      </div>
    </section>

    <section class="section">
      <span class="section-eyebrow">What we won't do</span>
      <h2>The language we refuse.</h2>
      <p class="lede">We don't talk about <i>designing your child</i>, <i>moulding</i> them, or <i>engineering their future</i>. We talk about nurturing, supporting, guiding, discovering, understanding, cultivating, and honouring who they already are.</p>
    </section>

    <div class="cta-strip">
      <h2>Education with intention starts with clarity.</h2>
      <p>Define your family's North Star, then let everything else fall into place.</p>
      <a class="btn btn-primary btn-lg" href="#/signup">Start free</a>
    </div>
  `;
}

/* ============================================================
   HOW IT WORKS PAGE  —  guided two-part experience
   Part 1: the parent experience (9 steps)
   Part 2: the child experience (10 steps)
   ============================================================ */
export function renderHowItWorks(container) {
  const parentSteps = [
    ["Create your Family North Star", "Define what you actually believe — values, mission, motto, core word, character priorities, capabilities, learning priorities. This becomes the lens for every decision the platform helps you make. Without it, every suggestion feels generic. With it, everything aligns."],
    ["Create child profiles",          "Passions, strengths, goals, learning preferences, areas developing. Each child is honoured as the unique person they already are. Every suggestion the platform makes downstream is tuned to this child, not the average."],
    ["Choose a learning style",        "A 1–10 slider, from Explorer (unschooling) to Traditional Academic. There is no right answer — only the one that fits your family right now. The platform meets you where you are."],
    ["Select learning domains",        "Brain Gigs · Build Gigs · Money Gigs · House Gigs · Community Gigs · Body Gigs (and optionally Faith Gigs). These are the dimensions of a whole-child rhythm — the platform watches the balance for you."],
    ["Build projects",                 "Parent-created or AI-assisted. Real work tied to real passions. Set a child's first business, a backyard sanctuary, a documented adventure — anything that takes them somewhere meaningful."],
    ["Create milestones",              "Each project has a small set of milestones — concrete, dateable steps. Each milestone carries Momentum Points and a star. Together they make abstract growth visible."],
    ["Set rewards & tolls",            "Rewards celebrate honest, finished work. Tolls are natural consequences of unfinished work — not punishments. The child agrees to both at the start."],
    ["Review growth",                  "Generate Growth Reports at month-end or term-end. Mentor-voiced, evidence-based, encouraging. Honest about strengths and what's still developing."],
    ["Plan the next term",             "Family Councils + Growth Reports feed the next chapter. The journey compounds — months become years, and years become a family story."],
  ];

  const childSteps = [
    ["Open my portal",        "A single access code (parent-issued) — no email, no password, optional 4-digit PIN. The child portal opens straight into something theirs."],
    ["See today's missions",  "Not assignments. Not homework. Missions — the next things alive for them, with countdown timers and Momentum Points attached."],
    ["Open Project HQ",       "Every project is its own headquarters: why it matters, the milestones ahead, the next step, the reward, the toll."],
    ["See the next step",     "One small, doable thing. Never \"here is your week\" — just \"here is the next move.\""],
    ["Do the real-world work","The actual learning happens away from the screen. Building. Reading. Cooking. Selling. Talking. Walking. The portal organises — it never replaces."],
    ["Return to reflect",     "When the work is done, the child writes — or speaks — what they noticed. Typing isn't required. The reflections become a record of their thinking."],
    ["Earn Momentum Points",  "Tap the star. A small celebration. Real progress made visible. Points accrue toward the project's reward."],
    ["Build a portfolio",     "Completed projects, reflections, photos, evidence. Their work, kept. A record they can show, share or simply hold onto."],
    ["Work toward rewards",   "Each project has a celebration at the end. Something agreed up front. Something the child has earned through finishing well."],
    ["Create a record of growth", "Over months, the portfolio becomes a story. The Family Legacy timeline turns months of work into a family book."],
  ];

  container.innerHTML = `
    <section class="hero" style="grid-template-columns:1fr;padding-top:80px;padding-bottom:30px">
      <div>
        <span class="hero-eyebrow">${nsIcon("compass", { size: 14 })} How North Star works</span>
        <h1>Two experiences. One shared journey.</h1>
        <p class="lede">North Star has two portals — one for the parent who plans, observes and reflects, and one for the child who works, reflects and grows. They mirror each other. Together they keep a family aligned.</p>
      </div>
    </section>

    <div class="journey-divider">
      <span>Part one</span>
      <hr>
    </div>

    <section class="section" style="border-top:none;padding-top:0">
      <div class="row" style="gap:14px;margin-bottom:12px">
        <span class="ns-icon-wrap midnight">${nsIcon("compass", { size: 22 })}</span>
        <div>
          <h2 style="font-size:30px;margin:0">The parent experience</h2>
          <p class="lede" style="margin:6px 0 0">Nine steps. Set once. Refined over time.</p>
        </div>
      </div>
      <div class="journey-list">
        ${parentSteps.map(([t, p], i) => `
          <div class="journey-item">
            <div class="journey-num">${String(i + 1).padStart(2, "0")}</div>
            <div class="journey-body">
              <h3>${esc(t)}</h3>
              <p>${esc(p)}</p>
            </div>
          </div>
        `).join("")}
      </div>
    </section>

    <div class="journey-divider">
      <span>Part two</span>
      <hr>
    </div>

    <section class="section" style="border-top:none;padding-top:0">
      <div class="row" style="gap:14px;margin-bottom:12px">
        <span class="ns-icon-wrap warm">${nsIcon("child", { size: 22 })}</span>
        <div>
          <h2 style="font-size:30px;margin:0">The child experience</h2>
          <p class="lede" style="margin:6px 0 0">Where learning is organised, reflected on, celebrated and remembered. The learning itself happens in the real world.</p>
        </div>
      </div>
      <div class="journey-list">
        ${childSteps.map(([t, p], i) => `
          <div class="journey-item">
            <div class="journey-num">${String(i + 1).padStart(2, "0")}</div>
            <div class="journey-body">
              <h3>${esc(t)}</h3>
              <p>${esc(p)}</p>
            </div>
          </div>
        `).join("")}
      </div>
    </section>

    <section class="section">
      <div class="section-philosophy">
        <span class="section-eyebrow">A reminder</span>
        <h2 style="max-width:760px">The platform is the hub. The learning is the life.</h2>
        <p class="philosophy-line muted">North Star is not a device-dependent educational pathway. It helps families plan, organise, reflect and celebrate. The actual learning happens through books, projects, conversations, community, nature, life skills, creativity, exploration and service.</p>
      </div>
    </section>

    <div class="cta-strip">
      <h2>Ten minutes to start. A lifetime to walk.</h2>
      <a class="btn btn-primary btn-lg" href="#/signup">Start Building Your North Star</a>
    </div>
  `;
}

/* ============================================================
   FEATURES PAGE
   ============================================================ */
export function renderFeaturesPublic(container) {
  const featureGroups = [
    ["Foundations", [
      ["🧭", "Family Vision Builder", "Mission, motto, values, desired outcomes."],
      ["✦", "Core Word / Acronym Builder", "Make a single word the lens for everything."],
      ["📏", "Learning Style Slider", "1–10 from unschooling to traditional academic."],
      ["✂", "DIY Materials Slider", "Buy ready-made or make at home — tuned to your time + energy."],
    ]],
    ["The child", [
      ["👶", "Child Profiles", "Passions, strengths, areas developing, goals, access codes."],
      ["🎯", "Personalised Suggestions", "Projects + materials tuned to each child."],
      ["🎤", "Voice Reflections", "Tap a microphone, speak naturally. Works for kids who don't yet type."],
      ["🏆", "Stars, Badges, Momentum Points", "Celebrate progress, not just completion."],
    ]],
    ["Learning structure", [
      ["🧠", "Brain Gigs", "Academic + intellectual."],
      ["🔨", "Build Gigs", "Making, design, invention."],
      ["💰", "Money Gigs", "Financial literacy + entrepreneurship."],
      ["🏡", "House Gigs", "Real life skills."],
      ["🤝", "Community Gigs", "Service + contribution."],
      ["🏃", "Body Gigs", "Movement, outdoors, capability."],
      ["✝", "Faith Gigs (optional)", "Parent-toggled, denomination-aware."],
    ]],
    ["Doing the work", [
      ["📦", "Project Builder", "Generate or hand-build projects with full milestones."],
      ["⏱", "Live Countdown Timers", "Weeks, days, hours, minutes — to milestones + due dates."],
      ["🌟", "Milestones &amp; Stars", "Tap-to-earn, sparkle animation."],
      ["📔", "Portfolio", "Completed projects, reflections, badges."],
      ["🛒", "Suggested Materials + Mock Cart", "Approve, reject, add to cart. Real checkout coming later."],
    ]],
    ["Reflection + reporting", [
      ["📊", "Growth Reports", "Honest, mentor-voiced developmental reviews."],
      ["🔍", "Child Insights (premium, optional)", "Observations, never labels. Parent-controlled frameworks."],
      ["🪑", "Family Councils", "Monthly + termly guided gatherings."],
      ["📔", "Family Legacy Timeline", "The whole journey, archivable + printable."],
    ]],
    ["Day-to-day", [
      ["📅", "Calendar", "Filtered by child + domain."],
      ["🔔", "Notifications", "In-app reminders; push coming later."],
      ["🎉", "Rewards &amp; Tolls", "Celebrations + natural consequences, not punishments."],
      ["🌳", "The Learning Guild (premium, future)", "Quest teams, project showcases, mentorship, councils."],
    ]],
  ];
  container.innerHTML = `
    <section class="hero" style="grid-template-columns:1fr;padding-top:60px;padding-bottom:30px">
      <div>
        <span class="hero-eyebrow">Features</span>
        <h1>Everything you need. Nothing you don't.</h1>
        <p class="lede">Each feature exists to serve clarity, growth and connection — not to add screen time or noise.</p>
      </div>
    </section>

    ${featureGroups.map(([title, items]) => `
      <section class="section">
        <span class="section-eyebrow">${esc(title)}</span>
        <div class="feature-grid">
          ${items.map(([em, t, p]) => `
            <div class="feature-card">
              <div class="ico">${em}</div>
              <h3>${t}</h3>
              <p>${p}</p>
            </div>
          `).join("")}
        </div>
      </section>
    `).join("")}

    <div class="cta-strip">
      <h2>Ready to see it for yourself?</h2>
      <a class="btn btn-primary btn-lg" href="#/signup">Open the sample family</a>
    </div>
  `;
}

/* ============================================================
   PRICING PAGE
   ============================================================ */
export function renderPricing(container) {
  container.innerHTML = `
    <section class="hero" style="grid-template-columns:1fr;padding-top:60px;padding-bottom:30px">
      <div>
        <span class="hero-eyebrow">Pricing</span>
        <h1>Three ways to begin.</h1>
        <p class="lede">Honest pricing for a tool you actually use. The MVP is free — these are early indications of where the platform is heading.</p>
      </div>
    </section>

    <section class="section" style="border-top:none;padding-top:0">
      <div class="pricing-grid">
        <div class="price-card">
          <span class="price-tag">North Star Family</span>
          <h3>Core platform</h3>
          <div class="price">$0<small>/ MVP</small></div>
          <p class="text-muted">Everything you need to run a real family learning journey.</p>
          <ul>
            <li>Family Vision builder</li>
            <li>Unlimited children + child portals</li>
            <li>Projects, milestones, Momentum Points</li>
            <li>Voice reflections</li>
            <li>Growth Reports</li>
            <li>Family Councils &amp; Legacy</li>
            <li>Calendar, materials, mock cart</li>
          </ul>
          <button class="btn btn-primary" data-cta="trial">Start Free Trial</button>
        </div>

        <div class="price-card featured">
          <span class="price-tag">North Star Premium</span>
          <h3>For families ready to go deeper</h3>
          <div class="price">$19<small>/ month · placeholder</small></div>
          <p>Everything in Family, plus deeper developmental intelligence and community.</p>
          <ul>
            <li>Child Insights (optional, parent-controlled)</li>
            <li>Optional interpretive frameworks</li>
            <li>Personality lenses + longitudinal map</li>
            <li>The Learning Guild (community)</li>
            <li>Priority Growth Report features</li>
            <li>Print-ready Family Legacy book</li>
          </ul>
          <button class="btn btn-primary" data-cta="waitlist">Join Waitlist</button>
        </div>

        <div class="price-card">
          <span class="price-tag">Guided Setup</span>
          <h3>One-hour onboarding call</h3>
          <div class="price">$149<small>/ once · placeholder</small></div>
          <p class="text-muted">Sit with a North Star guide and design your family's vision, slider, domains and first term.</p>
          <ul>
            <li>60-minute live call</li>
            <li>Your Family North Star captured with you</li>
            <li>First-term project plan</li>
            <li>Follow-up notes + recording</li>
            <li>Includes Family plan for 3 months</li>
          </ul>
          <button class="btn" data-cta="guided">Book Guided Setup</button>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 style="font-size:28px">Honest about what's mocked.</h2>
      <p class="lede">The MVP runs locally on your device. Real payments, real accounts, real community matching and real LLM-powered suggestions arrive as the platform matures. Your journey doesn't have to wait.</p>
    </section>
  `;
  container.querySelectorAll("[data-cta]").forEach(b => {
    b.addEventListener("click", () => {
      const what = b.dataset.cta;
      if (what === "trial") navigate("/signup");
      else if (what === "guided") navigate("/contact");
      else { toast("You're on the waitlist ✦ we'll be in touch.", { type: "success", duration: 3500 }); }
    });
  });
}

/* ============================================================
   CONTACT PAGE
   ============================================================ */
export function renderContact(container) {
  container.innerHTML = `
    <section class="hero" style="grid-template-columns:1fr;padding-top:60px;padding-bottom:30px">
      <div>
        <span class="hero-eyebrow">Contact</span>
        <h1>Tell us about your family.</h1>
        <p class="lede">Questions about North Star, guided setup, or whether this fits your family — we read every message.</p>
      </div>
    </section>

    <section class="section" style="border-top:none;padding-top:0">
      <div class="card" style="max-width:680px;padding:32px">
        <div class="field"><label>Name</label><input class="input" id="c-name" placeholder="Your name"/></div>
        <div class="field"><label>Email</label><input class="input" id="c-email" type="email" placeholder="you@example.com"/></div>
        <div class="field"><label>Message</label><textarea class="textarea" id="c-msg" data-voice data-voice-label="Speak your message" rows="6" placeholder="Tell us about your family, what you're trying to build, or any question on your mind."></textarea></div>
        <div class="row" style="justify-content:flex-end">
          <button class="btn btn-primary btn-lg" id="c-send">Send message</button>
        </div>
      </div>
    </section>
  `;
  container.querySelector("#c-send").addEventListener("click", () => {
    const name = container.querySelector("#c-name").value.trim();
    const email = container.querySelector("#c-email").value.trim();
    const msg = container.querySelector("#c-msg").value.trim();
    if (!name || !email || !msg) { toast("Please fill out every field", { type: "warning" }); return; }
    toast("Message received ✦ we'll be in touch.", { type: "success", duration: 3500 });
    container.querySelector("#c-name").value = "";
    container.querySelector("#c-email").value = "";
    container.querySelector("#c-msg").value = "";
  });
}

/* ============================================================
   LOGIN PAGE  —  real local-only auth
   ============================================================ */
export function renderLogin(container) {
  const accountExists = hasAccount();
  const loggedIn = isLoggedIn();

  container.innerHTML = `
    <section class="hero" style="grid-template-columns:1fr;padding-top:60px;padding-bottom:30px;text-align:center">
      <div>
        <span class="hero-eyebrow">Login</span>
        <h1 style="margin:0 auto">Choose your view.</h1>
        <p class="lede" style="margin:14px auto 0">All accounts are local to this device. Nothing leaves your machine.</p>
      </div>
    </section>

    <section class="section" style="border-top:none;padding-top:0">
      <div class="login-grid">
        <!-- Parent card -->
        <div class="login-card login-card-form" style="text-align:left">
          <div style="text-align:center">
            <div class="em">🧭</div>
            <h3 style="font-family:var(--font-serif);font-size:24px;margin-bottom:6px;text-align:center">Parent</h3>
          </div>
          ${loggedIn ? `
            <p class="text-muted center" style="text-align:center">You're signed in as <span class="kbd">${esc(currentUserEmail())}</span>.</p>
            <div class="row" style="gap:8px;justify-content:center;margin-top:14px">
              <a class="btn btn-primary btn-lg" href="#/">Open my portal →</a>
              <button class="btn btn-lg" id="p-logout">Log out</button>
            </div>
          ` : accountExists ? `
            <div class="field"><label>Email</label><input class="input" id="p-email" type="email" autocomplete="email" placeholder="you@example.com"/></div>
            <div class="field"><label>Password</label><input class="input" id="p-password" type="password" autocomplete="current-password" placeholder="Your password"/></div>
            <button class="btn btn-primary btn-lg" id="p-login" style="width:100%;justify-content:center">Log in</button>
            <p class="small text-muted center" style="text-align:center;margin-top:14px">No account on this device yet? <a href="#/signup">Create one</a>.</p>
          ` : `
            <p class="text-muted center" style="text-align:center">No account on this device yet.</p>
            <a class="btn btn-primary btn-lg" href="#/signup" style="width:100%;justify-content:center;text-decoration:none">Create your account →</a>
          `}
        </div>

        <!-- Child card -->
        <div class="login-card login-card-form" style="text-align:left">
          <div style="text-align:center">
            <div class="em">✦</div>
            <h3 style="font-family:var(--font-serif);font-size:24px;margin-bottom:6px;text-align:center">Child</h3>
            <p class="text-muted" style="text-align:center;margin-bottom:14px">Enter the access code your parent gave you.</p>
          </div>
          <div class="field"><label>Access code</label><input class="input" id="c-code" placeholder="e.g. NOAH12" style="font-size:18px;letter-spacing:0.1em;text-transform:uppercase;text-align:center"/></div>
          <div class="field"><label>PIN <span class="text-muted small">(if your parent set one)</span></label><input class="input" id="c-pin" inputmode="numeric" maxlength="4" placeholder="optional" style="font-size:18px;letter-spacing:0.4em;text-align:center"/></div>
          <button class="btn btn-primary btn-lg" id="c-login" style="width:100%;justify-content:center">Open my view →</button>
        </div>
      </div>
    </section>
  `;

  // Parent login submit
  const pLogin = container.querySelector("#p-login");
  pLogin?.addEventListener("click", async () => {
    const email = container.querySelector("#p-email").value.trim();
    const password = container.querySelector("#p-password").value;
    if (!email || !password) { toast("Email and password required", { type: "warning" }); return; }
    try {
      pLogin.disabled = true; pLogin.textContent = "Logging in…";
      await login({ email, password });
      toast(`Welcome back ✦`, { type: "success" });
      navigate("/");
    } catch (e) {
      pLogin.disabled = false; pLogin.textContent = "Log in";
      toast(e.message || "Login failed", { type: "warning", duration: 3500 });
    }
  });
  ["p-email", "p-password"].forEach(id => {
    container.querySelector("#" + id)?.addEventListener("keydown", e => {
      if (e.key === "Enter") pLogin?.click();
    });
  });

  // Parent logout (when already logged in)
  container.querySelector("#p-logout")?.addEventListener("click", () => {
    logout();
    toast("Logged out");
    navigate("/login");
  });

  // Child login submit
  const cLogin = container.querySelector("#c-login");
  cLogin?.addEventListener("click", () => {
    const code = container.querySelector("#c-code").value.trim().toUpperCase();
    const pin = container.querySelector("#c-pin").value.trim();
    if (!code) { toast("Enter your access code", { type: "warning" }); return; }
    const child = getChildByCode(code);
    if (!child) { toast("Code not recognised", { type: "warning" }); return; }
    if (child.pin && child.pin !== pin) {
      toast("That PIN doesn't match", { type: "warning" });
      return;
    }
    navigate("/kid/" + child.accessCode);
  });
  ["c-code", "c-pin"].forEach(id => {
    container.querySelector("#" + id)?.addEventListener("keydown", e => {
      if (e.key === "Enter") cLogin?.click();
    });
  });
}

/* ============================================================
   SIGNUP — account capture, then continue into onboarding.
   If an account already exists, redirect to /login.
   ============================================================ */
export function renderSignup(container) {
  if (hasAccount()) {
    navigate("/login");
    return;
  }

  container.innerHTML = `
    <section class="hero" style="grid-template-columns:1fr;padding-top:60px;padding-bottom:30px;text-align:center">
      <div>
        <span class="hero-eyebrow">Create your account</span>
        <h1 style="margin:0 auto">Set up your local sign-in.</h1>
        <p class="lede" style="margin:14px auto 0">One account per device. Email + password, stored locally with PBKDF2 hashing. Nothing leaves your machine.</p>
      </div>
    </section>

    <section class="section" style="border-top:none;padding-top:0">
      <div class="card" style="max-width:520px;margin:0 auto;padding:32px">
        <div class="field">
          <label>Your name</label>
          <input class="input" id="su-name" placeholder="e.g. Kristen"/>
        </div>
        <div class="field">
          <label>Email</label>
          <input class="input" id="su-email" type="email" autocomplete="email" placeholder="you@example.com"/>
        </div>
        <div class="field">
          <label>Password</label>
          <input class="input" id="su-password" type="password" autocomplete="new-password" placeholder="At least 8 characters, letters + a number"/>
          <span class="hint">Used only on this device. There's no recovery — write it somewhere safe.</span>
        </div>
        <div class="field">
          <label>Confirm password</label>
          <input class="input" id="su-confirm" type="password" autocomplete="new-password"/>
        </div>
        <button class="btn btn-primary btn-lg" id="su-create" style="width:100%;justify-content:center">Create account & continue →</button>
        <p class="small text-muted center" style="text-align:center;margin-top:14px">Already have one? <a href="#/login">Log in</a>.</p>
      </div>
    </section>
  `;

  const createBtn = container.querySelector("#su-create");
  createBtn.addEventListener("click", async () => {
    const parentName = container.querySelector("#su-name").value.trim();
    const email = container.querySelector("#su-email").value.trim();
    const password = container.querySelector("#su-password").value;
    const confirm = container.querySelector("#su-confirm").value;
    if (!parentName) { toast("Add your name", { type: "warning" }); return; }
    if (password !== confirm) { toast("Passwords don't match", { type: "warning" }); return; }
    try {
      createBtn.disabled = true; createBtn.textContent = "Creating account…";
      await signup({ email, password, parentName });
      toast("Account created — let's set up your family ✦", { type: "success", duration: 3000 });
      navigate("/onboarding");
    } catch (e) {
      createBtn.disabled = false; createBtn.textContent = "Create account & continue →";
      toast(e.message || "Couldn't create account", { type: "warning", duration: 3500 });
    }
  });
  ["su-name", "su-email", "su-password", "su-confirm"].forEach(id => {
    container.querySelector("#" + id)?.addEventListener("keydown", e => {
      if (e.key === "Enter") createBtn.click();
    });
  });
}
