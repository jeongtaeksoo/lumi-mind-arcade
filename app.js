import {
  MODE_IDS,
  MODE_INFO,
  MODE_LEVELS,
  accuracyFor,
  createCoveragePlan,
  createDefaultProfile,
  createSignalTrial,
  createStarPath,
  difficultyFor,
  finalizeRun,
  isSignalAnswerCorrect,
  isStarStepCorrect,
  readProfile,
  recordAttempt,
  scoreStage,
  selectAdaptiveRound,
  weaknessFor,
  writeProfile
} from "./game-core.mjs";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const screens = { home: $("#home-screen"), game: $("#game-screen"), result: $("#result-screen") };
const ui = {
  start: $("#start-button"), retry: $("#retry-button"), home: $("#home-button"), resultHome: $("#result-home-button"),
  pause: $("#pause-button"), resume: $("#resume-button"), pauseOverlay: $("#pause-overlay"),
  howTo: $("#how-to-button"), dialogStart: $("#dialog-start-button"), dialog: $("#how-to-dialog"), closeDialog: $("#close-how-to"),
  music: $("#music-toggle"), homeMusic: $("#home-bgm"), gameMusic: $("#game-bgm"), homeLumi: $("#home-lumi"), modeCards: $$(".mode-card"),
  recordSummary: $("#record-summary"), homeBestScore: $("#home-best-score"), homeBestCombo: $("#home-best-combo"), homeTotalRuns: $("#home-total-runs"),
  gameHeader: $(".game-header"), gameLayout: $(".game-layout"), playfield: $("#playfield"), round: $("#round-label"), stage: $("#stage-label"),
  title: $("#game-status-title"), score: $("#score-label"), combo: $("#combo-label"), hearts: $("#hearts"),
  instruction: $("#instruction-label"), difficulty: $("#difficulty-label"), attemptProgress: $("#attempt-progress"), hint: $("#hint-text"),
  timerPanel: $("#timer-panel"), timerTitle: $("#timer-title"), timerLabel: $("#timer-label"), timerBar: $("#timer-bar"), timerWarning: $("#timer-warning"),
  progress: $("#progress-bar"), progressLabel: $("#round-progress-label"), stageSteps: $$("[data-stage-step]"),
  gameLumi: $("#game-lumi"), speechTitle: $("#speech-title"), speechText: $("#speech-text"), partnerModes: $$("[data-partner-mode]"), meter: $("#round-meter-fill"),
  resultScore: $("#result-score"), resultCombo: $("#result-combo"), resultRound: $("#result-round"), resultBestScore: $("#result-best-score"), resultBestCombo: $("#result-best-combo"),
  resultRows: Object.fromEntries($$("[data-result-mode]").map((row) => [row.dataset.resultMode, row])),
  resultRecommendation: $("#result-recommendation"), saveStatus: $("#save-status"), share: $("#share-button"),
  toast: $("#toast"), announcer: $("#stage-announcer")
};

const MODE_UI = {
  focus: { title: "별빛 포착", instruction: "빛나는 목표를 연속으로 찾으세요", hint: "방해 도형 사이에서 움직이는 별빛을 따라가요.", intro: "목표가 움직일 때마다 다시 찾아요.", lumi: 2 },
  memory: { title: "빛 순서", instruction: "반짝인 카드 순서를 재현하세요", hint: "같은 카드가 다시 등장할 수도 있어요.", intro: "빛이 모두 꺼진 뒤 순서대로 눌러요.", lumi: 1 },
  pattern: { title: "균열 탐색", instruction: "규칙이 다른 타일 하나를 찾으세요", hint: "모양, 회전, 명도 차이를 차분히 살펴봐요.", intro: "답을 미리 강조하지 않아요. 관찰이 열쇠예요.", lumi: 3 },
  direction: { title: "궤도 입력", instruction: "보이는 방향을 순서대로 입력하세요", hint: "키보드 방향키나 화면 패드를 사용할 수 있어요.", intro: "현재 표시된 화살표부터 빠르게 입력해요.", lumi: 4 },
  switch: { title: "신호 전환", instruction: "지금 표시된 규칙에 맞는 신호를 고르세요", hint: "색 맞추기와 모양 맞추기가 바뀌어요.", intro: "규칙 문구를 먼저 읽고 후보를 골라요.", lumi: 2 },
  trail: { title: "별길 추적", instruction: "잠깐 빛난 별길을 시작부터 따라가세요", hint: "터치하거나 방향키로 이동한 뒤 선택해요.", intro: "상하좌우로 이어진 길을 기억해요.", lumi: 1 }
};

const DIRECTION_INFO = {
  ArrowUp: { symbol: "↑", label: "위" }, ArrowDown: { symbol: "↓", label: "아래" },
  ArrowLeft: { symbol: "←", label: "왼쪽" }, ArrowRight: { symbol: "→", label: "오른쪽" }
};
const MEMORY_SYMBOLS = ["◆", "●", "✦", "■", "✧", "▲", "◇", "○"];

