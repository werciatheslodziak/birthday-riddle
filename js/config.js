export const DEFAULT_IMAGE = "./assets/base_puzzle.webp";

export const STORAGE_KEYS = {
  checkpoint: "puzelki.checkpoint.v1",
  soundsEnabled: "puzelki.sounds.enabled.v1",
  musicEnabled: "puzelki.music.enabled.v1",
  tutorialSeen: "puzelki.tutorial.seen.v1",
};

export const ROTATION_STEP = 90;
export const ROTATION_OPTIONS = [0, 90, 180, 270];

export const PUZZLE = {
  tabRatio: 0.18,
  minTab: 8,
  maxBoardWidth: 720,
  minBoardWidth: 280,
  desktopHeavyBoardMinPieces: 500,
  boardScaleReferenceWidthPx: 1280,
  boardScaleGamma: 0.45,
  boardScaleMulFloor: 0.88,
  boardScaleMulCeil: 1.34,
  monumentTierMinPieces: 1000,
  printExportDisabledMinPieces: 500,
  desktopOnlyMinPieces: 500,
  desktopPuzzleMq: "(min-width: 1024px)",
  workbenchLayoutMq: "(min-width: 721px)",
  desktopHeavyFallbackPieces: 144,
  mobileMaxPresetPieces: 64,
  hardModeThreshold: 100,
  largePuzzleThreshold: 200,
  pieceImageStrokeWidth: 2,
  snapNearestRatio: 0.42,
  snapMinThresholdPx: 30,
  snapMagnetStrength: 0.38,
  snapRotationAssistWarm: true,
  pieceBuildChunkSize: 20,
  imageMaxDimension: 2400,
  boardPanScaleMin: 0.85,
  boardPanScaleMax: 1.65,
  dragMoveTolerancePx: 8,
  dragLiftScale: 1.042,
  snapTweenMs: 240,
  rejectFeedbackMs: 360,
  snapSuccessVibrateMs: [12],
  snapNearVibrateMs: [4],
  soundMasterGain: 0.26,
  bgmUrl: "./assets/bgm.mp3",
  musicVolume: 0.28,
  twistSecondFingerHitPaddingPx: 80,
  pieceRotateTransformMs: 150,
  pieceRotateTransformEasing: "ease",
  pieceHoverZoomMinPieces: 100,
};

export const PRINT_2D = {
  bleedRatio: 0.045,
  bleedMinPx: 10,
  gapTabMultiplier: 1.35,
  gapBleedMultiplier: 3,
  strokeRatio: 0.0026,
  strokeMinPx: 1.6,
  maxCanvasDimension: 4800,
};

export const PRINT_3D = {
  puzzleWidthMm: 180,
  thicknessMm: 2,
  gapMm: 4,
  bezierSegments: 6,
  previewBezierSegments: 8,
};

export const OPEN_GIFT_TIMING = {
  presentFadeMs: 520,
  hideStartMs: 680,
  revealMs: 620,
};

export const SHARED_PUZZLE_IMAGE_ID = "puzzle-shared-image";

export const CONFETTI = {
  smallScreenCount: 42,
  bigScreenCount: 76,
  smallScreenBreakpointPx: 640,
  cleanupDelayMs: 3400,
  durationsSec: { min: 1.5, max: 2.9 },
  fallXSpreadPx: 220,
  spinDegSpread: 720,
  delaysSec: { min: 0, max: 0.28 },
  colors: ["#ff4f7a", "#ffc928", "#2fc4ff", "#7ee787", "#ffffff"],
};

export const BACKDROP_TONES = {
  light: {
    luminanceMin: 178,
    brightness: "0.5",
    contrast: "1.32",
    saturation: "1.42",
    opacity: "0.84",
    highlightOverlay: "0",
    shadeOverlay: "0.44",
  },
  dark: {
    luminanceMax: 92,
    brightness: "0.76",
    contrast: "1.14",
    saturation: "1.24",
    opacity: "0.82",
    highlightOverlay: "0",
    shadeOverlay: "0.22",
  },
  mid: {
    brightness: "0.58",
    contrast: "1.24",
    saturation: "1.34",
    opacity: "0.82",
    highlightOverlay: "0",
    shadeOverlay: "0.34",
  },
};

export const TRAY_HEIGHTS = {
  large: { minPx: 460, maxPx: 620, vhRatio: 0.52, threshold: 450 },
  medium: { px: 420, threshold: 100 },
  small: { px: 340 },
  absoluteMinPx: 280,
};

export const CHECKPOINT_SCHEMA_VERSION = 1;
