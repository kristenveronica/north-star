/* ============================================================
   marketing.js — North Star public marketing site.
   7 pages: Home, About, How It Works, Features, Pricing,
   Contact, Login.
   ============================================================ */

import { esc, toast, nsIcon } from "../components/ui.js";
import { getChildByCode } from "../store.js";
import { childPortalLogin } from "../lib/childPortalCloud.js";
import { navigate, currentPath } from "../router.js";
import { hasAccount, isLoggedIn, signup, login, logout, currentUserEmail, requestPasswordReset, updatePassword } from "../auth.js";
import { logoLockup, logoStacked } from "../components/logo.js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../lib/supabase.js";
import { getPendingCheckout, getPendingInvite } from "../lib/repo.js";

/** Ask the public-checkout function whether an email already has a LIVE
    subscription. Used to gate sign-up so only subscribers can create an account.
    Returns { active, error? }. On a lookup error we return active:false + error
    so the caller can decide how to handle it (we let them proceed to checkout). */
async function checkActiveSubscription(email) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/public-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ action: "check-subscription", payload: { email } }),
    });
    const data = await res.json();
    return { active: !!data?.active, error: data?.error || (!res.ok ? "request_failed" : null) };
  } catch (e) {
    return { active: false, error: e?.message || "request_failed" };
  }
}

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
        <button class="public-nav-toggle" id="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="public-nav">
          <span class="public-nav-bars" aria-hidden="true"><span></span><span></span><span></span></span>
        </button>
        <nav class="public-nav" id="public-nav">
          ${NAV_LINKS.map(n => `<a href="#${n.path}" class="${path === n.path ? "active" : ""}">${esc(n.label)}</a>`).join("")}
          ${loggedIn
            ? `<a href="#" id="nav-logout" class="">Logout</a>
               <a href="#/" class="btn btn-sm btn-primary public-nav-cta" style="text-decoration:none">Open my portal →</a>`
            : `<a href="#/login" class="${path === "/login" ? "active" : ""}">Login</a>
               <a href="#${accountExists ? "/login" : "/pricing"}" class="btn btn-sm btn-primary public-nav-cta" style="text-decoration:none">${accountExists ? "Login →" : "Join North Star"}</a>`}
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
              <a href="#/pricing">Join North Star</a>
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

  // Mobile hamburger: toggle the nav panel. Navigating re-renders the shell,
  // so a tapped link naturally closes the menu; we also close it explicitly.
  const toggle = root.querySelector("#nav-toggle");
  const nav = root.querySelector("#public-nav");
  if (toggle && nav) {
    const setOpen = (open) => {
      nav.classList.toggle("open", open);
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
    nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setOpen(false)));
  }
}

/* ============================================================
   HOME PAGE  —  8-section narrative journey, strict design system
   1 Hero → 2 Start With The Destination → 3 Imagine Your Child At 18
   → 4 Every Family Has A North Star → 5 How North Star Works
   → 6 Learning Ecosystem → 7 Family Operating System → 8 Final CTA

   Only three section types: cream content (.np-section), navy
   storytelling (.np-section--navy), and the CTA (.np-cta). The
   compass appears only in the hero and as one subtle §4 watermark.
   ============================================================ */
/* ---- Homepage A/B split test ----
   A = the current cream hero (control). B = navy hero band with the rendered
   compass. A visitor is assigned once (50/50) and pinned in localStorage so the
   page never flips on them. Force/preview either with ?home=a or ?home=b. */
const HOME_VARIANT_KEY = "northstar::homeVariant";
function homeVariant() {
  try {
    const forced = new URLSearchParams(location.search).get("home");
    if (forced === "a" || forced === "b") { localStorage.setItem(HOME_VARIANT_KEY, forced); return forced; }
    const saved = localStorage.getItem(HOME_VARIANT_KEY);
    if (saved === "a" || saved === "b") return saved;
    const v = Math.random() < 0.5 ? "a" : "b";
    localStorage.setItem(HOME_VARIANT_KEY, v);
    return v;
  } catch { return "a"; }
}