const newRunStats = () => Object.fromEntries(MODE_IDS.map((mode) => [mode, { attempts: 0, successes: 0, errors: 0, timeouts: 0, recent: [] }]));
const unavailableStorage = { getItem() { throw new Error("unavailable"); }, setItem() { throw new Error("unavailable"); } };
let storage = unavailableStorage;
try { storage = window.localStorage; } catch { /* Continue in memory. */ }
let { profile, persistent: storagePersistent } = readProfile(storage);

const state = {
  round: 1, finalLevel: 1, stageIndex: 0, roundPlan: [], coveragePlan: [], mode: "focus", difficulty: 1, config: MODE_LEVELS.focus[0],
  hearts: 5, score: 0, combo: 0, bestCombo: 0, paused: false, stageLocked: false, stageToken: 0, runFinalized: false,
  remainingRatio: 0, runStats: newRunStats(), directionSequence: [], directionIndex: 0
};

const timeoutIds = new Set();
let timerInterval = null;
let toastTimer = null;
let audioContext = null;
const activeOscillators = new Set();

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => {
    screen.classList.toggle("active", key === name);
    screen.setAttribute("aria-hidden", String(key !== name));
  });
  window.scrollTo(0, 0);
}

function announce(message) {
  ui.announcer.textContent = "";
  requestAnimationFrame(() => { ui.announcer.textContent = message; });
}

function showToast(message) {
  clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add("visible");
  toastTimer = setTimeout(() => ui.toast.classList.remove("visible"), 2200);
}

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function randomItem(values) { return values[Math.floor(Math.random() * values.length)]; }
function formatScore(value) { return String(Math.max(0, value)).padStart(4, "0"); }
function setSpeech(title, text) { ui.speechTitle.textContent = title; ui.speechText.textContent = text; }

function setLumi(element, index) {
  element.className = element.className.replace(/state-\d/g, "").trim();
  element.classList.add(`state-${index}`);
}

function reactLumi(kind) {
  ui.gameLumi.classList.remove("react-success", "react-error");
  void ui.gameLumi.offsetWidth;
  ui.gameLumi.classList.add(`react-${kind}`);
  later(() => ui.gameLumi.classList.remove(`react-${kind}`), kind === "success" ? 420 : 320, false);
}

function setMusicUi(isPlaying) {
  ui.music.setAttribute("aria-pressed", String(isPlaying));
  ui.music.setAttribute("aria-label", isPlaying ? "배경음악 끄기" : "배경음악 켜기");
  ui.music.textContent = isPlaying ? "♫ 음악 끄기" : "♫ 음악 켜기";
}

function getAudioContext() {
  if (!profile.settings.soundEnabled) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function playTone(kind) {
  const context = getAudioContext();
  if (!context) return;
  const tones = {
    tap: [520, 0.05, "sine"], transition: [420, 0.09, "sine"], success: [720, 0.16, "triangle"],
    error: [190, 0.18, "sawtooth"], combo: [920, 0.2, "triangle"]
  };
  const [frequency, duration, type] = tones[kind] || tones.tap;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  if (kind === "success" || kind === "combo") oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.25, context.currentTime + duration);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.11, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination);
  activeOscillators.add(oscillator);
  oscillator.onended = () => activeOscillators.delete(oscillator);
  oscillator.start();
  oscillator.stop(context.currentTime + Math.min(0.25, duration));
}

function stopTones() {
  activeOscillators.forEach((oscillator) => { try { oscillator.stop(); } catch { /* Already stopped. */ } });
  activeOscillators.clear();
}

function startHomeMusic() {
  if (!profile.settings.soundEnabled) return;
  ui.homeMusic.volume = 0.28;
  const request = ui.homeMusic.play();
  if (request && typeof request.then === "function") request.then(() => setMusicUi(true)).catch(() => setMusicUi(false));
}

function startGameMusic() {
  if (!profile.settings.soundEnabled) return;
  ui.gameMusic.volume = 0.24;
  const request = ui.gameMusic.play();
  if (request && typeof request.then === "function") request.catch(() => {});
}

function stopMusic(audio) {
  audio.pause();
  audio.currentTime = 0;
}

function toggleMusic() {
  if (ui.homeMusic.paused) {
    profile.settings.soundEnabled = true;
    storagePersistent = writeProfile(storage, profile);
    startHomeMusic();
    playTone("transition");
    return;
  }
  profile.settings.soundEnabled = false;
  storagePersistent = writeProfile(storage, profile);
  ui.homeMusic.pause();
  ui.gameMusic.pause();
  stopTones();
  setMusicUi(false);
}

