# LUMI’S MIND ARCADE Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 네 모드를 개선하고 두 신규 모드를 더해, 로컬 약점 이력에 적응하며 실제 기록을 저장하는 여섯 모드 브라우저 아케이드를 완성한다.

**Architecture:** 정적 HTML/CSS와 DOM 렌더링 중심의 `app.js` 구조를 유지한다. 테스트가 필요한 난수 생성, 난이도, 점수, 적응, 저장 정규화만 `game-core.mjs`로 분리하고, Node 내장 `node:test`로 검증한다. 신규 프레임워크, 런타임 의존성, 빌드 과정은 추가하지 않는다.

**Tech Stack:** HTML5, CSS, vanilla JavaScript ES modules, Web Audio API, `localStorage`, Node.js built-in test runner

**Spec:** `docs/superpowers/specs/2026-08-27-lumi-arcade-expansion-design.md`

## Global Constraints

- Phaser 등 게임 엔진 또는 빌드 도구를 도입하지 않는다.
- 서버, 계정, 로그인, 클라우드 동기화, 온라인 순위표를 추가하지 않는다.
- 기존 시스템 한국어 폰트 스택과 루미의 독창적 생성 자산을 유지한다.
- 기존 제품 동작인 `public/assets/velvet-tide.mp3`와 `public/assets/origami-pavements.mp3` 및 홈/게임 라우팅을 유지한다. 저장소에 출처·라이선스 메타데이터가 없다는 잔여 위험을 사실대로 기록한다.
- 새 효과음은 Web Audio API로 250ms 이하 길이로 합성하며 기존 배경음악과 같은 사용자 음악 설정을 따른다.
- 새 아이콘은 CSS 도형 또는 Unicode 기본 기호만 사용한다.
- 핵심 터치 대상은 최소 44×44 CSS px이고, 상태는 색상 하나로만 전달하지 않는다.
- 1440×900 데스크톱과 390×844 모바일, 키보드 전용, 모션 감소 환경을 지원한다.
- 로컬 저장 실패는 플레이를 막지 않으며 성공한 것처럼 표시하지 않는다.

## File Map

- Create `game-core.mjs`: 여섯 모드 상수, 난이도 표, 적응형 선택, 점수 계산, 신호/경로 생성, 프로필 정규화와 기록 갱신을 담당한다.
- Create `tests/game.test.mjs`: 순수 로직과 정적 HTML/자산 계약을 Node 내장 테스트로 검증한다.
- Modify `app.js`: DOM 상태, 여섯 모드 렌더러, 중앙 성공/실패 흐름, 로컬 기록 연결, Web Audio, 입력과 전환을 담당한다.
- Modify `index.html`: 여섯 모드 홈/HUD/결과 마크업, 정확한 문구, 접근성 상태 영역, ES module 진입점을 제공한다.
- Modify `styles.css`: 기존 최종 override를 정리하고 여섯 모드, 전환, 피드백, 데스크톱/모바일/모션 감소 스타일을 제공한다.
- Modify `README.md`: 실제 여섯 모드, 로컬 저장, 기존 배경음악 라우팅과 합성 효과음, 실행 방법을 설명한다.
- Modify `GAME_SPEC.md`: 구현된 여섯 모드 규칙, 적응, 점수, 데이터 모델을 설계 문서와 일치시킨다.
- Modify `design-qa.md`: 최종 브라우저 검증의 화면 크기, 입력 방식, 콘솔, 저장, 라이선스 결과를 기록한다.
- Retain `public/assets/velvet-tide.mp3` and `public/assets/origami-pavements.mp3`: 기존 홈/게임 배경음악 동작을 보존하되 확인되지 않은 라이선스를 주장하지 않는다.
- Do not create `THIRD_PARTY_NOTICES.md`: 확정 범위에는 vendored third-party file이 없다. 실제 구현에서 제3자 파일이 추가되면 해당 파일과 고지 문서를 같은 커밋에 포함해야 한다.

---

### Task 1: Add a tested pure game core

**Files:**
- Create: `game-core.mjs`
- Create: `tests/game.test.mjs`
- Modify: `app.js`
- Modify: `index.html`

**Interfaces:**
- Produces: `MODE_IDS`, `MODE_INFO`, `MODE_LEVELS`, `createDefaultProfile()`, `createCoveragePlan(rng)`, `weaknessFor(stat)`, `selectAdaptiveRound(profile, rng)`, `difficultyFor({ mode, round, finalLevel, profile })`, `scoreStage({ base, difficulty, remainingRatio, comboBefore })`
- Consumes: `rng` is a function returning a number in `[0, 1)`; production passes `Math.random`, tests pass deterministic functions.

