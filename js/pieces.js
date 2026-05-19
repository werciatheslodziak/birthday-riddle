import { PUZZLE, ROTATION_STEP, ROTATION_OPTIONS, TRAY_HEIGHTS } from "./config.js";
import { updateBoardGhostHints } from "./board-view.js";
import { edgeSigns, puzzlePath } from "./geometry.js";
import { els, state, setStatus, updateStats } from "./state.js";
import { STATUS } from "./messages.js";
import { checkWin } from "./celebrate.js";
import { playParkSoft, playRejectSoft, playSnapSuccess } from "./sounds.js";
import { detachLockedFromGroups, getGroupPieces, tryMergeAround } from "./groups.js";
import { isWideDesktopViewport, isWorkbenchLayoutVisible } from "./desktop-difficulty.js";
import { debounceRaf, randomItem, clampNumber } from "./utils.js";

function prefersSequentialTapRotate() {
  try {
    return window.matchMedia("(max-width: 720px)").matches;
  } catch {
    return false;
  }
}

function desktopMouseChordRotateEnabled() {
  return !prefersSequentialTapRotate();
}

function rotateDragSessionChord() {
  if (!dragSession || !desktopMouseChordRotateEnabled()) return;
  const piece = dragSession.piece;
  if (getGroupPieces(piece).length > 1) {
    setStatus("Połączony fragment zostaje prosto — przeciągnij go jako całość.");
    return;
  }
  rotatePiece(piece);
  updateDragPlacementHints(piece, els.board.getBoundingClientRect());
}

function syncDesktopDragMouseChord(event) {
  if (!dragSession || !desktopMouseChordRotateEnabled()) return;
  if (dragSession.twistActive || event.pointerType !== "mouse") return;
  const both = (event.buttons & 3) === 3;
  if (both && !dragSession.mouseChordRotateLatch) {
    dragSession.mouseChordRotateLatch = true;
    rotateDragSessionChord();
  } else if (!both) {
    dragSession.mouseChordRotateLatch = false;
  }
}

function onDesktopDragChordMouseDown(event) {
  if (!dragSession || !desktopMouseChordRotateEnabled()) return;
  if (event.button !== 2 || (event.buttons & 3) !== 3) return;
  event.preventDefault();
  event.stopPropagation();
  syncDesktopDragMouseChord(event);
}

function onDesktopDragChordMouseUp(event) {
  if (!dragSession || !desktopMouseChordRotateEnabled()) return;
  if (event.button !== 0 && event.button !== 2) return;
  if ((event.buttons & 3) !== 3) dragSession.mouseChordRotateLatch = false;
}

const twistPointerPins = new Map();

function twistHydratePins(pointerId, clientX, clientY) {
  twistPointerPins.set(pointerId, { x: clientX, y: clientY });
}