export function renderHome(container) {
  // §6 Learning Ecosystem — 12 experiences (symmetric 4×3 grid).
  // No icons: the strict system leans on typography, not decoration.
  const EXPERIENCES = [
    "Projects", "Books", "Businesses", "Apprenticeships",
    "Mentorships", "Adventures", "Travel", "Service",
    "Creative Pursuits", "Life Skills", "Community", "Real-World Challenges",
  ];

  // §3 — the rhythmic "They know how to…" litany. Each line verbatim;
  // the final line carries the most weight.
  const KNOWS = [
    "They know how to learn.",
    "They know how to work.",
    "They know how to earn.",
    "They know how to communicate.",
    "They know how to contribute.",
    "They know how to navigate challenges.",
    "They know how to create value.",
    "They know how to build, grow, adapt, and stay steady in a changing world.",
  ];

  // §5 — how it works: a four-step path from vision to everyday life.
  const STEPS = [
    ["01", "Define your North Star", "Clarify the values, capabilities, and vision for the adult each child is becoming."],
    ["02", "Understand each child", "Capture their strengths, interests, and the way they learn best."],
    ["03", "Design the journey", "Reverse-engineer a personalised plan of projects and real-world experiences."],
    ["04", "Live &amp; reflect", "Track growth, capture the moments that matter, and adjust as your children grow."],
  ];

  const navyHero = homeVariant() === "b";

  container.innerHTML = `
    <div class="np-home">

      <!-- ───────────── 1. HERO (A/B split: cream control vs navy variant) ───────────── -->
      <section class="np-hero${navyHero ? " np-hero--navy" : ""}">
        <div class="np-hero-text">
          <span class="np-label${navyHero ? " np-label--gold" : ""}">A Family Vision Platform</span>
          <h1 class="np-hero-h1">Who do you hope your child becomes?</h1>
          <p class="np-hero-lead">At eighteen. At twenty-five. When they have left home and are building a life of their own.</p>
          <a class="btn btn-primary btn-lg" href="#/pricing">Discover Your North Star</a>
        </div>
        <div class="np-hero-art hero-art">
          ${navyHero
            ? `<div class="hero-compass hero-compass--render">
                 <span class="hero-compass-halo" aria-hidden="true"></span>
                 <img class="hero-compass-img" src="assets/images/hero-compass-rose.png"
                      alt="The North Star compass" width="464" height="464" decoding="async" />
                 <span class="hero-compass-core" aria-hidden="true"></span>
               </div>`
            : `<div class="hero-compass">
                 <span class="hero-compass-halo" aria-hidden="true"></span>
                 ${heroCompassIllustration()}
               </div>`}
        </div>
      </section>

      <!-- ───────────── 2. START WITH THE DESTINATION ───────────── -->
      <section class="np-section">
        <div class="np-inner">
          <span class="np-label">The Philosophy</span>
          <h2 class="np-h2">Education should begin with a destination — not a curriculum.</h2>
          <div class="np-contrast">
            <p class="np-contrast-them">Most planning starts by asking, <em>“What should my child learn this year?”</em></p>
            <p class="np-contrast-us">North Star starts by asking, <em>“Who are we helping this child become?”</em></p>
          </div>
          <p class="np-lg">We help families define their North Star, then reverse-engineer a personalised learning journey around each child — nurturing the capabilities, character, confidence, and real-world skills to bring that vision to life.</p>
        </div>
      </section>

      <!-- ───────────── 3. IMAGINE YOUR CHILD AT 18 ───────────── -->
      <section class="np-section np-section--navy">
        <div class="np-inner">
          <span class="np-label np-label--gold">Imagine Looking Back</span>
          <h2 class="np-h2">Imagine your child at eighteen.</h2>
          <p class="np-lg">They have spent their childhood developing the skills, habits, experiences, and character that matter most to your family.</p>
          <ul class="np-knows">
            ${KNOWS.map((line, i) => `<li${i === KNOWS.length - 1 ? ' class="np-knows-final"' : ""}>${line}</li>`).join("")}
          </ul>
          <div class="np-imagine-close">
            <p class="np-close-strong">They know who they are.</p>
            <p>And they are excited about the life ahead of them.</p>
          </div>
        </div>
      </section>

      <!-- ───────────── 4. EVERY FAMILY HAS A NORTH STAR ───────────── -->
      <section class="np-section np-section--navy np-coordinates">
        <div class="np-watermark" aria-hidden="true">${heroCompassIllustration()}</div>
        <div class="np-inner">
          <span class="np-label np-label--gold">Direction Changes Everything</span>
          <h2 class="np-h2">Every family has a North Star.</h2>
          <p class="np-lg">A direction. A vision. A set of values that shape how you live, and how you raise your children.</p>
          <p class="np-body">Every ship that sets sail first locks in its destination. Storms come. Detours happen. But the coordinates always guide it back onto the path to where it is heading.</p>
          <p class="np-body">North Star helps families move beyond simply educating their children, and begin intentionally shaping the culture, experiences, and opportunities that influence who they become.</p>
        </div>
      </section>

      <!-- ───────────── 5. HOW NORTH STAR WORKS ───────────── -->
      <section class="np-section">
        <div class="np-inner">
          <span class="np-label">How It Works</span>
          <h2 class="np-h2">A clear path, from vision to everyday life.</h2>
          <div class="np-steps">
            ${STEPS.map(([num, title, desc]) => `
              <div class="np-step">
                <div class="np-step-num">${num}</div>
                <h3>${title}</h3>
                <p>${desc}</p>
              </div>
            `).join("")}
          </div>
        </div>
      </section>

      <!-- ───────────── 6. LEARNING ECOSYSTEM ───────────── -->
      <section class="np-section">
        <div class="np-inner">
          <span class="np-label">The Learning Ecosystem</span>
          <h2 class="np-h2">Learning happens through real-world experience.</h2>
          <div class="np-ecosystem">
            ${EXPERIENCES.map((label, i) => `
              <div class="np-eco-item">
                <span class="np-eco-index">${String(i + 1).padStart(2, "0")}</span>
                <span class="np-eco-label">${label}</span>
              </div>
            `).join("")}
          </div>
          <p class="np-eco-foot">Each one is intentionally chosen for the role it can play in helping your child grow into the person you hope they become.</p>
        </div>
      </section>

      <!-- ───────────── 7. FAMILY OPERATING SYSTEM ───────────── -->
      <section class="np-section np-section--navy">
        <div class="np-inner">
          <span class="np-label np-label--gold">More Than A Curriculum</span>
          <h2 class="np-h2">Part learning platform. Part family operating system.</h2>
          <p class="np-lg">North Star brings together your family's values, vision, goals, rhythms, projects, learning plans, and reflections — into one place.</p>
          <p class="np-body">Because when a family shares a vision and is anchored in its core values, children grow up with a strong sense of identity and purpose.</p>
          <div class="np-os-close">
            <p>Learning becomes more meaningful.</p>
            <p>And children gain a deeper understanding of who they are, and where they are heading.</p>
          </div>
        </div>
      </section>

      <!-- ───────────── 8. FINAL CTA ───────────── -->
      <section class="np-cta">
        <h2 class="np-cta-h2">The destination matters.</h2>
        <p class="np-cta-sub">Let's build the path together.</p>
        <a class="btn btn-primary btn-lg" href="#/pricing">Discover Your North Star</a>
      </section>

    </div>
  `;
}

/* ============================================================
   HERO COMPASS — North Star illustrated instrument.

   Navy disc with a thin gold rim. Cream cardinal cross + muted
   antique gold intercardinal X meet at a small gold North Star
   in the centre — symbolically, the family's North Star sits at
   the heart of the compass.

   The outer ring + ticks + labels are STATIC. Only the inner rose
   group rotates during the calibration animation.

   viewBox 0–400, every element centred on (200, 200).
   ============================================================ */
