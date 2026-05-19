import { PUZZLE } from "./config.js";
import { loadImage } from "./utils.js";

export async function preparePuzzleImageSource(src) {
  if (!src) return src;
  if (src.startsWith("data:")) return src;
  try {
    const img = await loadImage(src);
    const maxDim = PUZZLE.imageMaxDimension || 2400;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) return src;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch {
    return src;
  }
}

export async function preparePuzzleImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    return await preparePuzzleImageSource(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
