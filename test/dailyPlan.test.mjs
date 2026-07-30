import { test } from "node:test";
import assert from "node:assert/strict";
import {
  milestoneMinutes, dailyTargetMinutes, learningDaysFrom,
  scheduleMilestones, loadByDay, buildTodayPlan, fmtMinutes,
} from "../js/lib/dailyPlan.js";

test("milestoneMinutes prefers the honest estimate, clamps, then falls back", () => {
  assert.equal(milestoneMinutes({ estimatedMinutes: 75 }), 75);
  assert.equal(milestoneMinutes({ estimatedMinutes: 400 }), 180);
  assert.equal(milestoneMinutes({ estimatedMinutes: 2 }), 5);
  assert.equal(milestoneMinutes({ momentumPoints: 20 }), 60);   // fallback
  assert.equal(milestoneMinutes({}), 30);
});

test("dailyTargetMinutes reads hoursPerDay, defaults to 3h", () => {
  assert.equal(dailyTargetMinutes({ hoursPerDay: 2 }), 120);
  assert.equal(dailyTargetMinutes({}), 180);
});

test("learningDaysFrom skips weekends and caps at daysPerWeek per week", () => {
  // Mon 2026-08-03 .. want 6 days at 4 days/week → Mon,Tue,Wed,Thu (week1), then Mon,Tue (week2)
  const start = new Date(2026, 7, 3, 12); // Aug 3 2026 is a Monday
  const days = learningDaysFrom(start, 6, { daysPerWeek: 4 });
  assert.equal(days.length, 6);
  for (const d of days) assert.ok(d.getDay() !== 0 && d.getDay() !== 6, "no weekends");
  // 5th learning day should jump to the next week's Monday (Aug 10), not Fri Aug 7
  assert.equal(days[4].getDate(), 10);
});

test("scheduleMilestones packs each learning day up to the daily target", () => {
  // target 180min; four 90-min missions → two per day across two learning days
  const items = [1, 2, 3, 4].map((n) => ({ id: `m${n}`, minutes: 90 }));
  const start = new Date(2026, 7, 3, 12); // Monday
  const out = scheduleMilestones(items, new Map(), { hoursPerDay: 3, daysPerWeek: 5 }, start);
  assert.equal(out.length, 4);
  const day1 = out[0].dueDate.getDate(), day2 = out[2].dueDate.getDate();
  assert.equal(out[1].dueDate.getDate(), day1); // first two share day 1
  assert.equal(out[3].dueDate.getDate(), day2); // next two share day 2
  assert.notEqual(day1, day2);
});

test("scheduleMilestones respects load other projects already put on a day", () => {
  const start = new Date(2026, 7, 3, 12); // Monday
  const existing = loadByDay([{ dueDate: start, estimatedMinutes: 150 }]); // day 1 nearly full (target 180)
  const out = scheduleMilestones([{ id: "x", minutes: 90 }], existing, { hoursPerDay: 3, daysPerWeek: 5 }, start);
  // 150 + 90 > 180 and day already has work → pushed to the next learning day
  assert.notEqual(out[0].dueDate.getDate(), start.getDate());
});

test("buildTodayPlan fills to the daily target in due order", () => {
  const ms = [
    { id: "a", dueDate: "2026-08-01", estimatedMinutes: 60 },
    { id: "b", dueDate: "2026-08-02", estimatedMinutes: 60 },
    { id: "c", dueDate: "2026-08-03", estimatedMinutes: 60 },
    { id: "d", dueDate: "2026-08-10", estimatedMinutes: 60 },
  ];
  const plan = buildTodayPlan(ms, { hoursPerDay: 3 }); // target 180
  assert.equal(plan.totalMinutes, 180);
  assert.equal(plan.items.length, 3);          // a,b,c fill 180; d not needed today
  assert.equal(plan.status, "balanced");
});

test("buildTodayPlan flags a light day and an empty day", () => {
  assert.equal(buildTodayPlan([], { hoursPerDay: 3 }).status, "empty");
  const light = buildTodayPlan([{ id: "a", estimatedMinutes: 30 }], { hoursPerDay: 3 });
  assert.equal(light.status, "light");
});

test("fmtMinutes is friendly", () => {
  assert.equal(fmtMinutes(150), "2h 30m");
  assert.equal(fmtMinutes(120), "2h");
  assert.equal(fmtMinutes(45), "45m");
});
