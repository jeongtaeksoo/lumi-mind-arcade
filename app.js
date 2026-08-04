const $ = (selector) => document.querySelector(selector);
const screens = { home: $("#home-screen"), game: $("#game-screen"), result: $("#result-screen") };
const ui = {
  start: $("#start-button"), retry: $("#retry-button"), home: $("#home-button"), pause: $("#pause-button"),
  howTo: $("#how-to-button"), dialogStart: $("#dialog-start-button"), dialog: $("#how-to-dialog"), closeDialog: $("#close-how-to"),
  homeWorld: $(".home-world"), homeLumi: $("#home-lumi"), modeCards: [...document.querySelectorAll(".mode-card[data-lumi-state]")],
  playfield: $("#playfield"), round: $("#round-label"), title: $("#game-status-title"), score: $("#score-label"), hearts: $("#hearts"),
  instruction: $("#instruction-label"), combo: $("#combo-label"), progress: $("#progress-bar"), hint: $("#hint-text"),
  gameLumi: $("#game-lumi"), speechTitle: $("#speech-title"), speechText: $("#speech-text"), meter: $("#round-meter-fill"),
  resultScore: $("#result-score"), resultCombo: $("#result-combo"), resultFocus: $("#result-focus"), resultMemory: $("#result-memory"), resultPattern: $("#result-pattern"),
  resultMessage: $("#result-message"), share: $("#share-button"), toast: $("#toast")
};

const MODE_INFO = {
  focus: { label: "집중력", instruction: "목표를 클릭하세요" },
  memory: { label: "기억력", instruction: "빛난 순서대로 눌러보세요" },
  pattern: { label: "패턴 찾기", instruction: "달라진 패턴을 찾아보세요" }
};

const state = {
  round: 1, hearts: 5, score: 0, combo: 0, bestCombo: 0, mode: "focus", roundProgress: 0,
  finalLevel: 1, roundTimer: null, memoryTimer: null, paused: false, modes: [], stats: { focus: 0, memory: 0, pattern: 0 }
};

function showScreen(name) { Object.values(screens).forEach((screen) => screen.classList.remove("active")); screens[name].classList.add("active"); }
function randomItem(list) { return list[Math.floor(Math.random() * list.length)]; }
function shuffle(list) { return [...list].sort(() => Math.random() - 0.5); }
function formatScore(score) { return String(Math.max(0, score)).padStart(3, "0"); }

function chooseMode() {
  if (!state.modes.length) state.modes = shuffle(["focus", "memory", "pattern"]);
  state.mode = state.modes.shift();
  return state.mode;
}

function resetState() {
  clearTimers();
  Object.assign(state, { round: 1, hearts: 5, score: 0, combo: 0, bestCombo: 0, mode: "focus", roundProgress: 0, finalLevel: 1, paused: false, modes: [], stats: { focus: 0, memory: 0, pattern: 0 } });
  renderHearts();
}

function startGame() {
  resetState();
  showScreen("game");
  beginRound();
}

function clearTimers() {
  if (state.roundTimer) clearTimeout(state.roundTimer);
  if (state.memoryTimer) clearTimeout(state.memoryTimer);
  state.roundTimer = null;
  state.memoryTimer = null;
}

