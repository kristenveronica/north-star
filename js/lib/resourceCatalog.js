/* ============================================================
   resourceCatalog.js — Static seed catalogs for the Learning
   Resources engine.

   These are the curated, slowly-changing inputs the engine blends
   with live project + child data to produce the five Learning
   Resources sections. Each entry carries the resource metadata the
   platform reasons over (capability domains, format, kind, frequency,
   affiliate availability, cost, age range). The engine merges any
   stored family record (status, ownership) on top of these defaults.
   ============================================================ */

// The five permanent sections of Learning Resources, in display order.
export const RESOURCE_SECTIONS = [
  {
    id: "essentials",
    title: "Learning Space Essentials",
    blurb: "The well-equipped learning environment every family needs — approve what you'd like, dismiss what you already have.",
    icon: "📦",
    permanent: true,
  },
  {
    id: "project",
    title: "Current Project Resources",
    blurb: "Exactly what your children's active projects need right now. Updates automatically as projects begin and finish.",
    icon: "🎯",
    permanent: true,
  },
  {
    id: "personalised",
    title: "Personalised Learning Recommendations",
    blurb: "Chosen for each child from their age, capability domains, passions, learning profile and your preferences. Evolves continuously.",
    icon: "🌱",
    permanent: true,
  },
  {
    id: "character",
    title: "Character, Identity & Wisdom",
    blurb: "Tools that shape identity, values and emotional maturity — so your Mission, Core Word and Motto become part of everyday life, not words on a page.",
    icon: "🧭",
    permanent: true,
  },
  {
    id: "printable",
    title: "Printable Resources",
    blurb: "North Star generates these for you to download and print — no need to buy what we can make.",
    icon: "🖨️",
    permanent: true,
  },
  {
    id: "marketplace",
    title: "Partner Marketplace",
    blurb: "A curated ecosystem of trusted educational suppliers and creators. We earn a small commission that keeps North Star running.",
    icon: "🛍️",
    permanent: true,
  },
];

