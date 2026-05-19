import { els, state, setStatus, updateStats, syncMobileActionsBar } from "./state.js";
import { runOpenGiftSequence, prefetchPuzzleImage, resetPrefetchCache } from "./opening.js";
import { installBoardPanZoom, resetBoardPan, updateBoardGhostHints } from "./board-view.js";
import { installTutorial, maybeShowTutorial } from "./tutorial.js";
import { preparePuzzleImageFile } from "./image-prep.js";
import { STATUS } from "./messages.js";
import { renderTimer, resetTimer, startTimer, stopTimer } from "./timer.js";
import { buildPuzzle, shuffleLoosePieces } from "./board.js";
import {
  applyTrayFilters,
  installPieceDelegation,
  isDraggingNow,
  rotatePiece,
  setTrayFilter,
  setTrayShapeFilter,
  flushWorkbenchPiecesToTray,
} from "./pieces.js";
import { setPuzzleBackground } from "./background.js";
import { printTemplate } from "./export-2d.js";
import { exportPuzzle3d } from "./export-3d.js";
import {
  applyBgmMutedState,
  configureBgmElement,
  pauseBgm,
  playUiAck,
  setMusicEnabled,
  setSoundsEnabled,
  startBgmIfAllowed,
  syncAudioToggles,
} from "./sounds.js";
import {
  getResumePayloadForResize,
  loadCheckpoint,
  saveCheckpoint,
} from "./checkpoint.js";
import {
  refreshDesktopDifficultyControls,
  subscribeDesktopDifficultyLayout,
  subscribeWorkbenchLayout,
  isWorkbenchLayoutVisible,
} from "./desktop-difficulty.js";
import { clampNumber } from "./utils.js";

let resizeTimer = 0;
let workbenchResizeSession = null;

function syncWorkbenchResizeHandle() {
  if (!els.workbenchResizeHandle) return;
  const hide = state.workbenchCollapsed;
  if (hide) {
    els.workbenchResizeHandle.setAttribute("hidden", "");
    els.workbenchResizeHandle.setAttribute("aria-hidden", "true");
  } else {
    els.workbenchResizeHandle.removeAttribute("hidden");
    els.workbenchResizeHandle.setAttribute("aria-hidden", "false");
  }
}

function resetInitialView() {
  stopTimer();
  state.started = false;
  state.opening = false;
  state.seconds = 0;
  state.moves = 0;
  state.placed = 0;
  state.selectedPiece = null;

  els.startScreen.classList.remove("hidden", "opening");
  els.gameScreen.classList.add("hidden");
  els.gameScreen.classList.remove("revealing");
  els.celebration.classList.add("hidden");
  els.guideScreen.classList.add("hidden");
  els.previewModal.classList.add("hidden");
  els.gift.removeAttribute("aria-disabled");
  els.gift.style.pointerEvents = "";
  els.confettiLayer.innerHTML = "";
  els.board?.classList.remove("drop-near", "complete-shine", "ready", "is-building");
  els.boardSkeleton?.classList.add("hidden");
  resetBoardPan();
  resetPrefetchCache();
  document.body.classList.remove(
    "hard-mode",
    "wide-puzzle",
    "monument-tier",
    "dense-desktop-tier",
    "game-started"
  );
  els.board.innerHTML = "";
  els.workbench.querySelectorAll(".piece").forEach((piece) => piece.remove());
  els.tray.querySelectorAll(".piece").forEach((piece) => piece.remove());
  pauseBgm(els.bgmAudio);
  document.body.classList.remove("focus-board", "focus-board-side-collapsed");
  state.focusMode = false;
  state.focusSidePanelCollapsed = false;
  syncFocusButtonLabels();
  syncFocusSidePanelUi();
  setAssistMode(state.assistMode);
  state.workbenchCollapsed = true;
  els.workbench.classList.add("collapsed");
  if (els.toggleWorkbench) {
    els.toggleWorkbench.textContent = "Rozwiń";
    els.toggleWorkbench.setAttribute("aria-expanded", "false");
  }
  syncWorkbenchResizeHandle();
  els.workbench.style.removeProperty("--workbench-height");
  renderTimer();
  updateStats();
  setStatus("");
  syncMobileActionsBar();
  syncAudioToggles(
    { sfx: els.sfxToggleStart, music: els.musicToggleStart },
    { sfx: els.sfxToggle, music: els.musicToggle }
  );
}

function openGift() {
  void runOpenGiftSequence().then(() => {
    syncMobileActionsBar();
    maybeShowTutorial();
  });
}

