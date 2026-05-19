import { PRINT_2D, PUZZLE } from "./config.js";
import { els, state, setStatus } from "./state.js";
import { STATUS, VIEW_2D } from "./messages.js";
import { edgeSigns, puzzlePath } from "./geometry.js";
import { escapeAttribute, escapeHtml, loadImage, openHtmlInNewTab, resolveImageSrc } from "./utils.js";

function computePrintLayout(imageWidth, imageHeight) {
  const pieceW = imageWidth / state.cols;
  const pieceH = imageHeight / state.rows;
  const tab = Math.min(pieceW, pieceH) * PUZZLE.tabRatio;
  const bleed = Math.max(PRINT_2D.bleedMinPx, Math.min(pieceW, pieceH) * PRINT_2D.bleedRatio);
  const gap = Math.max(tab * PRINT_2D.gapTabMultiplier, bleed * PRINT_2D.gapBleedMultiplier);
  const padding = tab + bleed;
  const slotW = pieceW + padding * 2 + gap;
  const slotH = pieceH + padding * 2 + gap;
  const sheetW = state.cols * slotW - gap;
  const sheetH = state.rows * slotH - gap;
  const strokeWidth = Math.max(
    PRINT_2D.strokeMinPx,
    Math.min(imageWidth, imageHeight) * PRINT_2D.strokeRatio
  );
  return { pieceW, pieceH, tab, bleed, gap, padding, slotW, slotH, sheetW, sheetH, strokeWidth };
}

function getPrintOptions() {
  return {
    showNumbers: true,
    imageOpacity: 0.62,
    bleedOpacity: 0.5,
  };
}

function pieceLabel(row, col) {
  return `${row + 1}.${col + 1}`;
}

