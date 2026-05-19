import { BACKDROP_TONES } from "./config.js";
import { els } from "./state.js";

function readImageLuminance(img) {
  try {
    const sampleSize = 24;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    canvas.width = sampleSize;
    canvas.height = sampleSize;
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    }
    return total / (data.length / 4);
  } catch {
    return null;
  }
}

function pickTone(img) {
  const luminance = img ? readImageLuminance(img) : null;
  const { light, dark, mid } = BACKDROP_TONES;
  if (luminance !== null && luminance > light.luminanceMin) return light;
  if (luminance !== null && luminance < dark.luminanceMax) return dark;
  return mid;
}

export function setPuzzleBackground(src, img = null) {
  const tone = pickTone(img);
  const cssUrl = `url(${JSON.stringify(src)})`;
  const style = els.gameScreen.style;
  style.setProperty("--puzzle-bg-image", cssUrl);
  style.setProperty("--puzzle-bg-brightness", tone.brightness);
  style.setProperty("--puzzle-bg-contrast", tone.contrast);
  style.setProperty("--puzzle-bg-saturation", tone.saturation);
  style.setProperty("--puzzle-bg-opacity", tone.opacity);
  style.setProperty("--puzzle-bg-highlight-overlay", tone.highlightOverlay);
  style.setProperty("--puzzle-bg-shade-overlay", tone.shadeOverlay);
  els.backdrop.style.backgroundImage = cssUrl;
}
