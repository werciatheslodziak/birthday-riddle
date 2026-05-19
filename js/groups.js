import { els, state, setStatus } from "./state.js";

let nextGroupId = 1;
const groups = new Map();

function pieceKey(piece) {
  return `${piece.dataset.row},${piece.dataset.col}`;
}

function groupIdFor(piece) {
  return piece?.dataset.groupId || "";
}

function makeGroupId() {
  const id = `g${nextGroupId}`;
  nextGroupId += 1;
  return id;
}

function reserveGroupId(groupId) {
  const match = /^g(\d+)$/.exec(groupId);
  if (!match) return;
  nextGroupId = Math.max(nextGroupId, Number(match[1]) + 1);
}

function setGroup(piece, groupId) {
  reserveGroupId(groupId);
  piece.dataset.groupId = groupId;
  piece.classList.add("piece-grouped");
  if (!groups.has(groupId)) groups.set(groupId, new Set());
  groups.get(groupId).add(piece);
}

function pruneGroups() {
  groups.forEach((set, groupId) => {
    [...set].forEach((piece) => {
      if (!state.pieces.includes(piece) || piece.dataset.groupId !== groupId) {
        set.delete(piece);
      }
    });
    if (set.size <= 1) {
      set.forEach((piece) => {
        piece.classList.remove("piece-grouped");
        delete piece.dataset.groupId;
      });
      groups.delete(groupId);
    }
  });
}

export function clearPuzzleGroups() {
  groups.clear();
  nextGroupId = 1;
  state.pieces.forEach((piece) => {
    piece.classList.remove("piece-grouped");
    delete piece.dataset.groupId;
  });
}

export function rebuildPuzzleGroupsFromPieces() {
  groups.clear();
  state.pieces.forEach((piece) => {
    const groupId = groupIdFor(piece);
    if (groupId) setGroup(piece, groupId);
  });
  pruneGroups();
}

export function getGroupPieces(piece) {
  const groupId = groupIdFor(piece);
  if (!groupId || !groups.has(groupId)) return [piece].filter(Boolean);
  return [...groups.get(groupId)].filter((p) => p.dataset.locked !== "true");
}

export function getSerializableGroups() {
  pruneGroups();
  return [...groups.entries()].map(([id, set]) => ({
    id,
    pieces: [...set].map(pieceKey),
  }));
}

export function applySerializedGroups(serialized = []) {
  clearPuzzleGroups();
  const byKey = new Map(state.pieces.map((piece) => [pieceKey(piece), piece]));
  serialized.forEach((group) => {
    if (!group?.id || !Array.isArray(group.pieces) || group.pieces.length < 2) return;
    group.pieces.forEach((key) => {
      const piece = byKey.get(key);
      if (piece && piece.dataset.locked !== "true") setGroup(piece, group.id);
    });
  });
  pruneGroups();
}

function isAdjacent(a, b) {
  const ar = Number(a.dataset.row);
  const ac = Number(a.dataset.col);
  const br = Number(b.dataset.row);
  const bc = Number(b.dataset.col);
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

function expectedViewportDelta(a, b) {
  const ar = Number(a.dataset.row);
  const ac = Number(a.dataset.col);
  const br = Number(b.dataset.row);
  const bc = Number(b.dataset.col);
  return {
    x: (bc - ac) * state.pieceW,
    y: (br - ar) * state.pieceH,
  };
}

function contentCenter(piece) {
  const rect = piece.getBoundingClientRect();
  return {
    x: rect.left + state.tab + state.pieceW / 2,
    y: rect.top + state.tab + state.pieceH / 2,
  };
}

function sameLooseSurface(a, b) {
  if (a.dataset.locked === "true" || b.dataset.locked === "true") return false;
  return (
    (a.parentElement === els.tray || a.parentElement === els.workbench) &&
    a.parentElement === b.parentElement
  );
}

function canMerge(a, b) {
  if (!a || !b || a === b) return false;
  if (groupIdFor(a) && groupIdFor(a) === groupIdFor(b)) return false;
  if (Number(a.dataset.rotation) % 360 !== 0 || Number(b.dataset.rotation) % 360 !== 0) {
    return false;
  }
  if (!sameLooseSurface(a, b) || !isAdjacent(a, b)) return false;

  const ac = contentCenter(a);
  const bc = contentCenter(b);
  const expected = expectedViewportDelta(a, b);
  const error = Math.hypot(bc.x - ac.x - expected.x, bc.y - ac.y - expected.y);
  const threshold = Math.max(14, Math.min(state.pieceW, state.pieceH) * 0.24);
  return error <= threshold;
}

function offsetPiece(piece, dx, dy) {
  const left = parseFloat(piece.style.left);
  const top = parseFloat(piece.style.top);
  if (Number.isFinite(left)) piece.style.left = `${left + dx}px`;
  if (Number.isFinite(top)) piece.style.top = `${top + dy}px`;
}

function alignGroupTo(anchor, moving) {
  const ac = contentCenter(anchor);
  const mc = contentCenter(moving);
  const expected = expectedViewportDelta(anchor, moving);
  const dx = ac.x + expected.x - mc.x;
  const dy = ac.y + expected.y - mc.y;
  getGroupPieces(moving).forEach((piece) => offsetPiece(piece, dx, dy));
}

function mergeGroups(anchor, moving) {
  const anchorGroup = groupIdFor(anchor) || makeGroupId();
  const movingGroup = groupIdFor(moving);
  const movingPieces = getGroupPieces(moving);

  setGroup(anchor, anchorGroup);
  movingPieces.forEach((piece) => setGroup(piece, anchorGroup));

  if (movingGroup && movingGroup !== anchorGroup) groups.delete(movingGroup);
  pruneGroups();
  getGroupPieces(anchor).forEach((piece) => {
    piece.classList.add("piece-group-pop");
    window.setTimeout(() => piece.classList.remove("piece-group-pop"), 420);
  });
  setStatus(`Połączone fragmenty: ${getGroupPieces(anchor).length} klocki.`);
}

export function tryMergeAround(piece) {
  if (!piece || piece.dataset.locked === "true") return false;
  let merged = false;
  let changed = true;
  while (changed) {
    changed = false;
    const groupPieces = getGroupPieces(piece);
    for (const a of groupPieces) {
      const candidate = state.pieces.find((b) => canMerge(a, b));
      if (candidate) {
        alignGroupTo(a, candidate);
        mergeGroups(a, candidate);
        merged = true;
        changed = true;
        break;
      }
    }
  }
  return merged;
}

export function detachLockedFromGroups() {
  state.pieces.forEach((piece) => {
    if (piece.dataset.locked === "true") {
      const groupId = groupIdFor(piece);
      if (groupId && groups.has(groupId)) groups.get(groupId).delete(piece);
      piece.classList.remove("piece-grouped");
      delete piece.dataset.groupId;
    }
  });
  pruneGroups();
}