function clearStageTimers() {
  timeoutIds.forEach((id) => clearTimeout(id));
  timeoutIds.clear();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function later(callback, delay, guardStage = true) {
  const token = state.stageToken;
  const id = setTimeout(() => {
    timeoutIds.delete(id);
    if (!guardStage || (token === state.stageToken && !state.paused)) callback();
  }, delay);
  timeoutIds.add(id);
  return id;
}

function hideTimer() {
  ui.timerPanel.classList.add("is-hidden");
  ui.timerPanel.classList.remove("urgent");
  ui.timerWarning.textContent = "";
  ui.timerBar.style.transform = "scaleX(1)";
  state.remainingRatio = 0;
}

function startTimer(duration, title, onTimeout) {
  ui.timerPanel.classList.remove("is-hidden", "urgent");
  ui.timerTitle.textContent = title;
  const startedAt = performance.now();
  const token = state.stageToken;
  const tick = () => {
    if (token !== state.stageToken || state.paused) return;
    const remaining = Math.max(0, duration - (performance.now() - startedAt));
    state.remainingRatio = remaining / duration;
    ui.timerLabel.textContent = `${(remaining / 1000).toFixed(1)}초`;
    ui.timerBar.style.transform = `scaleX(${state.remainingRatio})`;
    const urgent = state.remainingRatio <= 0.3;
    ui.timerPanel.classList.toggle("urgent", urgent);
    ui.timerWarning.textContent = urgent ? "시간이 얼마 남지 않았어요" : "";
  };
  tick();
  timerInterval = setInterval(tick, 50);
  later(onTimeout, duration);
}

function updateHomeRecords() {
  const records = profile.records;
  ui.recordSummary.classList.toggle("is-hidden", records.totalRuns === 0);
  ui.homeBestScore.textContent = records.bestScore;
  ui.homeBestCombo.textContent = `x${records.bestCombo}`;
  ui.homeTotalRuns.textContent = records.totalRuns;
}

function renderHearts(damaged = -1) {
  ui.hearts.innerHTML = Array.from({ length: 5 }, (_, index) => `<span class="heart ${index >= state.hearts ? "lost" : ""} ${index === damaged ? "damage" : ""}" aria-hidden="true">${index >= state.hearts ? "♡" : "♥"}</span>`).join("");
  ui.hearts.setAttribute("aria-label", `남은 하트 ${state.hearts}개`);
}

function setAttemptProgress(current, total) { ui.attemptProgress.textContent = `${current} / ${total}`; }

function updateRoundProgress(completed = state.stageIndex) {
  const percentage = Math.round(completed / 3 * 100);
  ui.progress.style.width = `${percentage}%`;
  ui.progressLabel.textContent = `${percentage}%`;
  const overall = Math.min(100, (((state.round - 1) * 3 + completed) / 15) * 100);
  ui.meter.style.width = `${overall}%`;
}

function renderStageTracker() {
  ui.stageSteps.forEach((step, index) => {
    step.querySelector("span").textContent = state.roundPlan[index] ? MODE_INFO[state.roundPlan[index]].short : "대기";
    step.classList.toggle("active", index === state.stageIndex);
    step.classList.toggle("complete", index < state.stageIndex);
    step.setAttribute("aria-current", index === state.stageIndex ? "step" : "false");
  });
}

function updatePartnerModes() {
  const weakest = [...MODE_IDS].sort((a, b) => weaknessFor(profile.modes[b]) - weaknessFor(profile.modes[a]))[0];
  ui.partnerModes.forEach((item) => {
    item.classList.toggle("current", item.dataset.partnerMode === state.mode);
    item.classList.toggle("weak", item.dataset.partnerMode === weakest && profile.modes[weakest].recent.length >= 4);
  });
}

function resetState() {
  clearStageTimers();
  stopTones();
  Object.assign(state, {
    round: 1, finalLevel: 1, stageIndex: 0, roundPlan: [], coveragePlan: createCoveragePlan(), mode: "focus", difficulty: 1,
    config: MODE_LEVELS.focus[0], hearts: 5, score: 0, combo: 0, bestCombo: 0, paused: false, stageLocked: false,
    stageToken: state.stageToken + 1, runFinalized: false, remainingRatio: 0, runStats: newRunStats(), directionSequence: [], directionIndex: 0
  });
  ui.score.textContent = formatScore(0);
  ui.combo.textContent = "x0";
  renderHearts();
}

function startGame() {
  getAudioContext();
  resetState();
  stopMusic(ui.homeMusic);
  startGameMusic();
  showScreen("game");
  beginRound();
}

function beginRound() {
  state.stageIndex = 0;
  state.roundPlan = state.round <= 2
    ? state.coveragePlan.slice((state.round - 1) * 3, state.round * 3)
    : selectAdaptiveRound(profile);
  beginStage();
}

function beginStage() {
  clearStageTimers();
  hideTimer();
  state.stageToken += 1;
  state.stageLocked = true;
  state.paused = false;
  state.mode = state.roundPlan[state.stageIndex];
  state.difficulty = difficultyFor({ mode: state.mode, round: state.round, finalLevel: state.finalLevel, profile });
  state.config = MODE_LEVELS[state.mode][state.difficulty - 1];
  const mode = MODE_UI[state.mode];
  ui.round.textContent = state.round < 5 ? `${state.round} / 5` : `5 / 5 · 최종 ${state.finalLevel}`;
  ui.stage.textContent = `${state.stageIndex + 1} / 3`;
  ui.title.textContent = mode.title;
  ui.instruction.textContent = mode.instruction;
  ui.difficulty.textContent = `난이도 ${state.difficulty}`;
  ui.hint.textContent = mode.hint;
  ui.playfield.innerHTML = "";
  setAttemptProgress(0, 1);
  setLumi(ui.gameLumi, mode.lumi);
  setSpeech("바로 시작해요", mode.intro);
  updateRoundProgress();
  renderStageTracker();
  updatePartnerModes();
  renderHearts();
  announce(mode.instruction);
  playTone("transition");
  state.stageLocked = false;
  renderCurrentMode();
}

function renderCurrentMode() {
  clearStageTimers();
  hideTimer();
  state.stageToken += 1;
  state.stageLocked = false;
  ui.playfield.innerHTML = "";
  const renderers = { focus: renderFocus, memory: renderMemory, pattern: renderPattern, direction: renderDirection, switch: renderSwitch, trail: renderTrail };
  renderers[state.mode](state.config);
}

function saveAttempt(outcome) {
  recordAttempt(profile, { mode: state.mode, outcome });
  const stat = state.runStats[state.mode];
  stat.attempts += 1;
  if (outcome === "success") stat.successes += 1;
  else {
    stat.errors += 1;
    if (outcome === "timeout") stat.timeouts += 1;
  }
  stat.recent.push(outcome);
  stat.recent = stat.recent.slice(-12);
  storagePersistent = writeProfile(storage, profile);
}

function failChallenge({ timeout = false } = {}) {
  if (state.stageLocked || state.paused) return;
  state.stageLocked = true;
  clearStageTimers();
  saveAttempt(timeout ? "timeout" : "error");
  state.hearts -= 1;
  state.combo = 0;
  ui.combo.textContent = "x0";
  renderHearts(Math.max(0, state.hearts));
  ui.playfield.classList.remove("feedback-success");
  ui.playfield.classList.add("feedback-error");
  reactLumi("error");
  playTone("error");
  setSpeech(timeout ? "시간이 끝났어요" : "괜찮아요!", "새 문제에서 다시 흐름을 잡아봐요.");
  announce(`${timeout ? "시간 초과" : "오답"}. 남은 하트 ${Math.max(0, state.hearts)}개.`);
  if (state.hearts <= 0) {
    later(showResults, 620);
  } else {
    later(() => {
      ui.playfield.classList.remove("feedback-error");
      renderCurrentMode();
    }, 620);
  }
}

function completeChallenge({ remainingRatio = state.remainingRatio } = {}) {
  if (state.stageLocked || state.paused) return;
  state.stageLocked = true;
  clearStageTimers();
  saveAttempt("success");
  const earned = scoreStage({ base: MODE_INFO[state.mode].base, difficulty: state.difficulty, remainingRatio, comboBefore: state.combo });
  state.score += earned;
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  ui.score.textContent = formatScore(state.score);
  ui.combo.textContent = `x${state.combo}`;
  ui.score.classList.remove("score-pop");
  void ui.score.offsetWidth;
  ui.score.classList.add("score-pop");
  ui.playfield.classList.add("feedback-success");
  reactLumi("success");
  const milestone = [3, 5, 10].includes(state.combo);
  playTone(milestone ? "combo" : "success");
  setSpeech(milestone ? `${state.combo} 콤보!` : "정답이에요!", `+${earned}점 · 다음 별빛으로 이어가요.`);
  announce(`정답. ${earned}점 획득. 현재 콤보 ${state.combo}.`);
  updateRoundProgress(state.stageIndex + 1);
  ui.stageSteps[state.stageIndex].classList.add("complete");
  later(() => {
    ui.playfield.classList.remove("feedback-success");
    if (state.stageIndex < 2) {
      state.stageIndex += 1;
      beginStage();
    } else if (state.round < 5) {
      state.round += 1;
      beginRound();
    } else {
      state.finalLevel += 1;
      beginRound();
    }
  }, 620);
}

function placeRandomly(element, padding = 36) {
  const width = ui.playfield.clientWidth || 640;
  const height = ui.playfield.clientHeight || 360;
  const radius = Math.max(24, element.offsetWidth / 2 || 24);
  const edge = padding + radius;
  const x = edge + Math.random() * Math.max(1, width - edge * 2);
  const y = edge + Math.random() * Math.max(1, height - edge * 2);
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
}

function renderFocus(config) {
  let hits = 0;
  setAttemptProgress(hits, config.hits);
  const shapes = ["diamond", "circle", "triangle"];
  for (let index = 0; index < config.decoys; index += 1) {
    const decoy = document.createElement("button");
    decoy.type = "button";
    decoy.className = `decoy shape-${randomItem(shapes)}`;
    decoy.setAttribute("aria-label", "방해 요소");
    decoy.addEventListener("click", () => failChallenge());
    ui.playfield.appendChild(decoy);
    placeRandomly(decoy, 18);
  }
  const target = document.createElement("button");
  target.type = "button";
  target.className = "focus-target";
  target.setAttribute("aria-label", "빛나는 목표");
  target.style.setProperty("--target-size", `${Math.max(44, 70 - state.difficulty * 3)}px`);
  target.addEventListener("click", () => {
    if (state.stageLocked) return;
    hits += 1;
    setAttemptProgress(hits, config.hits);
    playTone("tap");
    if (hits >= config.hits) completeChallenge();
    else placeRandomly(target, 20);
  });
  ui.playfield.appendChild(target);
  placeRandomly(target, 20);
  startTimer(config.limitMs, "별빛 포착 제한시간", () => failChallenge({ timeout: true }));
}

function memorySequence(config) {
  if (state.difficulty <= 2) return shuffle(Array.from({ length: config.cardCount }, (_, index) => index)).slice(0, config.length);
  const sequence = [];
  while (sequence.length < config.length) {
    const next = Math.floor(Math.random() * config.cardCount);
    if (next !== sequence.at(-1)) sequence.push(next);
  }
  return sequence;
}

function renderMemory(config) {
  const sequence = memorySequence(config);
  let inputIndex = 0;
  setAttemptProgress(0, sequence.length);
  const board = document.createElement("div");
  board.className = "memory-board";
  board.style.setProperty("--memory-columns", config.cardCount <= 6 ? 3 : 4);
  const cards = Array.from({ length: config.cardCount }, (_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "memory-card";
    button.disabled = true;
    button.innerHTML = `<span>${MEMORY_SYMBOLS[index]}</span>`;
    button.setAttribute("aria-label", `${index + 1}번 ${MEMORY_SYMBOLS[index]} 카드`);
    button.addEventListener("click", () => {
      if (state.stageLocked) return;
      if (sequence[inputIndex] !== index) {
        button.classList.add("wrong");
        failChallenge();
        return;
      }
      button.classList.add("correct");
      later(() => button.classList.remove("correct"), 170);
      inputIndex += 1;
      setAttemptProgress(inputIndex, sequence.length);
      playTone("tap");
      if (inputIndex === sequence.length) completeChallenge({ remainingRatio: 0 });
    });
    board.appendChild(button);
    return button;
  });
  ui.playfield.appendChild(board);
  sequence.forEach((cardIndex, index) => {
    later(() => {
      cards[cardIndex].classList.add("revealed");
      announce(`${index + 1}번째 ${MEMORY_SYMBOLS[cardIndex]}`);
    }, index * config.revealMs);
    later(() => cards[cardIndex].classList.remove("revealed"), index * config.revealMs + Math.round(config.revealMs * 0.68));
  });
  later(() => {
    cards.forEach((card) => { card.disabled = false; });
    setSpeech("이제 입력해요", "보여준 순서를 처음부터 재현해요.");
    announce("순서 공개가 끝났어요. 이제 입력하세요.");
  }, sequence.length * config.revealMs + 220);
}

function renderPattern(config) {
  const count = config.size * config.size;
  const oddIndex = Math.floor(Math.random() * count);
  const change = randomItem(config.changes);
  const baseShape = randomItem(["diamond", "circle", "triangle"]);
  const otherShape = randomItem(["diamond", "circle", "triangle"].filter((shape) => shape !== baseShape));
  setAttemptProgress(0, 1);
  const board = document.createElement("div");
  board.className = "pattern-board";
  board.style.setProperty("--pattern-size", config.size);
  for (let index = 0; index < count; index += 1) {
    const odd = index === oddIndex;
    const shape = odd && change === "shape" ? otherShape : baseShape;
    const tone = odd && change === "color" ? "violet" : "cyan";
    const rotation = odd && change === "rotation" ? "tilted" : "level";
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "pattern-tile";
    tile.dataset.shape = shape;
    tile.dataset.tone = tone;
    tile.dataset.rotation = rotation;
    tile.setAttribute("aria-label", `${index + 1}번 ${tone === "cyan" ? "청록" : "보라"} ${shape === "circle" ? "원" : shape === "triangle" ? "삼각형" : "마름모"} 타일`);
    tile.addEventListener("click", () => odd ? completeChallenge() : failChallenge());
    board.appendChild(tile);
  }
  ui.playfield.appendChild(board);
  startTimer(config.limitMs, "균열 탐색 제한시간", () => failChallenge({ timeout: true }));
}

function renderDirectionProgress() {
  $$(".direction-chip").forEach((chip, index) => {
    chip.classList.toggle("current", index === state.directionIndex);
    chip.classList.toggle("done", index < state.directionIndex);
  });
  setAttemptProgress(state.directionIndex, state.directionSequence.length);
}

function handleDirectionInput(direction) {
  if (state.mode !== "direction" || state.stageLocked || state.paused) return;
  const expected = state.directionSequence[state.directionIndex];
  const key = ui.playfield.querySelector(`[data-direction="${direction}"]`);
  if (key) {
    key.classList.remove("pressed", "wrong");
    void key.offsetWidth;
    key.classList.add(direction === expected ? "pressed" : "wrong");
  }
  if (direction !== expected) {
    failChallenge();
    return;
  }
  state.directionIndex += 1;
  playTone("tap");
  renderDirectionProgress();
  if (state.directionIndex === state.directionSequence.length) completeChallenge();
}

function renderDirection(config) {
  state.directionSequence = Array.from({ length: config.length }, () => randomItem(Object.keys(DIRECTION_INFO)));
  state.directionIndex = 0;
  const game = document.createElement("div");
  game.className = "direction-game";
  const sequence = document.createElement("div");
  sequence.className = "direction-sequence";
  sequence.setAttribute("aria-label", "입력할 방향 순서");
  state.directionSequence.forEach((direction) => {
    const chip = document.createElement("span");
    chip.className = "direction-chip";
    chip.textContent = DIRECTION_INFO[direction].symbol;
    chip.setAttribute("aria-label", DIRECTION_INFO[direction].label);
    sequence.appendChild(chip);
  });
  const pad = document.createElement("div");
  pad.className = "direction-pad";
  Object.entries(DIRECTION_INFO).forEach(([direction, info]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "direction-key";
    button.dataset.direction = direction;
    button.textContent = info.symbol;
    button.setAttribute("aria-label", info.label);
    button.addEventListener("click", () => handleDirectionInput(direction));
    pad.appendChild(button);
  });
  game.append(sequence, pad);
  ui.playfield.appendChild(game);
  renderDirectionProgress();
  startTimer(config.limitMs, "궤도 입력 제한시간", () => failChallenge({ timeout: true }));
}

function tokenElement(token, className = "signal-token") {
  const element = document.createElement("span");
  element.className = `${className} token-${token.color} token-${token.shape}`;
  element.setAttribute("aria-hidden", "true");
  return element;
}

function signalLabel(token) {
  const colors = { cyan: "청록", violet: "보라", coral: "주황" };
  const shapes = { circle: "원", diamond: "마름모", triangle: "삼각형" };
  return `${colors[token.color]} ${shapes[token.shape]}`;
}

function renderSwitch(config) {
  let trialIndex = 0;
  const previousRules = [];
  const game = document.createElement("div");
  game.className = "switch-game";
  const ruleBanner = document.createElement("div");
  ruleBanner.className = "rule-banner";
  const reference = document.createElement("div");
  reference.className = "signal-reference";
  const candidates = document.createElement("div");
  candidates.className = "signal-candidates";
  game.append(ruleBanner, reference, candidates);
  ui.playfield.appendChild(game);
  const showTrial = () => {
    const trial = createSignalTrial({ level: state.difficulty, previousRules, rng: Math.random });
    previousRules.push(trial.rule);
    const ruleText = trial.rule === "color" ? "색 맞추기" : "모양 맞추기";
    ruleBanner.textContent = ruleText;
    ruleBanner.classList.add("switching");
    reference.innerHTML = "<small>기준 신호</small>";
    reference.appendChild(tokenElement(trial.reference));
    reference.setAttribute("aria-label", `기준 신호 ${signalLabel(trial.reference)}`);
    candidates.innerHTML = "";
    trial.candidates.forEach((candidate) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "signal-choice";
      button.disabled = true;
      button.dataset.candidate = candidate.id;
      button.setAttribute("aria-label", signalLabel(candidate));
      button.appendChild(tokenElement(candidate));
      button.addEventListener("click", () => {
        if (!isSignalAnswerCorrect(trial, candidate.id)) {
          button.classList.add("wrong");
          failChallenge();
          return;
        }
        trialIndex += 1;
        setAttemptProgress(trialIndex, config.trials);
        playTone("tap");
        if (trialIndex >= config.trials) completeChallenge();
        else showTrial();
      });
      candidates.appendChild(button);
    });
    setAttemptProgress(trialIndex, config.trials);
    announce(`현재 규칙 ${ruleText}. 기준은 ${signalLabel(trial.reference)}.`);
    later(() => {
      ruleBanner.classList.remove("switching");
      candidates.querySelectorAll("button").forEach((button) => { button.disabled = false; });
      candidates.querySelector("button")?.focus({ preventScroll: true });
    }, 500);
  };
  showTrial();
  startTimer(config.limitMs, "신호 전환 제한시간", () => failChallenge({ timeout: true }));
}

