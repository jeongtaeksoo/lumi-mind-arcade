const $ = (selector) => document.querySelector(selector);
const screens = { home: $("#home-screen"), game: $("#game-screen"), result: $("#result-screen") };
const ui = {
  start: $("#start-button"), retry: $("#retry-button"), home: $("#home-button"), pause: $("#pause-button"),
  howTo: $("#how-to-button"), dialogStart: $("#dialog-start-button"), dialog: $("#how-to-dialog"), closeDialog: $("#close-how-to"),
  homeWorld: $(".home-world"), homeLumi: $("#home-lumi"), modeCards: [...document.querySelectorAll(".mode-card[data-lumi-state]")],
  playfield: $("#playfield"), round: $("#round-label"), title: $("#game-status-title"), score: $("#score-label"), hearts: $("#hearts"),
  stage: $("#stage-label"), stageSteps: [...document.querySelectorAll("[data-stage-step]")], modeIcon: $(".mode-hud-icon"),
  instruction: $("#instruction-label"), combo: $("#combo-label"), progress: $("#progress-bar"), hint: $("#hint-text"),
  timerPanel: $("#timer-panel"), timerLabel: $("#timer-label"), timerBar: $("#timer-bar"),
  gameLumi: $("#game-lumi"), speechTitle: $("#speech-title"), speechText: $("#speech-text"), meter: $("#round-meter-fill"),
  resultScore: $("#result-score"), resultCombo: $("#result-combo"), resultFocus: $("#result-focus"), resultMemory: $("#result-memory"), resultPattern: $("#result-pattern"),
  resultMessage: $("#result-message"), resultHome: $("#result-home-button"), progressLabel: $("#round-progress-label"), share: $("#share-button"), toast: $("#toast"), homeMusic: $("#home-bgm"), gameMusic: $("#game-bgm"), musicToggle: $("#music-toggle")
};

const MODE_INFO = {
  focus: { label: "집중 모드", short: "집중", instruction: "목표를 제한 시간 안에 클릭하세요", hint: "순발력 타이머가 끝나기 전에 빛나는 목표를 눌러요." },
  memory: { label: "기억 모드", short: "기억", instruction: "빛난 순서대로 눌러보세요", hint: "루미가 보여준 순서를 천천히 떠올려요." },
  pattern: { label: "패턴 모드", short: "패턴", instruction: "달라진 패턴을 찾아보세요", hint: "모양과 색이 다른 타일 하나를 찾아요." }
};

const state = {
  round: 1, hearts: 5, score: 0, combo: 0, bestCombo: 0, mode: "focus", roundProgress: 0,
  finalLevel: 1, stageIndex: 0, roundPlan: [], stageLocked: false, roundTimer: null, memoryTimer: null, timerInterval: null,
  paused: false, stats: { focus: 0, memory: 0, pattern: 0 }
};
let musicEnabled = true;

function showScreen(name) { Object.values(screens).forEach((screen) => screen.classList.remove("active")); screens[name].classList.add("active"); window.scrollTo(0, 0); requestAnimationFrame(() => window.scrollTo(0, 0)); setTimeout(() => window.scrollTo(0, 0), 40); }
function randomItem(list) { return list[Math.floor(Math.random() * list.length)]; }
function shuffle(list) { return [...list].sort(() => Math.random() - 0.5); }
function formatScore(score) { return String(Math.max(0, score)).padStart(3, "0"); }

function resetState() {
  clearTimers();
  Object.assign(state, { round: 1, hearts: 5, score: 0, combo: 0, bestCombo: 0, mode: "focus", roundProgress: 0, finalLevel: 1, stageIndex: 0, roundPlan: [], stageLocked: false, paused: false, stats: { focus: 0, memory: 0, pattern: 0 } });
  renderHearts();
}

function startGame() {
  resetState();
  stopMusic(ui.homeMusic);
  startGameMusic();
  showScreen("game");
  beginRound();
}

function clearTimers() {
  if (state.roundTimer) clearTimeout(state.roundTimer);
  if (state.memoryTimer) clearTimeout(state.memoryTimer);
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.roundTimer = null;
  state.memoryTimer = null;
  state.timerInterval = null;
}

function beginRound() {
  clearTimers();
  state.paused = false;
  state.roundProgress = 0;
  state.stageIndex = 0;
  state.roundPlan = shuffle(["focus", "memory", "pattern"]);
  beginStage();
}