- [ ] **Step 1: Write failing tests for six-mode coverage, adaptive choice, difficulty adjustment, and score**

```js
// tests/game.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  MODE_IDS,
  createCoveragePlan,
  createDefaultProfile,
  selectAdaptiveRound,
  difficultyFor,
  scoreStage
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
```

- [ ] **Step 2: Run the tests and verify the missing module failure**

Run: `node --test tests/game.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `game-core.mjs`.

- [ ] **Step 3: Implement the minimal pure contracts**

```js
// game-core.mjs — public surface; keep helpers private
export const MODE_IDS = Object.freeze(["focus", "memory", "pattern", "direction", "switch", "trail"]);
export const MODE_INFO = Object.freeze({
  focus: { label: "집중", base: 100 },
  memory: { label: "기억", base: 120 },
  pattern: { label: "패턴", base: 110 },
  direction: { label: "방향", base: 110 },
  switch: { label: "신호 전환", base: 130 },
  trail: { label: "별길 추적", base: 130 }
});

export function weaknessFor(stat) {
  const failures = stat.recent.filter((value) => value !== "success").length;
  return (failures + 1) / (stat.recent.length + 2);
}

export function difficultyFor({ mode, round, finalLevel, profile }) {
  const base = round < 5 ? round : Math.min(7, 5 + Math.floor((finalLevel - 1) / 2));
  if (round < 3) return base;
  const recent = profile.modes[mode].recent;
  const accuracy = recent.length ? recent.filter((value) => value === "success").length / recent.length : 0;
  const adjusted = recent.length >= 4 && accuracy < 0.6 ? base - 1 : recent.length >= 8 && accuracy >= 0.85 ? base + 1 : base;
  return Math.max(1, Math.min(7, adjusted));
}

export function scoreStage({ base, difficulty, remainingRatio, comboBefore }) {
  return base + difficulty * 10 + Math.round(Math.max(0, Math.min(1, remainingRatio)) * 40) + Math.min(comboBefore, 10) * 10;
}
```

Use Fisher–Yates in `createCoveragePlan`. In `selectAdaptiveRound`, randomly break weakness ties, include one highest-weakness mode, then weighted-sample two distinct remaining modes using `1 + 2 * weaknessFor(stat)`.

- [ ] **Step 4: Convert the browser entry point to an ES module**

```html
<script type="module" src="./app.js?v=16"></script>
```

At the top of `app.js`, import only the core names used by the current slice. Do not move DOM renderers into the core.

- [ ] **Step 5: Run the pure tests**

Run: `node --test tests/game.test.mjs`
Expected: 4 tests PASS.

- [ ] **Step 6: Smoke-test module loading**

Run: `python3 -m http.server 4173`
Open: `http://localhost:4173`
Expected: home renders, Start opens a round, browser console has no module/CORS error.

- [ ] **Step 7: Commit the core slice**

```bash
git add game-core.mjs tests/game.test.mjs app.js index.html
git commit -m "test: add deterministic game core"
```

### Task 2: Persist truthful records and adaptive history

**Files:**
- Modify: `game-core.mjs`
- Modify: `tests/game.test.mjs`
- Modify: `app.js`

**Interfaces:**
- Produces: `readProfile(storage) -> { profile, persistent }`, `writeProfile(storage, profile) -> boolean`, `recordAttempt(profile, { mode, outcome }) -> profile`, `finalizeRun(profile, summary) -> profile`
- `outcome` is exactly `"success"`, `"error"`, or `"timeout"`.
- `summary` is `{ score, bestCombo, round, finalLevel, endedAt, modes }` with numeric non-negative values and ISO `endedAt`.

- [ ] **Step 1: Add failing persistence and normalization tests**

```js
import {
  readProfile,
  writeProfile,
  recordAttempt,
  finalizeRun
} from "../game-core.mjs";

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
  for (let index = 0; index < 13; index += 1) recordAttempt(profile, { mode: "trail", outcome: index === 0 ? "timeout" : "success" });
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
  const storage = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  assert.equal(readProfile(storage).persistent, false);
  assert.equal(writeProfile(storage, createDefaultProfile()), false);
});

test("finalizing a run updates totals and bests once", () => {
  const profile = createDefaultProfile();
  finalizeRun(profile, { score: 540, bestCombo: 4, round: 3, finalLevel: 1, endedAt: "2026-08-27T12:00:00.000Z", modes: {} });
  assert.equal(profile.records.totalRuns, 1);
  assert.equal(profile.records.bestScore, 540);
  assert.equal(profile.records.bestCombo, 4);
});
```

