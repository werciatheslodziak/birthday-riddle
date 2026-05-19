import { OPEN_GIFT_TIMING } from "./config.js";
import { els, state, syncMobileActionsBar } from "./state.js";
import { syncBoardPanForViewport } from "./board-view.js";
import { buildPuzzle } from "./board.js";
import { startTimer } from "./timer.js";
import { playGiftReveal, startBgmIfAllowed } from "./sounds.js";
import { loadImage, prefersReducedMotion } from "./utils.js";

let prefetchPromise = null;

export function prefetchPuzzleImage() {
  if (!state.imageSrc) return Promise.resolve();
  if (prefetchPromise) return prefetchPromise;
  prefetchPromise = loadImage(state.imageSrc).catch(() => null);
  return prefetchPromise;
}

export function resetPrefetchCache() {
  prefetchPromise = null;
}

function waitMs(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function waitRevealAnimationEnd() {
  return new Promise((resolve) => {
    const reduced = prefersReducedMotion();
    const fallback = reduced ? 0 : OPEN_GIFT_TIMING.revealMs + 80;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      els.gameScreen.removeEventListener("animationend", onAnim);
      resolve();
    };
    const onAnim = (ev) => {
      if (ev.target !== els.gameScreen) return;
      finish();
    };
    els.gameScreen.addEventListener("animationend", onAnim);
    window.setTimeout(finish, fallback);
  });
}

export async function runOpenGiftSequence() {
  if (state.opening || state.started) return;
  state.opening = true;
  els.gift.setAttribute("aria-disabled", "true");
  els.gift.style.pointerEvents = "none";

  void playGiftReveal();
  void startBgmIfAllowed(els.bgmAudio);
  void prefetchPuzzleImage();

  const reduced = prefersReducedMotion();

  if (reduced) {
    els.startScreen.classList.add("hidden");
    els.startScreen.classList.remove("opening");
    els.gameScreen.classList.remove("hidden", "revealing");
    state.started = true;
    document.body.classList.add("game-started");
    await buildPuzzle();
    startTimer();
    state.opening = false;
    syncBoardPanForViewport();
    syncMobileActionsBar();
    return;
  }

  els.startScreen.classList.add("opening");
  await waitMs(OPEN_GIFT_TIMING.presentFadeMs);

  els.gameScreen.classList.remove("hidden");
  els.gameScreen.classList.add("revealing");
  state.started = true;
  document.body.classList.add("game-started");
  els.board?.classList.add("is-building");
  if (els.boardSkeleton) els.boardSkeleton.classList.remove("hidden");

  startTimer();
  const buildPromise = buildPuzzle();

  await waitMs(OPEN_GIFT_TIMING.hideStartMs);
  els.startScreen.classList.add("hidden");
  els.startScreen.classList.remove("opening");
  syncBoardPanForViewport();
  syncMobileActionsBar();

  await buildPromise;
  els.board?.classList.remove("is-building");
  if (els.boardSkeleton) els.boardSkeleton.classList.add("hidden");

  await waitRevealAnimationEnd();
  els.gameScreen.classList.remove("revealing");
  state.opening = false;
  syncBoardPanForViewport();
  syncMobileActionsBar();
}