function beginStage() {
  clearTimers();
  state.paused = false;
  state.stageLocked = false;
  state.mode = state.roundPlan[state.stageIndex] || "focus";
  const info = MODE_INFO[state.mode];
  ui.round.textContent = state.round >= 5 ? `라운드 5 / 5 · 최종 ${state.finalLevel}` : `라운드 ${state.round} / 5`;
  ui.stage.textContent = `${state.stageIndex + 1} / 3`;
  ui.title.textContent = info.label;
  ui.instruction.textContent = info.instruction;
  ui.hint.textContent = info.hint;
  ui.modeIcon.className = `mode-hud-icon ${state.mode === "focus" ? "target-icon" : state.mode === "memory" ? "memory-icon" : "pattern-icon"}`;
  ui.modeIcon.textContent = state.mode === "memory" ? "✦" : state.mode === "pattern" ? "◇" : "";
  ui.progress.style.width = `${(state.stageIndex / 3) * 100}%`;
  ui.progressLabel.textContent = `${Math.round((state.stageIndex / 3) * 100)}%`;
  ui.meter.style.width = `${Math.min(100, ((state.round - 1) * 3 + state.stageIndex) / 15 * 100)}%`;
  renderStageTracker();
  setLumiState(Math.min(4, state.round - 1));
  setSpeechForRound();
  renderHearts();
  if (state.mode === "focus") renderFocus();
  if (state.mode === "memory") renderMemory();
  if (state.mode === "pattern") renderPattern();
}

function renderStageTracker() {
  ui.stageSteps.forEach((step, index) => {
    const label = step.querySelector("span");
    if (label && state.roundPlan[index]) label.textContent = MODE_INFO[state.roundPlan[index]].short;
    step.classList.toggle("active", index === state.stageIndex);
    step.classList.toggle("complete", index < state.stageIndex);
    step.classList.remove("failed");
    step.setAttribute("aria-current", index === state.stageIndex ? "step" : "false");
  });
}

function setHomeLumiState(index) { ui.homeLumi.className = `lumi-sprite lumi-home state-${index}`; }
function setLumiState(index) { ui.gameLumi.className = `lumi-sprite lumi-game state-${index}`; }
function wakeHomeLumi(message = "루미가 깨어났어요. 게임을 시작해볼까요?") {
  setHomeLumiState(2);
  void ui.homeLumi.offsetWidth;
  ui.homeLumi.classList.add("home-awake");
  setTimeout(() => ui.homeLumi.classList.remove("home-awake"), 820);
  showToast(message);
}
function previewMode(card) {
  ui.modeCards.forEach((item) => item.classList.toggle("previewing", item === card));
  setHomeLumiState(Number(card.dataset.lumiState));
}
function updateHomeParallax(event) {
  const rect = screens.home.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  ui.homeWorld.style.setProperty("--lumi-pointer-x", `${x * 18}px`);
  ui.homeWorld.style.setProperty("--lumi-pointer-y", `${y * 14}px`);
  ui.homeWorld.style.setProperty("--portal-x", `${x * 10}px`);
  ui.homeWorld.style.setProperty("--portal-y", `${y * 8}px`);
  ui.homeWorld.style.setProperty("--platform-x", `${x * 6}px`);
  ui.homeWorld.style.setProperty("--platform-y", `${y * 4}px`);
}
function resetHomeParallax() {
  ["--lumi-pointer-x", "--lumi-pointer-y", "--portal-x", "--portal-y", "--platform-x", "--platform-y"].forEach((name) => ui.homeWorld.style.setProperty(name, "0px"));
}
function reactLumi(kind) {
  const reaction = `react-${kind}`;
  ui.gameLumi.classList.remove("react-success", "react-mistake");
  void ui.gameLumi.offsetWidth;
  ui.gameLumi.classList.add(reaction);
  setTimeout(() => ui.gameLumi.classList.remove(reaction), kind === "success" ? 680 : 540);
}
function setSpeechForRound() {
  if (state.round >= 5) {
    setSpeech("마지막 도전!", `최종 단계 ${state.finalLevel} · 하트가 모두 사라질 때까지 버텨요!`);
    return;
  }
  const messages = [
    ["준비됐나요?", "천천히 시작해봐요."],
    ["좋아요!", "이번엔 조금 더 빠르게요."],
    ["집중 모드!", "루미가 실수를 기억하고 있어요."],
    ["대단해요!", "방해 요소를 잘 살펴봐요."],
    ["마지막 도전!", "하트가 모두 사라질 때까지 버텨요!"]
  ];
  const message = messages[Math.min(messages.length - 1, state.round - 1)];
  ui.speechTitle.textContent = message[0];
  ui.speechText.textContent = message[1];
}

