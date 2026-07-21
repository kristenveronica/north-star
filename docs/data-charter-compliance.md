# Data & Trust Charter — Compliance Map

**Purpose:** map each binding commitment in the **North Star Family Sovereignty & Data Charter** (`co-work/NORTH STAR FAMILY SOVEREIGNTY & DATA CHARTER.docx`, public at `#/trust` via `renderTrustCharter`) to the concrete code/infrastructure that honours it — so compliance is legible, testable, and cannot silently regress. **This is a governance document: every data-handling change must keep this map true.**

Date started: 2026-07-20 · Scope focus: **uploads (child + parent portal)** and the data they produce.

---

## The commitments that bind the codebase

From the Charter (verbatim intent):
- *"Your family's data belongs to your family. Not North Star… not AI training systems. We are custodians, not owners."*
- *"Collect the minimum amount of information necessary… The safest data is the data we never collect."*
- Child privacy: *"No profiling children for commercial purposes… no surveillance-style tracking… children are not products."*
- *"We will never use your family's content to train public AI models."*
- *"We will never build facial recognition, biometric profiling or emotion detection for children."*
- *"Families should be able to access and export their educational records at any time… their work leaves with them… never create dependency through data lock-in."*
- *"Privacy is designed into North Star from the beginning — not added later."*

---

## Compliance map (uploads & family media)