function heroCompassIllustration() {
  const CX = 200, CY = 200;

  // Blade kite (tip → shoulder → centre → shoulder), absolute coords.
  const blade = (deg, length, shoulder, halfWidth) => {
    const a = (deg * Math.PI) / 180;
    const dx = Math.sin(a), dy = -Math.cos(a);
    const px = Math.cos(a), py = Math.sin(a);
    const tipX = CX + dx * length, tipY = CY + dy * length;
    const sx = CX + dx * shoulder, sy = CY + dy * shoulder;
    return [
      `${tipX.toFixed(2)},${tipY.toFixed(2)}`,
      `${(sx + px * halfWidth).toFixed(2)},${(sy + py * halfWidth).toFixed(2)}`,
      `${CX},${CY}`,
      `${(sx - px * halfWidth).toFixed(2)},${(sy - py * halfWidth).toFixed(2)}`,
    ].join(" ");
  };

  // Polar label position helper
  const polar = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return { x: CX + Math.sin(a) * r, y: CY - Math.cos(a) * r };
  };

  // 8 prominent hour ticks at non-cardinal 30° positions — set rhythm
  // on the cream band without clutter.
  const hourTicks = [30, 60, 120, 150, 210, 240, 300, 330].map(deg => {
    const a = (deg * Math.PI) / 180;
    const sin = Math.sin(a), cos = Math.cos(a);
    const x1 = CX + sin * 168, y1 = CY - cos * 168;
    const x2 = CX + sin * 184, y2 = CY - cos * 184;
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke-width="0.9" opacity="0.7"/>`;
  }).join("");

  // 60 minute hairlines — very subtle background rhythm
  const minuteTicks = Array.from({ length: 60 }, (_, i) => {
    const deg = i * 6;
    if (deg % 30 === 0) return "";
    const a = (deg * Math.PI) / 180;
    const sin = Math.sin(a), cos = Math.cos(a);
    const x1 = CX + sin * 176, y1 = CY - cos * 176;
    const x2 = CX + sin * 184, y2 = CY - cos * 184;
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke-width="0.5" opacity="0.35"/>`;
  }).join("");

  // Intercardinal labels at radius 164 — restrained, sit inside the cardinal ring
  const interLabels = [["NE", 45], ["SE", 135], ["SW", 225], ["NW", 315]].map(([label, deg]) => {
    const p = polar(deg, 158);
    return `<text x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="8.5" letter-spacing="1.6" opacity="0.45">${label}</text>`;
  }).join("");

  return `
    <svg class="hero-compass-svg" viewBox="0 0 400 400"
         xmlns="http://www.w3.org/2000/svg"
         role="img" aria-label="North Star compass illustration">

      <defs>
        <!-- Navy face: top-lit refined navy with subtle depth -->
        <radialGradient id="hc-face" cx="38%" cy="30%" r="80%">
          <stop offset="0%"   stop-color="#3C507A"/>
          <stop offset="55%"  stop-color="#2A3954"/>
          <stop offset="100%" stop-color="#162033"/>
        </radialGradient>

        <!-- Muted antique gold gradient for the intercardinal X -->
        <linearGradient id="hc-gold" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"   stop-color="#D9A848"/>
          <stop offset="55%"  stop-color="#B58535"/>
          <stop offset="100%" stop-color="#7A581F"/>
        </linearGradient>

        <!-- Cream gradient for the cardinal cross — warm not stark -->
        <linearGradient id="hc-cream" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"   stop-color="#FFF8E0"/>
          <stop offset="55%"  stop-color="#F4E9C5"/>
          <stop offset="100%" stop-color="#D9C796"/>
        </linearGradient>

        <!-- Centre North Star jewel -->
        <radialGradient id="hc-star" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stop-color="#FFF8E0"/>
          <stop offset="60%"  stop-color="#E8B547"/>
          <stop offset="100%" stop-color="#7A581F"/>
        </radialGradient>

        <!-- Soft engraved glow for the N letter -->
        <filter id="hc-n-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="0.9" result="b"/>
          <feMerge>
            <feMergeNode in="b"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- ────────── STATIC OUTER ────────── -->
      <g class="cmp-outer">
        <!-- Navy face disc with a delicate gold rim -->
        <circle cx="${CX}" cy="${CY}" r="190" fill="url(#hc-face)" stroke="#B58535" stroke-width="0.9" opacity="1"/>

        <!-- Inner gold detail ring -->
        <circle cx="${CX}" cy="${CY}" r="168" fill="none" stroke="#B58535" stroke-width="0.5" opacity="0.55"/>

        <!-- Inner guide ring just outside the rose -->
        <circle cx="${CX}" cy="${CY}" r="118" fill="none" stroke="#F4E9C5" stroke-width="0.4" opacity="0.22"/>

        <!-- Hour + minute ticks in cream -->
        <g class="cmp-ticks" stroke="#F4E9C5" stroke-linecap="round">
          ${minuteTicks}
          ${hourTicks}
        </g>

        <!-- Cardinal labels in cream; N is the dominant focal moment -->
        <g class="cmp-card-labels" font-family="Cormorant Garamond, Georgia, serif" fill="#F4E9C5" font-weight="500">
          <text x="${CX}" y="20" text-anchor="middle" dominant-baseline="central"
                font-size="26" font-weight="600" letter-spacing="4"
                filter="url(#hc-n-glow)" class="cmp-n">N</text>
          <text x="378" y="${CY}" text-anchor="middle" dominant-baseline="central"
                font-size="12" letter-spacing="2.2" opacity="0.5">E</text>
          <text x="${CX}" y="378" text-anchor="middle" dominant-baseline="central"
                font-size="12" letter-spacing="2.2" opacity="0.5">S</text>
          <text x="22" y="${CY}" text-anchor="middle" dominant-baseline="central"
                font-size="12" letter-spacing="2.2" opacity="0.5">W</text>
        </g>

        <!-- Intercardinals: smaller, sans-serif, set inside cardinals -->
        <g class="cmp-inter-labels" font-family="Mulish, system-ui, sans-serif" fill="#F4E9C5" font-weight="500">
          ${interLabels}
        </g>

        <!-- Four small muted-gold dots at the cardinal positions on the inner ring -->
        <g fill="#D9A848" opacity="0.85">
          <circle cx="${CX}" cy="${CY - 118}" r="1.9"/>
          <circle cx="${CX + 118}" cy="${CY}" r="1.9"/>
          <circle cx="${CX}" cy="${CY + 118}" r="1.9"/>
          <circle cx="${CX - 118}" cy="${CY}" r="1.9"/>
        </g>
      </g>

      <!-- ────────── ANIMATED INNER COMPASS (cross + X + centre star) ────────── -->
      <g class="cmp-rose">

        <!-- Intercardinal X blades — muted antique gold, sit underneath the cream cross -->
        <g fill="url(#hc-gold)">
          <polygon points="${blade(45,  62, 13, 4)}"/>
          <polygon points="${blade(135, 62, 13, 4)}"/>
          <polygon points="${blade(225, 62, 13, 4)}"/>
          <polygon points="${blade(315, 62, 13, 4)}"/>
        </g>

        <!-- Cardinal cross blades — cream, N reaches slightly further -->
        <g fill="url(#hc-cream)">
          <polygon points="${blade(0,   102, 16, 5.5)}"/>
          <polygon points="${blade(90,   94, 16, 5.5)}"/>
          <polygon points="${blade(180,  94, 16, 5.5)}"/>
          <polygon points="${blade(270,  94, 16, 5.5)}"/>
        </g>

        <!-- Fine warm ridge highlight down the centre of the north blade -->
        <line x1="${CX}" y1="100" x2="${CX}" y2="${CY}"
              stroke="#FFFCE5" stroke-width="0.7" opacity="0.6"/>

        <!-- Centre NORTH STAR — the heart of the compass.
              8-point gold star (two overlapping 4-point stars) with a tiny
              cream highlight at the very centre. -->
        <g class="cmp-centre-star">
          <!-- Outer 4-point gold star (cardinal axes) -->
          <polygon points="${CX},${CY - 13} ${CX + 3.2},${CY - 3.2} ${CX + 13},${CY} ${CX + 3.2},${CY + 3.2} ${CX},${CY + 13} ${CX - 3.2},${CY + 3.2} ${CX - 13},${CY} ${CX - 3.2},${CY - 3.2}"
                   fill="url(#hc-star)" stroke="#7A581F" stroke-width="0.35"/>
          <!-- Inner 4-point star rotated 45° for the 8-point look -->
          <polygon points="${CX},${CY - 7} ${CX + 1.8},${CY - 1.8} ${CX + 7},${CY} ${CX + 1.8},${CY + 1.8} ${CX},${CY + 7} ${CX - 1.8},${CY + 1.8} ${CX - 7},${CY} ${CX - 1.8},${CY - 1.8}"
                   fill="#FFF8E0" opacity="0.85" transform="rotate(45 ${CX} ${CY})"/>
          <!-- Centre highlight dot -->
          <circle cx="${CX}" cy="${CY}" r="1.2" fill="#FFFFFF" opacity="0.9"/>
        </g>
      </g>
    </svg>
  `;
}


