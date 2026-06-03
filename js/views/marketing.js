/* ============================================================
   marketing.js — North Star public marketing site.
   7 pages: Home, About, How It Works, Features, Pricing,
   Contact, Login.
   ============================================================ */

import { esc, toast, nsIcon } from "../components/ui.js";
import { getChildByCode } from "../store.js";
import { navigate, currentPath } from "../router.js";
import { hasAccount, isLoggedIn, signup, login, logout, currentUserEmail } from "../auth.js";

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
        <a class="public-brand" href="#/welcome">
          <div class="brand-mark brand-mark-star">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 1l2.4 7.6L22 10l-6.2 4.6L18 22l-6-4.6L6 22l2.2-7.4L2 10l7.6-1.4z"/></svg>
          </div>
          <div>
            <div class="name">North Star</div>
            <div class="sub">Family Learning</div>
          </div>
        </a>
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
            <div class="public-brand" style="color:var(--starlight)">
              <div class="brand-mark brand-mark-star">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 1l2.4 7.6L22 10l-6.2 4.6L18 22l-6-4.6L6 22l2.2-7.4L2 10l7.6-1.4z"/></svg>
              </div>
              <div>
                <div class="name">North Star</div>
                <div class="sub">Family Learning</div>
              </div>
            </div>
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
          ${compassSVG()}
          <div class="compass-glow"></div>
        </div>
      </div>
    </section>

    <!-- ───────────── 2. THE PROBLEM ───────────── -->
    <section class="section">
      <span class="section-eyebrow">The problem</span>
      <h2>Most homeschool tools start with curriculum. North Star starts with the child.</h2>
      <p class="lede">Families are often piecing together curriculum, planners, worksheets, apps, projects, values, life skills and passions from a dozen different places.</p>
      <p class="lede" style="color:var(--text)">North Star brings everything together around one guiding question:</p>
      <p class="philosophy-line" style="margin-top:20px">Who is this child, and how can we best support their growth?</p>
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
   COMPASS SVG — multi-ring celestial compass.
   Layered SVG; CSS handles the calibration animation.
   ============================================================ */
function compassSVG() {
  return `
    <svg class="compass-svg" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="bezelGrad" cx="50%" cy="42%" r="55%">
          <stop offset="0%"   stop-color="#3F5278"/>
          <stop offset="60%"  stop-color="#2A3954"/>
          <stop offset="100%" stop-color="#171F30"/>
        </radialGradient>
        <radialGradient id="faceGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stop-color="#2C3B58"/>
          <stop offset="100%" stop-color="#1B2538"/>
        </radialGradient>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stop-color="#F4E9C5" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#F4E9C5" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="needleGrad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"   stop-color="#F4E9C5"/>
          <stop offset="50%"  stop-color="#E8B547"/>
          <stop offset="100%" stop-color="#8C6612"/>
        </linearGradient>
      </defs>

      <!-- Outer bezel -->
      <circle cx="200" cy="200" r="196" fill="url(#bezelGrad)"/>
      <circle cx="200" cy="200" r="186" fill="none" stroke="rgba(244,233,197,0.18)" stroke-width="1"/>

      <!-- Inner face -->
      <circle cx="200" cy="200" r="170" fill="url(#faceGrad)"/>

      <!-- Concentric rings -->
      <g class="compass-ring-outer">
        <circle cx="200" cy="200" r="160" fill="none" stroke="rgba(244,233,197,0.22)" stroke-width="1"/>
        <circle cx="200" cy="200" r="148" fill="none" stroke="rgba(244,233,197,0.14)" stroke-width="0.6" stroke-dasharray="2 4"/>
      </g>
      <g class="compass-ring-mid">
        <circle cx="200" cy="200" r="120" fill="none" stroke="rgba(244,233,197,0.16)" stroke-width="0.8"/>
      </g>
      <g class="compass-ring-inner">
        <circle cx="200" cy="200" r="78" fill="none" stroke="rgba(244,233,197,0.25)" stroke-width="0.6"/>
      </g>

      <!-- 32 tick marks at 11.25° intervals -->
      <g stroke="rgba(244,233,197,0.55)" stroke-linecap="round">
        ${Array.from({ length: 32 }, (_, i) => {
          const a = (i * 11.25) * Math.PI / 180;
          const r1 = 160, r2 = i % 4 === 0 ? 144 : i % 2 === 0 ? 152 : 156;
          const sw = i % 4 === 0 ? 1.4 : 0.6;
          const x1 = 200 + Math.sin(a) * r1, y1 = 200 - Math.cos(a) * r1;
          const x2 = 200 + Math.sin(a) * r2, y2 = 200 - Math.cos(a) * r2;
          return `<line class="compass-tick" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke-width="${sw}"/>`;
        }).join("")}
      </g>

      <!-- Cardinal labels -->
      <g font-family="Fraunces, Georgia, serif" font-weight="600" fill="#F4E9C5">
        <text class="compass-label n" x="200" y="56"  text-anchor="middle" font-size="22" letter-spacing="2">N</text>
        <text class="compass-label"   x="346" y="208" text-anchor="middle" font-size="16" opacity="0.7" letter-spacing="2">E</text>
        <text class="compass-label"   x="200" y="358" text-anchor="middle" font-size="16" opacity="0.7" letter-spacing="2">S</text>
        <text class="compass-label"   x="54"  y="208" text-anchor="middle" font-size="16" opacity="0.7" letter-spacing="2">W</text>
      </g>

      <!-- Faint celestial dots scattered through outer ring -->
      <g fill="#F4E9C5">
        ${[[200,28],[330,90],[372,200],[330,310],[200,372],[70,310],[28,200],[70,90],[260,72],[80,250],[320,150]]
          .map(([x,y],i) => `<circle cx="${x}" cy="${y}" r="${i%3===0?1.6:1}" opacity="${0.3 + (i%4)*0.1}"/>`).join("")}
      </g>

      <!-- Central glow + star -->
      <circle cx="200" cy="200" r="60" fill="url(#centerGlow)"/>
      <g class="compass-center-star" transform="translate(200 200)">
        <path d="M0 -38 L11 -11 L40 -8 L18 9 L26 38 L0 22 L-26 38 L-18 9 L-40 -8 L-11 -11 Z"
              fill="#F4E9C5" stroke="#8C6612" stroke-width="0.6"/>
        <circle cx="0" cy="0" r="3.5" fill="#8C6612"/>
      </g>

      <!-- Needle (always points N after calibration) -->
      <g class="compass-needle">
        <path d="M200 65 L208 200 L200 210 L192 200 Z" fill="url(#needleGrad)" stroke="#8C6612" stroke-width="0.4"/>
        <path d="M200 335 L208 200 L200 190 L192 200 Z" fill="rgba(244,233,197,0.15)" stroke="rgba(244,233,197,0.25)" stroke-width="0.4"/>
        <circle cx="200" cy="200" r="6" fill="#E8B547" stroke="#8C6612" stroke-width="0.6"/>
      </g>
    </svg>
  `;
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
