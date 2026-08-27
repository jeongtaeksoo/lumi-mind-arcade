import test from "node:test";
import assert from "node:assert/strict";

import {
  MODE_IDS,
  createCoveragePlan,
  createDefaultProfile,
  selectAdaptiveRound,
  difficultyFor,
  scoreStage,
  readProfile,
  writeProfile,
  recordAttempt,
  finalizeRun
} from "../game-core.mjs";

const fixedRng = (...values) => {
  let index = 0;
  return () => values[index++ % values.length];
};

test("coverage plan contains every mode exactly once", () => {
  const plan = createCoveragePlan(fixedRng(0.2, 0.7, 0.1, 0.8, 0.3, 0.6));
  assert.equal(plan.length, 6);
  assert.deepEqual(new Set(plan), new Set(MODE_IDS));
});

test("adaptive round includes the weakest mode without duplicates", () => {
  const profile = createDefaultProfile();
  profile.modes.focus.recent = ["error", "timeout", "error", "success"];
  const plan = selectAdaptiveRound(profile, fixedRng(0, 0.4, 0.8));
  assert.equal(plan.length, 3);
  assert.equal(new Set(plan).size, 3);
  assert.ok(plan.includes("focus"));
});

test("weak modes get one level of assistance from round three", () => {
  const profile = createDefaultProfile();
  profile.modes.focus.recent = ["error", "error", "success", "error"];
  assert.equal(difficultyFor({ mode: "focus", round: 3, finalLevel: 1, profile }), 2);
});

test("score formula is exact and combo is capped", () => {
  assert.equal(scoreStage({ base: 100, difficulty: 3, remainingRatio: 0.5, comboBefore: 12 }), 250);
});

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    value: () => value
  };
}

test("attempt totals stay truthful and recent history is capped", () => {
  const profile = createDefaultProfile();
  for (let index = 0; index < 13; index += 1) {
    recordAttempt(profile, { mode: "trail", outcome: index === 0 ? "timeout" : "success" });
  }
  assert.equal(profile.modes.trail.attempts, 13);
  assert.equal(profile.modes.trail.successes, 12);
  assert.equal(profile.modes.trail.errors, 1);
  assert.equal(profile.modes.trail.timeouts, 1);
  assert.equal(profile.modes.trail.recent.length, 12);
});

test("corrupt storage falls back without blocking play", () => {
  const { profile, persistent } = readProfile(memoryStorage("not-json"));
  assert.equal(profile.version, 1);
  assert.equal(persistent, true);
});

test("storage exceptions report non-persistent mode", () => {
  const storage = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); }
  };
  assert.equal(readProfile(storage).persistent, false);
  assert.equal(writeProfile(storage, createDefaultProfile()), false);
});

test("finalizing a run updates totals and bests once per call", () => {
  const profile = createDefaultProfile();
  finalizeRun(profile, {
    score: 540,
    bestCombo: 4,
    round: 3,
    finalLevel: 1,
    endedAt: "2026-08-27T12:00:00.000Z",
    modes: {}
  });
  assert.equal(profile.records.totalRuns, 1);
  assert.equal(profile.records.bestScore, 540);
  assert.equal(profile.records.bestCombo, 4);
  assert.equal(profile.records.lastRun.score, 540);
});