function trailDirections(path, size) {
  const labels = [];
  for (let index = 1; index < path.length; index += 1) {
    const delta = path[index] - path[index - 1];
    labels.push(delta === 1 ? "오른쪽" : delta === -1 ? "왼쪽" : delta === size ? "아래" : "위");
  }
  return labels.join(", ");
}

function renderTrail(config) {
  const path = createStarPath({ size: config.size, length: config.length, rng: Math.random });
  let inputIndex = 0;
  const grid = document.createElement("div");
  grid.className = "trail-grid";
  grid.style.setProperty("--trail-size", config.size);
  const cells = Array.from({ length: config.size * config.size }, (_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "trail-cell";
    button.dataset.cell = index;
    button.disabled = true;
    button.tabIndex = -1;
    button.setAttribute("aria-label", `${Math.floor(index / config.size) + 1}행 ${index % config.size + 1}열`);
    button.addEventListener("click", () => {
      if (!isStarStepCorrect(path, inputIndex, index)) {
        button.classList.add("wrong");
        failChallenge();
        return;
      }
      button.classList.add("correct");
      button.textContent = "✦";
      inputIndex += 1;
      setAttemptProgress(inputIndex, path.length);
      playTone("tap");
      if (inputIndex === path.length) completeChallenge();
    });
    button.addEventListener("keydown", (event) => {
      if (!Object.hasOwn(DIRECTION_INFO, event.key)) return;
      event.preventDefault();
      const row = Math.floor(index / config.size);
      const column = index % config.size;
      const nextRow = event.key === "ArrowUp" ? row - 1 : event.key === "ArrowDown" ? row + 1 : row;
      const nextColumn = event.key === "ArrowLeft" ? column - 1 : event.key === "ArrowRight" ? column + 1 : column;
      if (nextRow < 0 || nextRow >= config.size || nextColumn < 0 || nextColumn >= config.size) return;
      const next = nextRow * config.size + nextColumn;
      cells.forEach((cell) => { cell.tabIndex = -1; });
      cells[next].tabIndex = 0;
      cells[next].focus();
    });
    grid.appendChild(button);
    return button;
  });
  ui.playfield.appendChild(grid);
  setAttemptProgress(0, path.length);
  path.forEach((cellIndex, index) => {
    later(() => {
      cells[cellIndex].classList.add("revealed");
      cells[cellIndex].textContent = String(index + 1);
      announce(`${index + 1}번째, ${cells[cellIndex].getAttribute("aria-label")}`);
    }, index * config.revealMs);
    later(() => {
      cells[cellIndex].classList.remove("revealed");
      cells[cellIndex].textContent = "";
    }, index * config.revealMs + Math.round(config.revealMs * 0.72));
  });
  later(() => {
    const start = path[0];
    cells.forEach((cell) => { cell.disabled = false; });
    cells[start].classList.add("start");
    cells[start].textContent = "시작";
    cells[start].tabIndex = 0;
    cells[start].focus({ preventScroll: true });
    const row = Math.floor(start / config.size) + 1;
    const column = start % config.size + 1;
    announce(`시작은 ${row}행 ${column}열. 이후 ${trailDirections(path, config.size)}.`);
    setSpeech("이제 따라가요", "시작 칸부터 기억한 길을 입력해요.");
    startTimer(config.limitMs, "별길 입력 제한시간", () => failChallenge({ timeout: true }));
  }, path.length * config.revealMs + 220);
}

