/* Unit tests for the Child Dashboard Sky backdrop (pure → `node --test`). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { timeOfDay, renderSky } from "../js/components/sky.js";

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
