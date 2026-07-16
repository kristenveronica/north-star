// ============================================================================
// Child access codes — memorable, high-entropy, identity-safe.
//
// A child's access code is the credential that opens their portal from any
// device (see supabase/functions/child-portal). It must be:
//   1. HARD TO GUESS — it is a bearer credential for that child's data.
//   2. EASY FOR A CHILD to read, remember and type.
//   3. FREE OF THE CHILD'S IDENTITY — the credential must not encode the name.
//
// The old scheme was `<name-initials><3 digits 2-9>` (e.g. "NOA274"). Anyone who
// knew the child's first name could derive the letters, collapsing the real
// keyspace to 8^3 = 512 (~9 bits) — exhaustible under the login throttle in
// ~90 minutes. This module replaces it with a two-word + two-digit code:
//
//     adjective  ×  noun  ×  100      (e.g. "sunny-otter-47")
//        ~256    ×  ~256  ×  100  ≈  6.5M combinations  (~22.6 bits)
//
// A vivid word-pair ("sunny otter") is *more* memorable than random digits AND
// far higher entropy than a longer number would be, with no identity leak.
//
// STORAGE MODEL
//   code    — normalized, [A-Z0-9] only (e.g. "SUNNYOTTER47"). This is what is
//             stored in children.access_code and what the server matches on
//             (it normalizes typed input the same way, killing wildcard
//             injection). Legacy codes like "NOA274" already satisfy this form.
//   display — the friendly, hyphenated form (e.g. "sunny-otter-47") shown to the
//             parent/child. Stored in children.access_code_display (nullable;
//             legacy rows have none and fall back to showing `code`).
//
// The word lists are deliberately wholesome, concrete and easy to spell. They
// are product-facing copy the founder can review/extend; keep them that way.
// ============================================================================

// Drop accidental duplicates so the keyspace math below stays honest and every
// word is equally likely.
function unique(list) { return Array.from(new Set(list)); }

// Positive, concrete, easy-to-spell adjectives. No negatives, no ambiguity.
const ADJECTIVES = unique([
  "sunny", "brave", "happy", "gentle", "swift", "bright", "cosy", "jolly",
  "shiny", "merry", "kind", "clever", "calm", "bold", "lucky", "cheery",
  "snug", "witty", "spry", "keen", "eager", "plucky", "chirpy", "dandy",
  "nimble", "peppy", "quirky", "rosy", "sparkly", "wavy", "zippy", "breezy",
  "fluffy", "glowy", "dreamy", "fuzzy", "giggly", "bubbly", "twirly", "swirly",
  "mighty", "royal", "noble", "grand", "epic", "super", "mega", "cosmic",
  "golden", "silver", "amber", "coral", "azure", "violet", "scarlet", "jade",
  "minty", "peachy", "honey", "maple", "berry", "cocoa", "vanilla", "cinnamon",
  "tiny", "little", "big", "giant", "jumbo", "mini", "petite", "grand",
  "warm", "toasty", "frosty", "snowy", "misty", "sunny", "starry", "moony",
  "wild", "free", "quick", "fast", "speedy", "turbo", "rapid", "flying",
  "quiet", "gentle", "soft", "smooth", "silky", "velvet", "plush", "downy",
  "curious", "wise", "smart", "sharp", "bright", "clever", "brainy", "canny",
  "loyal", "true", "steady", "trusty", "solid", "sturdy", "rugged", "hardy",
  "funny", "silly", "goofy", "wacky", "zany", "loopy", "kooky", "daffy",
  "proud", "regal", "stately", "lofty", "soaring", "rising", "leaping", "dashing",
  "glad", "sunny", "beaming", "radiant", "gleaming", "shining", "dazzling", "twinkly",
  "spicy", "zesty", "tangy", "fizzy", "sugary", "candy", "jelly", "gummy",
  "dusky", "twilight", "dawn", "morning", "evening", "midday", "noon", "solar",
  "polar", "arctic", "tropic", "desert", "forest", "meadow", "river", "ocean",
  "rocky", "sandy", "leafy", "grassy", "mossy", "ferny", "piney", "willow",
  "cloudy", "stormy", "rainy", "windy", "sunny", "hazy", "foggy", "dewy",
  "ruby", "pearl", "opal", "topaz", "onyx", "coral", "amber", "ivory",
  "royal", "cosmic", "lunar", "astral", "starlit", "moonlit", "sunlit", "skyward",
  "bouncy", "springy", "jumpy", "hoppy", "skippy", "leapy", "wiggly", "jiggly",
  "chubby", "roly", "poly", "pudgy", "stubby", "squat", "dinky", "teeny",
  "lively", "frisky", "peppy", "zesty", "vivid", "vibrant", "lush", "rich",
]);

