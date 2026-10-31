// Static JavaScript is embedded directly: Hermes does not preserve Function.toString() source.
export const scanGeometryScript = String.raw`
// Clockwise corners: top left, top right, bottom right, bottom left.
function validScanCorners(points) {
  if (points.length !== 4) return false;
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = points[i], b = points[(i + 1) % 4], c = points[(i + 2) % 4];
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return false;
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= 0.0001) return false;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2 >= 0.01;
}

// Map the output unit square back into the source quadrilateral. This removes
// perspective, rather than merely taking the bounding rectangle of the corners.
function scanProjectiveMap(p) {
  const dx1 = p[1].x - p[2].x, dx2 = p[3].x - p[2].x;
  const dy1 = p[1].y - p[2].y, dy2 = p[3].y - p[2].y;
  const sx = p[0].x - p[1].x + p[2].x - p[3].x;
  const sy = p[0].y - p[1].y + p[2].y - p[3].y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / denominator;
  const h = (dx1 * sy - sx * dy1) / denominator;
  return [p[1].x - p[0].x + g * p[1].x, p[3].x - p[0].x + h * p[3].x, p[0].x,
    p[1].y - p[0].y + g * p[1].y, p[3].y - p[0].y + h * p[3].y, p[0].y, g, h];
}

function scanOutputSize(p, width, height, maxEdge) {
  const distance = (a, b) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
  const w = Math.max(distance(p[0], p[1]), distance(p[3], p[2]));
  const h = Math.max(distance(p[0], p[3]), distance(p[1], p[2]));
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(2, Math.round(w * scale)), height: Math.max(2, Math.round(h * scale)) };
}
`;