function renderHearts(damageIndex = -1) {
  ui.hearts.innerHTML = Array.from({ length: 5 }, (_, index) => `<span class="heart ${index >= state.hearts ? "lost" : ""} ${index === damageIndex ? "damage" : ""}" aria-hidden="true">${index >= state.hearts ? "♡" : "♥"}</span>`).join("");
  ui.hearts.setAttribute("aria-label", `남은 하트 ${state.hearts}개`);
}

function loseHeart() {
  if (state.paused) return;
  state.hearts -= 1;
  state.combo = 0;
  renderHearts(Math.max(0, state.hearts));
  reactLumi("mistake");
  ui.combo.textContent = "콤보 x0";
  setSpeech("괜찮아요!", "다음 기회를 잡아봐요.");
  if (state.hearts <= 0) {
    setTimeout(showResults, 420);
    return true;
  }
  return false;
}

function reward(points) {
  state.score += points + state.combo * 5;
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  reactLumi("success");
  ui.score.textContent = formatScore(state.score);
  ui.combo.textContent = `콤보 x${state.combo}`;
}

function setSpeech(title, text) { ui.speechTitle.textContent = title; ui.speechText.textContent = text; }
function advanceRound() {
  if (state.round >= 5) {
    state.finalLevel += 1;
    beginRound();
    setSpeech("계속 가볼까요?", `최종 라운드 ${state.finalLevel}단계예요. 세 게임을 다시 달려요.`);
    return;
  }
  state.round += 1;
  beginRound();
}

function completeChallenge(points) {
  if (state.stageLocked || state.paused) return;
  state.stageLocked = true;
  clearTimers();
  reward(points);
  state.stats[state.mode] += 1;
  state.roundProgress = state.stageIndex + 1;
  ui.progress.style.width = `${(state.roundProgress / 3) * 100}%`;
  ui.progressLabel.textContent = `${Math.round((state.roundProgress / 3) * 100)}%`;
  ui.stageSteps[state.stageIndex].classList.remove("active");
  ui.stageSteps[state.stageIndex].classList.add("complete");
  if (state.stageIndex >= 2) {
    setSpeech("라운드 클리어!", state.round >= 5 ? "최종 라운드 한 사이클 완료! 계속 도전해요." : "세 가지 게임을 모두 통과했어요.");
    setTimeout(() => { if (state.hearts > 0) advanceRound(); }, state.round >= 5 ? 360 : 620);
    return;
  }
  setSpeech("좋아요!", `${MODE_INFO[state.roundPlan[state.stageIndex + 1]].short} 게임으로 이어가요.`);
  setTimeout(() => {
    if (state.hearts > 0) {
      state.stageIndex += 1;
      beginStage();
    }
  }, 420);
}

function placeRandomly(element, margin = 12) {
  const rect = ui.playfield.getBoundingClientRect();
  const x = margin + Math.random() * Math.max(10, rect.width - margin * 2);
  const y = margin + Math.random() * Math.max(10, rect.height - margin * 2);
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
}

function reactionLimitMs() {
  const limits = [5000, 4000, 3500, 2800, 2000];
  const cyclePenalty = state.round >= 5 ? Math.max(0, state.finalLevel - 1) * 200 : 0;
  return Math.max(1200, limits[state.round - 1] - cyclePenalty);
}

function hideReactionTimer() {
  ui.timerPanel.classList.add("is-hidden");
  ui.timerPanel.classList.remove("urgent");
  ui.timerBar.style.transform = "scaleX(1)";
}

function startReactionTimer(duration) {
  clearTimers();
  ui.timerPanel.classList.remove("is-hidden", "urgent");
  const startedAt = performance.now();
  const tick = () => {
    const remaining = Math.max(0, duration - (performance.now() - startedAt));
    const ratio = remaining / duration;
    ui.timerLabel.textContent = `${(remaining / 1000).toFixed(1)}초`;
    ui.timerBar.style.transform = `scaleX(${ratio})`;
    ui.timerPanel.classList.toggle("urgent", ratio <= 0.3);
    if (remaining <= 0) {
      clearTimers();
      if (!loseHeart()) renderFocus();
    }
  };
  tick();
  state.timerInterval = setInterval(tick, 50);
}