| Charter commitment | How the code honours it | Where |
|---|---|---|
| **Data minimisation** — collect the minimum; never the bytes we don't need | Uploaded files are stored in Storage; the DB keeps only a **pointer + minimal metadata** (path, name, type, size). Never base64, never the file in a row. | `milestone_evidence` (0001), `toEvidenceRow` (repo.js), edge `record-evidence` |
| **Never collect a child's location** (minimisation + no surveillance) | Every image is **canvas re-encoded before upload, which strips ALL EXIF/GPS metadata**. This is intentional and MUST always run (no "skip if small" fast-path). | `compressImage()` (submission.js) — see its charter comment |
| **Never send family content to third-party AI / no biometric or facial or emotion profiling of children** | **Family-media (children's photos/voices/videos) is NEVER sent to any external AI** — no moderation, no vision, no transcription, no biometric. The only AI calls made send *our own generated text* (TTS on mission copy) or *minimal declared facts* (the daily Guide line: first name + interests + recent titles) to no-training API tiers. **Bucket contents never leave for AI.** | `child-portal` `tts`/`daily-guide` (text only); **no code path reads `family-media` into an AI request** |
| **Family isolation / sovereignty** — a family's data serves only that family | Private bucket; every object path is `{familyId}/{childId}/…`; bucket RLS gates on the family_id segment. The child-portal signed-upload path mints URLs **only under the child's own family/child folder**, and `record-evidence` **rejects any pointer not under that exact prefix**. | bucket RLS (0029), edge `create-evidence-upload` / `record-evidence` |
| **Custodians, not owners** — child-portal writes are validated, never trusted blindly | Access-code sessions can't write through RLS. A **service-role** edge path persists completions + evidence only after validating `code → child → milestone → family`. | edge `record-completion`, `record-evidence` |
| **Privacy by design** | Private bucket (not public), short-lived **signed URLs** (1 h) for viewing, encryption at rest (Storage default). | `storage.js` (`signedUrl`), bucket (0029) |
| **Right to erasure / no data lock-in** — *"their work leaves with them… never create dependency through data lock-in"* | An Owner can **close the account and erase everything**. The `erase-family` edge fn (Owner-authZ + typed confirmation) **garbage-collects every Storage object** under the family prefix, then `erase_family()` deletes the whole DB footprint in one transaction — deliberately overriding the child-story RESTRICT guards — and closes the logins of adults left in no other family. No orphaned rows, **no orphaned files**. Verified end-to-end. | `erase_family()` (0036, service-role-only), edge `erase-family`, Settings danger zone (`js/lib/account.js`) |

---

## Known residuals (honest gaps, tracked)

- **Video/audio location metadata.** Only *images* are metadata-stripped (via canvas re-encode). iPhone **videos** can embed GPS; client-side stripping needs re-muxing and is not done. *Mitigation:* private, family-only bucket. *Tracked:* strip or warn on video upload.
- **HEIC on Chrome.** If the browser can't decode an image format, `compressImage` uploads the original (metadata intact). Most child devices (iPad/iPhone → Safari) decode HEIC and strip. *Tracked.*
- **Export / portability** (*"export at any time… work leaves with them… no lock-in"*). No self-serve family export yet. **Charter obligation — not built.** (Erasure is now built; export is its remaining half.)
- **Parental consent (COPPA / GDPR-K).** Assumed captured at onboarding; not audited here.

*Closed 2026-07-20:* **Right to erasure / deletion** — self-serve account closure now deletes the full DB footprint **and garbage-collects all storage objects** (edge `erase-family` + `erase_family()` SQL, migration 0036), verified end-to-end. See the compliance-map row above.

---

## Feature decision: giving children feedback on an uploaded video (how we do it safely)

*Decided 2026-07-20. A recurring, well-intentioned feature idea: a child uploads a video (e.g. presenting a report) and North Star / their Guide gives feedback — points to improve, suggestions, and acknowledgement. This records the boundary and the approved way to build it, so no one implements the forbidden version.*

**The forbidden version.** Having North Star or a Guide **watch the child's video and give feedback on the footage itself** is a **Charter violation** and must not be built. It breaks three commitments at once:

1. *"Family-media is never sent to any third-party AI."* Critiquing a video means sending its frames (the child's face) and audio (the child's voice) to a vision/transcription model — the exact boundary the family-media bucket exists to defend.
2. *"We will never build facial recognition, biometric profiling or **emotion detection** for children."* Reading a child's confidence, eye contact, or nervousness from footage **is** emotion detection on a child. Bright line.
3. **Data minimisation + no surveillance.** Analysing how a child performs on camera is the most intimate data we hold, processed for exactly the judgement the Charter forbids.

Parental consent does **not** unlock it: this is an architectural promise ("we don't build the feature"), and children's biometric/emotion analysis also carries real COPPA / BIPA-style legal exposure regardless of consent. The tempting line — *"AI watched your video: you said 'um' 11 times and looked nervous at 0:42"* — is precisely what we will never ship.

**The approved way — coach on *words about* the video, never its pixels or audio.** The uploaded video stays a private keepsake in the family-media bucket; the AI never receives the file. The value is delivered through text the child or parent provides:

| Pattern | How it works | Status |
|---|---|---|
| **Self-reflection coaching** *(recommended)* | After uploading, the child answers reflective prompts — *"What were you explaining? What was hardest? What would you change?"* — and the Guide coaches on the child's **own words**. The AI never touches the file. Stronger pedagogy, too: the child builds their own eye. | ✅ Charter-clean |
| **Parent-as-the-eyes** | A parent watches, notes a few observations, and asks the Guide for help (*"they kept losing their place — how do I support that?"*). The human watches; the AI coaches on human-provided text. | ✅ Charter-clean; honours "parent leads" |
| **Content-agnostic craft + acknowledgement** | The Guide offers presentation-craft tips (structure, pacing, "tell them what you'll tell them…") from the milestone type, and warmly **acknowledges the accomplishment** from metadata alone (milestone complete + evidence = video). | ✅ Charter-clean |

**The rule of thumb for this and anything like it:** the Guide may respond to *what the child says about their work*; it may never *analyse the child from their media*. Acknowledgement of the **act** (they made it, they finished, they shared) is always free and safe — it needs only metadata. Feedback on the **footage** is never built.

---

## The rule for future work

Before any feature touches family data, check it against this map. In particular — **the family-media bucket is a hard AI boundary: its contents must never be sent to any third-party model.** If a feature needs that, it isn't built (Charter: *"We don't build the feature. We don't collect the data. We don't compromise the principle."*).