- [ ] **Step 2: Run the focused tests and verify missing exports**

Run: `node --test --test-name-pattern="attempt|storage|finalizing" tests/game.test.mjs`
Expected: FAIL because the four persistence exports do not exist.

- [ ] **Step 3: Implement validation and record mutation**

Use the storage key `lumiMindArcade.profile.v1`. `recordAttempt` increments one attempt, increments `successes` or `errors`, increments `timeouts` only for timeout, and keeps the newest 12 outcomes. `readProfile` catches storage exceptions separately from JSON parse errors: malformed JSON still means storage is available, while a thrown `getItem` means `persistent: false`. Normalize every mode and numeric record field to finite non-negative values.

```js
export function recordAttempt(profile, { mode, outcome }) {
  const stat = profile.modes[mode];
  stat.attempts += 1;
  if (outcome === "success") stat.successes += 1;
  else {
    stat.errors += 1;
    if (outcome === "timeout") stat.timeouts += 1;
  }
  stat.recent.push(outcome);
  stat.recent = stat.recent.slice(-12);
  return profile;
}
```

- [ ] **Step 4: Connect one central attempt path in `app.js`**

Load the profile once at startup. Add current-run stats with the same six mode keys. Route every completed stage attempt through `completeChallenge({ remainingRatio })` and every first wrong/timeout event through `failChallenge({ timeout, restart })`; those functions update both current-run and persistent stats exactly once before rendering feedback.

```js
function saveAttempt(outcome) {
  recordAttempt(profile, { mode: state.mode, outcome });
  const run = state.runStats[state.mode];
  run.attempts += 1;
  outcome === "success" ? run.successes += 1 : run.errors += 1;
  if (outcome === "timeout") run.timeouts += 1;
  storagePersistent = writeProfile(localStorage, profile);
}
```

Call `saveAttempt` only when the entire generated stage attempt succeeds or its first wrong/timeout event ends it. Intermediate correct hits in focus and intermediate correct candidates in signal switch update on-screen progress but do not create profile attempts.

- [ ] **Step 5: Run all tests**

Run: `node --test tests/game.test.mjs`
Expected: all tests PASS.

- [ ] **Step 6: Verify storage failure manually**

In DevTools, temporarily override `Storage.prototype.setItem` to throw, finish one stage, and then restore it.
Expected: play continues; no duplicate heart/score event; the app marks the session non-persistent and does not claim that a record was saved.

- [ ] **Step 7: Commit persistence**

```bash
git add game-core.mjs tests/game.test.mjs app.js
git commit -m "feat: persist truthful local records"
```

### Task 3: Make the shell accurately represent six modes and retain original music routing

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`
- Modify: `tests/game.test.mjs`
- Retain: `public/assets/velvet-tide.mp3`
- Retain: `public/assets/origami-pavements.mp3`

**Interfaces:**
- Produces DOM hooks: `#music-toggle`, `#home-bgm`, `#game-bgm`, six `.mode-card[data-mode]`, six `[data-result-mode]`, `#record-summary`, `#save-status`, `#stage-announcer`, `#pause-overlay`.
- Produces app functions: `startHomeMusic()`, `startGameMusic()`, `toggleMusic()`, `playTone(kind)`, `announce(message)`.
- Consumes: `profile.records`, `profile.settings.soundEnabled`, `MODE_INFO`.

- [ ] **Step 1: Add failing static contract tests**

```js
import { existsSync, readFileSync } from "node:fs";

test("static shell advertises six modes and retains routed original music", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /6가지 두뇌 미니게임/);
  assert.equal((html.match(/class="mode-card/g) || []).length, 6);
  assert.match(html, /id="home-bgm"[^>]+velvet-tide\.mp3/);
  assert.match(html, /id="game-bgm"[^>]+origami-pavements\.mp3/);
  assert.equal(existsSync(new URL("../public/assets/velvet-tide.mp3", import.meta.url)), true);
  assert.equal(existsSync(new URL("../public/assets/origami-pavements.mp3", import.meta.url)), true);
});
```

- [ ] **Step 2: Run the static test and verify failure**

