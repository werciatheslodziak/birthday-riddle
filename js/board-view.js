import { PUZZLE } from "./config.js";
import { els, state } from "./state.js";

let panSession = null;

function isMobileBoardPan() {
  try {
    return window.matchMedia("(max-width: 900px)").matches;
  } catch {
    return false;
  }
}

export function installBoardPanZoom() {
  const wrap = els.boardWrap;
  if (!wrap) return;

  wrap.addEventListener(
    "pointerdown",
    (ev) => {
      if (!isMobileBoardPan() || !state.started) return;
      if (ev.target.closest(".piece, .pieces-tray, .pieces-workbench")) return;
      panSession = {
        pointerId: ev.pointerId,
        startX: ev.clientX,
        startY: ev.clientY,
        startScale: state.boardPanScale,
        startTx: state.boardPanX,
        startTy: state.boardPanY,
        mode: "pan",
        pinchStartDist: 0,
      };
    },
    { passive: true }
  );

  wrap.addEventListener(
    "pointermove",
    (ev) => {
      if (!panSession || panSession.pointerId !== ev.pointerId) return;
      if (panSession.mode === "pan") {
        const dx = ev.clientX - panSession.startX;
        const dy = ev.clientY - panSession.startY;
        applyBoardPan(panSession.startTx + dx, panSession.startTy + dy, state.boardPanScale);
      }
    },
    { passive: true }
  );

  const endPan = (ev) => {
    if (!panSession || panSession.pointerId !== ev.pointerId) return;
    panSession = null;
  };
  wrap.addEventListener("pointerup", endPan);
  wrap.addEventListener("pointercancel", endPan);

  wrap.addEventListener(
    "touchstart",
    (ev) => {
      if (!isMobileBoardPan() || !state.started || ev.touches.length !== 2) return;
      const [a, b] = ev.touches;
      panSession = {
        mode: "pinch",
        pinchStartDist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
        startScale: state.boardPanScale,
        startTx: state.boardPanX,
        startTy: state.boardPanY,
      };
    },
    { passive: true }
  );

  wrap.addEventListener(
    "touchmove",
    (ev) => {
      if (!panSession || panSession.mode !== "pinch" || ev.touches.length !== 2) return;
      const [a, b] = ev.touches;
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      if (panSession.pinchStartDist < 1) return;
      const ratio = dist / panSession.pinchStartDist;
      const minS = PUZZLE.boardPanScaleMin ?? 0.85;
      const maxS = PUZZLE.boardPanScaleMax ?? 1.65;
      const next = Math.min(maxS, Math.max(minS, panSession.startScale * ratio));
      applyBoardPan(panSession.startTx, panSession.startTy, next);
    },
    { passive: true }
  );

  wrap.addEventListener("touchend", () => {
    if (panSession?.mode === "pinch") panSession = null;
  });

  wrap.addEventListener("dblclick", () => {
    if (!isMobileBoardPan()) return;
    resetBoardPan();
  });
}

export function applyBoardPan(tx, ty, scale) {
  state.boardPanX = tx;
  state.boardPanY = ty;
  state.boardPanScale = scale;
  if (!els.boardPanLayer) return;
  els.boardPanLayer.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
}

export function resetBoardPan() {
  applyBoardPan(0, 0, 1);
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
