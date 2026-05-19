import { PUZZLE } from "./config.js";
import {
  clampPiecePresetForViewport,
  isDesktopOnlyPreset,
  isWideDesktopViewport,
  isWorkbenchLayoutVisible,
} from "./desktop-difficulty.js";
import {
  els,
  state,
  setStatus,
  syncDifficultyButtons,
  syncPrintExportButtons,
  updateStats,
} from "./state.js";
import { STATUS } from "./messages.js";
import { gridFromCount } from "./geometry.js";
import { loadImage, clampNumber } from "./utils.js";
import { setPuzzleBackground } from "./background.js";
import { preparePuzzleImageSource } from "./image-prep.js";
import { updateBoardGhostHints } from "./board-view.js";
import {
  applyTrayFilters,
  buildPiecesIntoTray,
  hidePieceZoom,
  mountLockedPiece,
  resetTrayFilters,
  scatterPieces,
} from "./pieces.js";
import {
  applySerializedGroups,
  clearPuzzleGroups,
  rebuildPuzzleGroupsFromPieces,
} from "./groups.js";
import { checkWin } from "./celebrate.js";

export function connectorsAreValid(verticalTabs, horizontalTabs, cols, rows) {
  const verticalOk =
    Array.isArray(verticalTabs) &&
    verticalTabs.length === rows &&
    verticalTabs.every(
      (row) => Array.isArray(row) && row.length === Math.max(0, cols - 1)
    );
  const horzExpectedRows = Math.max(0, rows - 1);
  const horizontalOk =
    Array.isArray(horizontalTabs) &&
    horizontalTabs.length === horzExpectedRows &&
    horizontalTabs.every((row) => Array.isArray(row) && row.length === cols);
  return verticalOk && horizontalOk;
}

export function createConnectors(preset = null) {
  if (
    preset?.verticalTabs &&
    preset.horizontalTabs &&
    connectorsAreValid(preset.verticalTabs, preset.horizontalTabs, state.cols, state.rows)
  ) {
    state.verticalTabs = preset.verticalTabs.map((row) => [...row]);
    state.horizontalTabs = preset.horizontalTabs.map((row) => [...row]);
    return;
  }
  state.verticalTabs = Array.from({ length: state.rows }, () =>
    Array.from({ length: Math.max(0, state.cols - 1) }, () => (Math.random() > 0.5 ? 1 : -1))
  );
  state.horizontalTabs = Array.from(
    { length: Math.max(0, state.rows - 1) },
    () => Array.from({ length: state.cols }, () => (Math.random() > 0.5 ? 1 : -1))
  );
}