// 1. Learning Space Essentials — a well-equipped learning environment.
export const ESSENTIALS = [
  { catalogId: "ess-printer", name: "Printer", category: "Equipment", description: "An inkjet or laser printer for worksheets, printables and project work.", estimatedPrice: 120, frequency: "frequent", capabilityDomains: ["literacy", "digital"] },
  { catalogId: "ess-paper", name: "Printer paper", category: "Consumables", description: "A ream of A4/Letter paper for everyday printing.", estimatedPrice: 8, frequency: "frequent", capabilityDomains: ["literacy"] },
  { catalogId: "ess-ink", name: "Ink / toner cartridges", category: "Consumables", description: "Spare cartridges so printing never stalls a project.", estimatedPrice: 35, frequency: "occasional", capabilityDomains: ["literacy"] },
  { catalogId: "ess-laminator", name: "Laminator + sheets", category: "Equipment", description: "Make flash cards, reusable mats and chore charts last.", estimatedPrice: 30, frequency: "occasional", capabilityDomains: ["practical", "literacy"] },
  { catalogId: "ess-scissors", name: "Scissors (child + adult)", category: "Craft", description: "Safety scissors for little hands and a sharp pair for prep.", estimatedPrice: 10, frequency: "frequent", capabilityDomains: ["creativity", "practical"] },
  { catalogId: "ess-glue", name: "Glue sticks + PVA", category: "Craft", description: "The backbone of every making and craft project.", estimatedPrice: 9, frequency: "frequent", capabilityDomains: ["creativity"] },
  { catalogId: "ess-paint", name: "Paint + brushes", category: "Art", description: "Washable paints and a set of brushes for art and design.", estimatedPrice: 22, frequency: "occasional", capabilityDomains: ["creativity", "music"] },
  { catalogId: "ess-pencils", name: "Pencils + coloured pencils", category: "Art", description: "Graphite and colour for writing, sketching and diagrams.", estimatedPrice: 14, frequency: "frequent", capabilityDomains: ["literacy", "creativity"] },
  { catalogId: "ess-markers", name: "Markers", category: "Art", description: "Bold colour for posters, signage and presentations.", estimatedPrice: 12, frequency: "occasional", capabilityDomains: ["creativity", "enterprise"] },
  { catalogId: "ess-whiteboard", name: "Whiteboard + clipboards", category: "Equipment", description: "Brainstorming, working maths and portable surfaces for field work.", estimatedPrice: 28, frequency: "frequent", capabilityDomains: ["maths", "literacy"] },
  { catalogId: "ess-cardboard", name: "Cardboard + construction paper", category: "Craft", description: "Raw materials for prototypes, models and builds.", estimatedPrice: 15, frequency: "frequent", capabilityDomains: ["creativity", "science"] },
  { catalogId: "ess-magnifier", name: "Magnifying glass + measuring tape", category: "Science", description: "Close observation and real measurement for science and nature.", estimatedPrice: 12, frequency: "occasional", capabilityDomains: ["science", "nature", "maths"] },
  { catalogId: "ess-science", name: "Basic science equipment", category: "Science", description: "Beakers, droppers, magnets and a magnifier for hands-on experiments.", estimatedPrice: 30, frequency: "occasional", capabilityDomains: ["science"] },
  { catalogId: "ess-storage", name: "Storage tubs + containers", category: "Organisation", description: "Keep materials, project parts and printables tidy and findable.", estimatedPrice: 25, frequency: "occasional", capabilityDomains: ["practical"] },
  // Adhesives & fasteners
  { catalogId: "ess-blutack", name: "Blu Tack", category: "Adhesives", description: "Reusable putty for displaying work and quick fixes.", estimatedPrice: 4, frequency: "frequent", capabilityDomains: ["creativity", "practical"] },
  { catalogId: "ess-maskingtape", name: "Masking tape", category: "Adhesives", description: "Low-tack tape for crafts, labelling and marking out.", estimatedPrice: 4, frequency: "frequent", capabilityDomains: ["creativity"] },
  { catalogId: "ess-paintertape", name: "Painter's tape", category: "Adhesives", description: "Clean-edge tape for painting and floor activities.", estimatedPrice: 6, frequency: "occasional", capabilityDomains: ["creativity"] },
  { catalogId: "ess-packingtape", name: "Packing tape", category: "Adhesives", description: "Strong tape for builds, models and shipping enterprise orders.", estimatedPrice: 5, frequency: "occasional", capabilityDomains: ["creativity", "enterprise"] },
  { catalogId: "ess-dstape", name: "Double-sided tape", category: "Adhesives", description: "Invisible mounting for posters, cards and presentations.", estimatedPrice: 5, frequency: "occasional", capabilityDomains: ["creativity"] },
  { catalogId: "ess-craftglue", name: "Craft glue", category: "Adhesives", description: "All-purpose PVA-style glue for making.", estimatedPrice: 5, frequency: "frequent", capabilityDomains: ["creativity"] },
  { catalogId: "ess-woodglue", name: "Wood glue", category: "Adhesives", description: "Strong bond for woodworking and sturdy builds.", estimatedPrice: 8, frequency: "occasional", capabilityDomains: ["creativity", "science"], ageBands: ["7-10", "11-14", "15-18"] },
  { catalogId: "ess-hotglue", name: "Hot glue gun + sticks", category: "Adhesives", description: "Fast, strong bonding for builds. Adult supervision for younger children.", estimatedPrice: 14, frequency: "occasional", capabilityDomains: ["creativity", "science"], ageBands: ["7-10", "11-14", "15-18"], requiresApproval: true },
  { catalogId: "ess-stickydots", name: "Sticky dots", category: "Adhesives", description: "Quick adhesive dots for cards, charts and craft.", estimatedPrice: 4, frequency: "occasional", capabilityDomains: ["creativity"] },
  { catalogId: "ess-velcro", name: "Velcro dots", category: "Adhesives", description: "Reusable fastening for interactive boards and learning aids.", estimatedPrice: 6, frequency: "occasional", capabilityDomains: ["creativity", "practical"] },
  { catalogId: "ess-magnets", name: "Magnets", category: "Equipment", description: "For boards, fridge displays and science exploration.", estimatedPrice: 8, frequency: "occasional", capabilityDomains: ["science", "creativity"] },
  // Paper & card
  { catalogId: "ess-cardstock", name: "Cardstock", category: "Consumables", description: "Heavier paper for cards, models, flash cards and printables.", estimatedPrice: 9, frequency: "frequent", capabilityDomains: ["creativity", "literacy"] },
  { catalogId: "ess-folders", name: "Folders + display books", category: "Organisation", description: "Organise worksheets, portfolios and project plans.", estimatedPrice: 10, frequency: "occasional", capabilityDomains: ["literacy", "practical"] },
  // Cutting & precision
  { catalogId: "ess-trimmer", name: "Paper trimmer", category: "Equipment", description: "Straight, safe cuts for cards, printables and laminating.", estimatedPrice: 22, frequency: "occasional", capabilityDomains: ["creativity", "practical"] },
  { catalogId: "ess-holepunch", name: "Hole punch", category: "Equipment", description: "Bind worksheets and build reusable folders.", estimatedPrice: 8, frequency: "occasional", capabilityDomains: ["practical"] },
  { catalogId: "ess-craftknife", name: "Craft knife (adult use)", category: "Tools", description: "Precision cutting for detailed builds. Adult use only.", estimatedPrice: 7, frequency: "occasional", capabilityDomains: ["creativity"], ageBands: ["15-18"], requiresApproval: true },
];

