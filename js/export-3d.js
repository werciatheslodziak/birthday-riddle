import { PRINT_3D, PUZZLE } from "./config.js";
import { state, setStatus } from "./state.js";
import { STATUS, VIEW_3D } from "./messages.js";
import {
  edgeSigns,
  fanTriangulateAroundCentre,
  puzzleOutlinePoints,
  puzzlePath,
  rectCentre,
} from "./geometry.js";
import { escapeAttribute, escapeHtml, openHtmlInNewTab } from "./utils.js";

function computePrint3dLayout() {
  const imageRatio = (state.imageHeight || 720) / (state.imageWidth || 1280);
  const fullWidth = PRINT_3D.puzzleWidthMm;
  const fullHeight = fullWidth * imageRatio;
  const pieceW = fullWidth / state.cols;
  const pieceH = fullHeight / state.rows;
  const tab = Math.min(pieceW, pieceH) * PUZZLE.tabRatio;
  const slotW = pieceW + tab * 2 + PRINT_3D.gapMm;
  const slotH = pieceH + tab * 2 + PRINT_3D.gapMm;
  return {
    pieceW,
    pieceH,
    tab,
    slotW,
    slotH,
    sheetW: state.cols * slotW - PRINT_3D.gapMm,
    sheetH: state.rows * slotH - PRINT_3D.gapMm,
  };
}

function normalFor(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

function countPieceTriangles(outline) {
  return outline.length * 2 + outline.length * 2;
}

function createPuzzle3dBinaryStl() {
  const { pieceW, pieceH, tab, slotW, slotH } = computePrint3dLayout();
  const thickness = PRINT_3D.thicknessMm;
  const pieces = [];

  let totalTriangles = 0;
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const offsetX = col * slotW + tab;
      const offsetY = row * slotH + tab;
      const outline = puzzleOutlinePoints(
        pieceW,
        pieceH,
        tab,
        edgeSigns(row, col),
        PRINT_3D.bezierSegments
      ).map((point) => ({ x: point.x + offsetX, y: point.y + offsetY }));
      const centre = {
        x: pieceW / 2 + offsetX,
        y: pieceH / 2 + offsetY,
      };
      const { polygon, triangles } = fanTriangulateAroundCentre(outline, centre);
      pieces.push({ polygon, triangles });
      totalTriangles += countPieceTriangles(polygon);
    }
  }

  const bufferSize = 84 + totalTriangles * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  const header = new TextEncoder().encode("puzzle_export ");
  for (let i = 0; i < Math.min(header.length, 80); i += 1) {
    view.setUint8(i, header[i]);
  }
  view.setUint32(80, totalTriangles, true);

  let offset = 84;
  const writeTriangle = (a, b, c) => {
    const n = normalFor(a, b, c);
    view.setFloat32(offset, n[0], true);
    view.setFloat32(offset + 4, n[1], true);
    view.setFloat32(offset + 8, n[2], true);
    view.setFloat32(offset + 12, a[0], true);
    view.setFloat32(offset + 16, a[1], true);
    view.setFloat32(offset + 20, a[2], true);
    view.setFloat32(offset + 24, b[0], true);
    view.setFloat32(offset + 28, b[1], true);
    view.setFloat32(offset + 32, b[2], true);
    view.setFloat32(offset + 36, c[0], true);
    view.setFloat32(offset + 40, c[1], true);
    view.setFloat32(offset + 44, c[2], true);
    view.setUint16(offset + 48, 0, true);
    offset += 50;
  };

  for (const { polygon, triangles } of pieces) {
    for (const tri of triangles) {
      const [a, b, c] = tri;
      writeTriangle(
        [a.x, a.y, thickness],
        [b.x, b.y, thickness],
        [c.x, c.y, thickness]
      );
      writeTriangle(
        [c.x, c.y, 0],
        [b.x, b.y, 0],
        [a.x, a.y, 0]
      );
    }
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      writeTriangle(
        [a.x, a.y, 0],
        [b.x, b.y, 0],
        [b.x, b.y, thickness]
      );
      writeTriangle(
        [a.x, a.y, 0],
        [b.x, b.y, thickness],
        [a.x, a.y, thickness]
      );
    }
  }

  return new Blob([buffer], { type: "model/stl" });
}