function restorePiecesFromSnapshot(piecesSnapshots) {
  const map = new Map();
  state.pieces.forEach((piece) => {
    map.set(`${piece.dataset.row},${piece.dataset.col}`, piece);
  });

  const tray = els.tray;
  let lockedCount = 0;

  piecesSnapshots.forEach((snap) => {
    const piece = map.get(`${snap.row},${snap.col}`);
    if (!piece) return;
    piece.classList.remove("dragging", "selected-rotate", "snap-success");
    piece.dataset.rotation = String(Number(snap.rotation) % 360);
    piece.style.transform = `rotate(${piece.dataset.rotation}deg)`;

    if (snap.locked) {
      mountLockedPiece(piece);
      lockedCount += 1;
      return;
    }

    piece.dataset.locked = "false";
    piece.classList.remove("locked");

    if (
      snap.surface === "board" &&
      Number.isFinite(Number(snap.bx)) &&
      Number.isFinite(Number(snap.by))
    ) {
      els.board.appendChild(piece);
      piece.style.position = "absolute";
      const bw = els.board.clientWidth;
      const bh = els.board.clientHeight;
      const pw = piece.offsetWidth;
      const ph = piece.offsetHeight;
      const pad = state.tab;
      let left = Number(snap.bx) * bw;
      let top = Number(snap.by) * bh;
      left = clampNumber(left, -pad, Math.max(-pad, bw - pw + pad));
      top = clampNumber(top, -pad, Math.max(-pad, bh - ph + pad));
      piece.style.left = `${left}px`;
      piece.style.top = `${top}px`;
      piece.style.zIndex = String(snap.z || 8);
      return;
    }

    if (
      snap.surface === "workbench" &&
      Number.isFinite(Number(snap.wx)) &&
      Number.isFinite(Number(snap.wy))
    ) {
      if (!isWorkbenchLayoutVisible()) {
        tray.appendChild(piece);
        piece.style.position = "absolute";
        const iw = Math.max(tray.clientWidth, 260);
        const ih = Math.max(tray.clientHeight, 260);
        const pw = piece.offsetWidth;
        const ph = piece.offsetHeight;
        const maxX = Math.max(8, iw - pw - 12);
        const maxY = Math.max(52, ih - ph - 12);
        const left = clampNumber(Number(snap.wx) * iw, 4, maxX);
        const top = clampNumber(Number(snap.wy) * ih, 48, maxY);
        piece.style.left = `${left}px`;
        piece.style.top = `${top}px`;
        piece.style.zIndex = String(snap.z || 8);
        return;
      }
      els.workbench.appendChild(piece);
      piece.style.position = "absolute";
      const ww = Math.max(1, els.workbench.clientWidth);
      const wh = Math.max(1, els.workbench.clientHeight);
      const pw = piece.offsetWidth;
      const ph = piece.offsetHeight;
      const pad = state.tab;
      let left = Number(snap.wx) * ww;
      let top = Number(snap.wy) * wh;
      left = clampNumber(left, -pad, Math.max(-pad, ww - pw + pad));
      top = clampNumber(top, -pad, Math.max(-pad, wh - ph + pad));
      piece.style.left = `${left}px`;
      piece.style.top = `${top}px`;
      piece.style.zIndex = String(snap.z || 8);
      return;
    }

    tray.appendChild(piece);
    piece.style.position = "absolute";
    const iw = Math.max(tray.clientWidth, 260);
    const ih = Math.max(tray.clientHeight, 260);
    const maxX = Math.max(8, iw - piece.offsetWidth - 12);
    const maxY = Math.max(52, ih - piece.offsetHeight - 12);
    const left = clampNumber((snap.fx ?? 0.1) * iw, 4, maxX);
    const top = clampNumber((snap.fy ?? 0.2) * ih, 48, maxY);
    piece.style.left = `${left}px`;
    piece.style.top = `${top}px`;
    piece.style.zIndex = String(snap.z || 8);
  });

  state.placed = lockedCount;
}

function computeBoardDimensions(imageWidth, imageHeight) {
  const ratio = imageWidth / imageHeight;
  const availableWidth =
    els.boardWrap?.clientWidth ||
    (typeof window !== "undefined"
      ? Math.max(PUZZLE.minBoardWidth, window.innerWidth - 56)
      : PUZZLE.minBoardWidth);

  let maxWidth;
  if (state.total <= 36) {
    maxWidth = Math.min(PUZZLE.maxBoardWidth, availableWidth);
  } else if (state.total <= 100) {
    maxWidth = Math.min(PUZZLE.maxBoardWidth + 180, availableWidth);
  } else if (state.total >= PUZZLE.desktopHeavyBoardMinPieces) {
    const refW = Math.max(1, PUZZLE.boardScaleReferenceWidthPx);
    const naturalW = Math.max(320, Number(imageWidth) || refW);
    let sourceMul = (naturalW / refW) ** PUZZLE.boardScaleGamma;
    sourceMul = clampNumber(sourceMul, PUZZLE.boardScaleMulFloor, PUZZLE.boardScaleMulCeil);

    const raw = Math.round(availableWidth * sourceMul);
    maxWidth = clampNumber(raw, PUZZLE.minBoardWidth, availableWidth);
  } else {
    maxWidth = availableWidth;
  }

  const boardWidth = Math.max(PUZZLE.minBoardWidth, maxWidth);
  const boardHeight = boardWidth / ratio;
  return { boardWidth, boardHeight };
}