function unwrapAngleDeltaRadians(prevRad, nextRad) {
  let d = nextRad - prevRad;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function normalizeRotationDegrees(deg) {
  return ((deg % 360) + 360) % 360;
}

function snapQuarterTurnDegrees(rawDeg) {
  const n = normalizeRotationDegrees(rawDeg);
  let snapped = Math.round(n / ROTATION_STEP) * ROTATION_STEP;
  return snapped % 360;
}

function twistChordAngleRad(holderIds, pins) {
  const ids = [...holderIds].sort((a, b) => a - b);
  if (ids.length < 2) return null;
  const p0 = pins.get(ids[0]);
  const p1 = pins.get(ids[1]);
  if (!p0 || !p1) return null;
  return Math.atan2(p1.y - p0.y, p1.x - p0.x);
}

function pointHitsDragPieces(clientX, clientY, dragEntries) {
  const pad = Math.max(0, Number(PUZZLE.twistSecondFingerHitPaddingPx) || 0);
  if (
    dragEntries.some(({ piece: ep }) => {
      const r = ep.getBoundingClientRect();
      return (
        clientX >= r.left - pad &&
        clientX <= r.right + pad &&
        clientY >= r.top - pad &&
        clientY <= r.bottom + pad
      );
    })
  ) {
    return true;
  }
  const raw = document.elementFromPoint(clientX, clientY);
  const piece = raw instanceof Element ? raw.closest(".piece") : null;
  return piece ? dragEntries.some(({ piece: ep }) => ep === piece) : false;
}

function applyTwistPiecesTransform(dragEntryRows, rotationDeg, scaleMul) {
  const scalePart = scaleMul !== 1 ? ` scale(${scaleMul})` : "";
  dragEntryRows.forEach((entry) => {
    entry.piece.style.transform = `rotate(${rotationDeg}deg)${scalePart}`;
  });
}

const SVG_NS = "http://www.w3.org/2000/svg";
let pieceIdCounter = 0;

let dragSession = null;
let nearChecksRafThrottled = null;
let autoScrollRaf = 0;
let autoScrollVelocity = 0;
let hoverZoomTimer = 0;

export function hidePieceZoom() {
  window.clearTimeout(hoverZoomTimer);
  hoverZoomTimer = 0;
  if (!els.pieceZoom) return;
  els.pieceZoom.classList.add("hidden");
  els.pieceZoom.replaceChildren();
}

function isPieceHoverZoomEnabled() {
  return state.total >= PUZZLE.pieceHoverZoomMinPieces;
}

function positionPieceZoom(clientX, clientY) {
  if (!els.pieceZoom || els.pieceZoom.classList.contains("hidden")) return;
  const pad = 16;
  const rect = els.pieceZoom.getBoundingClientRect();
  const left = clampNumber(clientX + 20, pad, window.innerWidth - rect.width - pad);
  const top = clampNumber(clientY - rect.height - 20, pad, window.innerHeight - rect.height - pad);
  els.pieceZoom.style.left = `${left}px`;
  els.pieceZoom.style.top = `${top}px`;
}

function showPieceZoom(piece, clientX, clientY) {
  if (!els.pieceZoom || piece.dataset.locked === "true" || !isPieceHoverZoomEnabled()) return;
  const clone = piece.cloneNode(true);
  clone.classList.remove(
    "dragging",
    "selected-rotate",
    "touch-twist-hint",
    "near-home",
    "near-home-rot",
    "piece-reject",
    "snap-success"
  );
  clone.removeAttribute("style");
  clone.style.width = `${Math.max(86, (state.pieceW + state.tab * 2) * 1.75)}px`;
  clone.style.height = `${Math.max(86, (state.pieceH + state.tab * 2) * 1.75)}px`;
  clone.style.transform = `rotate(${Number(piece.dataset.rotation) % 360}deg)`;
  els.pieceZoom.replaceChildren(clone);
  els.pieceZoom.classList.remove("hidden");
  positionPieceZoom(clientX, clientY);
}

function startDragAutoScroll() {
  if (autoScrollRaf) return;
  const step = () => {
    if (!dragSession || autoScrollVelocity === 0) {
      autoScrollRaf = 0;
      return;
    }
    window.scrollBy({ top: autoScrollVelocity, behavior: "auto" });
    autoScrollRaf = requestAnimationFrame(step);
  };
  autoScrollRaf = requestAnimationFrame(step);
}

function updateDragAutoScroll(clientY) {
  const edge = Math.min(110, Math.max(72, window.innerHeight * 0.16));
  const maxSpeed = 18;
  if (clientY < edge) {
    const t = (edge - clientY) / edge;
    autoScrollVelocity = -Math.ceil(maxSpeed * t * t);
  } else if (clientY > window.innerHeight - edge) {
    const t = (clientY - (window.innerHeight - edge)) / edge;
    autoScrollVelocity = Math.ceil(maxSpeed * t * t);
  } else {
    autoScrollVelocity = 0;
  }
  if (autoScrollVelocity !== 0) startDragAutoScroll();
}

function stopDragAutoScroll() {
  autoScrollVelocity = 0;
  if (autoScrollRaf) {
    cancelAnimationFrame(autoScrollRaf);
    autoScrollRaf = 0;
  }
}

function pieceTrayType(piece) {
  const row = Number(piece.dataset.row);
  const col = Number(piece.dataset.col);
  const verticalEdge = row === 0 || row === state.rows - 1;
  const horizontalEdge = col === 0 || col === state.cols - 1;
  if (verticalEdge && horizontalEdge) return "corner";
  if (verticalEdge || horizontalEdge) return "edge";
  return "center";
}

function pieceRegion(piece) {
  const row = Number(piece.dataset.row);
  const col = Number(piece.dataset.col);
  const topBand = row < Math.ceil(state.rows / 3);
  const bottomBand = row >= Math.floor((state.rows * 2) / 3);
  const leftBand = col < Math.ceil(state.cols / 3);
  const rightBand = col >= Math.floor((state.cols * 2) / 3);
  if (topBand) return "top";
  if (bottomBand) return "bottom";
  if (leftBand) return "left";
  if (rightBand) return "right";
  return "middle";
}

function pieceMatchesRegion(piece, region) {
  if (region === "all") return true;
  const row = Number(piece.dataset.row);
  const col = Number(piece.dataset.col);
  if (region === "top") return row < Math.ceil(state.rows / 3);
  if (region === "bottom") return row >= Math.floor((state.rows * 2) / 3);
  if (region === "left") return col < Math.ceil(state.cols / 3);
  if (region === "right") return col >= Math.floor((state.cols * 2) / 3);
  if (region === "middle") {
    const top = row < Math.ceil(state.rows / 3);
    const bottom = row >= Math.floor((state.rows * 2) / 3);
    const left = col < Math.ceil(state.cols / 3);
    const right = col >= Math.floor((state.cols * 2) / 3);
    return !top && !bottom && !left && !right;
  }
  return true;
}

function pieceMatchesTrayShapeFilter(piece) {
  const mode = state.trayShapeFilter || "all";
  if (mode === "all") return true;
  const t = piece.dataset.trayType;
  if (mode === "frame") return t === "edge" || t === "corner";
  if (mode === "edge") return t === "edge";
  if (mode === "center") return t === "center";
  return true;
}

function pieceMatchesTrayFilters(piece) {
  if (piece.dataset.locked === "true" || piece.parentElement !== els.tray) return true;
  const typeOk = state.trayFilterType === "all" || piece.dataset.trayType === state.trayFilterType;
  const regionOk = pieceMatchesRegion(piece, state.trayFilterRegion);
  const shapeOk = pieceMatchesTrayShapeFilter(piece);
  return typeOk && regionOk && shapeOk;
}

function arrangeVisibleTrayPieces() {
  const visible = state.pieces.filter(
    (piece) =>
      piece.parentElement === els.tray &&
      piece.dataset.locked !== "true" &&
      !piece.classList.contains("tray-filter-hidden")
  );
  if (visible.length === 0) return;

  const labelHeight = 44;
  const gap = Math.max(8, Math.min(18, state.tab * 0.75));
  const trayW = Math.max(320, els.tray.clientWidth);
  const cellW = Math.max(44, state.pieceW + state.tab * 2 + gap);
  const cellH = Math.max(44, state.pieceH + state.tab * 2 + gap);
  const cols = Math.max(1, Math.floor((trayW - gap) / cellW));
  const rows = Math.ceil(visible.length / cols);
  const targetHeight = Math.max(pickTrayHeight(), labelHeight + rows * cellH + gap * 2);
  els.tray.style.minHeight = `${Math.min(targetHeight, 720)}px`;

  visible.forEach((piece, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const left = gap + col * cellW;
    const top = labelHeight + gap + row * cellH;
    piece.style.left = `${left}px`;
    piece.style.top = `${top}px`;
    piece.style.zIndex = String(20 + index);
  });
}

export function applyTrayFilters(options = {}) {
  let visibleCount = 0;
  let hiddenCount = 0;
  state.pieces.forEach((piece) => {
    const visible = pieceMatchesTrayFilters(piece);
    piece.classList.toggle("tray-filter-hidden", !visible);
    if (piece.parentElement === els.tray && piece.dataset.locked !== "true") {
      if (visible) visibleCount += 1;
      else hiddenCount += 1;
    }
  });
  if (options.relayout) arrangeVisibleTrayPieces();
  els.tray.dataset.visiblePieces = String(visibleCount);
  els.tray.dataset.hiddenPieces = String(hiddenCount);
}

export function setTrayFilter(kind, value) {
  if (kind === "type") state.trayFilterType = value || "all";
  if (kind === "region") state.trayFilterRegion = value || "all";
  els.trayFilters.forEach((button) => {
    const active =
      button.dataset.filterKind === kind && button.dataset.filterValue === (value || "all");
    if (button.dataset.filterKind === kind) {
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
  });
  applyTrayFilters({ relayout: true });
}

const TRAY_SHAPE_FILTER_MAP = {
  "frame-first": "frame",
  frame: "frame",
  edges: "edge",
  edge: "edge",
  center: "center",
};

export function setTrayShapeFilter(mode) {
  const next = TRAY_SHAPE_FILTER_MAP[mode] || "all";
  state.trayShapeFilter = state.trayShapeFilter === next ? "all" : next;

  document.querySelectorAll("[data-tray-sort]").forEach((button) => {
    const mapped = TRAY_SHAPE_FILTER_MAP[button.dataset.traySort] || "all";
    const active = state.trayShapeFilter !== "all" && mapped === state.trayShapeFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  applyTrayFilters({ relayout: true });

  if (state.trayShapeFilter === "frame") {
    setStatus("Tacka: tylko rogi i brzegi (rama). Kliknij ponownie, żeby pokazać wszystkie.");
  } else if (state.trayShapeFilter === "edge") {
    setStatus("Tacka: tylko proste krawędzie (bez rogów). Kliknij ponownie, żeby pokazać wszystkie.");
  } else if (state.trayShapeFilter === "center") {
    setStatus("Tacka: tylko klocki ze środka. Kliknij ponownie, żeby pokazać wszystkie.");
  } else {
    setStatus("Tacka: wszystkie luźne klocki widoczne.");
  }
}

export function resetTrayFilters() {
  state.trayFilterType = "all";
  state.trayFilterRegion = "all";
  state.trayShapeFilter = "all";
  document.querySelectorAll("[data-tray-sort]").forEach((button) => {
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
  });
  els.trayFilters.forEach((button) => {
    const active = button.dataset.filterValue === "all";
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

export function selectPiece(piece) {
  if (state.selectedPiece && state.selectedPiece !== piece) {
    state.selectedPiece.classList.remove("selected-rotate");
  }
  state.selectedPiece = piece;
  if (piece && piece.dataset.locked !== "true") {
    piece.classList.add("selected-rotate");
  }
}


function prefersReducedRotationMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function pieceRotationVisual(deg, piece) {
  const dragging = piece.classList.contains("dragging");
  const scale = dragging ? PUZZLE.dragLiftScale : 1;
  const scalePart = scale !== 1 ? ` scale(${scale})` : "";
  const d = normalizeRotationDegrees(deg);
  return `rotate(${d}deg)${scalePart}`;
}

function pieceRotationTransformRawDeg(rawDeg, piece) {
  const dragging = piece.classList.contains("dragging");
  const scale = dragging ? PUZZLE.dragLiftScale : 1;
  const scalePart = scale !== 1 ? ` scale(${scale})` : "";
  return `rotate(${rawDeg}deg)${scalePart}`;
}

function snapPieceRotationNoTransition(piece, normDeg) {
  piece.style.transition = "none";
  const n = normalizeRotationDegrees(normDeg);
  piece.dataset.rotation = String(n);
  piece.style.transform = pieceRotationVisual(n, piece);
  void piece.getBoundingClientRect();
  piece.style.removeProperty("transition");
}

function runPieceQuarterRotateTween(piece, fromNorm, nextNorm) {
  const msRaw =
    PUZZLE.pieceRotateTransformMs !== undefined ? Number(PUZZLE.pieceRotateTransformMs) : 150;
  const tweenMs = Number.isFinite(msRaw) && msRaw >= 0 ? msRaw : 150;
  const ease =
    typeof PUZZLE.pieceRotateTransformEasing === "string" && PUZZLE.pieceRotateTransformEasing.length
      ? PUZZLE.pieceRotateTransformEasing
      : "ease";
  const endVisual = fromNorm + ROTATION_STEP;

  piece.classList.add("piece-rotate-tweening");

  piece.style.transition = "none";
  piece.style.transform = pieceRotationTransformRawDeg(fromNorm, piece);
  void piece.getBoundingClientRect();
  piece.style.transition = `transform ${tweenMs}ms ${ease}`;
  window.requestAnimationFrame(() => {
    piece.style.transform = pieceRotationTransformRawDeg(endVisual, piece);
  });

  let settled = false;
  const finalize = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(tid);
    piece.removeEventListener("transitionend", onEnd);
    piece.classList.remove("piece-rotate-tweening");
    snapPieceRotationNoTransition(piece, nextNorm);
    setStatus(nextNorm === 0 ? STATUS.rotationAligned : STATUS.rotationDegrees(nextNorm));
  };

  function onEnd(ev) {
    if (ev.target !== piece || ev.propertyName !== "transform") return;
    finalize();
  }
  piece.addEventListener("transitionend", onEnd);
  const tid = window.setTimeout(finalize, tweenMs + 80);
}

export function rotatePiece(piece) {
  if (!piece || piece.dataset.locked === "true") return;
  if (getGroupPieces(piece).length > 1) {
    setStatus("Połączony fragment zostaje prosto — przeciągnij go jako całość.");
    return;
  }

  if (piece.classList.contains("piece-rotate-tweening")) return;

  const fromNorm = normalizeRotationDegrees(Number(piece.dataset.rotation));
  const nextNorm = (fromNorm + ROTATION_STEP) % 360;

  const msRaw =
    PUZZLE.pieceRotateTransformMs !== undefined ? Number(PUZZLE.pieceRotateTransformMs) : 150;
  const tweenMs = Number.isFinite(msRaw) && msRaw >= 0 ? msRaw : 150;

  if (
    tweenMs <= 0 ||
    prefersReducedRotationMotion() ||
    piece.classList.contains("dragging")
  ) {
    snapPieceRotationNoTransition(piece, nextNorm);
    setStatus(nextNorm === 0 ? STATUS.rotationAligned : STATUS.rotationDegrees(nextNorm));
    return;
  }

  runPieceQuarterRotateTween(piece, fromNorm, nextNorm);
}

export function mountLockedPiece(piece) {
  const row = Number(piece.dataset.row);
  const col = Number(piece.dataset.col);
  els.board.appendChild(piece);
  piece.dataset.locked = "true";
  piece.classList.add("locked");
  piece.classList.remove("tray-filter-hidden");
  piece.classList.remove("piece-grouped");
  delete piece.dataset.groupId;
  if (state.selectedPiece === piece) state.selectedPiece = null;
  piece.style.position = "absolute";
  piece.style.left = `${col * state.pieceW - state.tab}px`;
  piece.style.top = `${row * state.pieceH - state.tab}px`;
  piece.style.zIndex = String(10 + row * state.cols + col);
  piece.dataset.rotation = "0";
  piece.style.transform = "rotate(0deg)";
  updateBoardGhostHints();
}

export function returnToTray(piece) {
  if (piece.dataset.locked === "true") return;
  piece.classList.remove("tray-filter-hidden");
  els.tray.appendChild(piece);
  piece.style.position = "absolute";
  piece.style.zIndex = String(5 + Math.floor(Math.random() * 200));

  const trayW = Math.max(320, els.tray.clientWidth);
  const trayH = Math.max(260, els.tray.clientHeight);
  const x = Math.random() * Math.max(8, trayW - piece.offsetWidth - 16);
  const y = 48 + Math.random() * Math.max(40, trayH - piece.offsetHeight - 60);
  piece.style.left = `${x}px`;
  piece.style.top = `${y}px`;
  applyTrayFilters({
    relayout: state.trayFilterType !== "all" || state.trayFilterRegion !== "all",
  });
}

function pickTrayHeight() {
  const { large, medium, small, absoluteMinPx } = TRAY_HEIGHTS;
  let base;
  if (state.total >= large.threshold) {
    base = Math.min(
      large.maxPx,
      Math.max(large.minPx, Math.round(window.innerHeight * large.vhRatio))
    );
  } else if (state.total >= medium.threshold) {
    base = medium.px;
  } else {
    base = small.px;
  }
  return Math.max(absoluteMinPx, base);
}

export function scatterPieces() {
  const labelHeight = 44;
  const trayW = Math.max(320, els.tray.clientWidth);
  const trayH = pickTrayHeight();
  els.tray.style.minHeight = `${trayH}px`;

  state.pieces.forEach((piece, index) => {
    if (piece.dataset.locked === "true") return;
    els.tray.appendChild(piece);
    const maxX = Math.max(8, trayW - piece.offsetWidth - 14);
    const maxY = Math.max(labelHeight, trayH - piece.offsetHeight - 14);
    const seedX = (index * 73) % Math.max(1, maxX);
    const seedY = labelHeight + ((index * 137) % Math.max(1, maxY - labelHeight));
    piece.style.left = `${seedX + Math.random() * 18}px`;
    piece.style.top = `${seedY + Math.random() * 18}px`;
    const trayType = pieceTrayType(piece);
    const edgeBoost = trayType === "corner" ? 280 : trayType === "edge" ? 160 : 0;
    piece.style.zIndex = String(2 + index + edgeBoost);
  });
  applyTrayFilters();
}

export async function buildPiecesIntoTray() {
  state.pieces.length = 0;
  const chunk = Math.max(4, Number(PUZZLE.pieceBuildChunkSize) || 20);
  const cells = [];
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      cells.push([row, col]);
    }
  }

  for (let i = 0; i < cells.length; i += chunk) {
    const fragment = document.createDocumentFragment();
    const end = Math.min(i + chunk, cells.length);
    for (let j = i; j < end; j += 1) {
      const [row, col] = cells[j];
      const piece = createPieceElement(row, col);
      state.pieces.push(piece);
      fragment.appendChild(piece);
    }
    els.tray.appendChild(fragment);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

function createPieceElement(row, col) {
  pieceIdCounter += 1;
  const clipId = `piece-clip-${pieceIdCounter}`;

  const piece = document.createElement("div");
  piece.className = "piece";
  piece.dataset.row = String(row);
  piece.dataset.col = String(col);
  piece.dataset.trayType = pieceTrayType(piece);
  piece.dataset.region = pieceRegion(piece);
  piece.dataset.rotation = String(randomItem(ROTATION_OPTIONS));
  piece.dataset.locked = "false";
  piece.style.width = `${state.pieceW + state.tab * 2}px`;
  piece.style.height = `${state.pieceH + state.tab * 2}px`;
  piece.style.transform = `rotate(${piece.dataset.rotation}deg)`;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute(
    "viewBox",
    `${-state.tab} ${-state.tab} ${state.pieceW + state.tab * 2} ${state.pieceH + state.tab * 2}`
  );
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  const defs = document.createElementNS(SVG_NS, "defs");
  const clip = document.createElementNS(SVG_NS, "clipPath");
  clip.setAttribute("id", clipId);
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");

  const pathData = puzzlePath(
    state.pieceW,
    state.pieceH,
    state.tab,
    edgeSigns(row, col)
  );

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData);
  clip.appendChild(path);
  defs.appendChild(clip);

  const imageHref = state.puzzleRenderSrc || state.imageSrc;
  const image = document.createElementNS(SVG_NS, "image");
  image.setAttribute("href", imageHref);
  image.setAttributeNS("http://www.w3.org/1999/xlink", "href", imageHref);
  image.setAttribute("x", String(-col * state.pieceW));
  image.setAttribute("y", String(-row * state.pieceH));
  image.setAttribute("width", String(state.pieceW * state.cols));
  image.setAttribute("height", String(state.pieceH * state.rows));
  image.setAttribute("preserveAspectRatio", "none");
  image.setAttribute("clip-path", `url(#${clipId})`);

  const hit = document.createElementNS(SVG_NS, "path");
  hit.setAttribute("d", pathData);
  hit.setAttribute("fill", "rgba(0,0,0,0.02)");
  hit.setAttribute("stroke", "none");
  hit.setAttribute("pointer-events", "all");
  hit.setAttribute("class", "piece-hit");

  const stroke = document.createElementNS(SVG_NS, "path");
  stroke.setAttribute("d", pathData);
  stroke.setAttribute("fill", "none");
  stroke.setAttribute("stroke", "rgba(255,255,255,0.9)");
  stroke.setAttribute("stroke-width", String(PUZZLE.pieceImageStrokeWidth));
  stroke.setAttribute("pointer-events", "none");

  svg.append(defs, image, hit, stroke);
  piece.appendChild(svg);

  return piece;
}

function pieceIsDraggable(piece) {
  if (!piece || piece.dataset.locked === "true") return false;
  if (piece.classList.contains("tray-filter-hidden")) return false;
  if (els.pieceZoom?.contains(piece)) return false;
  const parent = piece.parentElement;
  return (
    parent === els.tray ||
    parent === els.board ||
    parent === els.workbench ||
    parent === document.body
  );
}

function getPieceFromEvent(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return null;
  if (target.closest(".piece-zoom, .tray-sort-btn, .tray-label-row button")) return null;
  const piece = target.closest(".piece");
  if (!pieceIsDraggable(piece)) return null;
  return piece;
}

function onPiecePointerDown(event) {
  if (!state.started) return;
  if (dragSession) return;
  if (typeof event.button === "number" && event.button !== 0) return;

  const piece = getPieceFromEvent(event);
  if (!piece) return;

  if (event.type === "mousedown" && typeof window.PointerEvent === "function") {
    return;
  }

  event.preventDefault();
  startDrag(event, piece);
}

function snapThresholdPx() {
  return Math.max(
    PUZZLE.snapMinThresholdPx,
    Math.min(state.pieceW, state.pieceH) * PUZZLE.snapNearestRatio
  );
}

function snapTargetViewport(piece, boardRect) {
  const row = Number(piece.dataset.row);
  const col = Number(piece.dataset.col);
  return {
    left: boardRect.left + col * state.pieceW - state.tab,
    top: boardRect.top + row * state.pieceH - state.tab,
  };
}

function isNearTarget(piece, boardRect = els.board.getBoundingClientRect()) {
  const row = Number(piece.dataset.row);
  const col = Number(piece.dataset.col);
  const pieceRect = piece.getBoundingClientRect();
  const contentCenterX = pieceRect.left + state.tab + state.pieceW / 2;
  const contentCenterY = pieceRect.top + state.tab + state.pieceH / 2;
  const targetX = boardRect.left + col * state.pieceW + state.pieceW / 2;
  const targetY = boardRect.top + row * state.pieceH + state.pieceH / 2;
  const distance = Math.hypot(contentCenterX - targetX, contentCenterY - targetY);
  const threshold = snapThresholdPx();
  return { near: distance <= threshold, distance, threshold };
}

function magnetDragPosition(clientX, clientY, grabX, grabY, piece, boardRect) {
  let left = clientX - grabX;
  let top = clientY - grabY;
  if (state.assistMode === "minimal") return { left, top };

  const row = Number(piece.dataset.row);
  const col = Number(piece.dataset.col);
  const cx = left + state.tab + state.pieceW / 2;
  const cy = top + state.tab + state.pieceH / 2;
  const targetX = boardRect.left + col * state.pieceW + state.pieceW / 2;
  const targetY = boardRect.top + row * state.pieceH + state.pieceH / 2;
  const distance = Math.hypot(cx - targetX, cy - targetY);
  const threshold = snapThresholdPx();
  if (distance > threshold) return { left, top };

  const pull = (PUZZLE.snapMagnetStrength ?? 0.38) * (1 - distance / threshold);
  const target = snapTargetViewport(piece, boardRect);
  return {
    left: left + (target.left - left) * pull,
    top: top + (target.top - top) * pull,
  };
}

function pulseNearHaptics() {
  const pat = PUZZLE.snapNearVibrateMs;
  if (Array.isArray(pat) && pat.length > 0 && typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pat);
  }
}

function pieceOverlapsBoard(piece, boardRect) {
  return pieceOverlapsRect(piece, boardRect);
}

function pieceCenterOverTray(piece) {
  const trayRect = els.tray.getBoundingClientRect();
  const pr = piece.getBoundingClientRect();
  const cx = (pr.left + pr.right) / 2;
  const cy = (pr.top + pr.bottom) / 2;
  return (
    cx >= trayRect.left &&
    cx <= trayRect.right &&
    cy >= trayRect.top &&
    cy <= trayRect.bottom
  );
}

function pieceOverlapsRect(piece, rect) {
  const pr = piece.getBoundingClientRect();
  const cx = (pr.left + pr.right) / 2;
  const cy = (pr.top + pr.bottom) / 2;
  const centerInside =
    cx >= rect.left &&
    cx <= rect.right &&
    cy >= rect.top &&
    cy <= rect.bottom;
  if (centerInside) return true;
  const iw = Math.max(0, Math.min(pr.right, rect.right) - Math.max(pr.left, rect.left));
  const ih = Math.max(0, Math.min(pr.bottom, rect.bottom) - Math.max(pr.top, rect.top));
  const overlap = iw * ih;
  const pieceArea = Math.max(1, pr.width * pr.height);
  return overlap / pieceArea >= 0.16;
}

function parkPieceOnBoard(piece) {
  parkPieceOnSurface(piece, els.board);
}

function parkPieceOnSurface(piece, surface) {
  const surfaceRect = surface.getBoundingClientRect();
  const pr = piece.getBoundingClientRect();
  surface.appendChild(piece);
  piece.style.position = "absolute";
  piece.classList.remove("tray-filter-hidden");
  let left = pr.left - surfaceRect.left;
  let top = pr.top - surfaceRect.top;
  const bw = surface.clientWidth;
  const bh = surface.clientHeight;
  const pw = piece.offsetWidth;
  const ph = piece.offsetHeight;
  const pad = state.tab;
  left = clampNumber(left, -pad, Math.max(-pad, bw - pw + pad));
  top = clampNumber(top, -pad, Math.max(-pad, bh - ph + pad));
  piece.style.left = `${left}px`;
  piece.style.top = `${top}px`;
  piece.dataset.locked = "false";
  piece.classList.remove("locked");
  const zLoose = 40 + Math.floor(Math.random() * 60);
  piece.style.zIndex = String(Math.max(zLoose, Number(piece.style.zIndex) || 0));
}

function parkPiecesOnSurface(pieces, surface) {
  pieces.forEach((piece) => parkPieceOnSurface(piece, surface));
}

function snapPieceHomeViewport(piece, done) {
  const row = Number(piece.dataset.row);
  const col = Number(piece.dataset.col);
  const boardRect = els.board.getBoundingClientRect();
  const targetLeft = boardRect.left + col * state.pieceW - state.tab;
  const targetTop = boardRect.top + row * state.pieceH - state.tab;
  const fromLeft = parseFloat(piece.style.left) || 0;
  const fromTop = parseFloat(piece.style.top) || 0;
  const { snapTweenMs: dur } = PUZZLE;
  const t0 = performance.now();
  piece.classList.add("snap-in-flight");

  function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
  }

  function frame(now) {
    const u = Math.min(1, (now - t0) / dur);
    const e = easeOutCubic(u);
    const overshoot = Math.sin(u * Math.PI) * 0.035;
    const scale = 1.035 - u * 0.035 + overshoot;
    piece.style.left = `${fromLeft + (targetLeft - fromLeft) * Math.min(1, e + overshoot)}px`;
    piece.style.top = `${fromTop + (targetTop - fromTop) * Math.min(1, e + overshoot)}px`;
    piece.style.transform = `rotate(0deg) scale(${scale})`;
    if (u < 1) {
      requestAnimationFrame(frame);
    } else {
      piece.classList.remove("snap-in-flight");
      piece.style.transform = "rotate(0deg)";
      done();
    }
  }

  requestAnimationFrame(frame);
}

function pieceCenterViewport(piece) {
  const r = piece.getBoundingClientRect();
  return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
}

function isPieceOverBoardForHints(piece, boardRect) {
  const c = pieceCenterViewport(piece);
  const margin = 6;
  if (
    c.x < boardRect.left - margin ||
    c.x > boardRect.right + margin ||
    c.y < boardRect.top - margin ||
    c.y > boardRect.bottom + margin
  ) {
    return false;
  }

  if (
    els.workbench &&
    isWorkbenchLayoutVisible() &&
    !state.workbenchCollapsed
  ) {
    const wb = els.workbench.getBoundingClientRect();
    if (wb.height > 20 && c.y >= boardRect.bottom - 10) {
      if (c.x >= wb.left - margin && c.x <= wb.right + margin && c.y >= wb.top - margin) {
        return false;
      }
    }
  }
  return true;
}

function updateDragPlacementHints(piece, boardRect) {
  const { near } = isNearTarget(piece, boardRect);
  const rot = effectiveDragRotationDegrees();
  const overBoard = pieceOverlapsBoard(piece, boardRect);
  const warmHelp = state.assistMode !== "minimal";
  const onBoard = warmHelp && isPieceOverBoardForHints(piece, boardRect);

  piece.classList.toggle("near-home", onBoard && near && rot === 0);
  piece.classList.toggle("near-home-rot", onBoard && near && rot !== 0);
  els.board.classList.toggle("drop-board", onBoard && overBoard && !near);
  els.board.classList.toggle("drop-near", onBoard && near && rot === 0);
  els.board.classList.toggle("drop-near-rot", onBoard && near && rot !== 0);
}

function clearBoardTargetHint() {
  els.board.classList.remove("drop-near", "drop-near-rot", "drop-board");
  state.pieces.forEach((piece) => piece.classList.remove("near-home", "near-home-rot"));
}

function pulseSnapHaptics() {
  const pat = PUZZLE.snapSuccessVibrateMs;
  if (Array.isArray(pat) && pat.length > 0 && typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pat);
  }
}

function snapPiecesHomeViewport(pieces, done) {
  if (pieces.length <= 1) {
    snapPieceHomeViewport(pieces[0], done);
    return;
  }
  const primary = pieces[0];
  const boardRect = els.board.getBoundingClientRect();
  const target = snapTargetViewport(primary, boardRect);
  const fromLeft = parseFloat(primary.style.left) || 0;
  const fromTop = parseFloat(primary.style.top) || 0;
  const offsets = pieces.map((piece) => ({
    piece,
    dx: (parseFloat(piece.style.left) || 0) - fromLeft,
    dy: (parseFloat(piece.style.top) || 0) - fromTop,
  }));
  const { snapTweenMs: dur } = PUZZLE;
  const t0 = performance.now();
  pieces.forEach((piece) => piece.classList.add("snap-in-flight"));

  function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
  }

  function frame(now) {
    const u = Math.min(1, (now - t0) / dur);
    const e = easeOutCubic(u);
    const overshoot = Math.sin(u * Math.PI) * 0.035;
    const scale = 1.035 - u * 0.035 + overshoot;
    const curLeft = fromLeft + (target.left - fromLeft) * Math.min(1, e + overshoot);
    const curTop = fromTop + (target.top - fromTop) * Math.min(1, e + overshoot);
    offsets.forEach(({ piece, dx, dy }) => {
      piece.style.left = `${curLeft + dx}px`;
      piece.style.top = `${curTop + dy}px`;
      piece.style.transform = `rotate(0deg) scale(${scale})`;
    });
    if (u < 1) {
      requestAnimationFrame(frame);
    } else {
      pieces.forEach((piece) => {
        piece.classList.remove("snap-in-flight");
        piece.style.transform = "rotate(0deg)";
      });
      done();
    }
  }
  requestAnimationFrame(frame);
}

function returnPiecesToTray(pieces) {
  if (pieces.length > 1) {
    parkPiecesOnSurface(pieces, els.tray);
    applyTrayFilters({
      relayout: state.trayFilterType !== "all" || state.trayFilterRegion !== "all",
    });
    return;
  }
  pieces.forEach((piece) => returnToTray(piece));
}

export function flushWorkbenchPiecesToTray() {
  const movable = [...els.workbench.querySelectorAll(".piece")].filter(
    (piece) => piece.dataset.locked !== "true"
  );
  if (movable.length === 0) return;
  returnPiecesToTray(movable);
}

function tryPlacePieces(pieces, options = {}) {
  const primary = pieces[0];
  const boardRect = els.board.getBoundingClientRect();
  const workbenchRect = els.workbench.getBoundingClientRect();
  const { near } = isNearTarget(primary, boardRect);
  const rotation = Number(primary.dataset.rotation) % 360;
  state.moves += 1;
  updateStats();

  const rejectLater = (statusMessage) => {
    if (options.startedOnBoard) {
      parkPiecesOnSurface(pieces, els.board);
      void playParkSoft();
      tryMergeAround(primary);
      updateBoardGhostHints();
      setStatus(STATUS.stayedOnBoard);
      return;
    }
    void playRejectSoft();
    pieces.forEach((piece) => piece.classList.add("piece-reject"));
    window.setTimeout(() => {
      pieces.forEach((piece) => piece.classList.remove("piece-reject"));
      returnPiecesToTray(pieces);
      setStatus(statusMessage);
    }, PUZZLE.rejectFeedbackMs);
  };

  const allNear = pieces.every((piece) => isNearTarget(piece, boardRect).near);
  if (
    allNear &&
    state.assistMode === "warm" &&
    PUZZLE.snapRotationAssistWarm &&
    pieces.some((piece) => Number(piece.dataset.rotation) % 360 !== 0)
  ) {
    pieces.forEach((piece) => {
      piece.dataset.rotation = "0";
      piece.style.transform = "rotate(0deg)";
    });
  }

  const canSnapAll = pieces.every(
    (piece) => isNearTarget(piece, boardRect).near && Number(piece.dataset.rotation) % 360 === 0
  );

  if (canSnapAll) {
    pieces.forEach((piece) => {
      piece.style.transform = "rotate(0deg)";
    });

    snapPiecesHomeViewport(pieces, () => {
      pieces.forEach((piece) => {
        mountLockedPiece(piece);
        piece.classList.add("snap-success");
        window.setTimeout(() => piece.classList.remove("snap-success"), 480);
      });
      detachLockedFromGroups();
      if (state.placed + pieces.length < state.total) {
        void playSnapSuccess();
      }
      pulseSnapHaptics();
      state.placed += pieces.length;
      updateStats();
      setStatus(STATUS.snapped(state.placed, state.total));
      updateBoardGhostHints();
      checkWin();
    });
    return;
  }

  if (pieces.some((piece) => pieceCenterOverTray(piece))) {
    returnPiecesToTray(pieces);
    void playParkSoft();
    setStatus(STATUS.returnedToTray);
    return;
  }

  if (pieces.some((piece) => pieceOverlapsBoard(piece, boardRect))) {
    parkPiecesOnSurface(pieces, els.board);
    void playParkSoft();
    tryMergeAround(primary);
    updateBoardGhostHints();
    if (near && rotation !== 0) {
      setStatus(STATUS.wrongRotation);
    } else {
      setStatus(pieces.length > 1 ? "Fragment zostaje na planszy jako luźna grupa." : STATUS.notRightSpot);
    }
    return;
  }

  if (
    isWorkbenchLayoutVisible() &&
    !state.workbenchCollapsed &&
    pieces.some((piece) => pieceOverlapsRect(piece, workbenchRect))
  ) {
    parkPiecesOnSurface(pieces, els.workbench);
    void playParkSoft();
    if (!tryMergeAround(primary)) {
      setStatus(pieces.length > 1 ? "Fragment odłożony w strefie roboczej." : "Klocek odłożony w strefie roboczej.");
    }
    return;
  }

  rejectLater(STATUS.dropOutsideBoard);
}

export function tryPlacePiece(piece, options = {}) {
  tryPlacePieces([piece], options);
}

function clearPieceTwistSettle(entries) {
  window.clearTimeout(clearPieceTwistSettle._t);
  entries.forEach((entry) => entry.piece.classList.remove("piece-twist-snap-settle"));
}
clearPieceTwistSettle._t = 0;

function schedulePieceTwistSettle(entries, ms = 320) {
  entries.forEach((entry) => entry.piece.classList.add("piece-twist-snap-settle"));
  window.clearTimeout(clearPieceTwistSettle._t);
  clearPieceTwistSettle._t = window.setTimeout(() => {
    entries.forEach((entry) => entry.piece.classList.remove("piece-twist-snap-settle"));
  }, ms);
}

function tryBeginTwistGesture() {
  if (!dragSession || dragSession.twistActive || dragSession.pointerIdsHeld.size < 2) return;
  const { piece, entries } = dragSession;
  if (getGroupPieces(piece).length > 1) {
    setStatus("Połączony fragment zostaje prosto — przeciągnij go jako całość.");
    return;
  }
  dragSession.twistActive = true;
  dragSession.twoFingerHeldEver = true;
  window.clearTimeout(dragSession.zoomTimer);
  hidePieceZoom();
  stopDragAutoScroll();
  const pivot = normalizeRotationDegrees(Number(piece.dataset.rotation));
  dragSession.twistEnteredPivot = pivot;
  dragSession.twistPivotRotation = pivot;
  dragSession.twistAccumDeg = 0;
  const chord0 = twistChordAngleRad(dragSession.pointerIdsHeld, twistPointerPins);
  dragSession.twistLastRad = chord0;
  entries.forEach((entry) => entry.piece.classList.remove("touch-twist-hint"));
}

function finalizeTwistGestureSnap(options = {}) {
  if (!dragSession?.twistActive) return false;
  const { entries } = dragSession;
  const entered = dragSession.twistEnteredPivot;
  const snapped = snapQuarterTurnDegrees(dragSession.twistPivotRotation + dragSession.twistAccumDeg);
  entries.forEach((entry) => {
    entry.piece.dataset.rotation = String(snapped);
  });
  dragSession.twistActive = false;
  dragSession.twistLastRad = null;
  dragSession.twistAccumDeg = 0;
  dragSession.twistPivotRotation = snapped;
  const scale = PUZZLE.dragLiftScale;
  applyTwistPiecesTransform(entries, snapped, scale);
  if (options.animate !== false) {
    schedulePieceTwistSettle(entries, 340);
  }
  if (normalizeRotationDegrees(snapped - entered) !== 0) {
    setStatus(snapped === 0 ? STATUS.rotationAligned : STATUS.rotationDegrees(snapped));
  }
  return true;
}
function advanceTwistFromPins() {
  if (!dragSession?.twistActive) return;
  const chord = twistChordAngleRad(dragSession.pointerIdsHeld, twistPointerPins);
  if (chord === null || dragSession.twistLastRad === null) return;
  const dRad = unwrapAngleDeltaRadians(dragSession.twistLastRad, chord);
  dragSession.twistLastRad = chord;
  dragSession.twistAccumDeg += dRad * (180 / Math.PI);
  const visualDeg = dragSession.twistPivotRotation + dragSession.twistAccumDeg;
  applyTwistPiecesTransform(dragSession.entries, visualDeg, PUZZLE.dragLiftScale);
}

function promoteGrabToSurvivor(survivorId) {
  if (!dragSession) return;
  const pt = twistPointerPins.get(survivorId);
  if (!pt) return;
  dragSession.pointerId = survivorId;
  dragSession.entries.forEach((entry) => {
    const rect = entry.piece.getBoundingClientRect();
    entry.grabX = pt.x - rect.left;
    entry.grabY = pt.y - rect.top;
  });
  try {
    dragSession.piece.setPointerCapture(survivorId);
  } catch {
  }
}

function onTwistHydrateCapturePointer(ev) {
  if (!dragSession || ev.pointerType === "mouse") return;
  twistHydratePins(ev.pointerId, ev.clientX, ev.clientY);

  const isKnown = dragSession.pointerIdsHeld.has(ev.pointerId);
  if (!isKnown && dragSession.pointerIdsHeld.size >= 2) return;

  const hitEligible = pointHitsDragPieces(ev.clientX, ev.clientY, dragSession.entries);
  const groupLen = getGroupPieces(dragSession.piece).length;

  if (!isKnown && ev.pointerId !== dragSession.pointerId) {
    if (groupLen > 1) {
      return;
    }
    if (!hitEligible) return;
    try {
      ev.preventDefault();
    } catch {
      /* noop */
    }
    dragSession.pointerIdsHeld.add(ev.pointerId);
    tryBeginTwistGesture();
  }
}

function effectiveDragRotationDegrees() {
  if (!dragSession) return 0;
  if (dragSession.twistActive) {
    return normalizeRotationDegrees(
      Math.round(dragSession.twistPivotRotation + dragSession.twistAccumDeg)
    );
  }
  return Number(dragSession.piece.dataset.rotation) % 360;
}

function teardownDragChrome() {
  if (!dragSession) return;
  window.clearTimeout(dragSession.zoomTimer);
  hidePieceZoom();
  document.body.classList.remove("is-dragging-piece");
  stopDragAutoScroll();
  clearBoardTargetHint();
  twistPointerPins.clear();
}

function completeLiftDrag(event, aborted) {
  if (!dragSession) return;

  teardownDragChrome();

  try {
    dragSession.piece.releasePointerCapture(event.pointerId);
  } catch {
    /* noop */
  }

  const { piece, startX, startY, entries, twoFingerHeldEver, didTranslateBeyondTap } = dragSession;
  dragSession = null;

  entries.forEach((entry) => entry.piece.classList.remove("dragging", "touch-twist-hint"));
  clearPieceTwistSettle(entries);

  if (aborted) {
    entries.forEach((entry) => {
      const r = Number(entry.piece.dataset.rotation) % 360;
      entry.piece.style.transform = `rotate(${r}deg)`;
      if (entry.originalParent) {
        entry.originalParent.appendChild(entry.piece);
        entry.piece.style.position = entry.originalPosition;
        entry.piece.style.left = entry.originalLeft;
        entry.piece.style.top = entry.originalTop;
        entry.piece.style.zIndex = entry.originalZ;
      } else {
        returnToTray(entry.piece);
      }
    });
    return;
  }

  const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
  const microMove = moved < PUZZLE.dragMoveTolerancePx && !didTranslateBeyondTap && !twoFingerHeldEver;

  if (microMove) {
    entries.forEach((entry) => {
      if (entry.originalParent) entry.originalParent.appendChild(entry.piece);
      entry.piece.style.position = entry.originalPosition;
      entry.piece.style.left = entry.originalLeft;
      entry.piece.style.top = entry.originalTop;
      entry.piece.style.zIndex = entry.originalZ;
      const r = Number(entry.piece.dataset.rotation) % 360;
      entry.piece.style.transform = `rotate(${r}deg)`;
    });
    const sequential = prefersSequentialTapRotate();
    const rotateSequentialSecondTap =
      sequential &&
      state.selectedPiece === piece &&
      piece.classList.contains("selected-rotate") &&
      !twoFingerHeldEver;
    selectPiece(piece);
    if (sequential) {
      if (rotateSequentialSecondTap) {
        rotatePiece(piece);
      } else {
        const rTap = Number(piece.dataset.rotation) % 360;
        piece.style.transform = `rotate(${rTap}deg)`;
        setStatus(STATUS.pieceSelected(isWideDesktopViewport()));
      }
    } else {
      const rTap = Number(piece.dataset.rotation) % 360;
      piece.style.transform = pieceRotationVisual(rTap, piece);
      setStatus(STATUS.pieceSelected(isWideDesktopViewport()));
    }
    return;
  }

  entries.forEach((entry) => {
    entry.piece.classList.remove("selected-rotate");
    const rEnd = Number(entry.piece.dataset.rotation) % 360;
    entry.piece.style.transform = `rotate(${rEnd}deg)`;
  });
  const droppedPieces = entries.map((entry) => entry.piece);
  const startedOnBoard = entries.every((entry) => entry.originalParent === els.board);
  tryPlacePieces(droppedPieces, { startedOnBoard });
}

function onUnifiedDragPointerEnd(event) {
  if (dragSession) {
    twistHydratePins(event.pointerId, event.clientX, event.clientY);
  }
  twistPointerPins.delete(event.pointerId);

  if (!dragSession) return;
  const wasTwistActive = dragSession.twistActive;
  if (!dragSession.pointerIdsHeld.has(event.pointerId)) return;

  dragSession.pointerIdsHeld.delete(event.pointerId);

  if (wasTwistActive && dragSession.pointerIdsHeld.size < 2) {
    finalizeTwistGestureSnap();
  }

  if (dragSession.pointerIdsHeld.size === 0) {
    const aborted = event.type === "pointercancel";
    completeLiftDrag(event, aborted);
    return;
  }

  if (event.pointerId === dragSession.pointerId) {
    const survivor = [...dragSession.pointerIdsHeld][0];
    if (survivor !== undefined) promoteGrabToSurvivor(survivor);
  }
}

function startDrag(event, piece) {
  hidePieceZoom();
  twistPointerPins.clear();
  const groupPieces = [piece, ...getGroupPieces(piece).filter((groupPiece) => groupPiece !== piece)];
  const rect = piece.getBoundingClientRect();
  dragSession = {
    piece,
    pointerId: event.pointerId,
    grabX: event.clientX - rect.left,
    grabY: event.clientY - rect.top,
    startX: event.clientX,
    startY: event.clientY,
    entries: groupPieces.map((p) => {
      const r = p.getBoundingClientRect();
      return {
        piece: p,
        grabX: event.clientX - r.left,
        grabY: event.clientY - r.top,
        originalParent: p.parentElement,
        originalLeft: p.style.left,
        originalTop: p.style.top,
        originalPosition: p.style.position,
        originalZ: p.style.zIndex,
      };
    }),
    pointerIdsHeld: new Set([event.pointerId]),
    twistActive: false,
    twistLastRad: null,
    twistEnteredPivot: 0,
    twistPivotRotation: 0,
    twistAccumDeg: 0,
    twoFingerHeldEver: false,
    didTranslateBeyondTap: false,
    boardRect: els.board.getBoundingClientRect(),
    nearHapticSent: false,
    mouseChordRotateLatch: false,
    zoomTimer: isPieceHoverZoomEnabled()
      ? window.setTimeout(() => {
          if (dragSession && dragSession.piece === piece) {
            showPieceZoom(piece, event.clientX, event.clientY);
          }
        }, 620)
      : 0,
  };
  twistHydratePins(event.pointerId, event.clientX, event.clientY);
  selectPiece(piece);
  stopDragAutoScroll();
  document.body.classList.add("is-dragging-piece");
  dragSession.entries.forEach((entry, index) => {
    const p = entry.piece;
    document.body.appendChild(p);
    p.classList.add("dragging");
    const rot0 = Number(p.dataset.rotation) % 360;
    p.style.transform = `rotate(${rot0}deg) scale(${PUZZLE.dragLiftScale})`;
    p.style.position = "fixed";
    p.style.left = `${event.clientX - entry.grabX}px`;
    p.style.top = `${event.clientY - entry.grabY}px`;
    p.style.zIndex = String(9999 + index);
  });
  if (prefersSequentialTapRotate() && groupPieces.length === 1 && getGroupPieces(piece).length === 1) {
    dragSession.entries.forEach((entry) => entry.piece.classList.add("touch-twist-hint"));
  }
  try {
    piece.setPointerCapture(event.pointerId);
  } catch {
  }
}

function moveDrag(event) {
  if (!dragSession) return;
  twistHydratePins(event.pointerId, event.clientX, event.clientY);

  if (dragSession.twistActive) {
    if (!dragSession.pointerIdsHeld.has(event.pointerId)) return;
    advanceTwistFromPins();
    updateDragAutoScroll(event.clientY);
    if (!nearChecksRafThrottled) {
      nearChecksRafThrottled = debounceRaf(() => {
        if (!dragSession) return;
        const br = els.board.getBoundingClientRect();
        const { piece: p } = dragSession;
        updateDragPlacementHints(p, br);
      });
    }
    nearChecksRafThrottled();
    return;
  }

  if (dragSession.pointerId !== event.pointerId) {
    syncDesktopDragMouseChord(event);
    return;
  }
  syncDesktopDragMouseChord(event);
  if (Math.hypot(event.clientX - dragSession.startX, event.clientY - dragSession.startY) > PUZZLE.dragMoveTolerancePx) {
    dragSession.didTranslateBeyondTap = true;
    window.clearTimeout(dragSession.zoomTimer);
  }
  const br = dragSession.boardRect;
  dragSession.entries.forEach((entry) => {
    const pos = magnetDragPosition(
      event.clientX,
      event.clientY,
      entry.grabX,
      entry.grabY,
      entry.piece,
      br
    );
    entry.piece.style.left = `${pos.left}px`;
    entry.piece.style.top = `${pos.top}px`;
  });
  positionPieceZoom(event.clientX, event.clientY);
  updateDragAutoScroll(event.clientY);
  if (!nearChecksRafThrottled) {
    nearChecksRafThrottled = debounceRaf(() => {
      if (!dragSession) return;
      dragSession.boardRect = els.board.getBoundingClientRect();
      const boardRect = dragSession.boardRect;
      const { piece: p } = dragSession;
      updateDragPlacementHints(p, boardRect);
      const { near } = isNearTarget(p, boardRect);
      if (near && isPieceOverBoardForHints(p, boardRect) && !dragSession.nearHapticSent) {
        pulseNearHaptics();
        dragSession.nearHapticSent = true;
      }
      if (!near) dragSession.nearHapticSent = false;
    });
  }
  nearChecksRafThrottled();
}


let pieceDelegationInstalled = false;

export function installPieceDelegation() {
  if (pieceDelegationInstalled) return;
  pieceDelegationInstalled = true;

  document.addEventListener(
    "contextmenu",
    (event) => {
      if (dragSession) {
        event.preventDefault();
        return;
      }
      const piece = getPieceFromEvent(event);
      if (!piece) return;
      event.preventDefault();
      rotatePiece(piece);
    },
    true
  );

  document.addEventListener("mousedown", onDesktopDragChordMouseDown, true);
  document.addEventListener("mouseup", onDesktopDragChordMouseUp, true);

  document.addEventListener("pointerdown", onPiecePointerDown);
  document.addEventListener("mousedown", onPiecePointerDown);

  els.gameScreen.addEventListener("pointerover", (event) => {
    if (dragSession || event.pointerType !== "mouse") return;
    const piece = getPieceFromEvent(event);
    if (!piece || piece.dataset.locked === "true") return;
    window.clearTimeout(hoverZoomTimer);
    hoverZoomTimer = 0;
    if (!isPieceHoverZoomEnabled()) {
      hidePieceZoom();
      return;
    }
    hoverZoomTimer = window.setTimeout(() => {
      showPieceZoom(piece, event.clientX, event.clientY);
    }, 520);
  });

  els.gameScreen.addEventListener("pointerout", (event) => {
    if (event.pointerType === "mouse") hidePieceZoom();
  });

  document.addEventListener("pointermove", moveDrag, { passive: true });
  document.addEventListener("pointerdown", onTwistHydrateCapturePointer, {
    capture: true,
    passive: false,
  });
  document.addEventListener("pointerup", onUnifiedDragPointerEnd, true);
  document.addEventListener("pointercancel", onUnifiedDragPointerEnd, true);
}

export function isDraggingNow() {
  return Boolean(dragSession);
}