Run: `node --test --test-name-pattern="static shell" tests/game.test.mjs`
Expected: FAIL because the copy says three modes, only four cards exist, and routed audio elements are incomplete.

- [ ] **Step 3: Update semantic HTML and exact Korean copy**

Add `신호 전환` and `별길 추적` cards, six result rows, local record summary, save status, stage announcer, and a pause overlay that says `재개하면 현재 문제를 새로 시작해요.` Retain both `<audio>` elements and their existing home/game routes. Change the playfield itself from `aria-live` to a normal region; use `#stage-announcer` for polite announcements.

- [ ] **Step 4: Preserve the two original music files and routing**

Keep `velvet-tide.mp3` on home and `origami-pavements.mp3` during play, stop and reset the inactive track on every screen route, keep the music toggle and autoplay fallback, and record that the repository contains no source/license metadata for either file. Do not claim a license or add replacement music.

- [ ] **Step 5: Add procedural tones and persistent sound setting**

Create one `AudioContext` lazily after user input. `playTone("success")`, `playTone("error")`, `playTone("combo")`, and `playTone("transition")` use OscillatorNode and GainNode, last at most 250ms, and return silently if unavailable. The saved music setting controls both BGM and these short effects.

- [ ] **Step 6: Consolidate only the shell selectors being edited**

Before adding new mode styles, collapse duplicate final definitions for `.home-copy`, `.mode-row`, `.mode-card`, `.game-header`, `.result-stats`, and their 900px/560px media rules into one final declaration each. Leave unrelated selectors untouched. Render mode cards as 3 columns on desktop and 2 columns at 390px; every interactive control remains at least 44px.

- [ ] **Step 7: Run tests and browser smoke checks**

Run: `node --test tests/game.test.mjs`
Expected: all tests PASS.
Open home at 1440×900 and 390×844.
Expected: all six cards are visible, no horizontal scroll, the music toggle works after a click, home/game routes request the correct local MP3 without overlap, and console has no error.

- [ ] **Step 8: Commit the six-mode shell and retained music routing**

```bash
git add index.html styles.css app.js tests/game.test.mjs public/assets/velvet-tide.mp3 public/assets/origami-pavements.mp3
git commit -m "feat: present six modes with original music routing"
```

### Task 4: Deepen the four existing modes through the shared attempt flow

**Files:**
- Modify: `game-core.mjs`
- Modify: `tests/game.test.mjs`
- Modify: `app.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `MODE_LEVELS[mode][difficulty - 1]`, `difficultyFor(...)`, `recordAttempt(...)`, `scoreStage(...)`.
- Produces app functions: `renderFocus(config)`, `renderMemory(config)`, `renderPattern(config)`, `renderDirection(config)`, `failChallenge({ timeout, restart })`, `completeChallenge({ remainingRatio })`.
- `config` is the exact level object selected from `MODE_LEVELS`.
- Config shapes are `focus: { hits, decoys, limitMs }`, `memory: { length, revealMs, cardCount }`, `pattern: { size, limitMs, changes }`, `direction: { length, limitMs }`, `switch: { trials, candidates, limitMs }`, and `trail: { size, length, revealMs, limitMs }`. `changes` is an array containing one or more of `"shape"`, `"rotation"`, and `"color"`.

- [ ] **Step 1: Add failing table contract tests**

```js
import { MODE_LEVELS } from "../game-core.mjs";