function buildPrintSvg(layout, options) {
  const { pieceW, pieceH, tab, bleed, padding, slotW, slotH, sheetW, sheetH, strokeWidth } = layout;
  const imageWidth = state.imageWidth;
  const imageHeight = state.imageHeight;
  const imageSrc = escapeAttribute(resolveImageSrc(state.imageSrc));
  const pieces = [];
  const labelSize = Math.max(10, Math.min(pieceW, pieceH) * 0.18);

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const pathId = `p-${row}-${col}`;
      const bleedId = `b-${row}-${col}`;
      const d = puzzlePath(pieceW, pieceH, tab, edgeSigns(row, col));
      const x = col * slotW + padding;
      const y = row * slotH + padding;
      const bleedX = -padding;
      const bleedY = -padding;
      const bleedW = pieceW + padding * 2;
      const bleedH = pieceH + padding * 2;

      const label = options.showNumbers
        ? `<text class="piece-label" x="${pieceW / 2}" y="${pieceH / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="${labelSize}" font-weight="700" fill="#4e1027" stroke="#fffaf2" stroke-width="${Math.max(1.5, strokeWidth * 1.2)}" paint-order="stroke" opacity="0.82">${escapeHtml(pieceLabel(row, col))}</text>`
        : "";

      pieces.push(`
        <g transform="translate(${x} ${y})">
          <clipPath id="${bleedId}" clipPathUnits="userSpaceOnUse">
            <rect x="${bleedX}" y="${bleedY}" width="${bleedW}" height="${bleedH}" rx="${bleed * 0.35}" />
          </clipPath>
          <image class="bleed-image" href="${imageSrc}" x="${-col * pieceW}" y="${-row * pieceH}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="none" clip-path="url(#${bleedId})" opacity="${options.bleedOpacity}" />
          <clipPath id="${pathId}" clipPathUnits="userSpaceOnUse">
            <path d="${d}" />
          </clipPath>
          <image class="piece-image" href="${imageSrc}" x="${-col * pieceW}" y="${-row * pieceH}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="none" clip-path="url(#${pathId})" opacity="${options.imageOpacity}" />
          <path d="${d}" fill="none" stroke="#fffaf2" stroke-width="${strokeWidth * 2.4}" stroke-linejoin="round" stroke-linecap="round" opacity="0.92" />
          <path d="${d}" fill="none" stroke="#4e1027" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" />
          ${label}
        </g>
      `);
    }
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sheetW} ${sheetH}" role="img" aria-label="${escapeAttribute(VIEW_2D.ariaSvg)}">
      ${pieces.join("\n")}
    </svg>
  `;
}

async function renderPrintCanvasBlob(layout, img, options) {
  const { pieceW, pieceH, tab, bleed, padding, slotW, slotH, sheetW, sheetH, strokeWidth } = layout;

  const scale = Math.min(1, PRINT_2D.maxCanvasDimension / Math.max(sheetW, sheetH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sheetW * scale);
  canvas.height = Math.round(sheetH * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-2d-unavailable");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const sPieceW = pieceW * scale;
  const sPieceH = pieceH * scale;
  const sTab = tab * scale;
  const sPad = padding * scale;
  const sBleed = bleed * scale;
  const sStroke = strokeWidth * scale;
  const sSlotW = slotW * scale;
  const sSlotH = slotH * scale;
  const imgDrawW = state.imageWidth * scale;
  const imgDrawH = state.imageHeight * scale;
  const labelSize = Math.max(10, Math.min(pieceW, pieceH) * 0.18) * scale;

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const slotX = col * sSlotW + sPad;
      const slotY = row * sSlotH + sPad;
      const piecePath = new Path2D(
        puzzlePath(sPieceW, sPieceH, sTab, edgeSigns(row, col))
      );

      ctx.save();
      ctx.translate(slotX, slotY);

      ctx.save();
      const bleedPath = new Path2D();
      const rectX = -sPad;
      const rectY = -sPad;
      const rectW = sPieceW + sPad * 2;
      const rectH = sPieceH + sPad * 2;
      const radius = sBleed * 0.35;
      bleedPath.moveTo(rectX + radius, rectY);
      bleedPath.lineTo(rectX + rectW - radius, rectY);
      bleedPath.quadraticCurveTo(rectX + rectW, rectY, rectX + rectW, rectY + radius);
      bleedPath.lineTo(rectX + rectW, rectY + rectH - radius);
      bleedPath.quadraticCurveTo(rectX + rectW, rectY + rectH, rectX + rectW - radius, rectY + rectH);
      bleedPath.lineTo(rectX + radius, rectY + rectH);
      bleedPath.quadraticCurveTo(rectX, rectY + rectH, rectX, rectY + rectH - radius);
      bleedPath.lineTo(rectX, rectY + radius);
      bleedPath.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
      ctx.clip(bleedPath);
      ctx.globalAlpha = options.bleedOpacity;
      ctx.drawImage(img, -col * sPieceW, -row * sPieceH, imgDrawW, imgDrawH);
      ctx.globalAlpha = 1;
      ctx.restore();

      ctx.save();
      ctx.clip(piecePath);
      ctx.globalAlpha = options.imageOpacity;
      ctx.drawImage(img, -col * sPieceW, -row * sPieceH, imgDrawW, imgDrawH);
      ctx.globalAlpha = 1;
      ctx.restore();

      ctx.lineWidth = sStroke * 2.4;
      ctx.strokeStyle = "rgba(255, 250, 242, 0.92)";
      ctx.stroke(piecePath);
      ctx.lineWidth = sStroke;
      ctx.strokeStyle = "#4e1027";
      ctx.stroke(piecePath);

      if (options.showNumbers) {
        ctx.font = `700 ${labelSize}px Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(1.5, sStroke * 1.8);
        ctx.strokeStyle = "rgba(255, 250, 242, 0.95)";
        ctx.fillStyle = "rgba(78, 16, 39, 0.82)";
        ctx.strokeText(pieceLabel(row, col), sPieceW / 2, sPieceH / 2);
        ctx.fillText(pieceLabel(row, col), sPieceW / 2, sPieceH / 2);
      }

      ctx.restore();
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas-toBlob-failed"))),
      "image/png",
      0.92
    );
  });
}