function beginRound() {
  clearTimers();
  state.paused = false;
  state.roundProgress = 0;
  const mode = chooseMode();
  ui.round.textContent = state.round >= 5 ? `ROUND 5 / 5 · FINAL ${state.finalLevel}` : `ROUND ${state.round} / 5`;
  ui.title.textContent = MODE_INFO[mode].label;
  ui.instruction.textContent = MODE_INFO[mode].instruction;
  ui.progress.style.width = "0%";
  ui.meter.style.width = `${Math.min(100, state.round * 20)}%`;
  setLumiState(Math.min(4, state.round - 1));
  setSpeechForRound();
  renderHearts();
  if (mode === "focus") renderFocus();
  if (mode === "memory") renderMemory();
  if (mode === "pattern") renderPattern();
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
function roundGoal() { return state.round >= 5 ? Infinity : 3 + state.round; }

function advanceRound() {
  if (state.round >= 5) {
    state.finalLevel += 1;
    state.roundProgress = 0;
    ui.round.textContent = `ROUND 5 / 5 · FINAL ${state.finalLevel}`;
    ui.progress.style.width = `${Math.min(94, 20 + state.finalLevel * 12)}%`;
    setSpeech("계속 가볼까요?", `최종 라운드 ${state.finalLevel}단계예요.`);
    chooseMode();
    if (state.mode === "focus") renderFocus();
    if (state.mode === "memory") renderMemory();
    if (state.mode === "pattern") renderPattern();
    return;
  }
  state.round += 1;
  beginRound();
}

function completeChallenge(points) {
  reward(points);
  state.stats[state.mode] += 1;
  state.roundProgress += 1;
  const goal = roundGoal();
  ui.progress.style.width = `${Math.min(100, (state.roundProgress / goal) * 100)}%`;
  if (state.round >= 5) {
    ui.progress.style.width = `${Math.min(94, 20 + state.finalLevel * 12)}%`;
    setTimeout(() => { if (state.hearts > 0) advanceRound(); }, 210);
    return;
  }
  if (state.roundProgress >= goal) {
    setSpeech("라운드 클리어!", "다음 도전이 기다리고 있어요.");
    setTimeout(advanceRound, 520);
  } else {
    setTimeout(() => {
      if (state.mode === "focus") renderFocus();
      if (state.mode === "memory") renderMemory();
      if (state.mode === "pattern") renderPattern();
    }, 230);
  }
}

function placeRandomly(element, margin = 12) {
  const rect = ui.playfield.getBoundingClientRect();
  const x = margin + Math.random() * Math.max(10, rect.width - margin * 2);
  const y = margin + Math.random() * Math.max(10, rect.height - margin * 2);
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
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
  const delay = Math.max(3200, 10000 - state.round * 1150 - (state.round >= 5 ? state.finalLevel * 400 : 0));
  state.roundTimer = setTimeout(() => {
    if (state.paused) return;
    if (!loseHeart()) renderFocus();
  }, delay);
}

function renderMemory() {
  clearTimers();
  ui.playfield.innerHTML = "";
  const length = Math.min(7, 3 + state.round + (state.round >= 5 ? Math.ceil(state.finalLevel / 2) : 0));
  const symbols = ["◆", "●", "✦", "■", "✧", "▲", "◇"];
  const sequence = Array.from({ length }, () => randomItem(symbols));
  const board = document.createElement("div"); board.className = "memory-board"; ui.playfield.appendChild(board);
  const cards = sequence.map((symbol, index) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "memory-card"; button.dataset.index = index; button.innerHTML = `<span class="memory-symbol">${symbol}</span>`; button.disabled = true; board.appendChild(button); return button;
  });
  let current = 0;
  const revealTime = Math.max(360, 840 - state.round * 95 - (state.round >= 5 ? state.finalLevel * 40 : 0));
  cards.forEach((card, index) => setTimeout(() => card.classList.add("revealed"), index * revealTime));
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
ui.home.addEventListener("click", () => { clearTimers(); showScreen("home"); }); ui.pause.addEventListener("click", togglePause); ui.share.addEventListener("click", shareResult);
ui.howTo.addEventListener("click", () => ui.dialog.showModal()); ui.closeDialog.addEventListener("click", () => ui.dialog.close());
screens.home.addEventListener("pointermove", updateHomeParallax); screens.home.addEventListener("pointerleave", resetHomeParallax);
ui.homeLumi.addEventListener("click", () => wakeHomeLumi()); ui.homeLumi.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); wakeHomeLumi(); } });
ui.modeCards.forEach((card) => {
  card.addEventListener("pointerenter", () => previewMode(card)); card.addEventListener("focus", () => previewMode(card));
  card.addEventListener("click", () => wakeHomeLumi(`${card.dataset.modeLabel} 모드를 미리봤어요.`));
});
window.addEventListener("keydown", (event) => { if (event.key === "Escape" && ui.dialog.open) ui.dialog.close(); if (event.key === "p" && screens.game.classList.contains("active")) togglePause(); });

ui.score.textContent = formatScore(0); renderHearts();