function renderFocus() {
  clearTimers();
  ui.playfield.innerHTML = "";
  const distractors = 4 + state.round * 2 + (state.round >= 5 ? state.finalLevel : 0);
  const target = document.createElement("button");
  target.type = "button"; target.className = "target"; target.setAttribute("aria-label", "목표");
  target.style.width = `${Math.max(42, 78 - state.round * 5 - (state.round >= 5 ? state.finalLevel * 2 : 0))}px`;
  target.style.height = target.style.width;
  placeRandomly(target, 80); target.addEventListener("click", () => completeChallenge(30 + state.round * 4)); ui.playfield.appendChild(target);
  const shapes = ["", "circle", "triangle"];
  for (let i = 0; i < distractors; i += 1) {
    const decoy = document.createElement("button"); decoy.type = "button"; decoy.className = `decoy ${randomItem(shapes)}`; decoy.setAttribute("aria-label", "방해 요소");
    decoy.style.borderColor = randomItem(["#ff8ec5", "#b990ff", "#ff9f82"]); placeRandomly(decoy, 50);
    decoy.addEventListener("click", () => loseHeart()); ui.playfield.appendChild(decoy);
  }
  startReactionTimer(reactionLimitMs());
}

function renderMemory() {
  clearTimers();
  hideReactionTimer();
  ui.playfield.innerHTML = "";
  const length = Math.min(7, 3 + state.round + (state.round >= 5 ? Math.ceil(state.finalLevel / 2) : 0));
  const symbols = ["◆", "●", "✦", "■", "✧", "▲", "◇"];
  const sequence = shuffle(symbols).slice(0, length);
  const revealOrder = shuffle(Array.from({ length }, (_, index) => index));
  const board = document.createElement("div"); board.className = "memory-board"; ui.playfield.appendChild(board);
  const cards = revealOrder.map((sequenceIndex) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "memory-card"; button.dataset.index = sequenceIndex; button.innerHTML = `<span class="memory-symbol">${sequence[sequenceIndex]}</span>`; button.disabled = true; board.appendChild(button); return button;
  });
  const cardsBySequence = new Map(cards.map((card) => [Number(card.dataset.index), card]));
  let current = 0;
  const revealTime = Math.max(360, 840 - state.round * 95 - (state.round >= 5 ? state.finalLevel * 40 : 0));
  revealOrder.forEach((sequenceIndex, revealIndex) => setTimeout(() => cardsBySequence.get(sequenceIndex).classList.add("revealed"), revealIndex * revealTime));
  state.memoryTimer = setTimeout(() => {
    if (state.paused) return;
    cards.forEach((card) => { card.classList.remove("revealed"); card.disabled = false; });
    cards.forEach((card) => card.addEventListener("click", () => {
      if (state.paused) return;
      if (Number(card.dataset.index) !== current) {
        card.classList.add("wrong");
        if (!loseHeart()) setTimeout(renderMemory, 380);
        return;
      }
      card.classList.add("revealed"); card.disabled = true; current += 1;
      if (current === sequence.length) completeChallenge(42 + state.round * 5);
    }));
  }, sequence.length * revealTime + Math.max(500, 1050 - state.round * 80));
}

function renderPattern() {
  clearTimers();
  hideReactionTimer();
  ui.playfield.innerHTML = "";
  const size = state.round >= 5 ? Math.min(8, 5 + Math.ceil(state.finalLevel / 2)) : 4 + Math.ceil(state.round / 2);
  const board = document.createElement("div"); board.className = "pattern-board"; board.style.gridTemplateColumns = `repeat(${Math.min(size, 7)}, minmax(32px, 1fr))`; ui.playfield.appendChild(board);
  const count = size * Math.min(size, 7); const oddIndex = Math.floor(Math.random() * count);
  for (let index = 0; index < count; index += 1) {
    const tile = document.createElement("button"); tile.type = "button"; tile.className = `pattern-tile ${index === oddIndex ? "odd" : ""}`; tile.setAttribute("aria-label", "패턴 타일");
    tile.addEventListener("click", () => {
      if (index !== oddIndex) { if (!loseHeart()) setTimeout(renderPattern, 300); return; }
      completeChallenge(38 + state.round * 5 + (state.round >= 5 ? state.finalLevel * 2 : 0));
    }); board.appendChild(tile);
  }
  const delay = Math.max(4200, 11500 - state.round * 1250 - (state.round >= 5 ? state.finalLevel * 460 : 0));
  state.roundTimer = setTimeout(() => {
    if (state.paused) return;
    if (!loseHeart()) renderPattern();
  }, delay);
}

