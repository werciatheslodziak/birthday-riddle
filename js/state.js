import { DEFAULT_IMAGE, PUZZLE } from "./config.js";
import { STATUS } from "./messages.js";

export const els = {
  startScreen: document.getElementById("startScreen"),
  sfxToggleStart: document.getElementById("sfxToggleStart"),
  musicToggleStart: document.getElementById("musicToggleStart"),
  gameScreen: document.getElementById("gameScreen"),
  gift: document.getElementById("gift"),
  backdrop: document.getElementById("puzzleBackdrop"),
  board: document.getElementById("puzzleBoard"),
  boardSkeleton: document.getElementById("boardSkeleton"),
  boardPanLayer: document.getElementById("boardPanLayer"),
  boardGhost: document.getElementById("boardGhost"),
  boardWrap: document.querySelector(".board-wrap"),
  workbench: document.getElementById("piecesWorkbench"),
  toggleWorkbench: document.getElementById("toggleWorkbench"),
  workbenchResizeHandle: document.getElementById("workbenchResizeHandle"),
  tray: document.getElementById("piecesTray"),
  preview: document.getElementById("previewImage"),
  pieceCount: document.getElementById("pieceCount"),
  difficultyButtons: document.querySelectorAll(".difficulty-button"),
  imageInput: document.getElementById("imageInput"),
  newPuzzle: document.getElementById("newPuzzle"),
  shuffle: document.getElementById("shufflePuzzle"),
  openGuide: document.getElementById("openGuide"),
  printTemplate: document.getElementById("printTemplate"),
  export3d: document.getElementById("export3d"),
  saveCheckpoint: document.getElementById("saveCheckpoint"),
  loadCheckpoint: document.getElementById("loadCheckpoint"),
  controlsDock: document.querySelector(".puzzle-area .controls.control-center"),
  checkpointDock: document.querySelector(".puzzle-area .checkpoint-panel"),
  difficultyDock: document.querySelector(".puzzle-area .difficulty-strip"),
  trayFilters: document.querySelectorAll(".tray-filter"),
  focusBoard: document.getElementById("focusBoard"),
  assistMode: document.getElementById("assistMode"),
  sidePanel: document.getElementById("gameSidePanel"),
  toggleFocusSidePanel: document.getElementById("toggleFocusSidePanel"),
  regionStats: document.getElementById("regionStats"),
  sfxToggle: document.getElementById("sfxToggle"),
  musicToggle: document.getElementById("musicToggle"),
  bgmAudio: document.getElementById("bgmAudio"),
  previewZoom: document.getElementById("previewZoom"),
  previewModal: document.getElementById("imagePreviewModal"),
  closePreview: document.getElementById("closePreview"),
  largePreview: document.getElementById("largePreviewImage"),
  moves: document.getElementById("moves"),
  timer: document.getElementById("timer"),
  placed: document.getElementById("placedCount"),
  status: document.getElementById("status"),
  celebration: document.getElementById("stitchCelebration"),
  closeCelebration: document.getElementById("closeCelebration"),
  guideScreen: document.getElementById("guideScreen"),
  closeGuide: document.getElementById("closeGuide"),
  winTime: document.getElementById("winTime"),
  winMoves: document.getElementById("winMoves"),
  winPieces: document.getElementById("winPieces"),
  winNewPuzzle: document.getElementById("winNewPuzzle"),
  winChangeLevel: document.getElementById("winChangeLevel"),
  winViewImage: document.getElementById("winViewImage"),
  pieceZoom: document.getElementById("pieceZoom"),
  confettiLayer: document.getElementById("confettiLayer"),
  mobileActions: document.getElementById("mobileActions"),
  mobilePreview: document.getElementById("mobilePreview"),
  mobileFocus: document.getElementById("mobileFocus"),
  mobileHelp: document.getElementById("mobileHelp"),
  tutorialOverlay: document.getElementById("tutorialOverlay"),
  tutorialNext: document.getElementById("tutorialNext"),
  tutorialSkip: document.getElementById("tutorialSkip"),
  traySortButtons: document.querySelectorAll("[data-tray-sort]"),
};

