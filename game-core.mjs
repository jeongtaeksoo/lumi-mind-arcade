export const MODE_IDS = Object.freeze(["focus", "memory", "pattern", "direction", "switch", "trail"]);

export const MODE_INFO = Object.freeze({
  focus: { label: "집중 모드", short: "집중", base: 100 },
  memory: { label: "기억 모드", short: "기억", base: 120 },
  pattern: { label: "패턴 모드", short: "패턴", base: 110 },
  direction: { label: "방향 모드", short: "방향", base: 110 },
  switch: { label: "신호 전환", short: "전환", base: 130 },
  trail: { label: "별길 추적", short: "별길", base: 130 }
});

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

export const PROFILE_KEY = "lumiMindArcade.profile.v1";

const emptyModeStat = () => ({ attempts: 0, successes: 0, errors: 0, timeouts: 0, recent: [] });

export function createDefaultProfile() {
  return {
    version: 1,
    records: { bestScore: 0, bestCombo: 0, totalRuns: 0, lastRun: null },
    modes: Object.fromEntries(MODE_IDS.map((mode) => [mode, emptyModeStat()])),
    settings: { soundEnabled: true }
  };
}

export function createCoveragePlan(rng = Math.random) {
  const plan = [...MODE_IDS];
  for (let index = plan.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [plan[index], plan[swapIndex]] = [plan[swapIndex], plan[index]];
  }
  return plan;
}

export function weaknessFor(stat) {
  const failures = stat.recent.filter((value) => value !== "success").length;
  return (failures + 1) / (stat.recent.length + 2);
}

function weightedPick(entries, rng) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let target = rng() * total;
  for (const entry of entries) {
    target -= entry.weight;
    if (target <= 0) return entry.mode;
  }
  return entries.at(-1).mode;
}

export function selectAdaptiveRound(profile, rng = Math.random) {
  const ranked = MODE_IDS.map((mode) => ({ mode, weakness: weaknessFor(profile.modes[mode]), tie: rng() }))
    .sort((a, b) => b.weakness - a.weakness || a.tie - b.tie);
  const selected = [ranked[0].mode];
  while (selected.length < 3) {
    const candidates = MODE_IDS
      .filter((mode) => !selected.includes(mode))
      .map((mode) => ({ mode, weight: 1 + 2 * weaknessFor(profile.modes[mode]) }));
    selected.push(weightedPick(candidates, rng));
  }
  return selected;
}

export function difficultyFor({ mode, round, finalLevel, profile }) {
  const base = round < 5 ? round : Math.min(7, 5 + Math.floor((finalLevel - 1) / 2));
  if (round < 3) return base;
  const recent = profile.modes[mode].recent;
  const successes = recent.filter((value) => value === "success").length;
  const accuracy = recent.length ? successes / recent.length : 0;
  const adjusted = recent.length >= 4 && accuracy < 0.6
    ? base - 1
    : recent.length >= 8 && accuracy >= 0.85
      ? base + 1
      : base;
  return Math.max(1, Math.min(7, adjusted));
}

export function scoreStage({ base, difficulty, remainingRatio, comboBefore }) {
  const speedBonus = Math.round(Math.max(0, Math.min(1, remainingRatio)) * 40);
  return base + difficulty * 10 + speedBonus + Math.min(Math.max(0, comboBefore), 10) * 10;
}

export function accuracyFor(stat) {
  if (!stat.attempts) return null;
  return Math.round(stat.successes / stat.attempts * 100);
}

export function canPauseStage({ gameActive, stageLocked }) {
  return gameActive && !stageLocked;
}

export function canCommitHomeMusicRequest({ requestId, currentRequestId, soundEnabled, homeActive, paused }) {
  return requestId === currentRequestId && soundEnabled && homeActive && !paused;
}

const PATTERN_SHAPES = ["diamond", "circle", "triangle"];

export function createPatternTrial({ count, changes, rng = Math.random }) {
  const oddIndex = Math.floor(rng() * count);
  const change = changes[Math.floor(rng() * changes.length)];
  const baseShapes = change === "rotation" ? ["diamond", "triangle"] : PATTERN_SHAPES;
  const baseShape = baseShapes[Math.floor(rng() * baseShapes.length)];
  const otherShapes = PATTERN_SHAPES.filter((shape) => shape !== baseShape);
  const otherShape = otherShapes[Math.floor(rng() * otherShapes.length)];
  return { oddIndex, change, baseShape, otherShape };
}

export function patternTileLabel({ index, tone, shape, rotation }) {
  const toneLabel = tone === "cyan" ? "청록" : "보라";
  const shapeLabel = shape === "circle" ? "원" : shape === "triangle" ? "삼각형" : "마름모";
  const rotationLabel = rotation === "tilted" ? "기울어진" : "반듯한";
  return `${index + 1}번 ${toneLabel} ${rotationLabel} ${shapeLabel} 타일`;
}

const SIGNAL_COLORS = ["cyan", "violet", "coral"];
const SIGNAL_SHAPES = ["circle", "diamond", "triangle"];

