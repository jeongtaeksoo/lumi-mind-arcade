export const MODE_IDS = Object.freeze(["focus", "memory", "pattern", "direction", "switch", "trail"]);

export const MODE_INFO = Object.freeze({
  focus: { label: "집중 모드", short: "집중", base: 100 },
  memory: { label: "기억 모드", short: "기억", base: 120 },
  pattern: { label: "패턴 모드", short: "패턴", base: 110 },
  direction: { label: "방향 모드", short: "방향", base: 110 },
  switch: { label: "신호 전환", short: "전환", base: 130 },
  trail: { label: "별길 추적", short: "별길", base: 130 }
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
