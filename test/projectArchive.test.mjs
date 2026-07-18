/* Unit tests for the project-decision Archive builders (js/lib/projectArchive.js).
   Pure functions → runnable with `node --test` (no deps, no browser, no DB).
   The RLS / unauthorized-write / live cases are covered in
   supabase/tests/security/rls_behavioral.sql and the live verification run. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deterministicId, buildAcceptedArchive, buildEditedArchive, buildDeclinedArchive,
} from "../js/lib/projectArchive.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;
const FAM = "d5292c4a-f678-4416-a134-982b06fcd7d4";
const KID = "ef77e1c6-9242-49f9-bdc3-caa5cf77a304";
const USER = "22222222-2222-2222-2222-222222222222";
const PROPOSAL = { title: "The Gear Inventor", domains: ["science", "digital"], sizeBand: "medium" };

// Only these metadata keys may appear — enforces "record what happened, not what
// it means" (requirement #6). If a builder ever adds a scoring/preference field,
// this fails loudly.
const ALLOWED_META = {
  accepted: new Set(["event", "source", "projectId", "proposed"]),
  edited: new Set(["event", "source", "requestedChange", "preEdit", "sequence"]),
  declined: new Set(["event", "source", "reason", "proposed"]),
};

/* ---------- accepted (unchanged) ---------- */
test("accepted: canonical project_decision Archive entry", () => {
  const a = buildAcceptedArchive({
    familyId: FAM, childId: KID, projectId: "proj-1", actingUserId: USER, proposed: PROPOSAL,
  });
  assert.equal(a.sourceType, "project_decision");
  assert.equal(a.scope, "child");
  assert.equal(a.subjectId, KID);          // which child
  assert.equal(a.createdBy, USER);         // who acted
  assert.equal(a.title, PROPOSAL.title);
  assert.equal(a.metadata.event, "accepted");
  assert.equal(a.metadata.source, "project_generator");
  assert.equal(a.metadata.projectId, "proj-1");
  assert.deepEqual(a.metadata.proposed, PROPOSAL);   // what was originally proposed
  assert.match(a.id, UUID_RE);
  assert.deepEqual(new Set(Object.keys(a.metadata)), ALLOWED_META.accepted);
});

/* ---------- accepted AFTER edit: the edit is its own high-value entry ---------- */
test("edited: preserves the delta and is NOT reduced to accepted", () => {
  const preEdit = { title: "The Gear Inventor", domains: ["science"] };
  const e = buildEditedArchive({
    familyId: FAM, childId: KID, actingUserId: USER,
    preEdit, refineText: "make it more about robots", sequence: 0,
  });
  assert.equal(e.sourceType, "feedback");
  assert.equal(e.metadata.event, "edited");                       // NOT "accepted"
  assert.equal(e.metadata.requestedChange, "make it more about robots"); // WHAT changed
  assert.deepEqual(e.metadata.preEdit, preEdit);                  // the pre-edit proposal
  assert.equal(e.content, "make it more about robots");           // parent's own words
  assert.deepEqual(new Set(Object.keys(e.metadata)), ALLOWED_META.edited);

  // The subsequent accept is a DISTINCT entry keyed off the created project id.
  const a = buildAcceptedArchive({ familyId: FAM, childId: KID, projectId: "proj-9", actingUserId: USER, proposed: preEdit });
  assert.notEqual(e.id, a.id);
  assert.equal(a.metadata.event, "accepted");
});

test("edited: successive refines are distinct entries", () => {
  const e0 = buildEditedArchive({ familyId: FAM, childId: KID, preEdit: { title: "T" }, refineText: "change A", sequence: 0 });
  const e1 = buildEditedArchive({ familyId: FAM, childId: KID, preEdit: { title: "T" }, refineText: "change B", sequence: 1 });
  assert.notEqual(e0.id, e1.id);
});

/* ---------- declined ---------- */
test("declined: feedback entry, reason null when none given", () => {
  const d = buildDeclinedArchive({ familyId: FAM, childId: KID, actingUserId: USER, proposed: PROPOSAL });
  assert.equal(d.sourceType, "feedback");
  assert.equal(d.metadata.event, "declined");
  assert.equal(d.metadata.reason, null);              // no reasons UI → no inference
  assert.deepEqual(d.metadata.proposed, PROPOSAL);    // what was declined
  assert.deepEqual(new Set(Object.keys(d.metadata)), ALLOWED_META.declined);
});

test("declined: explicit reason preserved verbatim", () => {
  const d = buildDeclinedArchive({ familyId: FAM, childId: KID, proposed: PROPOSAL, reason: "too long for us right now" });
  assert.equal(d.metadata.reason, "too long for us right now");
  assert.equal(d.content, "too long for us right now");
});

/* ---------- duplicate retry → idempotent (same id) ---------- */
test("idempotency: identical accept inputs → identical id (retry-safe)", () => {
  const key = { familyId: FAM, childId: KID, projectId: "proj-1", actingUserId: USER, proposed: PROPOSAL };
  assert.equal(buildAcceptedArchive(key).id, buildAcceptedArchive(key).id);
  // accept id keys off (family, project) only → a retry with jittered metadata still de-dupes
  const jittered = buildAcceptedArchive({ ...key, proposed: { ...PROPOSAL, sizeBand: "large" } });
  assert.equal(jittered.id, buildAcceptedArchive(key).id);
});

test("idempotency: identical edit/decline inputs → identical id", () => {
  const e = { familyId: FAM, childId: KID, preEdit: { title: "T" }, refineText: "x", sequence: 0 };
  assert.equal(buildEditedArchive(e).id, buildEditedArchive(e).id);
  const d = { familyId: FAM, childId: KID, proposed: PROPOSAL };
  assert.equal(buildDeclinedArchive(d).id, buildDeclinedArchive(d).id);
});

test("distinctness: different families/children/projects → different ids", () => {
  const base = { familyId: FAM, childId: KID, projectId: "p", actingUserId: USER, proposed: PROPOSAL };
  const a = buildAcceptedArchive(base).id;
  assert.notEqual(a, buildAcceptedArchive({ ...base, familyId: "other-fam" }).id);
  assert.notEqual(a, buildAcceptedArchive({ ...base, projectId: "p2" }).id);
});

/* ---------- missing / deleted project → graceful ---------- */
test("missing project: builders tolerate null project fields (no throw, valid payload)", () => {
  const a = buildAcceptedArchive({ familyId: FAM, childId: KID, projectId: null, actingUserId: null, proposed: null });
  assert.match(a.id, UUID_RE);
  assert.equal(a.title, null);
  assert.equal(a.metadata.projectId, null);
  assert.equal(a.metadata.proposed, null);
  // decline with no proposal at all still yields a valid, stable id
  const d = buildDeclinedArchive({ familyId: FAM, childId: KID });
  assert.match(d.id, UUID_RE);
  assert.equal(buildDeclinedArchive({ familyId: FAM, childId: KID }).id, d.id);
});

/* ---------- deterministicId shape ---------- */
test("deterministicId: always a valid v4-shaped UUID, stable, low-collision", () => {
  assert.match(deterministicId("anything"), UUID_RE);
  assert.equal(deterministicId("k"), deterministicId("k"));
  const ids = new Set(Array.from({ length: 2000 }, (_, i) => deterministicId("accepted:" + FAM + ":proj-" + i)));
  assert.equal(ids.size, 2000);   // no collisions across 2k distinct keys
});
