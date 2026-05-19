import { CHECKPOINT_SCHEMA_VERSION, DEFAULT_IMAGE, STORAGE_KEYS } from "./config.js";
import { isDesktopOnlyPreset, isWorkbenchLayoutVisible } from "./desktop-difficulty.js";
import { els, state, setStatus } from "./state.js";
import { STATUS } from "./messages.js";
import { blobToDataUrl, clampNumber, formatSaveTime } from "./utils.js";
import { buildPuzzle } from "./board.js";
import { isDraggingNow, flushWorkbenchPiecesToTray } from "./pieces.js";
import { getSerializableGroups } from "./groups.js";
import { startTimer, stopTimer, renderTimer } from "./timer.js";

async function serializeImagePayload() {
  if (!state.objectUrl) {
    return { kind: "default" };
  }
  try {
    const response = await fetch(state.imageSrc);
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    return { kind: "dataUrl", mime: blob.type || "image/jpeg", data: dataUrl };
  } catch {
    return { kind: "default" };
  }
}

async function hydrateImage(imagePayload) {
  const reset = () => {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  };

  if (!imagePayload || imagePayload.kind === "default") {
    reset();
    state.imageSrc = DEFAULT_IMAGE;
    return;
  }
  if (imagePayload.kind === "dataUrl" && typeof imagePayload.data === "string") {
    reset();
    state.imageSrc = imagePayload.data;
  }
}

function gatherResumePayload() {
  if (!isWorkbenchLayoutVisible()) {
    flushWorkbenchPiecesToTray();
  }
  const tray = els.tray;
  const trayRect = tray.getBoundingClientRect();
  const trayW = Math.max(1, trayRect.width);
  const trayH = Math.max(1, trayRect.height);
  const boardW = Math.max(1, els.board.clientWidth);
  const boardH = Math.max(1, els.board.clientHeight);
  const workbenchW = Math.max(1, els.workbench.clientWidth);
  const workbenchH = Math.max(1, els.workbench.clientHeight);

  const piecesSnapshots = state.pieces.map((piece) => {
    const row = Number(piece.dataset.row);
    const col = Number(piece.dataset.col);
    const locked = piece.dataset.locked === "true";
    const rotation = Number(piece.dataset.rotation) % 360;
    const z = Number(piece.style.zIndex) || 2;
    if (locked) return { row, col, locked: true, rotation: 0, z };
    if (piece.parentElement === els.board) {
      const left = parseFloat(piece.style.left);
      const top = parseFloat(piece.style.top);
      const lx = Number.isFinite(left) ? left : 0;
      const ty = Number.isFinite(top) ? top : 0;
      return {
        row,
        col,
        locked: false,
        rotation,
        z,
        surface: "board",
        bx: clampNumber(lx / boardW, -0.5, 1.5),
        by: clampNumber(ty / boardH, -0.5, 1.5),
      };
    }
    if (piece.parentElement === els.workbench) {
      const left = parseFloat(piece.style.left);
      const top = parseFloat(piece.style.top);
      const lx = Number.isFinite(left) ? left : 0;
      const ty = Number.isFinite(top) ? top : 0;
      return {
        row,
        col,
        locked: false,
        rotation,
        z,
        surface: "workbench",
        wx: clampNumber(lx / workbenchW, -0.5, 1.5),
        wy: clampNumber(ty / workbenchH, -0.5, 1.5),
      };
    }
    const pieceRect = piece.getBoundingClientRect();
    return {
      row,
      col,
      locked: false,
      rotation,
      z,
      surface: "tray",
      fx: Math.min(0.99, Math.max(0, (pieceRect.left - trayRect.left) / trayW)),
      fy: Math.min(0.99, Math.max(0, (pieceRect.top - trayRect.top) / trayH)),
    };
  });

  return {
    pieceCountPreset: Number(els.pieceCount.value),
    cols: state.cols,
    rows: state.rows,
    moves: state.moves,
    seconds: state.seconds,
    verticalTabs: state.verticalTabs.map((row) => [...row]),
    horizontalTabs: state.horizontalTabs.map((row) => [...row]),
    pieces: piecesSnapshots,
    groups: getSerializableGroups(),
  };
}

export async function saveCheckpoint() {
  if (!state.started) return;
  if (isDraggingNow()) {
    setStatus(STATUS.saveBusy);
    return;
  }

  const imagePayload = await serializeImagePayload();
  const checkpoint = {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    image: imagePayload,
    ...gatherResumePayload(),
  };

  try {
    localStorage.setItem(STORAGE_KEYS.checkpoint, JSON.stringify(checkpoint));
    setStatus(STATUS.saveSuccess(formatSaveTime(new Date(checkpoint.savedAt))));
  } catch {
    setStatus(STATUS.saveFailed);
  }
}

export async function loadCheckpoint() {
  const raw = localStorage.getItem(STORAGE_KEYS.checkpoint);
  if (!raw) {
    setStatus(STATUS.loadEmpty);
    return;
  }

  let checkpoint;
  try {
    checkpoint = JSON.parse(raw);
  } catch {
    setStatus(STATUS.loadCorrupt);
    return;
  }

  if (
    checkpoint.schemaVersion !== CHECKPOINT_SCHEMA_VERSION ||
    !checkpoint.verticalTabs ||
    !checkpoint.horizontalTabs ||
    !Array.isArray(checkpoint.pieces)
  ) {
    setStatus(STATUS.loadUnsupported);
    return;
  }

  if (!state.started) {
    setStatus(STATUS.loadBeforeGame);
    return;
  }

  const requestedPreset = Number(checkpoint.pieceCountPreset) || 25;
  els.pieceCount.value = String(requestedPreset);
  await hydrateImage(checkpoint.image);
  await buildPuzzle({ resume: checkpoint, suppressHeavyClampMessage: true });

  stopTimer();
  state.seconds = Number(checkpoint.seconds) || 0;
  renderTimer();
  startTimer();

  els.celebration.classList.add("hidden");

  const dimsApplied = `${state.cols} × ${state.rows}`;
  if (
    Number.isFinite(requestedPreset) &&
    isDesktopOnlyPreset(requestedPreset) &&
    Number(els.pieceCount.value) !== requestedPreset
  ) {
    setStatus(STATUS.loadHeavyViewportFallback(requestedPreset, dimsApplied));
    return;
  }

  const dims =
    checkpoint.cols && checkpoint.rows ? `${checkpoint.cols} × ${checkpoint.rows}` : dimsApplied;
  setStatus(STATUS.loadSuccess(dims));
}

export function getResumePayloadForResize() {
  return gatherResumePayload();
}