function showResults() {
  clearStageTimers();
  stopTones();
  stopMusic(ui.gameMusic);
  state.stageToken += 1;
  state.stageLocked = true;
  hideTimer();
  if (!state.runFinalized) {
    finalizeRun(profile, {
      score: state.score, bestCombo: state.bestCombo, round: state.round, finalLevel: state.finalLevel,
      endedAt: new Date().toISOString(), modes: state.runStats
    });
    state.runFinalized = true;
    storagePersistent = writeProfile(storage, profile);
  }
  ui.resultScore.textContent = formatScore(state.score);
  ui.resultCombo.textContent = `x${state.bestCombo}`;
  ui.resultRound.textContent = state.round < 5 ? `라운드 ${state.round}` : `최종 ${state.finalLevel}`;
  ui.resultBestScore.textContent = profile.records.bestScore;
  ui.resultBestCombo.textContent = `x${profile.records.bestCombo}`;
  MODE_IDS.forEach((mode) => {
    const row = ui.resultRows[mode];
    const stat = state.runStats[mode];
    const accuracy = accuracyFor(stat);
    row.querySelector("strong").textContent = accuracy === null ? "—" : `${accuracy}%`;
    row.querySelector("small").textContent = `오류 ${stat.errors} · 시간초과 ${stat.timeouts}`;
  });
  const attempted = MODE_IDS.filter((mode) => state.runStats[mode].attempts > 0);
  const recommendation = attempted.sort((a, b) => weaknessFor(profile.modes[b]) - weaknessFor(profile.modes[a]))[0];
  ui.resultRecommendation.textContent = recommendation
    ? `루미의 다음 추천 · ${MODE_UI[recommendation].title} — 실수한 흐름을 한 단계 편하게 다시 연습해요.`
    : "루미의 다음 추천은 첫 문제를 마치면 준비돼요.";
  ui.saveStatus.textContent = storagePersistent ? "이 기기에 기록했어요." : "이번 결과는 표시되지만 이 기기에는 저장하지 못했어요.";
  ui.saveStatus.classList.toggle("save-failed", !storagePersistent);
  updateHomeRecords();
  showScreen("result");
  announce(`도전 완료. 최종 점수 ${state.score}, 최고 콤보 ${state.bestCombo}. ${ui.saveStatus.textContent}`);
}

