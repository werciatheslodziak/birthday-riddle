import { CONFETTI } from "./config.js";
import { playWinCelebration } from "./sounds.js";
import { els, state, setStatus } from "./state.js";
import { stopTimer } from "./timer.js";
import { STATUS } from "./messages.js";
import { formatClockTime } from "./utils.js";

export function launchConfetti() {
  els.confettiLayer.innerHTML = "";
  const small = window.innerWidth < CONFETTI.smallScreenBreakpointPx;
  const amount = small ? CONFETTI.smallScreenCount : CONFETTI.bigScreenCount;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < amount; i += 1) {
    const piece = document.createElement("span");
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty(
      "--fall-x",
      `${(Math.random() - 0.5) * CONFETTI.fallXSpreadPx}px`
    );
    piece.style.setProperty(
      "--spin",
      `${Math.random() * CONFETTI.spinDegSpread - CONFETTI.spinDegSpread / 2}deg`
    );
    const { min: dMin, max: dMax } = CONFETTI.durationsSec;
    piece.style.setProperty(
      "--duration",
      `${dMin + Math.random() * (dMax - dMin)}s`
    );
    const { min: delayMin, max: delayMax } = CONFETTI.delaysSec;
    piece.style.setProperty(
      "--delay",
      `${delayMin + Math.random() * (delayMax - delayMin)}s`
    );
    piece.style.background = CONFETTI.colors[i % CONFETTI.colors.length];
    fragment.appendChild(piece);
  }

  els.confettiLayer.appendChild(fragment);
  window.setTimeout(() => {
    els.confettiLayer.innerHTML = "";
  }, CONFETTI.cleanupDelayMs);
}

export function checkWin() {
  if (state.placed !== state.total) return;
  void playWinCelebration();
  stopTimer();
  els.board.classList.add("complete-shine", "board-win-wave");
  window.setTimeout(() => {
    els.board.classList.remove("complete-shine", "board-win-wave");
  }, 1400);
  if (els.winTime) els.winTime.textContent = formatClockTime(state.seconds);
  if (els.winMoves) els.winMoves.textContent = String(state.moves);
  if (els.winPieces) els.winPieces.textContent = `${state.total} puzzli`;
  els.celebration.classList.remove("hidden");
  launchConfetti();
  window.setTimeout(launchConfetti, 650);
  setStatus(STATUS.finished);
}
