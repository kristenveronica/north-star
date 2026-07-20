/* Unit tests for the Child Dashboard Sky backdrop (pure → `node --test`). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { timeOfDay, renderSky, lightLayout, earnedLightSVG, renderEarnedLights } from "../js/components/sky.js";

test("timeOfDay maps hours to the four sky moods", () => {
  assert.equal(timeOfDay(6), "dawn");
  assert.equal(timeOfDay(7), "dawn");
  assert.equal(timeOfDay(8), "day");
  assert.equal(timeOfDay(12), "day");
  assert.equal(timeOfDay(16), "day");
  assert.equal(timeOfDay(17), "dusk");
  assert.equal(timeOfDay(19), "dusk");
  assert.equal(timeOfDay(20), "night");
  assert.equal(timeOfDay(23), "night");
  assert.equal(timeOfDay(0), "night");
  assert.equal(timeOfDay(4), "night");
});

test("renderSky reflects the time of day and is decorative", () => {
  assert.match(renderSky(12), /cd-sky--day/);
  assert.match(renderSky(6), /cd-sky--dawn/);
  assert.match(renderSky(18), /cd-sky--dusk/);
  assert.match(renderSky(22), /cd-sky--night/);
  assert.match(renderSky(12), /aria-hidden="true"/);
});

test("renderSky renders the full deterministic star field", () => {
  const html = renderSky(22);
  assert.equal((html.match(/<circle /g) || []).length, 20);
  assert.match(html, /class="cd-stars"/);
});

/* ---- Momentum as Light ---- */
test("lightLayout is deterministic and stays within the sky bounds", () => {
  assert.deepEqual(lightLayout("abc"), lightLayout("abc"));   // stable
  const p = lightLayout("abc");
  assert.ok(p.x >= 6 && p.x <= 94, "x in band");
  assert.ok(p.y >= 8 && p.y <= 34, "y in upper sky");
  assert.ok(p.r >= 1.3 && p.r <= 2.4, "radius in range");
  assert.ok(p.glow >= 0.6 && p.glow <= 0.95, "glow in range");
});

test("different milestones make different lights — a sky unique to the child", () => {
  assert.notDeepEqual(lightLayout("m1"), lightLayout("m2"));
});

test("earnedLightSVG carries its per-light seed and marks settling lights", () => {
  const svg = earnedLightSVG("m1");
  assert.match(svg, /class="cd-light"/);
  assert.match(svg, /--glow:/);
  assert.match(svg, /--tw:/);
  assert.match(earnedLightSVG("m1", { settling: true }), /cd-light--settling/);
});

test("renderEarnedLights renders one light per completed milestone", () => {
  const html = renderEarnedLights(["m1", "m2", "m3"]);
  assert.equal((html.match(/<circle /g) || []).length, 3);
  assert.match(html, /class="cd-lights"/);
});

test("renderSky seeds the earned-lights layer and stays decorative", () => {
  const html = renderSky(22, ["m1", "m2"]);
  assert.match(html, /cd-lights-layer/);
  assert.equal((html.match(/class="cd-light"/g) || []).length, 2);
  assert.match(html, /aria-hidden="true"/);
});
