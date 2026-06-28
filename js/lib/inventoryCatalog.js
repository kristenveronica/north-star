/* ============================================================
   inventoryCatalog.js — The Family Inventory ("Learning Toolkit").

   North Star's living understanding of what the family already owns and
   has access to. It is built progressively (quick-add chips, "I already
   have this" buttons in Learning Resources, manual additions) and feeds
   project generation, resource recommendations, rewards and printables.

   Each category lists COMMON items as quick-add chips; families add their
   own freely. A few categories also capture light structured context
   (music lessons, sports clubs, library/Kindle/Audible) stored on
   family.inventoryContext.
   ============================================================ */

export const INVENTORY_CATEGORIES = [
  {
    id: "learning-equipment", title: "Learning Equipment", icon: "🖨️",
    blurb: "The hardware of a well-equipped learning space.",
    items: ["Printer", "Laminator", "Paper cutter", "Whiteboard", "Corkboard", "Magnetic board", "Projector", "Microscope", "Telescope", "Magnifying glasses", "Globe", "Maps", "Filing cabinet", "Shelving", "Learning table", "Standing desk", "Easel", "Storage systems"],
  },
  {
    id: "art", title: "Art & Creative Supplies", icon: "🎨",
    blurb: "Everything for making and creating.",
    items: ["Paints", "Pencils", "Pencil crayons", "Markers", "Clay", "Play-Doh", "PVA glue", "Glue sticks", "Hot glue gun", "Masking tape", "Blu Tack", "Cardboard", "Construction paper", "Coloured paper", "Fabric", "Wool", "Sewing supplies", "Knitting supplies", "Jewellery making kit", "Beads", "Canvases"],
  },
  {
    id: "music", title: "Musical Instruments", icon: "🎵",
    blurb: "What's available lets North Star generate music projects naturally.",
    items: ["Piano", "Keyboard", "Guitar", "Ukulele", "Violin", "Cello", "Recorder", "Flute", "Trumpet", "Saxophone", "Drums", "Percussion", "Microphone", "Recording equipment"],
    context: "music",
  },
  {
    id: "sports", title: "Sports & Movement Equipment", icon: "⚽",
    blurb: "Equipment available dramatically improves physical-capability projects.",
    items: ["Mountain bike", "BMX", "Scooter", "Skateboard", "Roller skates", "Inline skates", "Skis", "Snowboard", "Hockey gear", "Basketball hoop", "Footballs", "Soccer gear", "Tennis racquet", "Pickleball gear", "Golf clubs", "Gymnastics equipment", "Climbing gear", "Yoga mat", "Resistance bands", "Weights", "Swimming gear"],
    context: "sports",
  },
  {
    id: "outdoor", title: "Outdoor Adventure Equipment", icon: "🏕️",
    blurb: "Opens up expeditions, nature study and self-reliance.",
    items: ["Tent", "Sleeping bags", "Hiking packs", "Camping stove", "Fishing rods", "Paddle board", "Kayak", "Canoe", "Binoculars", "Bird guide", "Compass", "First aid kit", "Gardening tools"],
  },
  {
    id: "building", title: "Building & Maker Equipment", icon: "🔧",
    blurb: "These open completely different project opportunities.",
    items: ["LEGO", "LEGO Technic", "Magna-Tiles", "Wooden blocks", "Hammer", "Nails", "Screwdrivers", "Cordless drill", "Workbench", "Sewing machine", "Cricut", "Laser cutter", "3D printer", "Robotics kit", "Arduino", "Raspberry Pi", "Electronics kit"],
  },
  {
    id: "science", title: "Science Equipment", icon: "🔬",
    blurb: "Real tools for real experiments.",
    items: ["Microscope", "Telescope", "Chemistry kit", "Magnets", "Weather station", "Measuring tools", "Scales", "Snap Circuits", "Electrical kit", "STEM experiment kit"],
  },
  {
    id: "technology", title: "Technology", icon: "💻",
    blurb: "What's available shapes digital-capability projects.",
    items: ["Desktop computer", "Laptop", "Tablet", "iPad", "Phone", "Camera", "GoPro", "Drone", "Headphones", "Microphone", "Drawing tablet", "VR headset", "Coding robot", "Programmable device"],
  },
  {
    id: "games", title: "Board Games & Educational Games", icon: "🎲",
    blurb: "Games you own can be woven straight into projects.",
    items: ["Cashflow", "Catan", "Chess", "Ticket to Ride", "Scrabble", "Bananagrams", "Monopoly", "Sequence", "Cooperative games", "Escape room games", "Logic games"],
  },
  {
    id: "books", title: "Books & Reading Resources", icon: "📚",
    blurb: "Projects make use of books you already own wherever possible.",
    items: ["Home library", "Encyclopedias", "Atlas", "Dictionary", "Picture books", "Chapter books", "Reference books"],
    context: "books",
  },
  {
    id: "character", title: "Character & Family Resources", icon: "🧭",
    blurb: "Tools that shape identity, values and emotional maturity.",
    items: ["Share Tree cards", "Values card deck", "Conversation cards", "Gratitude journals", "Emotional intelligence game", "Family meeting resources", "Devotionals", "Affirmation cards", "Character-building books"],
  },
  {
    id: "pets", title: "Pets & Animals", icon: "🐾",
    blurb: "Natural openings for responsibility, biology, leadership and service.",
    items: ["Dog", "Cat", "Chickens", "Horse", "Fish", "Reptile", "Farm animals", "Guinea pig", "Rabbit", "Birds"],
  },
  {
    id: "garden", title: "Garden & Food Growing", icon: "🌱",
    blurb: "Gardening, sustainability, biology and cooking projects.",
    items: ["Vegetable garden", "Fruit trees", "Compost", "Worm farm", "Greenhouse", "Chickens", "Beehives", "Herb garden", "Raised beds"],
  },
  {
    id: "community", title: "Community Assets", icon: "🏛️",
    blurb: "What exists outside the home — projects use nearby resources too.",
    items: ["Library membership", "Museum membership", "Zoo membership", "Aquarium membership", "Makerspace", "Climbing gym", "Ski pass", "Swimming pool", "Community garden", "Music school", "Art classes", "Local sports club"],
  },
];