// Concrete, friendly nouns: animals, nature, sky, sweet everyday objects.
const NOUNS = unique([
  "otter", "tiger", "panda", "koala", "fox", "wolf", "bear", "lynx",
  "robin", "sparrow", "finch", "wren", "heron", "falcon", "eagle", "owl",
  "comet", "planet", "meteor", "nebula", "galaxy", "cosmos", "aurora", "eclipse",
  "river", "brook", "creek", "meadow", "canyon", "valley", "summit", "ridge",
  "maple", "willow", "cedar", "birch", "aspen", "poplar", "spruce", "juniper",
  "acorn", "pebble", "boulder", "geode", "crystal", "quartz", "amber", "flint",
  "dolphin", "whale", "seal", "octopus", "starfish", "seahorse", "turtle", "crab",
  "rabbit", "hare", "hedgehog", "badger", "beaver", "raccoon", "squirrel", "chipmunk",
  "moose", "elk", "deer", "bison", "antelope", "gazelle", "zebra", "giraffe",
  "parrot", "toucan", "puffin", "penguin", "flamingo", "peacock", "swan", "goose",
  "dragon", "phoenix", "griffin", "unicorn", "pegasus", "sphinx", "kraken", "yeti",
  "rocket", "comet", "shuttle", "orbit", "beacon", "lantern", "compass", "anchor",
  "mango", "cherry", "peach", "plum", "melon", "berry", "apricot", "guava",
  "muffin", "cookie", "waffle", "pancake", "cupcake", "biscuit", "pretzel", "bagel",
  "castle", "cottage", "cabin", "lighthouse", "windmill", "bridge", "harbor", "meadow",
  "breeze", "sunbeam", "raindrop", "snowflake", "dewdrop", "puddle", "rainbow", "cloud",
  "clover", "daisy", "poppy", "lily", "tulip", "iris", "violet", "bluebell",
  "kitten", "puppy", "duckling", "gosling", "fawn", "cub", "joey", "piglet",
  "cricket", "beetle", "firefly", "dragonfly", "butterfly", "ladybug", "grasshopper", "bumblebee",
  "island", "lagoon", "reef", "cove", "shore", "delta", "fjord", "atoll",
  "boot", "mitten", "kite", "marble", "yoyo", "puzzle", "domino", "jigsaw",
  "trumpet", "banjo", "fiddle", "drum", "flute", "harp", "bell", "chime",
  "mushroom", "toadstool", "fern", "moss", "vine", "reed", "cattail", "thistle",
  "pony", "foal", "colt", "donkey", "llama", "alpaca", "camel", "yak",
  "walrus", "narwhal", "manatee", "platypus", "pangolin", "armadillo", "wombat", "quokka",
  "sundae", "gumdrop", "lollipop", "jellybean", "marshmallow", "toffee", "caramel", "nougat",
]);

// Prefer the platform RNG (uniform, unpredictable) for a credential; fall back
// to Math.random only if Web Crypto is somehow unavailable.
function randInt(max) {
  const g = (typeof globalThis !== "undefined" && globalThis.crypto) || null;
  if (g && typeof g.getRandomValues === "function") {
    // Rejection sampling to avoid modulo bias.
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    let x;
    do { g.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % max;
  }
  return Math.floor(Math.random() * max);
}

function pick(list) { return list[randInt(list.length)]; }

/**
 * Generate a fresh access code.
 * @returns {{ code: string, display: string }}
 *   code    — normalized storage form, e.g. "SUNNYOTTER47"
 *   display — friendly form,          e.g. "sunny-otter-47"
 */
export function generateAccessCode() {
  const adj = pick(ADJECTIVES);
  const noun = pick(NOUNS);
  const num = String(randInt(100)).padStart(2, "0");   // "00".."99"
  const display = `${adj}-${noun}-${num}`;
  const code = (adj + noun + num).toUpperCase();
  return { code, display };
}

/** Normalize any typed/stored code to the match form (mirrors the server). */
export function normalizeAccessCode(input) {
  return String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Best display string for a child: the stored friendly form when present,
 * otherwise the raw (legacy) code. Never returns empty for a coded child.
 */
export function displayAccessCode(child) {
  if (!child) return "";
  return child.accessCodeDisplay || child.accessCode || "";
}

/** Approximate keyspace / entropy, for docs and tests. */
export function accessCodeEntropyBits() {
  const space = ADJECTIVES.length * NOUNS.length * 100;
  return { space, bits: Math.log2(space) };
}