function showResults() {
  clearTimers();
  stopMusic(ui.gameMusic);
  hideReactionTimer();
  const average = (key) => Math.min(99, 50 + state.stats[key] * 8 + Math.floor(Math.random() * 12));
  ui.resultScore.textContent = String(state.score).padStart(4, "0");
  ui.resultCombo.textContent = `x${state.bestCombo}`;
  ui.resultFocus.textContent = average("focus"); ui.resultMemory.textContent = average("memory"); ui.resultPattern.textContent = average("pattern");
  ui.resultMessage.textContent = state.round >= 5 ? "마지막 라운드까지 도전했어요. 루미가 당신의 기록을 기억할게요." : "다음에는 더 멀리 도전해봐요. 루미가 기다리고 있을게요.";
  showScreen("result");
}

function shareResult() {
  const text = `LUMI'S MIND ARCADE\n총점 ${state.score} · 최고 콤보 x${state.bestCombo}\n루미와 함께 다시 도전해보세요!`;
  if (navigator.share) navigator.share({ title: "LUMI’S MIND ARCADE", text }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => showToast("기록을 클립보드에 복사했어요."));
  else showToast("기록 공유 준비 완료!");
}

function showToast(message) { ui.toast.textContent = message; ui.toast.classList.add("visible"); setTimeout(() => ui.toast.classList.remove("visible"), 2200); }
function setMusicUi(isPlaying) {
  ui.musicToggle.setAttribute("aria-pressed", String(isPlaying));
  ui.musicToggle.setAttribute("aria-label", isPlaying ? "배경음악 끄기" : "배경음악 켜기");
  ui.musicToggle.textContent = isPlaying ? "♫ 음악 끄기" : "♫ 음악 켜기";
  ui.musicToggle.classList.toggle("is-playing", isPlaying);
}
function startHomeMusic() {
  if (!musicEnabled) return;
  ui.homeMusic.volume = 0.28;
  const playRequest = ui.homeMusic.play();
  if (playRequest && typeof playRequest.then === "function") playRequest.then(() => setMusicUi(true)).catch(() => setMusicUi(false));
}
function startGameMusic() {
  if (!musicEnabled) return;
  ui.gameMusic.volume = 0.24;
  const playRequest = ui.gameMusic.play();
  if (playRequest && typeof playRequest.then === "function") playRequest.catch(() => {});
}
function stopMusic(audio) { audio.pause(); audio.currentTime = 0; }
function toggleMusic() {
  if (ui.homeMusic.paused) { musicEnabled = true; startHomeMusic(); }
  else { musicEnabled = false; ui.homeMusic.pause(); ui.gameMusic.pause(); setMusicUi(false); }
}
function togglePause() {
  state.paused = !state.paused;
  if (state.paused) clearTimers();
  else if (state.mode === "focus") renderFocus();
  else if (state.mode === "memory") renderMemory();
  else renderPattern();
  ui.pause.textContent = state.paused ? "▶" : "Ⅱ";
  showToast(state.paused ? "잠시 멈췄어요." : "다시 시작할게요.");
}

ui.start.addEventListener("click", startGame); ui.retry.addEventListener("click", startGame); ui.dialogStart.addEventListener("click", () => { ui.dialog.close(); startGame(); });
ui.home.addEventListener("click", () => { clearTimers(); stopMusic(ui.gameMusic); showScreen("home"); startHomeMusic(); }); ui.resultHome.addEventListener("click", () => { clearTimers(); stopMusic(ui.gameMusic); showScreen("home"); startHomeMusic(); }); ui.pause.addEventListener("click", togglePause); ui.share.addEventListener("click", shareResult);
ui.musicToggle.addEventListener("click", toggleMusic);
screens.home.addEventListener("pointerdown", (event) => { if (!event.target.closest("#music-toggle")) startHomeMusic(); });
ui.howTo.addEventListener("click", () => ui.dialog.showModal()); ui.closeDialog.addEventListener("click", () => ui.dialog.close());
screens.home.addEventListener("pointermove", updateHomeParallax); screens.home.addEventListener("pointerleave", resetHomeParallax);
ui.homeLumi.addEventListener("click", () => wakeHomeLumi()); ui.homeLumi.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); wakeHomeLumi(); } });
ui.modeCards.forEach((card) => {
  card.addEventListener("pointerenter", () => previewMode(card));
  card.addEventListener("pointerleave", () => { card.classList.remove("previewing"); setHomeLumiState(1); });
});
window.addEventListener("keydown", (event) => { if (event.key === "Escape" && ui.dialog.open) ui.dialog.close(); if (event.key === "p" && screens.game.classList.contains("active")) togglePause(); });

ui.score.textContent = formatScore(0); renderHearts(); setMusicUi(false); startHomeMusic();