test("six mode tables match the design endpoints", () => {
  assert.deepEqual(MODE_LEVELS.focus[0], { hits: 2, decoys: 4, limitMs: 6000 });
  assert.deepEqual(MODE_LEVELS.focus[6], { hits: 5, decoys: 12, limitMs: 3200 });
  assert.equal(MODE_LEVELS.memory[6].length, 8);
  assert.equal(MODE_LEVELS.pattern[4].size, 6);
  assert.deepEqual(MODE_LEVELS.direction[6], { length: 8, limitMs: 3300 });
  assert.deepEqual(MODE_LEVELS.switch[0], { trials: 3, candidates: 3, limitMs: 10000 });
  assert.deepEqual(MODE_LEVELS.switch[6], { trials: 6, candidates: 4, limitMs: 5500 });
  assert.deepEqual(MODE_LEVELS.trail[0], { size: 4, length: 4, revealMs: 600, limitMs: 9000 });
  assert.deepEqual(MODE_LEVELS.trail[6], { size: 5, length: 9, revealMs: 380, limitMs: 6000 });
});
```

- [ ] **Step 2: Run the table test and verify failure**

Run: `node --test --test-name-pattern="six mode tables" tests/game.test.mjs`
Expected: FAIL because `MODE_LEVELS` is not complete.

- [ ] **Step 3: Add all seven config rows from the design table**

Keep all six seven-row tables as plain frozen arrays in `game-core.mjs`. Transcribe every value from the design, including signal candidate counts `3, 3, 4, 4, 4, 4, 4`, memory card counts `6, 6, 8, 8, 8, 8, 8`, and trail grid sizes `4, 4, 4, 4, 5, 5, 5`. Do not add mode classes, factories, or a registry beyond `MODE_INFO` and `MODE_LEVELS`.

```js
export const MODE_LEVELS = Object.freeze({
  focus: [
    { hits: 2, decoys: 4, limitMs: 6000 }, { hits: 2, decoys: 6, limitMs: 5500 },
    { hits: 3, decoys: 7, limitMs: 5000 }, { hits: 3, decoys: 8, limitMs: 4500 },
    { hits: 4, decoys: 10, limitMs: 4000 }, { hits: 4, decoys: 11, limitMs: 3600 },
    { hits: 5, decoys: 12, limitMs: 3200 }
  ],
  memory: [
    { length: 4, revealMs: 720, cardCount: 6 }, { length: 5, revealMs: 650, cardCount: 6 },
    { length: 5, revealMs: 580, cardCount: 8 }, { length: 6, revealMs: 520, cardCount: 8 },
    { length: 7, revealMs: 470, cardCount: 8 }, { length: 7, revealMs: 430, cardCount: 8 },
    { length: 8, revealMs: 400, cardCount: 8 }
  ],
  pattern: [
    { size: 4, limitMs: 10000, changes: ["shape"] },
    { size: 5, limitMs: 9000, changes: ["shape", "rotation"] },
    { size: 5, limitMs: 8000, changes: ["shape", "rotation"] },
    { size: 6, limitMs: 7000, changes: ["shape", "rotation", "color"] },
    { size: 6, limitMs: 6000, changes: ["shape", "rotation", "color"] },
    { size: 7, limitMs: 5500, changes: ["shape", "rotation", "color"] },
    { size: 7, limitMs: 5000, changes: ["shape", "rotation", "color"] }
  ],
  direction: [
    { length: 4, limitMs: 7000 }, { length: 5, limitMs: 6200 },
    { length: 5, limitMs: 5500 }, { length: 6, limitMs: 4800 },
    { length: 6, limitMs: 4200 }, { length: 7, limitMs: 3700 },
    { length: 8, limitMs: 3300 }
  ],
  switch: [
    { trials: 3, candidates: 3, limitMs: 10000 }, { trials: 3, candidates: 3, limitMs: 9000 },
    { trials: 4, candidates: 4, limitMs: 8000 }, { trials: 4, candidates: 4, limitMs: 7000 },
    { trials: 5, candidates: 4, limitMs: 6500 }, { trials: 5, candidates: 4, limitMs: 6000 },
    { trials: 6, candidates: 4, limitMs: 5500 }
  ],
  trail: [
    { size: 4, length: 4, revealMs: 600, limitMs: 9000 },
    { size: 4, length: 5, revealMs: 560, limitMs: 8500 },
    { size: 4, length: 5, revealMs: 520, limitMs: 8000 },
    { size: 4, length: 6, revealMs: 480, limitMs: 7500 },
    { size: 5, length: 7, revealMs: 440, limitMs: 7000 },
    { size: 5, length: 8, revealMs: 410, limitMs: 6500 },
    { size: 5, length: 9, revealMs: 380, limitMs: 6000 }
  ]
});
```

- [ ] **Step 4: Upgrade focus and memory**

Focus requires `config.hits` successive moving targets under one timer; clamp each target by its rendered radius. Memory uses 6 cards at levels 1–2 and 8 cards above, allows repeated card values from level 3, forbids immediate repeats, and displays current input progress. Both call the shared failure/success functions once per resolved stage attempt.

- [ ] **Step 5: Upgrade pattern and direction**

Pattern creates one unmarked difference in shape, rotation, or color-plus-luminance according to difficulty and removes the current `.odd` gold/star answer leak. Direction keeps the sequence visible, uses the exact length/time config, and keeps keyboard and on-screen pad paths identical.

- [ ] **Step 6: Guard timers and duplicate input**

Increment `state.stageToken` when a stage or retry starts. Timer callbacks capture the token and return if it no longer matches. Set `state.stageLocked` before writing score, heart, or profile data.

```js
const token = ++state.stageToken;
state.roundTimer = setTimeout(() => {
  if (token !== state.stageToken || state.stageLocked || state.paused) return;
  failChallenge({ timeout: true, restart: renderCurrentMode });
}, config.limitMs);
```

- [ ] **Step 7: Run unit and runtime checks for all four modes**

Run: `node --test tests/game.test.mjs`
Expected: all tests PASS.
For each existing mode, force it through DevTools state or deterministic mode order and verify one success, one wrong input, and one timeout.
Expected: success adds one attempt/one success; wrong and timeout each remove one heart and add exactly one error; timeout also adds one timeout; combo resets only on failure.

- [ ] **Step 8: Commit existing-mode upgrades**

```bash
git add game-core.mjs tests/game.test.mjs app.js styles.css
git commit -m "feat: deepen the original four modes"
```

### Task 5: Add the original Signal Switch mode

**Files:**
- Modify: `game-core.mjs`
- Modify: `tests/game.test.mjs`
- Modify: `app.js`
- Modify: `styles.css`

**Interfaces:**
- Produces: `createSignalTrial({ level, previousRules, rng }) -> { rule, reference, candidates, answerId }`, `isSignalAnswerCorrect(trial, candidateId) -> boolean`, `renderSwitch(config)`.
- A token is `{ color: "cyan" | "violet" | "coral", shape: "circle" | "diamond" | "triangle" }`.
- A candidate is a token plus unique string `id`; exactly one candidate matches the active rule.

- [ ] **Step 1: Add failing rule-conflict tests**

```js
import { createSignalTrial, isSignalAnswerCorrect } from "../game-core.mjs";