function popupShell({ title, headerHtml, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; color: #4e1027; font-family: Arial, sans-serif; background: #fffaf2; }
    .print-page { display: grid; gap: 12px; max-width: 1100px; margin: 0 auto; }
    h1 { margin: 0; font-size: 18px; }
    p { margin: 0; font-size: 12px; line-height: 1.4; }
    img.sheet, svg { width: 100%; height: auto; display: block; background: white; border: 1px solid #ddd; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .print-settings { display: inline-flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 8px 10px; border-radius: 12px; background: #fff; border: 1px solid #ead4dc; }
    .print-settings label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: bold; }
    .print-settings select { padding: 6px 8px; border-radius: 8px; border: 1px solid #ead4dc; color: #4e1027; background: #fffaf2; }
    button { padding: 10px 14px; border: 0; border-radius: 10px; color: white; background: #7d1d3a; cursor: pointer; font: inherit; font-weight: bold; }
    .piece-image { opacity: var(--piece-opacity, 0.62); }
    .bleed-image { opacity: var(--bleed-opacity, 0.5); }
    body.hide-field-numbers .piece-label { display: none; }
    @media print {
      body { padding: 0; background: white; }
      .actions, .note { display: none; }
      .print-page { max-width: none; gap: 0; }
      h1 { margin-bottom: 6mm; }
      img.sheet, svg { max-height: calc(100vh - 16mm); border: 0; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="print-page">
    <div class="actions">
      <button type="button" onclick="window.print()">${escapeHtml(VIEW_2D.print)}</button>
      <button type="button" onclick="window.close()">${escapeHtml(VIEW_2D.close)}</button>
      <div class="print-settings" role="group" aria-label="Opcje drukowania">
        <label>
          <input id="fieldNumbers" type="checkbox" checked />
          Numery pól
        </label>
        <label>
          Jasność
          <select id="brightness">
            <option value="normal">Normalna</option>
            <option value="light" selected>Jasna</option>
            <option value="faint">Bardzo jasna</option>
          </select>
        </label>
      </div>
    </div>
    ${headerHtml}
    ${bodyHtml}
  </main>
  <script>
    const values = {
      normal: { piece: "1", bleed: "0.9" },
      light: { piece: "0.62", bleed: "0.5" },
      faint: { piece: "0.36", bleed: "0.26" }
    };
    const numbers = document.getElementById("fieldNumbers");
    const brightness = document.getElementById("brightness");
    function applyPrintSettings() {
      const current = values[brightness.value] || values.light;
      document.documentElement.style.setProperty("--piece-opacity", current.piece);
      document.documentElement.style.setProperty("--bleed-opacity", current.bleed);
      document.body.classList.toggle("hide-field-numbers", !numbers.checked);
    }
    numbers.addEventListener("change", applyPrintSettings);
    brightness.addEventListener("change", applyPrintSettings);
    applyPrintSettings();
  </script>
</body>
</html>`;
}

function statusBeforeRender() {
  setStatus(STATUS.template2dRendering);
}

export async function printTemplate() {
  if (!state.verticalTabs.length || !state.horizontalTabs.length) {
    setStatus(STATUS.buildBefore2d);
    return;
  }

  if (state.total >= PUZZLE.printExportDisabledMinPieces) {
    setStatus(STATUS.printExportDisabled);
    return;
  }

  statusBeforeRender();
  let img;
  try {
    img = await loadImage(state.imageSrc);
  } catch {
    setStatus(STATUS.imageLoadFailed);
    return;
  }

  const layout = computePrintLayout(img.naturalWidth, img.naturalHeight);
  const printOptions = getPrintOptions();
  const heading = `<h1>${escapeHtml(VIEW_2D.heading(state.cols, state.rows))}</h1>
        <p class="note">${escapeHtml(VIEW_2D.note)} Opcje numerów pól i jasności ustawisz tutaj przed drukowaniem.</p>`;
  const bodyHtml = buildPrintSvg(layout, printOptions);

  const html = popupShell({
    title: VIEW_2D.pageTitle,
    headerHtml: heading,
    bodyHtml,
  });

  const popup = openHtmlInNewTab(html);
  if (!popup) {
    setStatus(STATUS.popupBlocked2d);
    return;
  }
  setStatus(STATUS.template2dReady);
}