// Light structured context for a few categories (stored on family.inventoryContext).
export const INVENTORY_CONTEXT = {
  music: {
    title: "Music context",
    fields: [
      { key: "lessons", label: "Currently taking lessons?", type: "select", options: ["", "Yes", "No"] },
      { key: "teaching", label: "Teacher or self-taught?", type: "select", options: ["", "Teacher", "Self-taught", "Online app", "Mix"] },
      { key: "app", label: "Which app (if any)?", type: "text", placeholder: "e.g. Simply Piano, Yousician" },
      { key: "genres", label: "Favourite genres", type: "text", placeholder: "e.g. classical, pop, film scores" },
      { key: "artists", label: "Favourite artists", type: "text", placeholder: "e.g. Taylor Swift, Ludovico Einaudi" },
    ],
  },
  sports: {
    title: "Sport context",
    fields: [
      { key: "played", label: "Sports currently played", type: "text", placeholder: "e.g. soccer, skiing, swimming" },
      { key: "clubs", label: "Clubs attended", type: "text", placeholder: "e.g. local soccer club, swim squad" },
      { key: "coaching", label: "Coaching / competitions?", type: "text", placeholder: "e.g. weekly coaching, district comps" },
      { key: "favourites", label: "Favourite physical activities", type: "text", placeholder: "e.g. mountain biking, climbing" },
    ],
  },
  books: {
    title: "Reading context",
    fields: [
      { key: "library", label: "Library membership?", type: "select", options: ["", "Yes", "No"] },
      { key: "kindle", label: "Kindle / e-reader?", type: "select", options: ["", "Yes", "No"] },
      { key: "audible", label: "Audible / audiobooks?", type: "select", options: ["", "Yes", "No"] },
      { key: "authors", label: "Favourite books & authors", type: "text", placeholder: "e.g. Roald Dahl, Percy Jackson series" },
    ],
  },
};

// Map an inventory category id → the capability domains it tends to unlock
// (used to hint project generation and surface relevance).
export const INVENTORY_DOMAIN_HINTS = {
  "learning-equipment": ["literacy", "science"],
  art: ["creativity"],
  music: ["music"],
  sports: ["sport", "health"],
  outdoor: ["nature", "sport"],
  building: ["creativity", "practical", "digital"],
  science: ["science"],
  technology: ["digital"],
  games: ["maths", "enterprise", "relationships"],
  books: ["literacy"],
  character: ["relationships", "leadership"],
  pets: ["nature", "relationships"],
  garden: ["nature", "practical"],
  community: ["leadership", "relationships"],
};
