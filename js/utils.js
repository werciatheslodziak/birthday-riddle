export function clampNumber(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

export function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function resolveImageSrc(src) {
  try {
    return new URL(src, window.location.href).href;
  } catch {
    return src;
  }
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function formatClockTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = String(Math.floor(safe / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function formatSaveTime(date = new Date()) {
  return date.toISOString().slice(0, 16).replace("T", ", ");
}

export function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function openHtmlInNewTab(html) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank");
  if (!popup) {
    URL.revokeObjectURL(url);
    return null;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return popup;
}

export function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function debounceRaf(fn) {
  let raf = 0;
  let latestArgs = null;
  return (...args) => {
    latestArgs = args;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const captured = latestArgs;
      latestArgs = null;
      fn(...captured);
    });
  };
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