test("signal trial follows the displayed rule in a conflict set", () => {
  const trial = createSignalTrial({ level: 3, previousRules: ["shape", "shape"], rng: fixedRng(0, 0.2, 0.4, 0.6, 0.8) });
  assert.equal(trial.rule, "color");
  assert.equal(trial.candidates.length, 4);
  assert.equal(trial.candidates.filter((candidate) => candidate.color === trial.reference.color).length, 1);
  assert.equal(isSignalAnswerCorrect(trial, trial.answerId), true);
  assert.equal(isSignalAnswerCorrect(trial, "missing"), false);
});
```

- [ ] **Step 2: Run the signal test and verify missing exports**

Run: `node --test --test-name-pattern="signal trial" tests/game.test.mjs`
Expected: FAIL because signal trial functions do not exist.

- [ ] **Step 3: Implement deterministic trial generation**

At levels 1–2 use 3 candidates; at level 3+ use 4. Include a color-only match and a shape-only match from level 2. If the previous two rules match, force the other rule. Candidate order uses the provided RNG.

- [ ] **Step 4: Render the full stage**

Show `색 맞추기` or `모양 맞추기` as persistent text and icon, a reference token, candidates, problem progress, and the design’s total stage timer. On rule change, show the rule banner for 500ms before enabling candidates. Touch, Tab, Enter, and Space use the same click handler.

- [ ] **Step 5: Verify conflicts, switching, and failure paths**

Run: `node --test tests/game.test.mjs`
Expected: all tests PASS.
In the browser, complete a conflict trial by choosing the active-rule match, then choose the inactive-rule match on the next trial, then let one stage time out.
Expected: only the active-rule answer succeeds; wrong and timeout cost one heart each; current rule is always visible as text.

- [ ] **Step 6: Commit Signal Switch**

```bash
git add game-core.mjs tests/game.test.mjs app.js styles.css
git commit -m "feat: add signal switch mode"
```

### Task 6: Add the original Star Trail mode

**Files:**
- Modify: `game-core.mjs`
- Modify: `tests/game.test.mjs`
- Modify: `app.js`
- Modify: `styles.css`

**Interfaces:**
- Produces: `createStarPath({ size, length, rng }) -> number[]`, `isStarStepCorrect(path, inputIndex, cellIndex) -> boolean`, `renderTrail(config)`.
- Cell indexes are row-major integers from `0` through `size * size - 1`.
- Every consecutive path pair has Manhattan distance 1 and a path never repeats a cell.

- [ ] **Step 1: Add failing path validity tests**

```js
import { createStarPath, isStarStepCorrect } from "../game-core.mjs";