// Age-appropriate tools. Surfaced inside Learning Space Essentials, gated by the
// child's age band and (where risky) parent approval. Tools grow with capability:
// younger children get glue/cardboard construction; older children earn a real
// toolbox and progress to woodworking, repairs and power tools (parent approved).
export const TOOLS = [
  { catalogId: "tool-toolbox", name: "First toolbox (starter)", category: "Tools", description: "A child's first real toolbox — the foundation of practical capability.", estimatedPrice: 40, frequency: "frequent", capabilityDomains: ["practical", "creativity"], ageBands: ["11-14", "15-18"], unlocks: ["practical"] },
  { catalogId: "tool-hammer", name: "Hammer", category: "Tools", description: "For real building and repair projects.", estimatedPrice: 15, frequency: "occasional", capabilityDomains: ["practical"], ageBands: ["7-10", "11-14", "15-18"], requiresApproval: true },
  { catalogId: "tool-tape", name: "Tape measure", category: "Tools", description: "Measure, plan and build accurately — maths made real.", estimatedPrice: 9, frequency: "frequent", capabilityDomains: ["practical", "maths"], ageBands: ["7-10", "11-14", "15-18"] },
  { catalogId: "tool-screwdrivers", name: "Screwdriver set", category: "Tools", description: "Assemble, repair and take things apart to learn how they work.", estimatedPrice: 18, frequency: "occasional", capabilityDomains: ["practical", "science"], ageBands: ["7-10", "11-14", "15-18"], requiresApproval: true },
  { catalogId: "tool-pliers", name: "Pliers", category: "Tools", description: "Grip, bend and fix for repairs and making.", estimatedPrice: 12, frequency: "occasional", capabilityDomains: ["practical"], ageBands: ["11-14", "15-18"], requiresApproval: true },
  { catalogId: "tool-handsaw", name: "Handsaw", category: "Tools", description: "For real woodworking — when age and supervision are appropriate.", estimatedPrice: 20, frequency: "occasional", capabilityDomains: ["practical", "creativity"], ageBands: ["11-14", "15-18"], requiresApproval: true },
  { catalogId: "tool-drill", name: "Cordless drill", category: "Tools", description: "A serious capability step — parent approved, with supervision.", estimatedPrice: 70, frequency: "occasional", capabilityDomains: ["practical", "creativity"], ageBands: ["11-14", "15-18"], requiresApproval: true, unlocks: ["practical"] },
  { catalogId: "tool-repairkit", name: "Repair kit", category: "Tools", description: "Glue, fasteners and basics for fixing what breaks.", estimatedPrice: 25, frequency: "occasional", capabilityDomains: ["practical", "nature"], ageBands: ["11-14", "15-18"] },
  { catalogId: "tool-woodworking", name: "Woodworking equipment", category: "Tools", description: "Clamps, sandpaper, safety glasses and timber for real builds.", estimatedPrice: 45, frequency: "occasional", capabilityDomains: ["creativity", "practical"], ageBands: ["11-14", "15-18"], requiresApproval: true, unlocks: ["creativity"] },
  { catalogId: "tool-garden", name: "Garden tools (child-sized)", category: "Tools", description: "Trowel, gloves and watering can for growing food and stewardship.", estimatedPrice: 22, frequency: "occasional", capabilityDomains: ["nature", "practical"], ageBands: ["3-6", "7-10", "11-14"], unlocks: ["nature"] },
];