async function changeImage(file) {
  if (!file) return;
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);
  try {
    state.imageSrc = await preparePuzzleImageFile(file);
  } catch {
    state.imageSrc = state.objectUrl;
  }
  resetPrefetchCache();
  await buildPuzzle();
  resetTimer();
}

function onWorkbenchLayoutMqChange() {
  if (!state.started) return;
  if (!isWorkbenchLayoutVisible()) {
    flushWorkbenchPiecesToTray();
  }
}

const trayFiltersPortableMq = "(max-width: 1000px)";

function placeTrayFiltersPanel() {
  const panel = document.querySelector(".tray-filters-panel");
  const slot = document.getElementById("trayFiltersInlineSlot");
  const rotationHint = els.sidePanel?.querySelector(".rotation-hint-panel");
  if (!panel || !slot || !els.sidePanel || !rotationHint) return;

  try {
    if (window.matchMedia(trayFiltersPortableMq).matches) {
      slot.appendChild(panel);
    } else {
      els.sidePanel.insertBefore(panel, rotationHint);
    }
  } catch {
  }
}

function subscribeTrayFiltersPanelPortableLayout(listener) {
  try {
    const mq = window.matchMedia(trayFiltersPortableMq);
    if (mq.addEventListener) {
      mq.addEventListener("change", listener);
    } else if (mq.addListener) {
      mq.addListener(listener);
    }
  } catch {
  }
}

function scheduleViewportPuzzleRefresh() {
  refreshDesktopDifficultyControls();
  if (!state.started) return;
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (isDraggingNow()) return;
    const resumePayload = getResumePayloadForResize();
    buildPuzzle({ resume: resumePayload });
  }, 180);
}

function syncFocusButtonLabels() {
  if (els.focusBoard) {
    els.focusBoard.setAttribute("aria-pressed", state.focusMode ? "true" : "false");
    els.focusBoard.textContent = state.focusMode ? "↩ Pokaż panele" : "🔎 Tryb skupienia";
  }
}

function syncFocusSidePanelUi() {
  const collapsed = Boolean(state.focusMode && state.focusSidePanelCollapsed);
  document.body.classList.toggle("focus-board-side-collapsed", collapsed);
  if (els.sidePanel) {
    if (collapsed) els.sidePanel.setAttribute("aria-hidden", "true");
    else els.sidePanel.removeAttribute("aria-hidden");
  }
  if (els.controlsDock) {
    if (collapsed) els.controlsDock.setAttribute("aria-hidden", "true");
    else els.controlsDock.removeAttribute("aria-hidden");
  }
  if (els.checkpointDock) {
    if (collapsed) els.checkpointDock.setAttribute("aria-hidden", "true");
    else els.checkpointDock.removeAttribute("aria-hidden");
  }
  if (els.difficultyDock) {
    if (collapsed) els.difficultyDock.setAttribute("aria-hidden", "true");
    else els.difficultyDock.removeAttribute("aria-hidden");
  }
  if (els.toggleFocusSidePanel) {
    els.toggleFocusSidePanel.hidden = !state.focusMode;
    els.toggleFocusSidePanel.setAttribute("aria-expanded", collapsed ? "false" : "true");
    els.toggleFocusSidePanel.textContent = collapsed ? "Opcje" : "Schowaj";
    els.toggleFocusSidePanel.setAttribute(
      "aria-label",
      collapsed ? "Pokaż panel ustawień skupienia" : "Ukryj panel ustawień skupienia"
    );
  }
}

const FOCUS_FLOATING_PANEL_AUTO_HIDE_MQ = "(max-width: 720px)";

function shouldAutoHideFloatingFocusPanel() {
  try {
    return window.matchMedia(FOCUS_FLOATING_PANEL_AUTO_HIDE_MQ).matches;
  } catch {
    return false;
  }
}

function collapseFloatingFocusPanelIfNarrowViewport() {
  if (!state.focusMode || !shouldAutoHideFloatingFocusPanel()) return;
  state.focusSidePanelCollapsed = true;
  syncFocusSidePanelUi();
}

function subscribeFloatingFocusPanelNarrowMq() {
  try {
    const mq = window.matchMedia(FOCUS_FLOATING_PANEL_AUTO_HIDE_MQ);
    const onChange = () => collapseFloatingFocusPanelIfNarrowViewport();
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  } catch {
  }
}

function toggleFocusSidePanelCollapsed() {
  if (!state.focusMode) return;
  state.focusSidePanelCollapsed = !state.focusSidePanelCollapsed;
  syncFocusSidePanelUi();
}