function goHome() {
  clearStageTimers();
  stopTones();
  stopMusic(ui.gameMusic);
  state.stageToken += 1;
  state.paused = false;
  ui.pauseOverlay.classList.add("is-hidden");
  ui.gameHeader.inert = false;
  ui.gameLayout.inert = false;
  updateHomeRecords();
  showScreen("home");
  startHomeMusic();
}

function togglePause(forceResume = false) {
  if (!screens.game.classList.contains("active")) return;
  if (!state.paused && !forceResume) {
    state.paused = true;
    state.stageToken += 1;
    clearStageTimers();
    stopTones();
    ui.pauseOverlay.classList.remove("is-hidden");
    ui.gameHeader.inert = true;
    ui.gameLayout.inert = true;
    ui.resume.focus();
    announce("일시정지. 재개하면 현재 문제를 새로 시작합니다.");
    return;
  }
  state.paused = false;
  ui.pauseOverlay.classList.add("is-hidden");
  ui.gameHeader.inert = false;
  ui.gameLayout.inert = false;
  renderCurrentMode();
  announce("게임을 재개합니다. 현재 모드의 새 문제입니다.");
}

async function shareResult() {
  const reached = state.round < 5 ? `라운드 ${state.round}` : `최종 ${state.finalLevel}`;
  const text = `LUMI’S MIND ARCADE\n총점 ${state.score} · 최고 콤보 x${state.bestCombo} · ${reached}`;
  if (navigator.share) {
    try { await navigator.share({ title: "LUMI’S MIND ARCADE", text }); return; }
    catch (error) { if (error.name === "AbortError") return; }
  }
  if (navigator.clipboard) {
    try { await navigator.clipboard.writeText(text); showToast("결과를 클립보드에 복사했어요."); return; }
    catch { /* Fall through to selectable text. */ }
  }
  window.prompt("아래 결과를 복사하세요.", text);
}

