import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  MODE_IDS,
  MODE_LEVELS,
  createCoveragePlan,
  createDefaultProfile,
  selectAdaptiveRound,
  difficultyFor,
  scoreStage,
  readProfile,
  writeProfile,
  recordAttempt,
  finalizeRun,
  createSignalTrial,
  isSignalAnswerCorrect,
  createStarPath,
  isStarStepCorrect,
  accuracyFor
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

test("six mode tables expose the designed endpoint behavior", () => {
  assert.deepEqual(MODE_LEVELS.focus[0], { hits: 2, decoys: 4, limitMs: 6000 });
  assert.deepEqual(MODE_LEVELS.focus[6], { hits: 5, decoys: 12, limitMs: 3200 });
  assert.deepEqual(MODE_LEVELS.memory[6], { length: 8, revealMs: 400, cardCount: 8 });
  assert.equal(MODE_LEVELS.pattern[4].size, 6);
  assert.deepEqual(MODE_LEVELS.direction[6], { length: 8, limitMs: 3300 });
  assert.deepEqual(MODE_LEVELS.switch[0], { trials: 3, candidates: 3, limitMs: 10000 });
  assert.deepEqual(MODE_LEVELS.switch[6], { trials: 6, candidates: 4, limitMs: 5500 });
  assert.deepEqual(MODE_LEVELS.trail[0], { size: 4, length: 4, revealMs: 600, limitMs: 9000 });
  assert.deepEqual(MODE_LEVELS.trail[6], { size: 5, length: 9, revealMs: 380, limitMs: 6000 });
});

test("signal trial follows the displayed rule in a conflict set", () => {
  const trial = createSignalTrial({
    level: 3,
    previousRules: ["shape", "shape"],
    rng: fixedRng(0, 0.2, 0.4, 0.6, 0.8)
  });
  assert.equal(trial.rule, "color");
  assert.equal(trial.candidates.length, 4);
  assert.equal(trial.candidates.filter((candidate) => candidate.color === trial.reference.color).length, 1);
  assert.equal(trial.candidates.filter((candidate) => candidate.shape === trial.reference.shape).length, 1);
  assert.equal(isSignalAnswerCorrect(trial, trial.answerId), true);
  assert.equal(isSignalAnswerCorrect(trial, "missing"), false);
});

test("level one signal keeps one rule for a pair of trials", () => {
  const trial = createSignalTrial({ level: 1, previousRules: ["color"], rng: fixedRng(0.2, 0.4, 0.9) });
  assert.equal(trial.rule, "color");
});

test("star path is adjacent, unique, and exactly the requested length", () => {
  const size = 5;
  const path = createStarPath({ size, length: 9, rng: fixedRng(0.1, 0.8, 0.3, 0.6) });
  assert.equal(path.length, 9);
  assert.equal(new Set(path).size, 9);
  for (let index = 1; index < path.length; index += 1) {
    const previous = [Math.floor(path[index - 1] / size), path[index - 1] % size];
    const current = [Math.floor(path[index] / size), path[index] % size];
    assert.equal(Math.abs(previous[0] - current[0]) + Math.abs(previous[1] - current[1]), 1);
  }
  assert.equal(isStarStepCorrect(path, 0, path[0]), true);
  assert.equal(isStarStepCorrect(path, 1, path[0]), false);
});

test("static shell exposes six modes and retains routed original music", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /6가지 두뇌 미니게임/);
  assert.equal((html.match(/data-mode="/g) || []).length, 6);
  assert.match(html, /id="home-bgm"[^>]+velvet-tide\.mp3/);
  assert.match(html, /id="game-bgm"[^>]+origami-pavements\.mp3/);
  assert.equal(existsSync(new URL("../public/assets/velvet-tide.mp3", import.meta.url)), true);
  assert.equal(existsSync(new URL("../public/assets/origami-pavements.mp3", import.meta.url)), true);
});

test("mini-games render directly without a title interstitial", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /stage-intro/);
  assert.doesNotMatch(app, /stageIntro|showStageIntro/);
  assert.match(app, /state\.stageLocked = false;\s+renderCurrentMode\(\);/);
});

test("result accuracy is derived only from truthful attempts", () => {
  assert.equal(accuracyFor({ attempts: 3, successes: 2 }), 67);
  assert.equal(accuracyFor({ attempts: 0, successes: 0 }), null);
});
