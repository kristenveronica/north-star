# AI Cost Audit

*Measured 2026-07-17. Philosophy: spend AI where it creates unique value; use
templates where they produce the same outcome.*

## Method & honest caveats

There is **no usage telemetry table** — the edge function `console.log`s Anthropic
`usage` but never persists it, so no historical token counts exist. These figures
are therefore **modelled**, grounded in two real measurements: (1) the exact
character length of each prompt in `supabase/functions/ai/index.ts`, and (2) the
actual byte size of stored AI outputs in production (a generated project row is
8.4 KB ≈ ~2,400 output tokens). Token ≈ chars ÷ 4. Treat costs as ±30%, good
enough to decide architecture; the first recommendation below makes them exact.

All models are **`claude-sonnet-4-6`**: input **$3**/1M, output **$15**/1M, cache
read **$0.30**/1M, cache write **$3.75**/1M.

## Every AI interaction

| Feature | Action | Trigger | ~In tok | ~Out tok | Cached | ~$/call | Category |
|---|---|---|---|---|---|---|---|
| **Project generation** | `generate-project` | Parent creates/refines a quest | ~8,500 | ~2,400 | SOUL only (~1k of ~8.5k) | **$0.061** | Premium |
| Growth reflection | `growth-reflection` | End-of-term child reflection | ~2,500 | ~1,500 | SOUL only | $0.030 | Premium |
| Core-Word living | `coreword-living` | Values → lived examples | ~1,500 | ~1,000 | SOUL only | $0.020 | Premium |
| Family reflection | `family-reflection` | First-run "unforgettable moment" (dark) | ~1,500 | ~300 | SOUL only | $0.009 | Premium |
| Quickstart extract | `quickstart-extract` | 5-min onboarding (once/family) | ~1,500 | ~1,500 | SOUL only | $0.027 | Standard |
| Mentor turn | `mentor-turn` | Each chat message | ~2,500 | ~400 | SOUL only | $0.014/msg | Standard |
| Suggest focus | `suggest-focus` | "Suggest" during quest setup | ~1,200 | ~500 | SOUL only | $0.011 | Standard |
| Suggest core-word | `suggest-core-word` | Onboarding "suggest" | ~800 | ~300 | SOUL only | $0.007 | Standard |
| Suggest vision | `suggest-vision` | Onboarding "suggest" | ~800 | ~250 | SOUL only | $0.006 | Standard |
| Tidy text | `tidy-text` | Clean up a typed field | ~700 | ~200 | SOUL only | $0.005 | Standard→Template |
| **Printable / worksheet** | `generate-printable` | Parent generates a worksheet | ~450 | ~700 | SOUL only | **$0.012** | **Template** |
| Insights / Growth / Council / suggestions | — (`js/ai/*`) | Various | 0 | 0 | n/a | **$0.000** | Already deterministic |

**The one feature that dominates cost is `generate-project`** — it is 5× the next
most expensive call and runs most often. Everything else is rounding error by
comparison. Optimise there first; ignore the long tail.

## Three categories

**Premium AI — keep, protect, spend here.** Project generation, growth reflection,
Core-Word-living, family reflection. These produce genuinely novel, per-child
educational design that no template can fake. This is the product's moat. Do not
cheapen the model or over-trim the prompt in ways that dull output quality.

**Standard AI — keep, but make cheap.** Quickstart extract, mentor chat,
suggest-*/tidy. Real value, but bounded and repetitive. Cache aggressively; some
(tidy-text, simple suggests) could degrade gracefully to deterministic helpers.

**Template + Variables — should not be an LLM call at all (or rarely).**
Printables: worksheets, flash cards, journals, certificates, trackers, checklists,
planning pages. The *structure* is deterministic; only a thin slice of *content*
sometimes benefits from AI. Today every printable is a full LLM round-trip. This is
the clearest "spending AI where a template would do" — see architecture below.

## Modelled monthly cost per active family

Assumptions (stated so they can be argued): 2 children; ~6 project generations/mo
(incl. refines); ~8 printables/mo; ~2 growth/values reflections/mo; ~20 mentor
messages/mo if chat is used; onboarding amortised.

| Bucket | Calls/mo | $/mo |
|---|---|---|
| Project generation | 6 | $0.37 |
| Printables (current: all LLM) | 8 | $0.10 |
| Growth / values reflections | 2 | $0.05 |
| Mentor chat (if used) | 20 | $0.28 |
| Suggests / onboarding (amortised) | ~5 | $0.04 |
| **Total** | | **≈ $0.84 / active family / month** |

**Headline:** even generously, AI costs **under ~$1–2 per family per month** against
a $29–99 plan. AI spend is **not a margin threat today.** The reason to optimise is
not survival — it's (a) keeping unit economics boring as we scale, and (b) not
paying the model to do work a template does identically. Optimise deliberately, not
anxiously.

## Lowest-cost architecture (preserves the experience)

Ordered by value ÷ effort. Nothing here changes what a family sees.

### 1. Persist usage → make this audit exact (cheapest, do first)
Add an `ai_usage_log` row per call (action, input/output/cache tokens, cost, family,
ms). The function already has `usage` in hand; it's ~10 lines + one table. Converts
every future number here from modelled to measured — the founder's "measure first"
made permanent. *~40% of the value of this whole audit is just turning the lights on.*

### 2. Cache the static prompt bodies (biggest single win)
Only SOUL (~1k tokens) is cached; the ~7,200-token `generate-project` instruction
block is resent uncached every call. Split each heavy prompt into **[static rules
(cache_control) | dynamic family/child data (uncached)]**. Project generation input
drops from ~8,500 to ~1,500 billable tokens after the first call:
**$0.061 → ~$0.041/call (~33% off the flagship)**, zero quality change. Same pattern
for growth-reflection and mentor-turn.

### 3. Printables → template-first (the category fix)
Reclassify printables by how much AI the *content* genuinely needs:

- **Pure template (no AI):** certificates, reflection-journal pages, planning pages,
  checklists, habit/reward trackers, blank flash-card grids, handwriting/number
  lines. Structure + a few variables (child name, date, topic). **$0.012 → $0.**
- **Template + tiny AI fill (cheap, batched):** themed flash-card *word/fact lists*,
  spelling lists, simple copywork lines. One small call can fill many cards; or a
  seeded content bank. Move to Haiku-class or a cached micro-prompt. **~$0.012 → ~$0.002.**
- **Genuine AI (keep):** age-and-interest-tailored worksheets (maths word problems
  woven around this child's passions). Keep the LLM, but cache the rubric.

Net: most printables become **$0**, and the ones that stay AI get cheaper. This is
also the quality unlock — a real flash-card *layout template* beats an LLM
describing one (see the PDF redesign work).

### 4. Deterministic / graceful-degrade for the trivial tail
`tidy-text` and the simplest `suggest-*` can fall back to deterministic helpers (or
a cached one-shot) when the input is trivial, calling the model only when it earns it.

### 5. Right-size `max_tokens`
`generate-project` caps at 8,000 but measures ~2,400 out; the cap doesn't cost money
(you pay for real output) but tightening to ~4,000 bounds worst-case spend and latency.

**What NOT to do:** don't downgrade project generation to a weaker model or gut its
prompt to save fractions of a cent — that prompt *is* the product. Premium stays premium.

## Bottom line

Spend is already low. The disciplined moves are: **turn on measurement (1)**, **cache
static prompt bodies (2)**, and **stop routing template-shaped printables through the
LLM (3)**. Together they cut per-family AI cost roughly in half and, more importantly,
align spend with the philosophy — premium AI only where it creates value a template can't.