export async function buildPuzzle(options = {}) {
  hidePieceZoom();
  let resume = options.resume;
  let presetRequested = Number(resume?.pieceCountPreset ?? els.pieceCount.value);
  if (!Number.isFinite(presetRequested) || presetRequested < 1) presetRequested = 25;
  presetRequested = Math.floor(presetRequested);

  const presetRequestedBeforeClamp = presetRequested;
  const presetCount = clampPiecePresetForViewport(presetRequestedBeforeClamp);

  els.pieceCount.value = String(presetCount);

  if (Boolean(resume) && presetCount !== presetRequestedBeforeClamp) {
    resume = undefined;
    if (state.started && !options.suppressHeavyClampMessage) {
      if (!isWideDesktopViewport() && presetRequestedBeforeClamp > PUZZLE.mobileMaxPresetPieces) {
        setStatus(STATUS.mobileMaxPiecesClamp(PUZZLE.mobileMaxPresetPieces));
      } else if (isDesktopOnlyPreset(presetRequestedBeforeClamp)) {
        setStatus(STATUS.desktopHeavyRebuildMin(PUZZLE.desktopOnlyMinPieces));
      }
    }
  }

  const grid = gridFromCount(presetCount);
  state.cols = grid.cols;
  state.rows = grid.rows;
  state.total = grid.total;

  document.body.classList.toggle("hard-mode", state.total >= PUZZLE.hardModeThreshold);
  document.body.classList.toggle("wide-puzzle", state.total >= PUZZLE.desktopHeavyBoardMinPieces);
  document.body.classList.toggle(
    "dense-desktop-tier",
    state.total >= PUZZLE.desktopHeavyBoardMinPieces
  );
  document.body.classList.toggle("monument-tier", state.total >= PUZZLE.monumentTierMinPieces);
  els.celebration.classList.add("hidden");

  state.moves = resume ? Number(resume.moves) || 0 : 0;
  state.placed = 0;
  state.pieces = [];
  resetTrayFilters();
  clearPuzzleGroups();
  updateStats();
  syncPrintExportButtons();

  let img = null;
  try {
    const renderSrc = await preparePuzzleImageSource(state.imageSrc);
    state.puzzleRenderSrc = renderSrc;
    img = await loadImage(renderSrc);
    state.imageWidth = img.naturalWidth || img.width;
    state.imageHeight = img.naturalHeight || img.height;
  } catch {
    setStatus(STATUS.imageLoadFailed);
    return;
  }

  els.preview.src = state.puzzleRenderSrc || state.imageSrc;
  els.largePreview.src = state.puzzleRenderSrc || state.imageSrc;
  setPuzzleBackground(state.puzzleRenderSrc || state.imageSrc, img);

  els.board.style.setProperty(
    "--board-ratio",
    `${state.imageWidth} / ${state.imageHeight}`
  );
  els.preview.style.setProperty(
    "--preview-ratio",
    `${state.imageWidth} / ${state.imageHeight}`
  );

  const { boardWidth, boardHeight } = computeBoardDimensions(state.imageWidth, state.imageHeight);
  state.pieceW = boardWidth / state.cols;
  state.pieceH = boardHeight / state.rows;
  state.tab = Math.max(PUZZLE.minTab, Math.min(state.pieceW, state.pieceH) * PUZZLE.tabRatio);

  els.board.style.width = `${boardWidth}px`;
  els.board.style.height = `${boardHeight}px`;
  els.board.style.maxWidth = `${boardWidth}px`;
  els.board.style.setProperty("--cell-w", `${state.pieceW}px`);
  els.board.style.setProperty("--cell-h", `${state.pieceH}px`);
  els.tray.style.maxWidth = `${boardWidth}px`;
  els.workbench.style.maxWidth = `${boardWidth}px`;
  els.board.classList.add("ready");
  els.board.innerHTML = "";
  els.tray.querySelectorAll(".piece").forEach((piece) => piece.remove());
  els.workbench.querySelectorAll(".piece").forEach((piece) => piece.remove());

  const canResume = Boolean(
    resume &&
      Array.isArray(resume.pieces) &&
      resume.pieces.length === state.total &&
      resume.cols === state.cols &&
      resume.rows === state.rows &&
      connectorsAreValid(resume.verticalTabs, resume.horizontalTabs, state.cols, state.rows)
  );

  createConnectors(canResume ? resume : null);
  await buildPiecesIntoTray();

  if (canResume) {
    restorePiecesFromSnapshot(resume.pieces);
    applySerializedGroups(resume.groups);
    applyTrayFilters();
    updateStats();
    if (state.placed === state.total) checkWin();
  } else {
    scatterPieces();
    rebuildPuzzleGroupsFromPieces();
  }

  syncDifficultyButtons();

  updateBoardGhostHints();

  if (!resume || !canResume) {
    setStatus(STATUS.initialHint(isWideDesktopViewport()));
  }
}

export function shuffleLoosePieces() {
  const choices = [0, 90, 180, 270];
  state.pieces.forEach((piece) => {
    if (piece.dataset.locked === "true") return;
    const rotation = choices[Math.floor(Math.random() * choices.length)];
    piece.dataset.rotation = String(rotation);
    piece.style.transform = `rotate(${rotation}deg)`;
  });
  scatterPieces();
  setStatus(STATUS.shuffled);
}