// 4. Printable Resources — North Star generates these to download/print.
// `ageBands` gate relevance (3-6, 7-10, 11-14, 15-18).
export const PRINTABLES = [
  { catalogId: "prn-flashcards", name: "Custom flash cards", description: "Generate flash cards for any topic the child is learning.", capabilityDomains: ["literacy", "maths"], ageBands: ["3-6", "7-10"] },
  { catalogId: "prn-reflection", name: "Reflection journal pages", description: "Age-appropriate reflection prompts to print and fill in.", capabilityDomains: ["literacy", "relationships"], ageBands: ["7-10", "11-14", "15-18"] },
  { catalogId: "prn-readinglog", name: "Reading log", description: "Track books read, minutes and favourite moments.", capabilityDomains: ["literacy"], ageBands: ["7-10", "11-14"] },
  { catalogId: "prn-mathsgames", name: "Maths games + worksheets", description: "Printable number games and practice tuned to the child's level.", capabilityDomains: ["maths"], ageBands: ["3-6", "7-10", "11-14"] },
  { catalogId: "prn-scavenger", name: "Nature scavenger hunt", description: "A printable hunt for the child's local environment.", capabilityDomains: ["nature", "science"], ageBands: ["3-6", "7-10"] },
  { catalogId: "prn-interview", name: "Interview templates", description: "Question sheets for interviewing experts, elders or mentors.", capabilityDomains: ["literacy", "leadership", "enterprise"], ageBands: ["11-14", "15-18"] },
  { catalogId: "prn-budget", name: "Budget sheets", description: "Track income, costs and profit for an enterprise project.", capabilityDomains: ["enterprise", "maths"], ageBands: ["11-14", "15-18"] },
  { catalogId: "prn-goals", name: "Goal planner", description: "Set goals, break them into steps and track progress.", capabilityDomains: ["leadership", "relationships"], ageBands: ["7-10", "11-14", "15-18"] },
  { catalogId: "prn-habit", name: "Habit + chore tracker", description: "Build routines and responsibility with a printable tracker.", capabilityDomains: ["practical", "health"], ageBands: ["3-6", "7-10", "11-14"] },
  { catalogId: "prn-sticker", name: "Sticker / reward chart", description: "Celebrate momentum for younger children.", capabilityDomains: ["practical"], ageBands: ["3-6"] },
  { catalogId: "prn-montessori", name: "Montessori cards", description: "Three-part cards and nomenclature sets for guided discovery.", capabilityDomains: ["literacy", "science", "nature"], ageBands: ["3-6", "7-10"] },
  { catalogId: "prn-presentation", name: "Presentation + project planning templates", description: "Plan, structure and present a project professionally.", capabilityDomains: ["literacy", "digital", "enterprise"], ageBands: ["11-14", "15-18"] },
];

/* Character, Identity & Wisdom — tools that shape values, emotional maturity and
   character. Less academic, more identity-forming: they spark meaningful
   conversations and reflection around values, choices and relationships, and
   help the family's Mission / Core Word / Motto become lived rather than written.
   `format: "printable"` items North Star can generate; the rest are physical
   decks/books/games. The engine personalises by age, domains, values and faith. */
