import { els, state } from "./state.js";

let panSession = null;

function boardPanZoomEnabled() {
  return false;
}

export function installBoardPanZoom() {
  syncBoardPanForViewport();
}

export function syncBoardPanForViewport() {
  panSession = null;
  if (!boardPanZoomEnabled()) {
    resetBoardPan();
  }
}

export function applyBoardPan(tx, ty, scale) {
  if (!boardPanZoomEnabled()) return;
  state.boardPanX = tx;
  state.boardPanY = ty;
  state.boardPanScale = scale;
  if (!els.boardPanLayer) return;
  els.boardPanLayer.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
}

export function resetBoardPan() {
  state.boardPanX = 0;
  state.boardPanY = 0;
  state.boardPanScale = 1;
  if (els.boardPanLayer) {
    els.boardPanLayer.style.transform = "";
  }
}

export function updateBoardGhostHints() {
  const layer = els.boardGhost;
  if (!layer || !els.board) return;
  layer.replaceChildren();
  if (state.assistMode === "minimal" || !state.started) return;

  const locked = new Set();
  state.pieces.forEach((piece) => {
    if (piece.dataset.locked === "true") {
      locked.add(`${piece.dataset.row},${piece.dataset.col}`);
    }
  });
  if (locked.size === 0) return;

  const hintCells = new Set();
  locked.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nc < 0 || nr >= state.rows || nc >= state.cols) return;
      const k = `${nr},${nc}`;
      if (!locked.has(k)) hintCells.add(k);
    });
  });

  hintCells.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    const div = document.createElement("div");
    div.className = "board-ghost-cell";
    div.style.left = `${col * state.pieceW}px`;
    div.style.top = `${row * state.pieceH}px`;
    div.style.width = `${state.pieceW}px`;
    div.style.height = `${state.pieceH}px`;
    layer.appendChild(div);
  });
}