function shuffled(values, rng) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createSignalTrial({ level, previousRules = [], rng = Math.random }) {
  const reference = {
    color: SIGNAL_COLORS[Math.floor(rng() * SIGNAL_COLORS.length)],
    shape: SIGNAL_SHAPES[Math.floor(rng() * SIGNAL_SHAPES.length)]
  };
  const lastTwo = previousRules.slice(-2);
  const rule = level === 1 && previousRules.length % 2 === 1
    ? previousRules.at(-1)
    : lastTwo.length === 2 && lastTwo[0] === lastTwo[1]
      ? (lastTwo[0] === "color" ? "shape" : "color")
      : (rng() < 0.5 ? "color" : "shape");
  const otherColors = SIGNAL_COLORS.filter((color) => color !== reference.color);
  const otherShapes = SIGNAL_SHAPES.filter((shape) => shape !== reference.shape);
  const correct = rule === "color"
    ? { id: "answer", color: reference.color, shape: otherShapes[0] }
    : { id: "answer", color: otherColors[0], shape: reference.shape };
  const candidates = [correct];
  if (level >= 2) {
    candidates.push(rule === "color"
      ? { id: "conflict", color: otherColors[0], shape: reference.shape }
      : { id: "conflict", color: reference.color, shape: otherShapes[0] });
  }
  const fillers = [];
  otherColors.forEach((color) => otherShapes.forEach((shape) => fillers.push({ color, shape })));
  for (const token of fillers) {
    if (candidates.length >= MODE_LEVELS.switch[Math.max(0, Math.min(6, level - 1))].candidates) break;
    if (!candidates.some((candidate) => candidate.color === token.color && candidate.shape === token.shape)) {
      candidates.push({ id: `distractor-${candidates.length}`, ...token });
    }
  }
  if (level < 2 && candidates.length < 3) {
    const conflict = rule === "color"
      ? { id: "distractor-conflict", color: otherColors[0], shape: reference.shape }
      : { id: "distractor-conflict", color: reference.color, shape: otherShapes[0] };
    candidates.push(conflict);
  }
  return { rule, reference, candidates: shuffled(candidates, rng), answerId: correct.id };
}

export function isSignalAnswerCorrect(trial, candidateId) {
  return candidateId === trial.answerId;
}

function starNeighbors(cell, size) {
  const row = Math.floor(cell / size);
  const column = cell % size;
  const neighbors = [];
  if (row > 0) neighbors.push(cell - size);
  if (row < size - 1) neighbors.push(cell + size);
  if (column > 0) neighbors.push(cell - 1);
  if (column < size - 1) neighbors.push(cell + 1);
  return neighbors;
}

export function createStarPath({ size, length, rng = Math.random }) {
  if (!Number.isInteger(size) || !Number.isInteger(length) || size < 2 || length < 1 || length > size * size) {
    throw new RangeError("Invalid star path dimensions");
  }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const path = [Math.floor(rng() * size * size)];
    while (path.length < length) {
      const next = shuffled(starNeighbors(path.at(-1), size).filter((cell) => !path.includes(cell)), rng)[0];
      if (next === undefined) break;
      path.push(next);
    }
    if (path.length === length) return path;
  }
  const snake = [];
  for (let row = 0; row < size; row += 1) {
    const columns = Array.from({ length: size }, (_, column) => row % 2 === 0 ? column : size - column - 1);
    columns.forEach((column) => snake.push(row * size + column));
  }
  return snake.slice(0, length);
}

export function isStarStepCorrect(path, inputIndex, cellIndex) {
  return path[inputIndex] === cellIndex;
}

const count = (value) => Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

function normalizeModeStat(value = {}) {
  const successes = count(value.successes);
  const errors = count(value.errors);
  const recent = Array.isArray(value.recent)
    ? value.recent.filter((item) => ["success", "error", "timeout"].includes(item)).slice(-12)
    : [];
  return {
    attempts: successes + errors,
    successes,
    errors,
    timeouts: Math.min(errors, count(value.timeouts)),
    recent
  };
}

function normalizeLastRun(value) {
  if (!value || typeof value !== "object") return null;
  return {
    score: count(value.score),
    bestCombo: count(value.bestCombo),
    round: Math.max(1, count(value.round)),
    finalLevel: Math.max(1, count(value.finalLevel)),
    endedAt: typeof value.endedAt === "string" ? value.endedAt : "",
    modes: Object.fromEntries(MODE_IDS.map((mode) => [mode, normalizeModeStat(value.modes?.[mode])]))
  };
}

export function normalizeProfile(value) {
  if (!value || typeof value !== "object" || value.version !== 1) return createDefaultProfile();
  return {
    version: 1,
    records: {
      bestScore: count(value.records?.bestScore),
      bestCombo: count(value.records?.bestCombo),
      totalRuns: count(value.records?.totalRuns),
      lastRun: normalizeLastRun(value.records?.lastRun)
    },
    modes: Object.fromEntries(MODE_IDS.map((mode) => [mode, normalizeModeStat(value.modes?.[mode])])),
    settings: { soundEnabled: value.settings?.soundEnabled !== false }
  };
}

export function readProfile(storage) {
  try {
    const raw = storage.getItem(PROFILE_KEY);
    if (!raw) return { profile: createDefaultProfile(), persistent: true };
    try {
      return { profile: normalizeProfile(JSON.parse(raw)), persistent: true };
    } catch {
      return { profile: createDefaultProfile(), persistent: true };
    }
  } catch {
    return { profile: createDefaultProfile(), persistent: false };
  }
}

export function writeProfile(storage, profile) {
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(normalizeProfile(profile)));
    return true;
  } catch {
    return false;
  }
}

export function recordAttempt(profile, { mode, outcome }) {
  if (!MODE_IDS.includes(mode) || !["success", "error", "timeout"].includes(outcome)) {
    throw new TypeError("Invalid attempt");
  }
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

export function finalizeRun(profile, summary) {
  const run = normalizeLastRun(summary);
  profile.records.totalRuns += 1;
  profile.records.bestScore = Math.max(profile.records.bestScore, run.score);
  profile.records.bestCombo = Math.max(profile.records.bestCombo, run.bestCombo);
  profile.records.lastRun = run;
  return profile;
}