test("star path is adjacent, unique, and exactly the requested length", () => {
  const size = 5;
  const path = createStarPath({ size, length: 9, rng: fixedRng(0.1, 0.8, 0.3, 0.6) });
  assert.equal(path.length, 9);
  assert.equal(new Set(path).size, 9);
  for (let index = 1; index < path.length; index += 1) {
    const a = [Math.floor(path[index - 1] / size), path[index - 1] % size];
    const b = [Math.floor(path[index] / size), path[index] % size];
    assert.equal(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 1);
  }
  assert.equal(isStarStepCorrect(path, 0, path[0]), true);
});
```

- [ ] **Step 2: Run the path test and verify missing exports**

Run: `node --test --test-name-pattern="star path" tests/game.test.mjs`
Expected: FAIL because star path functions do not exist.

- [ ] **Step 3: Implement bounded path generation**

Build the path by choosing from unvisited orthogonal neighbors. If the walk reaches a dead end before the requested length, restart from a new start cell, capped at 100 attempts. The required maximum length is 9 on a 5×5 grid, so a deterministic row-snake fallback can always return a valid prefix after the cap.

- [ ] **Step 4: Render reveal, retrace, and roving focus**

Reveal numbered stars at the design’s interval, clear them, start the input timer, and show only the correctly retraced prefix. Use one tab stop in the grid, arrow keys to move focus without wrapping, and Enter/Space to select. Announce the starting row/column and subsequent movement directions through `#stage-announcer`.

- [ ] **Step 5: Verify touch, keyboard, reduced motion, and error paths**

Run: `node --test tests/game.test.mjs`
Expected: all tests PASS.
At 390×844, complete one path with touch. Repeat with keyboard only. Emulate `prefers-reduced-motion: reduce` and repeat. Enter one wrong cell and allow one timeout.
Expected: grid stays inside the playfield; focus remains visible; reveal remains understandable without movement animation; each failure costs exactly one heart.

- [ ] **Step 6: Commit Star Trail**

```bash
git add game-core.mjs tests/game.test.mjs app.js styles.css
git commit -m "feat: add star trail mode"
```

### Task 7: Finish adaptive rounds, truthful results, and game feel

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `tests/game.test.mjs`

**Interfaces:**
- Consumes: `createCoveragePlan`, `selectAdaptiveRound`, `difficultyFor`, `scoreStage`, `finalizeRun`, `writeProfile`.
- Produces: `beginRound()`, `beginStage()`, `showResults()`, `togglePause()` with the behavior fixed by the design.
- Result accuracy is `Math.round(successes / attempts * 100)` or `null` when attempts is 0.

- [ ] **Step 1: Add a failing source contract for removal of fake metrics**

```js
test("result code contains no random cognitive metric", () => {
  const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /50\s*\+\s*state\.stats/);
  assert.doesNotMatch(source, /Math\.random\(\).*result/i);
});
```

- [ ] **Step 2: Run the result contract and verify failure**

Run: `node --test --test-name-pattern="random cognitive" tests/game.test.mjs`
Expected: FAIL against the current random result calculation.

- [ ] **Step 3: Wire round planning and adapted configs**

At `startGame`, create one coverage plan. `beginRound` slices it for rounds 1–2 and calls `selectAdaptiveRound` from round 3 onward. `beginStage` derives the current config from `difficultyFor` and `MODE_LEVELS`. The stage tracker uses `MODE_INFO` for all six labels.

- [ ] **Step 4: Replace result metrics and finalize records once**

Remove the random `average` calculation. Build six accuracy/error rows from `state.runStats`, choose the attempted mode with greatest `weaknessFor(profile.modes[mode])`, call `finalizeRun` once behind a `state.runFinalized` guard, then call `writeProfile`. Show distinct current score/combo and local best score/combo labels. Use `—` for unplayed modes.

- [ ] **Step 5: Add compact in-place feedback and direct stage transitions**

Add score increment text, combo milestone text at 3/5/10, selected-element error state, and success brightness response. Do not add a stage-title overlay, splash, separate mode-name announcement, or input delay; `beginStage()` renders the next board immediately and updates the existing HUD in place. Screen-level transitions use opacity plus at most 8px movement for 220ms. Reduced motion removes movement, scaling, repeated floating, urgent blinking, and shake while preserving text and border changes.

- [ ] **Step 6: Make pause and navigation deterministic**

Pause clears current timers, increments `stageToken`, blocks input, and opens `#pause-overlay`. Resume closes it and renders a fresh problem in the same mode without changing hearts, score, combo, or attempt stats. Home/retry/result clear all timers and pending tone nodes. A mid-run home exit does not call `finalizeRun`.