export const CHARACTER = [
  { catalogId: "char-sharetree", name: "Share Tree cards", category: "Values cards", description: "Beautifully made cards that spark values and character conversations.", estimatedPrice: 30, frequency: "frequent", capabilityDomains: ["relationships", "leadership"], format: "physical" },
  { catalogId: "char-values", name: "Values card deck", category: "Values cards", description: "Sort, discuss and choose the values your family lives by.", estimatedPrice: 22, frequency: "frequent", capabilityDomains: ["relationships", "leadership"], format: "physical" },
  { catalogId: "char-conversation", name: "Conversation cards", category: "Conversation", description: "Question prompts for deep, connected family conversations.", estimatedPrice: 20, frequency: "frequent", capabilityDomains: ["relationships", "literacy"], format: "physical" },
  { catalogId: "char-eigame", name: "Emotional intelligence game", category: "Games", description: "Play your way into naming and navigating emotions.", estimatedPrice: 28, frequency: "occasional", capabilityDomains: ["relationships", "health"], format: "physical" },
  { catalogId: "char-discussiongame", name: "Family discussion game", category: "Games", description: "A game that gets everyone talking honestly and kindly.", estimatedPrice: 25, frequency: "occasional", capabilityDomains: ["relationships"], format: "physical" },
  { catalogId: "char-charbooks", name: "Character-building books", category: "Books", description: "Stories and guides that model courage, kindness and integrity.", estimatedPrice: 18, frequency: "occasional", capabilityDomains: ["literacy", "relationships"], format: "physical" },
  { catalogId: "char-growthmindset", name: "Growth mindset resources", category: "Mindset", description: "Cards and activities that build resilience and a love of challenge.", estimatedPrice: 20, frequency: "occasional", capabilityDomains: ["relationships", "health"], format: "physical" },
  { catalogId: "char-leadership", name: "Leadership resources", category: "Leadership", description: "Activities and frameworks that grow initiative and responsibility.", estimatedPrice: 22, frequency: "occasional", capabilityDomains: ["leadership"], format: "physical", ageBands: ["11-14", "15-18"] },
  // Printable — North Star generates these.
  { catalogId: "char-gratitude", name: "Gratitude journal", category: "Journals", description: "A daily gratitude practice that reshapes how a child sees the world.", capabilityDomains: ["relationships", "health"], format: "printable", frequency: "daily" },
  { catalogId: "char-reflection", name: "Reflection journal", category: "Journals", description: "Guided reflection on choices, growth and relationships.", capabilityDomains: ["literacy", "relationships"], format: "printable", frequency: "frequent" },
  { catalogId: "char-goals", name: "Goal-setting journal", category: "Journals", description: "Set, pursue and review meaningful goals.", capabilityDomains: ["leadership"], format: "printable", frequency: "frequent", ageBands: ["7-10", "11-14", "15-18"] },
  { catalogId: "char-strengths", name: "Strengths discovery activities", category: "Identity", description: "Help each child discover and name their God-given strengths.", capabilityDomains: ["relationships", "leadership"], format: "printable", frequency: "occasional" },
  { catalogId: "char-decisions", name: "Decision-making frameworks", category: "Wisdom", description: "Simple frameworks for making wise, values-aligned choices.", capabilityDomains: ["leadership", "maths"], format: "printable", frequency: "occasional", ageBands: ["11-14", "15-18"] },
  { catalogId: "char-conflict", name: "Conflict resolution resources", category: "Relationships", description: "Tools for repairing and strengthening relationships well.", capabilityDomains: ["relationships"], format: "printable", frequency: "occasional" },
  { catalogId: "char-familymeeting", name: "Family meeting kit", category: "Family", description: "Agendas, roles and rituals for regular family meetings.", capabilityDomains: ["leadership", "relationships"], format: "printable", frequency: "frequent" },
  { catalogId: "char-kindness", name: "Kindness challenges", category: "Service", description: "Weekly acts-of-kindness challenges that build generosity.", capabilityDomains: ["relationships", "leadership"], format: "printable", frequency: "frequent" },
  { catalogId: "char-service", name: "Service & contribution activities", category: "Service", description: "Ideas for serving others and contributing to community.", capabilityDomains: ["leadership", "relationships"], format: "printable", frequency: "occasional" },
];

/* 5. Partner Marketplace — North Star's intelligent procurement layer.
   Suppliers carry which countries they serve and the value signals the engine
   reasons over (pricing, quality, shipping, reputation). `countries: ["*"]`
   means broadly international. The list is deliberately flexible and expands
   over time, including local educational businesses per country. */
