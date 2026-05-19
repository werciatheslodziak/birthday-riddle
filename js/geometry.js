import { state } from "./state.js";

export function gridFromCount(count) {
  const total = Math.max(1, Math.floor(Number(count)));
  const sqrtFloor = Math.floor(Math.sqrt(total));
  let bestDiff = Infinity;
  let cols = total;
  let rows = 1;

  for (let d = sqrtFloor; d >= 1; d -= 1) {
    if (total % d !== 0) continue;
    const a = total / d;
    const big = Math.max(a, d);
    const small = Math.min(a, d);
    const diff = big - small;
    if (diff < bestDiff) {
      bestDiff = diff;
      cols = big;
      rows = small;
    }
  }

  return { cols, rows, total };
}

export function edgeSigns(row, col, cols = state.cols, rows = state.rows, vert = state.verticalTabs, horz = state.horizontalTabs) {
  return {
    top: row === 0 ? 0 : -horz[row - 1][col],
    right: col === cols - 1 ? 0 : vert[row][col],
    bottom: row === rows - 1 ? 0 : horz[row][col],
    left: col === 0 ? 0 : -vert[row][col - 1],
  };
}

export function puzzlePath(w, h, tab, signs) {
  const bumpW = w * 0.22;
  const bumpH = h * 0.22;
  let d = "M 0 0";

  if (signs.top === 0) {
    d += ` L ${w} 0`;
  } else {
    const s = -signs.top;
    d += ` L ${w / 2 - bumpW} 0`;
    d += ` C ${w / 2 - bumpW * 0.65} ${s * tab}, ${w / 2 - bumpW * 0.25} ${s * tab}, ${w / 2} ${s * tab}`;
    d += ` C ${w / 2 + bumpW * 0.25} ${s * tab}, ${w / 2 + bumpW * 0.65} ${s * tab}, ${w / 2 + bumpW} 0`;
    d += ` L ${w} 0`;
  }

  if (signs.right === 0) {
    d += ` L ${w} ${h}`;
  } else {
    const s = signs.right;
    d += ` L ${w} ${h / 2 - bumpH}`;
    d += ` C ${w + s * tab} ${h / 2 - bumpH * 0.65}, ${w + s * tab} ${h / 2 - bumpH * 0.25}, ${w + s * tab} ${h / 2}`;
    d += ` C ${w + s * tab} ${h / 2 + bumpH * 0.25}, ${w + s * tab} ${h / 2 + bumpH * 0.65}, ${w} ${h / 2 + bumpH}`;
    d += ` L ${w} ${h}`;
  }

  if (signs.bottom === 0) {
    d += ` L 0 ${h}`;
  } else {
    const s = signs.bottom;
    d += ` L ${w / 2 + bumpW} ${h}`;
    d += ` C ${w / 2 + bumpW * 0.65} ${h + s * tab}, ${w / 2 + bumpW * 0.25} ${h + s * tab}, ${w / 2} ${h + s * tab}`;
    d += ` C ${w / 2 - bumpW * 0.25} ${h + s * tab}, ${w / 2 - bumpW * 0.65} ${h + s * tab}, ${w / 2 - bumpW} ${h}`;
    d += ` L 0 ${h}`;
  }

  if (signs.left === 0) {
    d += " L 0 0";
  } else {
    const s = -signs.left;
    d += ` L 0 ${h / 2 + bumpH}`;
    d += ` C ${s * tab} ${h / 2 + bumpH * 0.65}, ${s * tab} ${h / 2 + bumpH * 0.25}, ${s * tab} ${h / 2}`;
    d += ` C ${s * tab} ${h / 2 - bumpH * 0.25}, ${s * tab} ${h / 2 - bumpH * 0.65}, 0 ${h / 2 - bumpH}`;
    d += " L 0 0";
  }

  return `${d} Z`;
}

function cubicValue(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

function pushPoint(points, x, y) {
  const last = points[points.length - 1];
  if (!last || Math.abs(last.x - x) > 0.001 || Math.abs(last.y - y) > 0.001) {
    points.push({ x, y });
  }
}

function pushCubic(points, current, c1x, c1y, c2x, c2y, ex, ey, segments) {
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    pushPoint(
      points,
      cubicValue(current.x, c1x, c2x, ex, t),
      cubicValue(current.y, c1y, c2y, ey, t)
    );
  }
  return { x: ex, y: ey };
}

export function puzzleOutlinePoints(w, h, tab, signs, segments = 10) {
  const bumpW = w * 0.22;
  const bumpH = h * 0.22;
  const points = [];
  let current = { x: 0, y: 0 };

  const lineTo = (x, y) => {
    current = { x, y };
    pushPoint(points, x, y);
  };
  const cubicTo = (c1x, c1y, c2x, c2y, ex, ey) => {
    current = pushCubic(points, current, c1x, c1y, c2x, c2y, ex, ey, segments);
  };

  pushPoint(points, 0, 0);

  if (signs.top === 0) {
    lineTo(w, 0);
  } else {
    const s = -signs.top;
    lineTo(w / 2 - bumpW, 0);
    cubicTo(w / 2 - bumpW * 0.65, s * tab, w / 2 - bumpW * 0.25, s * tab, w / 2, s * tab);
    cubicTo(w / 2 + bumpW * 0.25, s * tab, w / 2 + bumpW * 0.65, s * tab, w / 2 + bumpW, 0);
    lineTo(w, 0);
  }

  if (signs.right === 0) {
    lineTo(w, h);
  } else {
    const s = signs.right;
    lineTo(w, h / 2 - bumpH);
    cubicTo(w + s * tab, h / 2 - bumpH * 0.65, w + s * tab, h / 2 - bumpH * 0.25, w + s * tab, h / 2);
    cubicTo(w + s * tab, h / 2 + bumpH * 0.25, w + s * tab, h / 2 + bumpH * 0.65, w, h / 2 + bumpH);
    lineTo(w, h);
  }

  if (signs.bottom === 0) {
    lineTo(0, h);
  } else {
    const s = signs.bottom;
    lineTo(w / 2 + bumpW, h);
    cubicTo(w / 2 + bumpW * 0.65, h + s * tab, w / 2 + bumpW * 0.25, h + s * tab, w / 2, h + s * tab);
    cubicTo(w / 2 - bumpW * 0.25, h + s * tab, w / 2 - bumpW * 0.65, h + s * tab, w / 2 - bumpW, h);
    lineTo(0, h);
  }

  if (signs.left === 0) {
    lineTo(0, 0);
  } else {
    const s = -signs.left;
    lineTo(0, h / 2 + bumpH);
    cubicTo(s * tab, h / 2 + bumpH * 0.65, s * tab, h / 2 + bumpH * 0.25, s * tab, h / 2);
    cubicTo(s * tab, h / 2 - bumpH * 0.25, s * tab, h / 2 - bumpH * 0.65, 0, h / 2 - bumpH);
    lineTo(0, 0);
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (
    first &&
    last &&
    Math.abs(first.x - last.x) < 0.001 &&
    Math.abs(first.y - last.y) < 0.001
  ) {
    points.pop();
  }

  return points;
}

export function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

export function fanTriangulateAroundCentre(points, centre) {
  const ccw = polygonArea(points) > 0 ? points : [...points].reverse();
  const triangles = [];
  for (let i = 0; i < ccw.length; i += 1) {
    const a = ccw[i];
    const b = ccw[(i + 1) % ccw.length];
    triangles.push([centre, a, b]);
  }
  return { polygon: ccw, triangles };
}

export function rectCentre(w, h) {
  return { x: w / 2, y: h / 2 };
}