function toggleFocusBoard() {
  state.focusMode = !state.focusMode;
  if (!state.focusMode) {
    state.focusSidePanelCollapsed = false;
  }
  document.body.classList.toggle("focus-board", state.focusMode);
  if (state.focusMode && shouldAutoHideFloatingFocusPanel()) {
    state.focusSidePanelCollapsed = true;
  }
  syncFocusButtonLabels();
  syncFocusSidePanelUi();
  applyTrayFilters({
    relayout: state.trayFilterType !== "all" || state.trayFilterRegion !== "all",
  });
}

function openGuideScreen() {
  els.guideScreen.classList.remove("hidden");
}

function setAssistMode(value) {
  state.assistMode = value || "warm";
  if (els.assistMode) els.assistMode.value = state.assistMode;
  updateBoardGhostHints();
}

function bindEventListeners() {
  installPieceDelegation();
  installBoardPanZoom();
  installTutorial();

  els.gift.addEventListener("click", openGift);
  els.gift.addEventListener("pointerenter", () => void prefetchPuzzleImage());
  els.gift.addEventListener("focus", () => void prefetchPuzzleImage());
  els.gift.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openGift();
    }
  });

  els.newPuzzle.addEventListener("click", () => {
    buildPuzzle();
    resetTimer();
  });

  els.shuffle.addEventListener("click", shuffleLoosePieces);
  els.toggleWorkbench?.addEventListener("click", () => {
    state.workbenchCollapsed = !state.workbenchCollapsed;
    els.workbench.classList.toggle("collapsed", state.workbenchCollapsed);
    els.toggleWorkbench.textContent = state.workbenchCollapsed ? "Rozwiń" : "Zwiń";
    els.toggleWorkbench.setAttribute("aria-expanded", state.workbenchCollapsed ? "false" : "true");
    syncWorkbenchResizeHandle();
  });
  els.workbenchResizeHandle?.addEventListener("pointerdown", (event) => {
    if (state.workbenchCollapsed) return;
    event.preventDefault();
    workbenchResizeSession = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: els.workbench.getBoundingClientRect().height,
    };
    document.body.classList.add("is-resizing-workbench");
    try {
      els.workbenchResizeHandle.setPointerCapture(event.pointerId);
    } catch {
    }
  });
  els.workbenchResizeHandle?.addEventListener("pointermove", (event) => {
    if (!workbenchResizeSession || workbenchResizeSession.pointerId !== event.pointerId) return;
    const delta = event.clientY - workbenchResizeSession.startY;
    const maxHeight = Math.max(360, window.innerHeight * 1.15);
    const height = clampNumber(workbenchResizeSession.startHeight + delta, 90, maxHeight);
    els.workbench.style.setProperty("--workbench-height", `${Math.round(height)}px`);
  });
  const finishWorkbenchResize = (event) => {
    if (!workbenchResizeSession || workbenchResizeSession.pointerId !== event.pointerId) return;
    try {
      els.workbenchResizeHandle.releasePointerCapture(event.pointerId);
    } catch {
    }
    workbenchResizeSession = null;
    document.body.classList.remove("is-resizing-workbench");
  };
  els.workbenchResizeHandle?.addEventListener("pointerup", finishWorkbenchResize);
  els.workbenchResizeHandle?.addEventListener("pointercancel", finishWorkbenchResize);
  els.openGuide?.addEventListener("click", openGuideScreen);
  els.closeGuide?.addEventListener("click", () => {
    els.guideScreen.classList.add("hidden");
  });
  els.guideScreen?.addEventListener("click", (event) => {
    if (event.target === els.guideScreen) {
      els.guideScreen.classList.add("hidden");
    }
  });
  els.printTemplate.addEventListener("click", () => void printTemplate());
  els.export3d.addEventListener("click", () => void exportPuzzle3d());
  els.saveCheckpoint.addEventListener("click", () => void saveCheckpoint());
  els.loadCheckpoint.addEventListener("click", () => void loadCheckpoint());
  els.trayFilters.forEach((button) => {
    button.addEventListener("click", () => {
      setTrayFilter(button.dataset.filterKind, button.dataset.filterValue);
    });
  });

  els.focusBoard?.addEventListener("click", toggleFocusBoard);
  els.toggleFocusSidePanel?.addEventListener("click", toggleFocusSidePanelCollapsed);

  els.assistMode?.addEventListener("change", () => {
    setAssistMode(els.assistMode.value || "warm");
  });

  els.tray?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tray-sort]");
    if (!button) return;
    event.preventDefault();
    setTrayShapeFilter(button.dataset.traySort || "frame-first");
  });

  els.mobilePreview?.addEventListener("click", () => {
    els.previewModal?.classList.remove("hidden");
  });
  els.mobileFocus?.addEventListener("click", () => toggleFocusBoard());
  els.mobileHelp?.addEventListener("click", () => openGuideScreen());

  try {
    const mobileMq = window.matchMedia("(max-width: 900px)");
    const onMobileMq = () => syncMobileActionsBar();
    if (mobileMq.addEventListener) mobileMq.addEventListener("change", onMobileMq);
    else if (mobileMq.addListener) mobileMq.addListener(onMobileMq);
  } catch {
    /* noop */
  }

  const audioToggleGroups = [
    { sfx: els.sfxToggleStart, music: els.musicToggleStart },
    { sfx: els.sfxToggle, music: els.musicToggle },
  ];
  const onSfxChange = (event) => {
    const on = Boolean(event.currentTarget.checked);
    setSoundsEnabled(on);
    syncAudioToggles(...audioToggleGroups);
    if (on) playUiAck();
  };
  els.sfxToggle?.addEventListener("change", onSfxChange);
  els.sfxToggleStart?.addEventListener("change", onSfxChange);

  const onMusicChange = (event) => {
    const on = Boolean(event.currentTarget.checked);
    setMusicEnabled(on);
    applyBgmMutedState(els.bgmAudio);
    syncAudioToggles(...audioToggleGroups);
    if (on && state.started) void startBgmIfAllowed(els.bgmAudio);
  };
  els.musicToggle?.addEventListener("change", onMusicChange);
  els.musicToggleStart?.addEventListener("change", onMusicChange);

  els.difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      els.pieceCount.value = button.dataset.pieces;
      buildPuzzle();
      resetTimer();
    });
  });

  els.pieceCount.addEventListener("change", () => {
    buildPuzzle();
    resetTimer();
  });

  els.imageInput.addEventListener("change", (event) => {
    changeImage(event.target.files?.[0]);
  });

  els.closeCelebration.addEventListener("click", () => {
    els.celebration.classList.add("hidden");
  });

  els.winNewPuzzle?.addEventListener("click", () => {
    els.celebration.classList.add("hidden");
    buildPuzzle();
    resetTimer();
  });

  els.winChangeLevel?.addEventListener("click", () => {
    els.celebration.classList.add("hidden");
    els.pieceCount.focus();
    els.pieceCount.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  els.winViewImage?.addEventListener("click", () => {
    els.celebration.classList.add("hidden");
    els.previewModal.classList.remove("hidden");
  });

  els.celebration.addEventListener("click", (event) => {
    if (event.target === els.celebration) {
      els.celebration.classList.add("hidden");
    }
  });

  els.previewZoom.addEventListener("click", () => {
    els.previewModal.classList.remove("hidden");
  });

  els.closePreview.addEventListener("click", () => {
    els.previewModal.classList.add("hidden");
  });

  els.previewModal.addEventListener("click", (event) => {
    if (event.target === els.previewModal) {
      els.previewModal.classList.add("hidden");
    }
  });

  window.addEventListener("resize", () => {
    scheduleViewportPuzzleRefresh();
    syncFocusSidePanelUi();
    syncMobileActionsBar();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      els.guideScreen.classList.add("hidden");
      els.previewModal.classList.add("hidden");
      els.celebration.classList.add("hidden");
      return;
    }
    const activePiece = document.querySelector(".piece.selected-rotate");
    if (!activePiece) return;
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      rotatePiece(activePiece);
    }
  });

  window.addEventListener("pageshow", () => {
    resetInitialView();
    refreshDesktopDifficultyControls();
  });

  refreshDesktopDifficultyControls();
  subscribeDesktopDifficultyLayout(scheduleViewportPuzzleRefresh);
  subscribeWorkbenchLayout(onWorkbenchLayoutMqChange);
  subscribeTrayFiltersPanelPortableLayout(placeTrayFiltersPanel);
  placeTrayFiltersPanel();
  subscribeFloatingFocusPanelNarrowMq();
}
bindEventListeners();
configureBgmElement(els.bgmAudio);
syncAudioToggles(
  { sfx: els.sfxToggleStart, music: els.musicToggleStart },
  { sfx: els.sfxToggle, music: els.musicToggle }
);
setPuzzleBackground(state.imageSrc);
resetInitialView();
refreshDesktopDifficultyControls();
syncFocusSidePanelUi();
syncMobileActionsBar();
