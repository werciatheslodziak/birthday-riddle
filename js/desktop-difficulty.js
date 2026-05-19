import { PUZZLE } from "./config.js";
import { gridFromCount } from "./geometry.js";
import { els } from "./state.js";

export function isWideDesktopViewport() {
  try {
    return window.matchMedia(PUZZLE.desktopPuzzleMq).matches;
  } catch {
    return true;
  }
}

export function isDesktopOnlyPreset(pieceTotal) {
  return Number(pieceTotal) >= PUZZLE.desktopOnlyMinPieces;
}

function mobilePresetGridHint() {
  const g = gridFromCount(PUZZLE.mobileMaxPresetPieces);
  return `${g.cols}×${g.rows}`;
}

export function clampPiecePresetForViewport(presetRaw) {
  const parsed = Number(presetRaw);
  let n =
    Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : PUZZLE.desktopHeavyFallbackPieces;

  if (!isWideDesktopViewport() && n > PUZZLE.mobileMaxPresetPieces) {
    n = PUZZLE.mobileMaxPresetPieces;
  }

  if (!isDesktopOnlyPreset(n)) return n;
  return isWideDesktopViewport() ? n : PUZZLE.desktopHeavyFallbackPieces;
}

export function refreshDesktopDifficultyControls() {
  const allowHeavy = isWideDesktopViewport();
  els.difficultyButtons.forEach((button) => {
    const pc = Number(button.dataset.pieces);
    const gatedHeavy = Number.isFinite(pc) && isDesktopOnlyPreset(pc);
    const gatedMobile =
      Number.isFinite(pc) && !isWideDesktopViewport() && pc > PUZZLE.mobileMaxPresetPieces;

    if (gatedMobile) {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      button.title = `Na telefonie maksymalnie ${PUZZLE.mobileMaxPresetPieces} elementów (${mobilePresetGridHint()}).`;
      return;
    }

    if (!gatedHeavy) {
      button.disabled = false;
      button.removeAttribute("aria-disabled");
      button.removeAttribute("title");
      return;
    }

    button.disabled = !allowHeavy;
    button.setAttribute("aria-disabled", allowHeavy ? "false" : "true");
    button.title = allowHeavy
      ? ""
      : `Od ${PUZZLE.desktopOnlyMinPieces}+ elementów — dostępne przy szerokości okna od 1024 px (typowo desktop). Zmniejsz okno przeglądarki albo ustaw krajobraz na większym tablecie.`;
  });

  [...els.pieceCount.options].forEach((option) => {
    const pc = Number(option.value);
    const gatedHeavy = Number.isFinite(pc) && isDesktopOnlyPreset(pc);
    const gatedMobile =
      Number.isFinite(pc) && !isWideDesktopViewport() && pc > PUZZLE.mobileMaxPresetPieces;

    if (gatedMobile) {
      option.disabled = true;
      option.setAttribute("aria-disabled", "true");
      option.title = `Maks. ${PUZZLE.mobileMaxPresetPieces} elementów (${mobilePresetGridHint()}) na telefonie`;
      return;
    }

    if (!gatedHeavy) {
      option.disabled = false;
      option.removeAttribute("aria-disabled");
      option.removeAttribute("title");
      return;
    }

    option.disabled = !allowHeavy;
    if (!allowHeavy) {
      option.setAttribute("aria-disabled", "true");
      option.removeAttribute("title");
    } else {
      option.removeAttribute("aria-disabled");
      option.removeAttribute("title");
    }
  });
}

export function subscribeDesktopDifficultyLayout(listener) {
  try {
    const mq = window.matchMedia(PUZZLE.desktopPuzzleMq);
    if (mq.addEventListener) {
      mq.addEventListener("change", listener);
    } else if (mq.addListener) {
      mq.addListener(listener);
    }
  } catch {
  }
}

export function isWorkbenchLayoutVisible() {
  try {
    return window.matchMedia(PUZZLE.workbenchLayoutMq).matches;
  } catch {
    return true;
  }
}

export function subscribeWorkbenchLayout(listener) {
  try {
    const mq = window.matchMedia(PUZZLE.workbenchLayoutMq);
    if (mq.addEventListener) {
      mq.addEventListener("change", listener);
    } else if (mq.addListener) {
      mq.addListener(listener);
    }
  } catch {
  }
}