export const SUPPLIERS = [
  { id: "amazon", name: "Amazon", category: "General", description: "Books, equipment and consumables — broad range, fast shipping.", domains: [], countries: ["AU", "CA", "US", "UK"], attributes: ["wide range", "fast shipping", "strong reputation"], affiliate: true },
  { id: "temu", name: "Temu", category: "Value", description: "Very low-cost craft, storage and basics — slower shipping, variable quality.", domains: [], countries: ["*"], attributes: ["lowest price", "slower shipping"], affiliate: true },
  { id: "officeworks", name: "Officeworks", category: "Office", description: "Stationery, printing, paper and storage.", domains: ["literacy", "practical"], countries: ["AU"], attributes: ["competitive pricing", "reliable"], affiliate: false },
  { id: "kmart", name: "Kmart", category: "Value", description: "Affordable craft, storage and basics.", domains: ["creativity", "practical"], countries: ["AU", "NZ"], attributes: ["low price", "in-store pickup"], affiliate: false },
  { id: "spotlight", name: "Spotlight", category: "Craft", description: "Craft, fabric, art and making supplies.", domains: ["creativity", "music"], countries: ["AU", "NZ"], attributes: ["wide craft range"], affiliate: false },
  { id: "bunnings", name: "Bunnings", category: "Hardware", description: "Tools, timber, garden and hardware for real builds.", domains: ["practical", "nature"], countries: ["AU", "NZ"], attributes: ["competitive pricing", "knowledgeable staff"], affiliate: false },
  { id: "staples", name: "Staples", category: "Office", description: "Office and school supplies, printing and storage.", domains: ["literacy", "practical"], countries: ["US", "CA"], attributes: ["competitive pricing"], affiliate: true },
  { id: "walmart", name: "Walmart", category: "Value", description: "Low-cost supplies, equipment and consumables.", domains: [], countries: ["US", "CA"], attributes: ["low price", "wide range"], affiliate: true },
  { id: "michaels", name: "Michaels", category: "Craft", description: "Art, craft and making supplies.", domains: ["creativity"], countries: ["US", "CA"], attributes: ["wide craft range", "frequent sales"], affiliate: true },
  { id: "homedepot", name: "Home Depot", category: "Hardware", description: "Tools, timber and hardware.", domains: ["practical"], countries: ["US", "CA"], attributes: ["competitive pricing"], affiliate: true },
  { id: "hobbycraft", name: "Hobbycraft", category: "Craft", description: "Art, craft and making supplies.", domains: ["creativity"], countries: ["UK"], attributes: ["wide craft range"], affiliate: false },
  { id: "theworks", name: "The Works", category: "Value", description: "Low-cost books, craft and stationery.", domains: ["literacy", "creativity"], countries: ["UK"], attributes: ["low price"], affiliate: false },
  { id: "warehouse", name: "The Warehouse", category: "Value", description: "Affordable supplies, craft and basics.", domains: [], countries: ["NZ"], attributes: ["low price"], affiliate: false },
  { id: "montessori", name: "Montessori suppliers", category: "Method", description: "Practical-life, sensorial and language materials.", domains: ["practical", "literacy", "maths"], countries: ["*"], attributes: ["specialist quality"], affiliate: false },
  { id: "waldorf", name: "Waldorf / Steiner suppliers", category: "Method", description: "Natural materials, handwork and seasonal craft.", domains: ["creativity", "nature"], countries: ["*"], attributes: ["natural materials"], affiliate: false },
  { id: "publishers", name: "Educational publishers", category: "Curriculum", description: "Textbooks, workbooks and readers for traditional pathways.", domains: ["literacy", "maths", "science"], countries: ["*"], attributes: ["curriculum-aligned"], affiliate: false },
  { id: "sciencekits", name: "Science kit suppliers", category: "Science", description: "Experiment kits, microscopes and STEM sets.", domains: ["science"], countries: ["*"], attributes: ["specialist"], affiliate: true },
  { id: "books", name: "Book retailers", category: "Books", description: "New and used books, often cheaper than big-box.", domains: ["literacy"], countries: ["*"], attributes: ["used options", "free shipping options"], affiliate: true },
  { id: "games", name: "Puzzle & game suppliers", category: "Games", description: "Board games, puzzles and card games that build capability.", domains: ["maths", "enterprise", "relationships"], countries: ["*"], attributes: ["educational"], affiliate: true },
  { id: "music", name: "Music suppliers", category: "Arts", description: "Instruments, sheet music and practice tools.", domains: ["music"], countries: ["*"], attributes: ["specialist"], affiliate: false },
  { id: "technology", name: "Technology suppliers", category: "Digital", description: "Coding kits, cameras, microphones and creative tech.", domains: ["digital"], countries: ["*"], attributes: ["specialist"], affiliate: true },
  { id: "language", name: "Language learning providers", category: "Language", description: "Apps, tutors and immersion resources.", domains: ["literacy", "travel"], countries: ["*"], attributes: ["subscription"], affiliate: true },
  { id: "sport", name: "Sport & movement suppliers", category: "Physical", description: "Equipment for sport, movement and outdoor adventure.", domains: ["sport", "health"], countries: ["*"], attributes: ["specialist"], affiliate: false },
];
// Backward-compatible alias (was PARTNERS).
export const PARTNERS = SUPPLIERS;