export const state = {
  imageSrc: DEFAULT_IMAGE,
  imageWidth: 1280,
  imageHeight: 720,
  cols: 5,
  rows: 5,
  total: 25,
  pieceW: 0,
  pieceH: 0,
  tab: 0,
  moves: 0,
  seconds: 0,
  placed: 0,
  timerId: null,
  started: false,
  pieces: [],
  verticalTabs: [],
  horizontalTabs: [],
  objectUrl: null,
  opening: false,
  selectedPiece: null,
  trayFilterType: "all",
  trayFilterRegion: "all",
  trayShapeFilter: "all",
  focusMode: false,
  focusSidePanelCollapsed: false,
  assistMode: "warm",
  workbenchCollapsed: true,
  boardPanX: 0,
  boardPanY: 0,
  boardPanScale: 1,
  puzzleRenderSrc: null,
};

export function setStatus(message) {
  els.status.textContent = message ?? "";
}

export function updateStats() {
  els.moves.textContent = String(state.moves);
  els.placed.textContent = `${state.placed} / ${state.total}`;
  if (els.regionStats && Array.isArray(state.pieces)) {
    const count = (fn) => state.pieces.filter(fn).length;
    const locked = (fn) =>
      state.pieces.filter((piece) => piece.dataset.locked === "true" && fn(piece)).length;
    const edge = (piece) => piece.dataset.trayType === "edge" || piece.dataset.trayType === "corner";
    const top = (piece) => {
      const row = Number(piece.dataset.row);
      return row < Math.ceil(state.rows / 3);
    };
    const middle = (piece) => {
      const row = Number(piece.dataset.row);
      const col = Number(piece.dataset.col);
      const inY = row >= Math.ceil(state.rows / 3) && row < Math.floor((state.rows * 2) / 3);
      const inX = col >= Math.ceil(state.cols / 3) && col < Math.floor((state.cols * 2) / 3);
      return inX && inY;
    };
    const bottom = (piece) => {
      const row = Number(piece.dataset.row);
      return row >= Math.floor((state.rows * 2) / 3);
    };
    const leftR = (piece) => {
      const col = Number(piece.dataset.col);
      return col < Math.ceil(state.cols / 3);
    };
    const rightR = (piece) => {
      const col = Number(piece.dataset.col);
      return col >= Math.floor((state.cols * 2) / 3);
    };
    els.regionStats.innerHTML =
      `<span class="region-stat"><strong>Rama</strong> ${locked(edge)}/${count(edge)}</span>` +
      `<span class="region-stat"><strong>Góra</strong> ${locked(top)}/${count(top)}</span>` +
      `<span class="region-stat"><strong>Dół</strong> ${locked(bottom)}/${count(bottom)}</span>` +
      `<span class="region-stat"><strong>Centrum</strong> ${locked(middle)}/${count(middle)}</span>` +
      `<span class="region-stat"><strong>Lewo</strong> ${locked(leftR)}/${count(leftR)}</span>` +
      `<span class="region-stat"><strong>Prawo</strong> ${locked(rightR)}/${count(rightR)}</span>`;
  }
}

export function isGameScreenActive() {
  return (
    state.started &&
    !state.opening &&
    els.startScreen?.classList.contains("hidden") === true &&
    els.gameScreen?.classList.contains("hidden") !== true
  );
}

export function syncMobileActionsBar() {
  if (!els.mobileActions) return;
  let showMobile = false;
  try {
    showMobile = window.matchMedia("(max-width: 900px)").matches;
  } catch {
    showMobile = false;
  }
  const visible = showMobile && isGameScreenActive();
  if (visible) els.mobileActions.removeAttribute("hidden");
  else els.mobileActions.setAttribute("hidden", "");
  document.body.classList.toggle("mobile-actions-visible", visible);
}

export function syncDifficultyButtons() {
  els.difficultyButtons.forEach((button) => {
    const active = button.dataset.pieces === els.pieceCount.value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

export function syncPrintExportButtons() {
  const disabled = state.total >= PUZZLE.printExportDisabledMinPieces;
  els.printTemplate.disabled = disabled;
  els.export3d.disabled = disabled;
  els.printTemplate.setAttribute("aria-disabled", disabled ? "true" : "false");
  els.export3d.setAttribute("aria-disabled", disabled ? "true" : "false");
  if (disabled) {
    els.printTemplate.title = STATUS.printExportDisabledTitle;
    els.export3d.title = STATUS.printExportDisabledTitle;
  } else {
    els.printTemplate.removeAttribute("title");
    els.export3d.removeAttribute("title");
  }
}