- [ ] **Step 7: Verify the full loop and persistence truth**

Run: `node --test tests/game.test.mjs`
Expected: all tests PASS.
Play through rounds 1 and 2.
Expected: all six modes appear exactly once.
Seed focus with four recent failures, start at round 3, and inspect the selected plan/config.
Expected: focus is included and uses one lower level.
Finish a run, note score/combo/accuracy, reload, and inspect home/results.
Expected: displayed local records and saved JSON match the observed events exactly; totalRuns increments once.

- [ ] **Step 8: Commit final gameplay integration**

```bash
git add app.js index.html styles.css tests/game.test.mjs
git commit -m "feat: adapt rounds and report truthful results"
```

### Task 8: Accessibility, responsive, documentation, and license regression

**Files:**
- Modify: `styles.css`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `GAME_SPEC.md`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: final DOM hooks and behavior from Tasks 1–7.
- Produces: deploy-ready static files and a recorded QA result.

- [ ] **Step 1: Run the automated regression suite before final polish**

Run: `node --test tests/game.test.mjs`
Expected: all tests PASS with no skipped test.

- [ ] **Step 2: Complete the 1440×900 desktop matrix**

Serve with `python3 -m http.server 4173`. At 1440×900, use mouse to trigger success, wrong input, timeout, pause/resume, round change, final result, retry, share fallback, and home return across all six modes.
Expected: no overlap or clipped controls; every state has text feedback; score/heart/combo change once per event; console has 0 errors; Network has 0 failed requests.

- [ ] **Step 3: Complete the 390×844 mobile matrix**

Emulate 390×844 with touch. Complete all six modes and results, including signal candidates and a 5×5 trail. Inspect `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
Expected: expression is true; all primary controls are at least 44×44; no key instruction, timer, heart, or result action is cut off.

- [ ] **Step 4: Complete keyboard and motion matrices**

Reload and use only Tab, Shift+Tab, Enter, Space, arrow keys, `p`, and Escape. Complete one stage in every mode, including direction and trail. Then emulate `prefers-reduced-motion: reduce` and repeat a success, failure, stage transition, and result transition.
Expected: visible focus never disappears; no keyboard trap; direction and trail work; reduced motion has no repeated float, shake, scale pulse, or urgent blink.

- [ ] **Step 5: Audit storage and asset licensing**

Run:

```bash
rg -n -i 'velvet|origami|\.mp3|<audio|https?://' index.html app.js styles.css public
find public/assets -maxdepth 1 -type f -print | sort
```

Expected: only the two retained local MP3 routes and project PNG files appear; no remote asset reference exists. Record that the MP3 provenance is not documented rather than claiming a license. If a new third-party file appears, stop and add its exact notice before continuing.

- [ ] **Step 6: Update user and game documentation to the shipped behavior**

Update README and GAME_SPEC with six modes, first-two-round coverage, later adaptive selection, local-only records, actual score formula, retained home/game BGM routing, procedural effects, direct stage transitions, accessibility controls, and static serving. Remove every statement that says three or four total modes, random cognitive scores, no background music, a stage-title interstitial, or guaranteed permanent saving.

- [ ] **Step 7: Record reproducible QA evidence**

Append a dated section to `design-qa.md` listing tested desktop/mobile viewports, six success paths, wrong/timeout paths, keyboard trail/direction, reduced motion, storage success/failure, console/network result, and license audit result. Record observed results rather than planned claims.

- [ ] **Step 8: Scan documentation for gaps and contradictory copy**

Run:

```bash
rg -n '3가지|4개 모드|저장 완료|인지 점수|T[B]D|T[O]DO|implement l[a]ter|fill i[n] details' README.md GAME_SPEC.md design-qa.md index.html docs/superpowers
```

Expected: no stale mode counts, unconditional save-success claim, fake metric description, or incomplete marker. Any `저장 완료` occurrence must be conditional on confirmed `writeProfile` success.

- [ ] **Step 9: Run final regression and inspect the diff**

Run:

```bash
node --test tests/game.test.mjs
git diff --check
git status --short
```

Expected: tests PASS, `git diff --check` has no output, status contains only the planned files, no dependency or new third-party asset was added, and the two existing MP3 files remain tracked with the provenance caveat documented.

- [ ] **Step 10: Commit documentation and final QA**

```bash
git add README.md GAME_SPEC.md design-qa.md index.html styles.css
git commit -m "docs: document expanded arcade and QA"
```