ui.start.addEventListener("click", startGame);
ui.retry.addEventListener("click", startGame);
ui.dialogStart.addEventListener("click", () => { ui.dialog.close(); startGame(); });
ui.home.addEventListener("click", goHome);
ui.resultHome.addEventListener("click", goHome);
ui.pause.addEventListener("click", () => togglePause());
ui.resume.addEventListener("click", () => togglePause(true));
ui.share.addEventListener("click", shareResult);
ui.howTo.addEventListener("click", () => ui.dialog.showModal());
ui.closeDialog.addEventListener("click", () => ui.dialog.close());
ui.music.addEventListener("click", toggleMusic);
screens.home.addEventListener("pointerdown", (event) => { if (!event.target.closest("#music-toggle")) startHomeMusic(); });
screens.home.addEventListener("click", (event) => {
  if (screens.home.classList.contains("active") && !event.target.closest("#music-toggle")) startHomeMusic();
});
ui.homeLumi.addEventListener("click", () => {
  const next = (Number(ui.homeLumi.className.match(/state-(\d)/)?.[1] || 1) + 1) % 5;
  setLumi(ui.homeLumi, next);
  playTone("success");
  showToast("루미가 오늘의 도전을 응원해요!");
});
ui.modeCards.forEach((card) => {
  card.addEventListener("pointerenter", () => setLumi(ui.homeLumi, MODE_UI[card.dataset.mode].lumi));
  card.addEventListener("pointerleave", () => setLumi(ui.homeLumi, 1));
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && ui.dialog.open) { ui.dialog.close(); return; }
  if (event.key.toLowerCase() === "p" && screens.game.classList.contains("active")) { event.preventDefault(); togglePause(); return; }
  if (screens.game.classList.contains("active") && state.mode === "direction" && Object.hasOwn(DIRECTION_INFO, event.key)) {
    event.preventDefault();
    handleDirectionInput(event.key);
  }
});

ui.score.textContent = formatScore(0);
renderHearts();
setMusicUi(false);
updateHomeRecords();
showScreen("home");
startHomeMusic();