/* ============================================================
   ABOUT PAGE
   ============================================================ */
export function renderAbout(container) {
  container.innerHTML = `
    <!-- ───────────── HERO — meet the founders ───────────── -->
    <section class="hero ns-hero about-hero">
      <div class="ns-hero-lead">
        <span class="hero-eyebrow">${nsIcon("compass", { size: 14 })} About North Star</span>
        <h1>We Built The Platform We Couldn't Find.</h1>
        <div class="about-intro">
          <p>Hi, we're Kristen and Mikey.</p>
          <p>We're the parents of two boys, Noah and Jett.</p>
          <p>Like many families, we've spent years exploring different approaches to education.</p>
          <p>Noah has experienced Montessori education, Steiner education, traditional classroom environments, and homeschooling.</p>
          <p>Jett's learning journey has looked different again.</p>
          <p>Along the way, we discovered something important.</p>
        </div>
      </div>
      <div class="hero-art">
        <div class="about-montage">
          <figure class="about-photo about-photo--family">
            <img src="assets/images/about-family.jpg" alt="Kristen, Mikey, Noah and Jett together on a family ski adventure" loading="lazy" />
          </figure>
          <figure class="about-photo about-photo--couple">
            <img src="assets/images/about-kristen-mikey.jpg" alt="Kristen and Mikey" loading="lazy" />
          </figure>
        </div>
      </div>
    </section>

    <!-- ───────────── THE REAL QUESTION ───────────── -->
    <section class="section" style="border-top:none;padding-top:8px">
      <div class="about-pivot">
        <p class="about-pivot-row about-pivot-row--quiet">
          <span class="about-pivot-label">The question was never</span>
          <span class="about-pivot-q">"What curriculum should we use?"</span>
        </p>
        <p class="about-pivot-row about-pivot-row--answer">
          <span class="about-pivot-label">The real question was</span>
          <span class="about-pivot-q">"How do we help our children become capable, confident, healthy, purpose-driven human beings?"</span>
        </p>
      </div>

      <p class="ns-bigidea-lead" style="margin-top:38px">We wanted an educational approach that recognised our children as unique individuals.</p>
      <ul class="ns-future-list cols-2">
        ${[
          "One that honoured their strengths.",
          "Supported their challenges.",
          "Encouraged their curiosity.",
          "Developed real-world capabilities.",
          "And helped them build a genuine love of learning.",
        ].map(t => `<li>${t}</li>`).join("")}
      </ul>
    </section>

    <!-- ───────────── EVERY OPTION SOLVED PART OF THE PUZZLE ───────────── -->
    <section class="section">
      <h2>What we found was that every option seemed to solve part of the puzzle.</h2>
      <div class="about-puzzle">
        ${[
          "Some offered structure.",
          "Some offered freedom.",
          "Some developed creativity.",
          "Some developed academics.",
          "Some focused on life skills.",
          "Some focused on personal growth.",
        ].map(t => `<span class="about-puzzle-piece">${t}</span>`).join("")}
      </div>
      <p class="ns-bigidea-close" style="margin-top:26px">But we couldn't find a framework that brought everything together in one place.</p>
      <p class="ns-turn-accent" style="text-align:left">So we started building it.</p>
    </section>

    <!-- ───────────── MORE THAN EDUCATION ───────────── -->
    <section class="section">
      <span class="section-eyebrow">More Than Education</span>
      <h2>As homeschooling parents ourselves, we also became aware of another challenge.</h2>
      <p class="philosophy-line" style="margin:14px 0 6px">Homeschooling can sometimes feel lonely.</p>
      <p class="about-aside">For children. For parents.</p>

      <div class="about-cols">
        <div class="about-col-card">
          <span class="ns-icon-wrap" style="margin-bottom:14px">${nsIcon("child", { size: 22 })}</span>
          <h3>Children need</h3>
          ${[
            "Children need meaningful friendships.",
            "They need collaboration.",
            "They need opportunities to build things together.",
            "To create together.",
            "To solve problems together.",
            "To learn from one another.",
          ].map(t => `<p>${t}</p>`).join("")}
        </div>
        <div class="about-col-card">
          <span class="ns-icon-wrap warm" style="margin-bottom:14px">${nsIcon("family", { size: 22 })}</span>
          <h3>Parents need</h3>
          ${[
            "Parents need community too.",
            "They need support.",
            "Ideas.",
            "Encouragement.",
            "Connection.",
          ].map(t => `<p>${t}</p>`).join("")}
        </div>
      </div>

      <p class="ns-destination-foot" style="margin-top:30px">That became one of the driving forces behind North Star's community features.</p>
      <p class="about-aside">Not simply another online community.</p>
      <p class="ns-operating-line">A place where children can connect around shared interests, shared projects, shared businesses, shared adventures, and meaningful friendships.</p>
    </section>

    <!-- ───────────── BUILT AROUND REAL CHILDREN ───────────── -->
    <section class="section">
      <span class="section-eyebrow">Built Around Real Children</span>
      <figure class="destination-callout">
        <span class="destination-callout-star" aria-hidden="true">${nsIcon("compass", { size: 18 })}</span>
        <blockquote>
          <span class="muted">Everything inside North Star begins with a simple question:</span>
          <span class="lead">Would we want this for Noah and Jett?</span>
        </blockquote>
        <p class="destination-callout-foot">If the answer is no, it doesn't belong.</p>
      </figure>

      <ul class="ns-future-list cols-2" style="margin-top:34px">
        ${[
          "The projects.",
          "The mentorships.",
          "The family economy tools.",
          "The capability frameworks.",
          "The life skills.",
          "The entrepreneurship pathways.",
          "The community.",
          "The travel learning.",
          "The reflections.",
          "The family vision work.",
        ].map(t => `<li>${t}</li>`).join("")}
      </ul>

      <p class="ns-destination-foot">It all exists because these are the things we want our own children to experience.</p>
    </section>

    <!-- ───────────── EDUCATION DESIGNED AROUND THE CHILD ───────────── -->
    <section class="section">
      <span class="section-eyebrow">Education Designed Around The Child</span>
      <h2>We believe children learn best when learning feels meaningful.</h2>
      <p class="about-aside">When it connects to their interests. Their strengths. Their passions. Their questions. Their natural curiosity.</p>

      <div class="about-examples">
        <div class="about-example-card">
          <span class="ns-icon-wrap" style="margin-bottom:14px">${nsIcon("pulse", { size: 22 })}</span>
          <p>A child who loves skiing should be able to learn mathematics, communication, business, leadership, science, and problem solving through projects connected to skiing.</p>
        </div>
        <div class="about-example-card">
          <span class="ns-icon-wrap sage" style="margin-bottom:14px">${nsIcon("leaf", { size: 22 })}</span>
          <p>A child who loves animals should be able to build their educational journey around animals.</p>
        </div>
        <div class="about-example-card">
          <span class="ns-icon-wrap gold" style="margin-bottom:14px">${nsIcon("spark", { size: 22 })}</span>
          <p>A child who loves music should be able to learn through music.</p>
        </div>
      </div>

      <div class="about-goal">
        <p class="muted">The goal isn't to make children fit a curriculum.</p>
        <p class="lead">The goal is to build a pathway that helps the child flourish.</p>
      </div>
    </section>

    <!-- ───────────── THE PLATFORM WE WISH WE HAD ───────────── -->
    <section class="section">
      <div class="section-philosophy ns-operating">
        <span class="section-eyebrow">The Platform We Wish We Had</span>
        <h2 style="max-width:740px">North Star is our attempt to bring together everything we've loved about:</h2>
        <ul class="ns-prompts" style="justify-content:flex-start;margin:8px 0 28px">
          ${[
            "Montessori.", "Steiner.", "Homeschooling.", "Unschooling.",
            "Project-based learning.", "Entrepreneurship.", "Mentorship.",
            "Life skills.", "Family culture.", "Community.",
          ].map(t => `<li><span>${t}</span></li>`).join("")}
        </ul>
        <p class="ns-operating-line">And combine it into a single framework that families can make entirely their own.</p>
        <div class="ns-operating-outcomes">
          <p>Because no two children are the same.</p>
          <p>No two families are the same.</p>
          <p>And education should reflect that.</p>
        </div>
      </div>
    </section>

    <!-- ───────────── OUR HOPE ───────────── -->
    <section class="section section-dark ns-imagine about-hope">
      <span class="section-eyebrow">Our Hope</span>
      <h2>Our hope is simple.</h2>
      <ul class="knows-list">
        ${[
          "That North Star helps families become more intentional.",
          "That children grow up knowing who they are and build strong relationships with peers who are on an aligned path.",
          "That learning becomes meaningful.",
          "That families feel more connected.",
          "That children develop the capabilities needed to thrive in an ever-changing world.",
          "And that more families get to experience the kind of educational journey we wished existed when we started looking for it ourselves.",
        ].map(t => `<li><span class="knows-star" aria-hidden="true">${nsIcon("star", { size: 13 })}</span><span>${t}</span></li>`).join("")}
      </ul>
      <p class="about-welcome">Welcome to North Star.</p>
    </section>

    <!-- ───────────── CTA ───────────── -->
    <div class="cta-strip ns-final-cta">
      <h2>Begin with a destination.</h2>
      <p>Let's build the path together.</p>
      <a class="btn btn-primary btn-lg" href="#/pricing">Discover Your North Star</a>
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
    ["Create your Family North Star", "Define what you actually believe — values, family vision, credo, core word, character priorities, capabilities, learning priorities. This becomes the lens for every decision the platform helps you make. Without it, every suggestion feels generic. With it, everything aligns."],
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
      <a class="btn btn-primary btn-lg" href="#/pricing">Start Building Your North Star</a>
    </div>
  `;
}

