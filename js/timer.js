import { els, state } from "./state.js";
import { formatClockTime } from "./utils.js";

export function renderTimer() {
  els.timer.textContent = formatClockTime(state.seconds);
}

export function startTimer() {
  stopTimer();
  state.timerId = window.setInterval(() => {
    state.seconds += 1;
    renderTimer();
  }, 1000);
}

export function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

export function resetTimer() {
  stopTimer();
  state.seconds = 0;
  renderTimer();
  startTimer();
}