/* Map a free-text country name (from family.location.country) to a code we can
   match suppliers on. Expand as North Star grows internationally. */
export const COUNTRY_CODES = {
  australia: "AU", "australian": "AU",
  canada: "CA", "canadian": "CA",
  "united states": "US", "united states of america": "US", usa: "US", "u.s.a.": "US", america: "US",
  "united kingdom": "UK", uk: "UK", "u.k.": "UK", england: "UK", scotland: "UK", wales: "UK", britain: "UK", "great britain": "UK",
  "new zealand": "NZ", nz: "NZ",
};
export function countryCodeOf(countryName) {
  return COUNTRY_CODES[String(countryName || "").trim().toLowerCase()] || null;
}
export const COUNTRY_LABELS = { AU: "Australia", CA: "Canada", US: "United States", UK: "United Kingdom", NZ: "New Zealand" };

/* Reward catalogue. North Star always encourages a HEALTHY BALANCE of reward
   types — never only purchases. Purchase rewards can `unlock` capability domains
   (e.g. a toolbox unlocks practical/creativity), which the AI uses to generate
   richer projects afterwards. Contribution rewards reinforce the family's values
   (service, generosity, intrinsic motivation). */
export const REWARD_TYPES = ["experience", "purchase", "contribution"];
export const REWARDS = [
  // --- Purchase rewards (many unlock new capability) ---
  { id: "rw-toolbox", name: "First toolbox", type: "purchase", description: "Their own real tools — the start of practical mastery.", domains: ["practical", "creativity"], unlocks: ["practical", "creativity"], estimatedCost: 40 },
  { id: "rw-microscope", name: "Microscope", type: "purchase", description: "Open up the invisible world.", domains: ["science"], unlocks: ["science"], estimatedCost: 60 },
  { id: "rw-binoculars", name: "Binoculars", type: "purchase", description: "For birding, nature study and adventure.", domains: ["nature", "science"], unlocks: ["nature"], estimatedCost: 35 },
  { id: "rw-camera", name: "Camera", type: "purchase", description: "Capture, create and tell visual stories.", domains: ["digital", "creativity"], unlocks: ["digital", "creativity"], estimatedCost: 90 },
  { id: "rw-sciencekit", name: "Science kit", type: "purchase", description: "Hands-on experiments and discovery.", domains: ["science"], unlocks: ["science"], estimatedCost: 45 },
  { id: "rw-instrument", name: "Musical instrument", type: "purchase", description: "Begin a lifelong musical pathway.", domains: ["music"], unlocks: ["music"], estimatedCost: 120 },
  { id: "rw-bizkit", name: "Business starter kit", type: "purchase", description: "Cards, signage and supplies to launch a real venture.", domains: ["enterprise"], unlocks: ["enterprise"], estimatedCost: 50 },
  { id: "rw-gardentools", name: "Gardening tools", type: "purchase", description: "Grow food and care for living things.", domains: ["nature", "practical"], unlocks: ["nature"], estimatedCost: 30 },
  { id: "rw-sewing", name: "Sewing machine", type: "purchase", description: "Design and make real things to wear and use.", domains: ["creativity", "practical"], unlocks: ["creativity"], estimatedCost: 130 },
  { id: "rw-3dprinter", name: "3D printer", type: "purchase", description: "Design and manufacture their own creations.", domains: ["digital", "creativity"], unlocks: ["digital"], estimatedCost: 250 },
  { id: "rw-robot", name: "Coding robot", type: "purchase", description: "Bring code to life.", domains: ["digital"], unlocks: ["digital"], estimatedCost: 80 },
  { id: "rw-books", name: "Books / learning subscription", type: "purchase", description: "Fuel a current passion.", domains: ["literacy"], unlocks: [], estimatedCost: 25 },
  // --- Experience rewards ---
  { id: "rx-camping", name: "Camping trip", type: "experience", description: "Adventure, self-reliance and family time outdoors.", domains: ["nature", "sport"], unlocks: [] },
  { id: "rx-museum", name: "Museum visit", type: "experience", description: "Real-world discovery tied to their interests.", domains: ["science", "creativity"], unlocks: [] },
  { id: "rx-horse", name: "Horse riding", type: "experience", description: "Confidence, care and physical capability.", domains: ["sport", "nature"], unlocks: [] },
  { id: "rx-climbing", name: "Rock climbing", type: "experience", description: "Courage, problem-solving and strength.", domains: ["sport", "health"], unlocks: [] },
  { id: "rx-concert", name: "Concert or performance", type: "experience", description: "Experience live music and the arts.", domains: ["music"], unlocks: [] },
  { id: "rx-workshop", name: "Workshop or class", type: "experience", description: "Hands-on learning with a real practitioner.", domains: [], unlocks: [] },
  { id: "rx-kayak", name: "Kayaking", type: "experience", description: "Adventure on the water.", domains: ["sport", "nature"], unlocks: [] },
  { id: "rx-cooking", name: "Cooking class", type: "experience", description: "Real practical-life skills, deliciously.", domains: ["practical", "health"], unlocks: [] },
  { id: "rx-biztour", name: "Behind-the-scenes business tour", type: "experience", description: "See how a real enterprise works.", domains: ["enterprise"], unlocks: [] },
  { id: "rx-expedition", name: "Nature expedition", type: "experience", description: "A bigger adventure into the natural world.", domains: ["nature", "science"], unlocks: [] },
  // --- Contribution rewards (child chooses service over payment) ---
  { id: "rc-neighbour", name: "Help a neighbour (no charge)", type: "contribution", description: "Give time and skill freely.", domains: ["leadership", "relationships"], unlocks: [], faith: false },
  { id: "rc-cookforsick", name: "Cook for someone who is unwell", type: "contribution", description: "Care expressed through practical skill.", domains: ["practical", "relationships"], unlocks: [] },
  { id: "rc-park", name: "Clean up a local park", type: "contribution", description: "Stewardship of shared places.", domains: ["nature", "leadership"], unlocks: [] },
  { id: "rc-church", name: "Help at church", type: "contribution", description: "Serve within the faith community.", domains: ["leadership", "faith"], unlocks: [], faith: true },
  { id: "rc-grandparents", name: "Support grandparents", type: "contribution", description: "Honour and help across generations.", domains: ["relationships"], unlocks: [] },
  { id: "rc-teach", name: "Teach a younger sibling", type: "contribution", description: "Cement capability by passing it on.", domains: ["leadership", "literacy"], unlocks: [] },
  { id: "rc-volunteer", name: "Volunteer", type: "contribution", description: "Give time to a cause that matters.", domains: ["leadership", "relationships"], unlocks: [] },
  { id: "rc-garden", name: "Community gardening", type: "contribution", description: "Grow food for others.", domains: ["nature", "leadership"], unlocks: [] },
  { id: "rc-kindness", name: "Act of anonymous kindness", type: "contribution", description: "Generosity with no expectation of return.", domains: ["relationships"], unlocks: [] },
];

// Resource metadata vocabulary (kept here so UI + engine agree).
export const RESOURCE_KINDS = ["diy", "ready"];          // make it / buy it ready-made
export const RESOURCE_FORMATS = ["physical", "printable"]; // physical item / printable
export const RESOURCE_FREQUENCY = ["once", "occasional", "frequent", "daily"];
// The lifecycle status of a resource for a family.
// suggested=🛒 recommended · approved=📦 in cart · owned=✓ already own ·
// borrow=🤝 borrow · save=💰 save for later · self-source=source it themselves ·
// dismissed=❌ not interested.
export const RESOURCE_STATUSES = ["suggested", "approved", "owned", "borrow", "save", "self-source", "dismissed"];

// Map an age (years) to a printable age band.
export function ageBand(age) {
  if (age == null) return null;
  if (age <= 6) return "3-6";
  if (age <= 10) return "7-10";
  if (age <= 14) return "11-14";
  return "15-18";
}
