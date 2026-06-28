/* ============================================================
   marketing.js — North Star public marketing site.
   7 pages: Home, About, How It Works, Features, Pricing,
   Contact, Login.
   ============================================================ */

import { esc, toast, nsIcon } from "../components/ui.js";
import { getChildByCode } from "../store.js";
import { navigate, currentPath } from "../router.js";
import { hasAccount, isLoggedIn, signup, login, logout, currentUserEmail, requestPasswordReset, updatePassword } from "../auth.js";
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
   HOME PAGE  —  8-section narrative journey, strict design system
   1 Hero → 2 Start With The Destination → 3 Imagine Your Child At 18
   → 4 Every Family Has A North Star → 5 How North Star Works
   → 6 Learning Ecosystem → 7 Family Operating System → 8 Final CTA

   Only three section types: cream content (.np-section), navy
   storytelling (.np-section--navy), and the CTA (.np-cta). The
   compass appears only in the hero and as one subtle §4 watermark.
   ============================================================ */
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

  container.innerHTML = `
    <div class="np-home">

      <!-- ───────────── 1. HERO ───────────── -->
      <section class="np-hero">
        <div class="np-hero-text">
          <span class="np-label">A Family Vision Platform</span>
          <h1 class="np-hero-h1">Who do you hope your child becomes?</h1>
          <p class="np-hero-lead">At eighteen. At twenty-five. When they have left home and are building a life of their own.</p>
          <a class="btn btn-primary btn-lg" href="#/signup">Discover Your North Star</a>
        </div>
        <div class="np-hero-art hero-art">
          <div class="hero-compass">
            <span class="hero-compass-halo" aria-hidden="true"></span>
            ${heroCompassIllustration()}
          </div>
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
        <a class="btn btn-primary btn-lg" href="#/signup">Discover Your North Star</a>
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
        <div class="hero-compass">
          <span class="hero-compass-halo" aria-hidden="true"></span>
          ${heroCompassIllustration()}
        </div>
      </div>
    </section>

    <!-- ───────────── THE REAL QUESTION ───────────── -->
    <section class="section" style="border-top:none;padding-top:8px">
      <div class="ns-bigidea-pair">
        <div class="ns-bigidea-card them">
          <p class="ns-bigidea-intro">The question was never:</p>
          <p class="ns-bigidea-q">"What curriculum should we use?"</p>
        </div>
        <div class="ns-bigidea-card us">
          <p class="ns-bigidea-intro">The real question was:</p>
          <p class="ns-bigidea-q">"How do we help our children become capable, confident, healthy, purpose-driven human beings?"</p>
        </div>
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
      <a class="btn btn-primary btn-lg" href="#/signup">Discover Your North Star</a>
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

  container.innerHTML = `
    <section class="hero" style="grid-template-columns:1fr;padding-top:60px;padding-bottom:30px;text-align:center">
      <div>
        <span class="hero-eyebrow">Create your account</span>
        <h1 style="margin:0 auto">Create your account.</h1>
        <p class="lede" style="margin:14px auto 0">Your secure North Star account — synced across your devices, with every family's data kept private and isolated.</p>
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
    if (password !== confirm) { toast("Passwords don't match", { type: "warning" }); return; }
    try {
      createBtn.disabled = true; createBtn.textContent = "Creating account…";
      const res = await signup({ email, password, parentName });
      if (res?.needsConfirmation) {
        const card = container.querySelector(".card");
        if (card) card.innerHTML = `
          <div style="text-align:center">
            <div class="em">✉️</div>
            <h3 style="font-family:var(--font-serif);font-size:24px">Check your email</h3>
            <p class="text-muted" style="margin-top:8px">We've sent a confirmation link to <span class="kbd">${esc(email)}</span>.
            Click it, then come back and <a href="#/login">log in</a> to set up your family.</p>
          </div>`;
        return;
      }
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
