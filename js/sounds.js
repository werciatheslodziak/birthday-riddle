import { PUZZLE, STORAGE_KEYS } from "./config.js";

const AC = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;

let audioCtx = null;
let sfxBus = null;
let celebrateBus = null;

function readSfxEnabled() {
  const raw = localStorage.getItem(STORAGE_KEYS.soundsEnabled);
  if (raw === null) return true;
  return raw === "1";
}

function readMusicEnabled() {
  const raw = localStorage.getItem(STORAGE_KEYS.musicEnabled);
  if (raw === null) return true;
  return raw === "1";
}

function syncBusGains() {
  if (!audioCtx || !sfxBus || !celebrateBus) return;
  const t = audioCtx.currentTime;
  sfxBus.gain.cancelScheduledValues(t);
  celebrateBus.gain.cancelScheduledValues(t);
  sfxBus.gain.setValueAtTime(readSfxEnabled() ? PUZZLE.soundMasterGain : 0, t);
  const celebrateVol =
    readSfxEnabled() || readMusicEnabled()
      ? Math.min(0.95, PUZZLE.soundMasterGain * 1.08)
      : 0;
  celebrateBus.gain.setValueAtTime(celebrateVol, t);
}

export function isSoundsEnabled() {
  return readSfxEnabled();
}

export function isMusicEnabled() {
  return readMusicEnabled();
}

export function setSoundsEnabled(on) {
  localStorage.setItem(STORAGE_KEYS.soundsEnabled, on ? "1" : "0");
  syncBusGains();
}

export function setMusicEnabled(on) {
  localStorage.setItem(STORAGE_KEYS.musicEnabled, on ? "1" : "0");
  syncBusGains();
}

export function syncAudioToggles(...groups) {
  const sfx = readSfxEnabled();
  const music = readMusicEnabled();
  groups.forEach((g) => {
    if (g?.sfx) g.sfx.checked = sfx;
    if (g?.music) g.music.checked = music;
  });
}

function ensureGraph() {
  if (!AC) return null;
  if (!audioCtx) {
    audioCtx = new AC();
    sfxBus = audioCtx.createGain();
    celebrateBus = audioCtx.createGain();
    sfxBus.connect(audioCtx.destination);
    celebrateBus.connect(audioCtx.destination);
    syncBusGains();
  }
  return audioCtx;
}

async function prepareOutput(mode) {
  const ctx = ensureGraph();
  if (!ctx || !sfxBus || !celebrateBus) return null;

  const allowCelebrate = readSfxEnabled() || readMusicEnabled();
  const allow =
    mode === "celebrate" ? allowCelebrate : readSfxEnabled();
  if (!allow) return null;

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return null;
    }
  }

  syncBusGains();
  return {
    ctx,
    dest: mode === "celebrate" ? celebrateBus : sfxBus,
  };
}

const EPS = 0.0008;

function scheduleTone(ctx, destGain, t0, freq, duration, peak, type = "sine") {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(EPS, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, EPS * 2), t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(EPS, t0 + duration);
  osc.connect(g);
  g.connect(destGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.04);
}

export async function playSnapSuccess() {
  const out = await prepareOutput("sfx");
  if (!out) return;
  const { ctx, dest } = out;
  const t0 = ctx.currentTime + 0.01;
  scheduleTone(ctx, dest, t0, 784, 0.055, 0.1);
  scheduleTone(ctx, dest, t0 + 0.038, 1175, 0.072, 0.08);
}

export async function playParkSoft() {
  const out = await prepareOutput("sfx");
  if (!out) return;
  const { ctx, dest } = out;
  const t0 = ctx.currentTime + 0.01;
  scheduleTone(ctx, dest, t0, 620, 0.04, 0.055);
}

export async function playRejectSoft() {
  const out = await prepareOutput("sfx");
  if (!out) return;
  const { ctx, dest } = out;
  const t0 = ctx.currentTime + 0.01;
  scheduleTone(ctx, dest, t0, 220, 0.09, 0.065, "triangle");
}

export async function playGiftReveal() {
  const out = await prepareOutput("celebrate");
  if (!out) return;
  const { ctx, dest } = out;
  const t0 = ctx.currentTime + 0.015;
  scheduleTone(ctx, dest, t0, 740, 0.06, 0.085);
  scheduleTone(ctx, dest, t0 + 0.055, 988, 0.07, 0.075);
  scheduleTone(ctx, dest, t0 + 0.12, 1318, 0.095, 0.065);
}

export async function playWinCelebration() {
  const out = await prepareOutput("celebrate");
  if (!out) return;
  const { ctx, dest } = out;
  const t0 = ctx.currentTime + 0.02;
  const peaks = [0.1, 0.095, 0.09, 0.1, 0.085];
  scheduleTone(ctx, dest, t0, 523.25, 0.12, peaks[0]);
  scheduleTone(ctx, dest, t0 + 0.13, 659.25, 0.12, peaks[1]);
  scheduleTone(ctx, dest, t0 + 0.26, 783.99, 0.13, peaks[2]);
  scheduleTone(ctx, dest, t0 + 0.4, 1046.5, 0.14, peaks[3]);
  scheduleTone(ctx, dest, t0 + 0.56, 783.99, 0.16, peaks[4]);
}

export function playUiAck() {
  void playSnapSuccess();
}

export function configureBgmElement(audioEl) {
  if (!audioEl) return;
  audioEl.loop = true;
  audioEl.playsInline = true;
  audioEl.preload = "auto";
  audioEl.src = PUZZLE.bgmUrl;
  audioEl.volume = readMusicEnabled() ? PUZZLE.musicVolume : 0;
}

export async function startBgmIfAllowed(audioEl) {
  if (!audioEl || !readMusicEnabled()) return;
  audioEl.volume = PUZZLE.musicVolume;
  try {
    await audioEl.play();
  } catch {
  }
}

export function pauseBgm(audioEl) {
  if (!audioEl) return;
  audioEl.pause();
  try {
    audioEl.currentTime = 0;
  } catch {
  }
}

export function applyBgmMutedState(audioEl) {
  if (!audioEl) return;
  audioEl.volume = readMusicEnabled() ? PUZZLE.musicVolume : 0;
  syncBusGains();
  if (!readMusicEnabled()) pauseBgm(audioEl);
}
