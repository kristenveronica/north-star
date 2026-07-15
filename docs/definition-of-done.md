# Definition of Done

**The quality standard for North Star.** *When can we genuinely say a feature is finished?*

Date: 2026-07-15 · The final gate before anything reaches a family. It exists to stop us shipping features that *technically work* but *fail the North Star experience*. "It functions" is the floor, not the bar. A feature is done when a family is genuinely better off for having it — and not before.

This standard sits on top of the [Engineering Principles](engineering-principles.md), the [Living Family Model Constitution](living-family-model.md), and the [Observation Framework](observation-framework.md). Where they say *how to build* and *how to think*, this says *when to stop*.

---

## Engineering

The mechanics must be sound. None of this is sufficient on its own — it's the price of entry.

- **Code reviewed** — read by someone (or something) other than the author; nothing merges unseen.
- **Tests passing** — including the relevant regression harness; a green suite with the change in it.
- **No known regressions** — existing workflows for every role (architect, contributor, observer, child) still work.
- **Logging where appropriate** — enough to diagnose a failure in production without guessing; security-relevant events recorded.
- **Performance acceptable** — no perceptible regression; slow paths are intentional, not accidental.
- **Security reviewed** — authorization enforced server-side, not just in the UI; no new way to reach another family's data. (The cardinal sin — silently losing or exposing family data — is specifically checked.)
- **Documentation updated** — the change is reflected wherever the next engineer will look.

## Product

- **Fulfils its stated purpose** — the one-sentence purpose from the feature registry is actually delivered, not approximated.
- **Aligns with the Constitution** — it serves a family's flourishing, not just an internal goal.
- **Aligns with the Engineering Principles** — it passes the pre-merge question (simpler, wiser, more helpful).
- **Strengthens rather than complicates** — the family experience is *less* cluttered after this ships, not more.
- **Reduces work rather than creating it** — it does not hand parents a new chore, setting, or thing to maintain.

## User Experience

- **Intuitive** — a person understands what to do without being taught.
- **Obvious first-time experience** — the very first encounter makes sense with no prior context.
- **Thoughtful empty states** — before there's any data, the screen still guides and reassures rather than looking broken.
- **Helpful error states** — when something goes wrong, the message says what happened and what to do, never just "error."
- **Intentional loading states** — waiting feels considered, not like a stall; the family is never left wondering if it's frozen.
- **Mobile considered** — it works and feels right on a phone, where much of family life actually happens.
- **Accessibility considered** — keyboard, contrast, and screen-reader basics are not an afterthought.

## Living Family Model

Where appropriate, every feature consciously asks:

- **Does this capture meaningful context?** — is real understanding of the family being gathered?
- **Does this strengthen the Living Family Model?** — does the moat get deeper because this shipped?
- **Does it help North Star understand the family better?**
- **Does it create opportunities for future observations?** — does it plant signal the model can later reflect back?

Not every feature answers *yes* — a bug fix needn't. But every feature **consciously considers** these questions rather than ignoring them. A feature that could have fed the LFM and didn't is a quiet missed compounding.

## Emotional Experience

Equally important, and the part most software forgets. Every feature should leave a **parent** feeling *"I can do this,"* and a **child** feeling *"this was made for me."*

- **Does it create delight?** — a small, earned, honest moment of good feeling (never gamified).
- **Does it build trust?** — accurate, humble, never over-claiming; silence over a guess.
- **Does it reduce cognitive load?** — fewer decisions, not more.
- **Does it make the product feel *quieter* rather than noisier?** — the mature product asks less, not more.

A feature that works, tests green, and looks fine but leaves a parent feeling *more* overwhelmed has **not** met the standard.

## Commercial

Where relevant:

- **Analytics added** — we can tell whether it's actually used and whether it helps.
- **Billing behaviour verified** — money paths tested end-to-end (test mode), idempotent, no surprise charges.
- **Feature flags removed or documented** — no orphaned flags; anything left dark is written down and owned.
- **Upgrade paths reviewed** — the way a family encounters a plan boundary is honest and never aggressive.
- **Copy reviewed** — words are design material; they say exactly what happens, in the family's language.

---

## Checklist 1 — Definition of Done

*The concise gate before merging. If any box is unchecked, it isn't done.*

- [ ] Fulfils its stated purpose; passes the pre-merge question (simpler, wiser, more helpful).
- [ ] Code reviewed; tests + relevant regression harness green; no known regressions across roles.
- [ ] Security enforced server-side; no new path to another family's data; no data-loss risk.
- [ ] Logging/analytics where appropriate; performance not regressed.
- [ ] First-time, empty, error, and loading states all handled; mobile works.
- [ ] LFM questions consciously considered (context captured where it should be).
- [ ] Copy reviewed; flags removed or documented; billing verified (if touched).
- [ ] Docs updated.

## Checklist 2 — Definition of Delight

*The smaller, harder gate. If the honest answer to the first question is no, don't ship it yet.*

- [ ] **Would I be proud to show this to one of our first 25 founding families?**
- [ ] Does it feel *intentional* — designed, not defaulted?
- [ ] Does it feel *simple*?
- [ ] Does it feel *thoughtful*?
- [ ] Does it make the product *noticeably better*?

**If not — why are we shipping it?** A feature that clears Checklist 1 but fails Checklist 2 is working, not finished. Send it back, or cut it.

---

## The final principle

> **We do not ship a feature because it is finished. We ship it because a family is genuinely ready to be better off for having it — and until that is true, it is not done, no matter how complete the code.**

*Functionality is the beginning of the work, not the end of it. Done is measured on the family's side of the screen.*