function createPuzzle3dPreviewSvg() {
  const { pieceW, pieceH, tab, slotW, slotH, sheetW, sheetH } = computePrint3dLayout();
  const pieces = [];

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const d = puzzlePath(pieceW, pieceH, tab, edgeSigns(row, col));
      const x = col * slotW + tab;
      const y = row * slotH + tab;
      pieces.push(`
        <g transform="translate(${x} ${y})">
          <path d="${d}" transform="translate(2.2 3.2)" fill="#8c5f6f" opacity="0.55" />
          <path d="${d}" fill="url(#pieceTop)" stroke="#6b1c39" stroke-width="0.55" stroke-linejoin="round" />
          <path d="${d}" fill="none" stroke="rgba(255,255,255,0.76)" stroke-width="0.28" stroke-linejoin="round" />
        </g>
      `);
    }
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${sheetW + 6} ${sheetH + 8}" role="img" aria-label="${escapeAttribute(VIEW_3D.ariaPreview)}">
      <defs>
        <linearGradient id="pieceTop" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#fff2e4" />
          <stop offset="0.52" stop-color="#d8a9b6" />
          <stop offset="1" stop-color="#a95a74" />
        </linearGradient>
      </defs>
      <rect x="-2" y="-2" width="${sheetW + 6}" height="${sheetH + 8}" rx="8" fill="#fff7ef" />
      ${pieces.join("\n")}
    </svg>
  `;
}

function renderListSection({ title, items, ordered }) {
  const tag = ordered ? "ol" : "ul";
  const lis = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
  return `<article class="card">
    <h2>${escapeHtml(title)}</h2>
    <${tag}>${lis}</${tag}>
  </article>`;
}

function build3dPreviewHtml({ stlUrl, filename, previewSvg }) {
  const sectionsHtml = VIEW_3D.sections.map(renderListSection).join("\n");
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(VIEW_3D.pageTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: clamp(16px, 3vw, 34px);
      color: #4e1027;
      font-family: Arial, sans-serif;
      background:
        radial-gradient(circle at 12% 8%, rgba(215, 167, 43, 0.18), transparent 26%),
        linear-gradient(135deg, #fff8ee, #f5dce4);
    }
    .page { width: min(1180px, 100%); margin: 0 auto; display: grid; gap: 18px; }
    .hero, .card {
      border-radius: 24px;
      background: rgba(255, 250, 242, 0.86);
      border: 1px solid rgba(255, 255, 255, 0.78);
      box-shadow: 0 20px 60px rgba(95, 23, 48, 0.12);
    }
    .hero { padding: clamp(18px, 3vw, 28px); display: grid; gap: 12px; }
    h1, h2 { margin: 0; color: #4e1027; }
    h1 { font-size: clamp(1.7rem, 4vw, 2.6rem); }
    h2 { font-size: 1.1rem; }
    p, li { line-height: 1.55; }
    p { margin: 0; }
    ul, ol { margin: 10px 0 0; padding-left: 22px; }
    li + li { margin-top: 6px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .button {
      display: inline-grid; place-items: center; min-height: 44px; padding: 10px 16px;
      border: 0; border-radius: 14px; color: white;
      background: linear-gradient(135deg, #7d1d3a, #b53359);
      text-decoration: none; font: inherit; font-weight: 800; cursor: pointer;
    }
    .button.secondary {
      color: #5f1730;
      background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,248,238,0.84));
      border: 1px solid rgba(215, 167, 43, 0.24);
    }
    .layout { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr); gap: 18px; align-items: start; }
    .preview { padding: clamp(12px, 2vw, 18px); }
    .preview svg { width: 100%; height: auto; display: block; border-radius: 18px; background: #fff7ef; }
    .cards { display: grid; gap: 14px; }
    .card { padding: 16px; }
    .meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .meta span {
      padding: 10px; border-radius: 14px; text-align: center; font-weight: 800;
      background: rgba(255, 255, 255, 0.7);
    }
    @media (max-width: 860px) {
      .layout, .meta { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <h1>${escapeHtml(VIEW_3D.heading)}</h1>
      <p>${escapeHtml(VIEW_3D.intro)}</p>
      <div class="actions">
        <a class="button" href="${escapeAttribute(stlUrl)}" download="${escapeAttribute(filename)}">${escapeHtml(VIEW_3D.download)}</a>
        <button class="button secondary" type="button" onclick="window.close()">${escapeHtml(VIEW_3D.close)}</button>
      </div>
      <div class="meta">
        <span>${escapeHtml(VIEW_3D.grid(state.cols, state.rows))}</span>
        <span>${escapeHtml(VIEW_3D.count(state.total))}</span>
        <span>${escapeHtml(VIEW_3D.thickness)}</span>
      </div>
    </section>

    <section class="layout">
      <article class="card preview">
        ${previewSvg}
      </article>
      <div class="cards">
        ${sectionsHtml}
      </div>
    </section>
  </main>
</body>
</html>`;
}

export async function exportPuzzle3d() {
  if (!state.verticalTabs.length || !state.horizontalTabs.length) {
    setStatus(STATUS.buildBefore3d);
    return;
  }

  if (state.total >= PUZZLE.printExportDisabledMinPieces) {
    setStatus(STATUS.printExportDisabled);
    return;
  }

  setStatus(STATUS.template3dRendering);
  await new Promise((resolve) => requestAnimationFrame(resolve));

  let stlBlob;
  try {
    stlBlob = createPuzzle3dBinaryStl();
  } catch {
    setStatus(STATUS.imageLoadFailed);
    return;
  }

  const filename = `puzzle-${state.cols}x${state.rows}.stl`;
  const stlUrl = URL.createObjectURL(stlBlob);
  const previewSvg = createPuzzle3dPreviewSvg();
  const html = build3dPreviewHtml({ stlUrl, filename, previewSvg });

  const popup = openHtmlInNewTab(html);
  if (!popup) {
    URL.revokeObjectURL(stlUrl);
    setStatus(STATUS.popupBlocked3d);
    return;
  }

  window.setTimeout(() => URL.revokeObjectURL(stlUrl), 120_000);
  setStatus(STATUS.template3dReady);
}