/* ============================================================
   FEATURES PAGE
   ============================================================ */
export function renderFeaturesPublic(container) {
  const featureGroups = [
    ["Foundations", [
      ["🧭", "Family Vision Builder", "Family vision, credo, core word, values."],
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
// Two ways to pay for the SAME 12-month membership. Annual is featured (navy).
const MEMBERSHIP_PLANS = [
  { key: "month", name: "Monthly", per: "per month", desc: "Your full 12-month membership, spread into comfortable monthly payments." },
  { key: "year",  name: "Annual",  per: "per year",  desc: "Your full 12-month membership, paid in one — and you save.", featured: true, tag: "Best value" },
];

const MEMBERSHIP_BELIEFS = [
  ["Learning shaped around <b>who your child already is</b>", "their interests, strengths and readiness."],
  ["Your family's values woven naturally through everyday learning", "<b>never bolted on</b>."],
  ["Real-world capability grown <b>alongside</b> literacy and numeracy", "not instead of them."],
  ["Projects that raise <b>capable adults</b>", "not just successful students."],
  ["Intelligence that <b>understands your family</b>", "before it suggests a single thing."],
  ["Designed for the <b>whole arc of childhood</b>", "not a single school year."],
];

export function renderPricing(container) {
  const FN = `${SUPABASE_URL}/functions/v1/public-checkout`;
  const money = (amt, cur = "usd") => amt == null ? "—"
    : new Intl.NumberFormat(undefined, { style: "currency", currency: (cur || "usd").toUpperCase() }).format(amt / 100);
  const planOf = (k) => MEMBERSHIP_PLANS.find(p => p.key === k) || {};

  let interval = null, children = 1, adults = 0, prices = null;
  const $ = (sel) => container.querySelector(sel);

  async function call(action, payload) {
    const res = await fetch(FN, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ action, payload }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  container.innerHTML = `
    <div class="pm">
      <!-- Short hero -->
      <div class="pm-hero">
        <span class="pm-eyebrow">Join North Star</span>
        <h1 class="pm-h1">A different way to raise learners.</h1>
        <p class="pm-lede">North Star helps families build a learning path around who their child is becoming, what they love, and the values they are growing up inside.</p>
      </div>

      <!-- Membership cards — above the fold (populated synchronously below) -->
      <p class="pm-cards-note">Every membership is a <b>12-month journey</b> — simply choose how you'd like to pay. Your first child is always included.</p>
      <div class="pm-cards" id="pm-cards"></div>

      <!-- Configurator (appears after a card is chosen) -->
      <div class="pm-config" id="pm-config">
        <div class="pm-calc">
          <h3 class="pm-calc-head">Begin your family's journey</h3>
          <p class="pm-calc-sub">A few details and you're ready. You can change everything later.</p>
          <div class="pm-chosen" id="pm-chosen"></div>

          <label class="pm-label">Your email</label>
          <input id="pm-email" class="pm-input" type="email" placeholder="you@example.com" autocomplete="email" />

          <label class="pm-label">How many children?</label>
          <div class="pm-step">
            <button data-step-child="-1" type="button">−</button>
            <span class="pm-n" id="pm-children">1</span>
            <button data-step-child="1" type="button">+</button>
            <span class="pm-note" id="pm-child-note">Your first child is included.</span>
          </div>

          <label class="pm-label">Supporting adults <span class="pm-muted" style="font-weight:600">(optional)</span></label>
          <div class="pm-help">Co-parents, tutors or mentors who help guide the learning — each can create projects and growth reports.</div>
          <div class="pm-step">
            <button data-step-adult="-1" type="button">−</button>
            <span class="pm-n" id="pm-adults">0</span>
            <button data-step-adult="1" type="button">+</button>
          </div>

          <button class="pm-promo-link" id="pm-promo-toggle" type="button">Have a beta code?</button>
          <div class="pm-promo-wrap" id="pm-promo-wrap">
            <input id="pm-promo" class="pm-input" type="text" placeholder="Enter your code" autocomplete="off" style="margin-top:10px" />
            <div class="pm-trial" id="pm-trial" style="display:none"></div>
          </div>

          <div class="pm-breakdown" id="pm-breakdown"></div>

          <button class="pm-go" id="pm-go" type="button">Continue →</button>
          <div class="pm-trust">Secure payment · Your family's data stays yours · Built for years of learning, not months</div>
          <div class="pm-err" id="pm-err"></div>
        </div>
      </div>

      <!-- Philosophy (below the cards) -->
      <div class="pm-beliefs">
        <div class="pm-beliefs-head">North Star is built on a few firm beliefs.</div>
        ${MEMBERSHIP_BELIEFS.map(([a, b]) => `
          <div class="pm-belief"><span class="pm-tick">✓</span><p>${a} — ${b}</p></div>
        `).join("")}
      </div>

      <!-- 12-month commitment (reassuring, below) -->
      <div class="pm-commit">
        <h3>A 12-month rhythm — and your journey is always yours</h3>
        <p>Real human development doesn't happen in 30-day cycles. North Star is a <b>12-month commitment</b> — because growing curiosity, character and capability needs room to unfold, and because a full year lets North Star truly come to know your family.</p>
        <p class="pm-keep">And the work is never lost. Every project, reflection, portfolio and milestone your family creates stays safely stored.</p>
        <p>If life ever calls you away, pause whenever you need — and if you return, your family's journey simply continues where it left off. We don't erase years of a childhood because a subscription paused.</p>
      </div>

      <p class="pm-post">After payment you'll create your North Star account with this email — your membership links automatically.</p>
    </div>
  `;

  const availablePlans = () => MEMBERSHIP_PLANS.filter(p => prices?.[p.key]?.base);

  function cardHtml(p) {
    const set = prices?.[p.key] || {};
    const cur = set.base?.currency || "usd";
    // Show a shimmer where the price will be until the live amount loads, so the
    // two cards appear instantly and only the number fills in (no layout jump).
    const priceHtml = prices
      ? money(set.base?.amount ?? null, cur)
      : `<span class="pm-price-skeleton" aria-hidden="true"></span>`;
    // On the annual card, show the saving vs paying monthly for the year.
    let saveHtml = "";
    if (p.featured && prices?.month?.base?.amount && prices?.year?.base?.amount) {
      const save = prices.month.base.amount * 12 - prices.year.base.amount;
      if (save > 0) saveHtml = `<div class="pm-psave">Save ${money(save, cur)} vs paying monthly</div>`;
    }
    return `
      <div class="pm-plan ${p.featured ? "featured" : ""} ${interval === p.key ? "selected" : ""}" data-plan="${p.key}">
        ${p.tag ? `<div class="pm-ribbon">${p.tag}</div>` : ""}
        <div class="pm-pstar">✦</div>
        <div class="pm-pname">${p.name}</div>
        <div class="pm-pterm">12-month membership</div>
        <div class="pm-pprice">${priceHtml}</div>
        <div class="pm-pper">${p.per} · your first child included</div>
        ${saveHtml}
        <div class="pm-pdesc">${p.desc}</div>
        <button class="pm-cta" type="button">${interval === p.key ? "Selected ✓" : "Choose " + p.name}</button>
      </div>`;
  }

  function renderCards() {
    const host = $("#pm-cards");
    // Before prices load, render BOTH cards (with a price skeleton) so the
    // membership options are visible immediately — no "Loading…" placeholder
    // that lets the philosophy section flash up before the cards arrive.
    const list = prices ? availablePlans() : MEMBERSHIP_PLANS;
    if (prices && !list.length) {
      host.innerHTML = `<div class="pm-loading">Memberships are being finalised — please check back shortly.</div>`;
      return;
    }
    host.innerHTML = list.map(cardHtml).join("");
    host.querySelectorAll("[data-plan]").forEach(card => card.addEventListener("click", () => choose(card.dataset.plan)));
  }

  function choose(key) {
    interval = key;
    renderCards();
    renderConfig();
    $("#pm-config").classList.add("open");
    setTimeout(() => $("#pm-config").scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }

  function renderConfig() {
    if (!interval) return;
    const p = planOf(interval);
    const set = prices?.[interval] || {};
    const cur = set.base?.currency || "usd";
    const extraChild = Math.max(0, children - 1);

    $("#pm-children").textContent = children;
    $("#pm-adults").textContent = adults;
    $("#pm-child-note").textContent = extraChild ? `Your first child + ${extraChild} more` : "Your first child is included.";
    $("#pm-chosen").innerHTML = `12-month membership · paid ${p.name.toLowerCase()} · ${money(set.base?.amount ?? null, cur)} ${p.per}
      <button type="button" id="pm-change">change</button>`;
    $("#pm-change").addEventListener("click", () => {
      $("#pm-config").classList.remove("open");
      interval = null; renderCards();
      $("#pm-cards").scrollIntoView({ behavior: "smooth", block: "center" });
    });

    const baseAmt = set.base?.amount ?? null, seatAmt = set.seat?.amount ?? null, aiAmt = set.aiseat?.amount ?? null;
    const total = baseAmt == null ? null : baseAmt + extraChild * (seatAmt || 0) + adults * (aiAmt || 0);
    const per = p.per === "per year" ? "/yr" : "/mo";

    $("#pm-breakdown").innerHTML = `
      <div class="pm-row"><span>Base membership · your first child</span><span>${money(baseAmt, cur)}${per}</span></div>
      ${extraChild > 0 ? `<div class="pm-row"><span class="pm-muted">${extraChild} additional ${extraChild === 1 ? "child" : "children"}</span><span>${money(seatAmt != null ? seatAmt * extraChild : null, cur)}${per}</span></div>` : ""}
      ${adults > 0 ? `<div class="pm-row"><span class="pm-muted">${adults} supporting ${adults === 1 ? "adult" : "adults"}</span><span>${money(aiAmt != null ? aiAmt * adults : null, cur)}${per}</span></div>` : ""}
      <div class="pm-total"><span>Total</span><span>${money(total, cur)}${per}</span></div>`;
    $("#pm-go").disabled = baseAmt == null;
  }

  container.querySelectorAll("[data-step-child]").forEach(b => b.addEventListener("click", () => { children = Math.max(1, children + (+b.dataset.stepChild)); renderConfig(); }));
  container.querySelectorAll("[data-step-adult]").forEach(b => b.addEventListener("click", () => { adults = Math.max(0, adults + (+b.dataset.stepAdult)); renderConfig(); }));

  $("#pm-promo-toggle").addEventListener("click", () => {
    const w = $("#pm-promo-wrap");
    const open = w.classList.toggle("open");
    $("#pm-promo-toggle").textContent = open ? "Hide beta code" : "Have a beta code?";
    if (open) $("#pm-promo").focus();
  });
  $("#pm-promo").addEventListener("input", () => {
    const v = $("#pm-promo").value.trim();
    $("#pm-trial").style.display = v ? "block" : "none";
    if (v) $("#pm-trial").textContent = "If this is a valid beta code, your membership is free through the beta — then your chosen membership begins. Beta families have no 12-month commitment.";
  });

  $("#pm-go").addEventListener("click", async () => {
    $("#pm-err").textContent = "";
    if (!interval) { $("#pm-err").textContent = "Please choose a membership above."; return; }
    const email = $("#pm-email").value.trim();
    if (!email) { $("#pm-err").textContent = "Please enter your email."; return; }
    const go = $("#pm-go");
    go.disabled = true; go.textContent = "Redirecting…";
    try {
      const { url } = await call("create", {
        interval, email, promoCode: $("#pm-promo").value.trim(),
        childSeats: Math.max(0, children - 1), adultSeats: adults,
      });
      window.location.href = url;
    } catch (e) {
      $("#pm-err").textContent = e.message || "Couldn't start checkout.";
      go.disabled = false; go.textContent = "Continue →";
    }
  });

  // Render the cards immediately (skeleton prices) so the page never flashes an
  // empty/loading state, then fetch live prices and fill them in.
  renderCards();
  (async () => {
    try { prices = await call("prices"); } catch (e) { $("#pm-err").textContent = e.message; }
    renderCards();
    if (interval) renderConfig(); // if a card was chosen before prices loaded, fill totals
  })();
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
        <p class="lede" style="margin:14px auto 0">Sign in to your family's North Star — synced securely across your devices.</p>
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
          ` : `
            <div class="field"><label>Email</label><input class="input" id="p-email" type="email" autocomplete="email" placeholder="you@example.com"/></div>
            <div class="field"><label>Password</label><input class="input" id="p-password" type="password" autocomplete="current-password" placeholder="Your password"/></div>
            <button class="btn btn-primary btn-lg" id="p-login" style="width:100%;justify-content:center">Log in →</button>
            <div id="p-err" class="small" style="color:var(--danger);text-align:center;margin-top:10px;display:none"></div>
            <p class="small text-muted" style="text-align:center;margin-top:14px"><a href="#" id="p-forgot">Forgot password?</a></p>
            <p class="small text-muted" style="text-align:center;margin-top:4px">New to North Star? <a href="#/signup">Create an account</a>.</p>
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
  const pErr = container.querySelector("#p-err");
  const showErr = (msg) => { if (pErr) { pErr.textContent = msg; pErr.style.display = "block"; } };
  pLogin?.addEventListener("click", async () => {
    if (pErr) pErr.style.display = "none";
    const email = container.querySelector("#p-email").value.trim();
    const password = container.querySelector("#p-password").value;
    if (!email || !password) { showErr("Enter your email and password."); return; }
    try {
      pLogin.disabled = true; pLogin.textContent = "Logging in…";
      await login({ email, password });
      toast(`Welcome back ✦`, { type: "success" });
      navigate("/");   // smartRoot routes to onboarding if not yet set up, else the dashboard
    } catch (e) {
      pLogin.disabled = false; pLogin.textContent = "Log in →";
      showErr(e.message || "Login failed. Please try again.");
    }
  });
  ["p-email", "p-password"].forEach(id => {
    container.querySelector("#" + id)?.addEventListener("keydown", e => {
      if (e.key === "Enter") pLogin?.click();
    });
  });

  // Forgot password — best-effort reset email (uses the email typed above).
  container.querySelector("#p-forgot")?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (pErr) pErr.style.display = "none";
    const email = (container.querySelector("#p-email")?.value || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showErr("Type your email in the box above first, then tap Forgot password.");
      return;
    }
    try {
      await requestPasswordReset(email);
      toast("If that email has an account, a reset link is on its way. Check your inbox (and spam).", { type: "success", duration: 5000 });
    } catch (err) {
      showErr(err.message || "Couldn't send a reset email right now.");
    }
  });

  // Parent logout (when already logged in)
  container.querySelector("#p-logout")?.addEventListener("click", () => {
    logout();
    toast("Logged out");
    navigate("/login");
  });

  // Child login submit
  const cLogin = container.querySelector("#c-login");
  cLogin?.addEventListener("click", async () => {
    const code = container.querySelector("#c-code").value.trim().toUpperCase();
    const pin = container.querySelector("#c-pin").value.trim();
    if (!code) { toast("Enter your access code", { type: "warning" }); return; }
    let child = getChildByCode(code);     // same-device fast path
    if (!child) {
      // Cross-device: look the child up in the cloud by their access code.
      cLogin.disabled = true; cLogin.textContent = "Checking…";
      try {
        child = await childPortalLogin(code);
      } catch (e) {
        cLogin.disabled = false; cLogin.textContent = "Open my view →";
        toast(/not_found/i.test(e.message) ? "Code not recognised"
          : /ambiguous/i.test(e.message) ? "This code needs resetting — ask your parent."
          : "Couldn't open the portal — try again", { type: "warning" });
        return;
      }
    }
    if (child.pin && child.pin !== pin) {
      cLogin.disabled = false; cLogin.textContent = "Open my view →";
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
/* Set a new password after arriving from a reset email (recovery session). */
export function renderResetPassword(container) {
  const hasSession = isLoggedIn();
  container.innerHTML = `
    <section class="hero" style="grid-template-columns:1fr;padding-top:60px;padding-bottom:30px;text-align:center">
      <div>
        <span class="hero-eyebrow">Reset password</span>
        <h1 style="margin:0 auto">Set a new password.</h1>
        <p class="lede" style="margin:14px auto 0">Choose a new password for your North Star account.</p>
      </div>
    </section>
    <section class="section" style="border-top:none;padding-top:0">
      <div class="card" style="max-width:460px;margin:0 auto;padding:32px">
        ${hasSession ? `
          <div class="field"><label>New password</label><input class="input" id="rp-pw" type="password" autocomplete="new-password" placeholder="At least 8 characters, letters + a number"/></div>
          <div class="field"><label>Confirm new password</label><input class="input" id="rp-confirm" type="password" autocomplete="new-password"/></div>
          <button class="btn btn-primary btn-lg" id="rp-save" style="width:100%;justify-content:center">Save new password →</button>
          <div id="rp-err" class="small" style="color:var(--danger);text-align:center;margin-top:10px;display:none"></div>
        ` : `
          <p class="text-muted" style="text-align:center;margin:0">This reset link is invalid or has expired. Head back to <a href="#/login">log in</a> and tap <b>Forgot password?</b> to get a fresh one.</p>
        `}
      </div>
    </section>`;
  if (!hasSession) return;
  const save = container.querySelector("#rp-save");
  const err = container.querySelector("#rp-err");
  const showErr = (m) => { err.textContent = m; err.style.display = "block"; };
  save.addEventListener("click", async () => {
    err.style.display = "none";
    const pw = container.querySelector("#rp-pw").value;
    const cf = container.querySelector("#rp-confirm").value;
    if (pw !== cf) { showErr("Passwords don't match."); return; }
    try {
      save.disabled = true; save.textContent = "Saving…";
      await updatePassword(pw);
      toast("Password updated — you're signed in ✦", { type: "success" });
      navigate("/");
    } catch (e) {
      save.disabled = false; save.textContent = "Save new password →";
      showErr(e.message || "Couldn't update your password.");
    }
  });
}

export function renderSignup(container) {
  if (hasAccount()) {
    navigate("/login");
    return;
  }

  // Gateway: a North Star account requires a membership. EXCEPTION: someone
  // joining an existing family via an invitation (a supporting adult / co-owner)
  // is covered by that family's subscription and must NOT be gated.
  const invited = !!getPendingInvite();
  // If they arrived straight from checkout we have a pending session (paid →
  // welcome them). Otherwise we verify on submit that their email has a live
  // subscription, else → /pricing.
  const paidViaCheckout = !!getPendingCheckout();

  container.innerHTML = `
    <section class="hero" style="grid-template-columns:1fr;padding-top:60px;padding-bottom:30px;text-align:center">
      <div>
        <span class="hero-eyebrow">${invited ? "You're invited ✦" : paidViaCheckout ? "Payment received ✓" : "Create your account"}</span>
        <h1 style="margin:0 auto">${invited ? "Join your family." : paidViaCheckout ? "Activate your membership." : "Create your account."}</h1>
        <p class="lede" style="margin:14px auto 0">${invited
          ? "Create your account below to join the family you were invited to — no payment needed, you're covered by their membership."
          : paidViaCheckout
            ? "Thank you — your payment went through. Create your account below to activate your membership and set up your family."
            : "Your secure North Star account — synced across your devices, with every family's data kept private and isolated."}</p>
      </div>
    </section>

    <section class="section" style="border-top:none;padding-top:0">
      <div class="card" style="max-width:520px;margin:0 auto;padding:32px">
        ${invited
          ? `<div class="hint" style="background:var(--sage-soft);color:var(--sage-ink);border-radius:10px;padding:11px 14px;margin-bottom:18px;line-height:1.5">Use the <strong>same email your invitation was sent to</strong> so we can add you to the family automatically.</div>`
          : paidViaCheckout
            ? `<div class="hint" style="background:var(--sage-soft);color:var(--sage-ink);border-radius:10px;padding:11px 14px;margin-bottom:18px;line-height:1.5">Use the <strong>same email</strong> you paid with so we can link your membership automatically.</div>`
            : ""}
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
          <span class="hint">At least 8 characters, including a number.</span>
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
    if (!email) { toast("Add your email", { type: "warning" }); return; }
    if (password !== confirm) { toast("Passwords don't match", { type: "warning" }); return; }
    try {
      createBtn.disabled = true;
      // Membership gateway: unless they just paid (pending checkout) OR are joining
      // a family via invitation, require a live subscription for this email.
      if (!paidViaCheckout && !invited) {
        createBtn.textContent = "Checking your membership…";
        const { active, error } = await checkActiveSubscription(email);
        if (!active) {
          createBtn.disabled = false; createBtn.textContent = "Create account & continue →";
          if (error) {
            // Couldn't verify — don't hard-block; send them to choose a membership.
            toast("Let's get your membership set up first.", { type: "warning", duration: 3500 });
          } else {
            toast("No active membership found for that email — choose a plan to get started.", { type: "warning", duration: 4000 });
          }
          navigate("/pricing");
          return;
        }
      }
      createBtn.textContent = "Creating account…";
      const res = await signup({ email, password, parentName });
      if (res?.needsConfirmation) {
        const card = container.querySelector(".card");
        if (card) card.innerHTML = `
          <div style="text-align:center">
            <div class="em">✉️</div>
            <h3 style="font-family:var(--font-serif);font-size:24px">Check your email</h3>
            <p class="text-muted" style="margin-top:8px">We've sent a confirmation link to <span class="kbd">${esc(email)}</span>.
            Click it, then come back and <a href="#/login">log in</a> to ${invited ? "join your family" : "set up your family"}.</p>
          </div>`;
        return;
      }
      // Invitees join an existing family (redeemed on hydrate) → go to the portal,
      // not the new-family onboarding wizard.
      toast(invited ? "Account created — joining your family ✦" : "Account created — let's set up your family ✦", { type: "success", duration: 3000 });
      navigate(invited ? "/" : "/onboarding");
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
