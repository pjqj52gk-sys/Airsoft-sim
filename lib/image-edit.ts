import type { Layer } from "./project";
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export const distance = (a: Point, b: Point) =>
  Math.hypot(b.x - a.x, b.y - a.y);
export function resizeAroundCenter(layer: Layer, factor: number) {
  const mm =
    Number.isFinite(factor) && factor > 0
      ? Math.min(5000, Math.max(1, layer.mm * factor))
      : layer.mm;
  const ratio = mm / layer.mm;
  return {
    mm,
    x: layer.x + (layer.mm - mm) / 2,
    y: layer.y + (((layer.mm * layer.height) / layer.width) * (1 - ratio)) / 2,
  };
}
export function measuredWidth(pixelWidth: number, points: Point[], mm: number) {
  if (
    points.length !== 2 ||
    !Number.isFinite(mm) ||
    mm <= 0 ||
    distance(points[0], points[1]) < 2
  )
    throw new Error("2点を2px以上離して選び、正の実寸を入力してください。");
  const result = (pixelWidth * mm) / distance(points[0], points[1]);
  if (!Number.isFinite(result) || result < 1 || result > 5000)
    throw new Error("画像全体の横幅が1〜5000mmになるように指定してください。");
  return result;
}
export function cropRect(points: Point[], width: number, height: number): Rect {
  if (points.length !== 2)
    throw new Error("切り出す範囲の対角2点を選んでください。");
  // Screen/SVG conversion can produce 49.99999999999999 for an exact 50px click.
  const snap = (n: number) => Math.round(n * 1e3) / 1e3;
  const x = Math.max(0, Math.floor(snap(Math.min(points[0].x, points[1].x))));
  const y = Math.max(0, Math.floor(snap(Math.min(points[0].y, points[1].y))));
  const right = Math.min(
    width,
    Math.ceil(snap(Math.max(points[0].x, points[1].x))),
  );
  const bottom = Math.min(
    height,
    Math.ceil(snap(Math.max(points[0].y, points[1].y))),
  );
  if (right - x < 2 || bottom - y < 2)
    throw new Error("幅・高さが2px以上ある範囲を選んでください。");
  return { x, y, w: right - x, h: bottom - y };
}
// Move the cropped layer's centre through the existing flip and rotation so it stays in place.
export function croppedPlacement(layer: Layer, rect: Rect) {
  const unit = layer.mm / layer.width;
  const dx =
    (rect.x + rect.w / 2 - layer.width / 2) * unit * (layer.flip ? -1 : 1);
  const dy = (rect.y + rect.h / 2 - layer.height / 2) * unit;
  const angle = (layer.rotation * Math.PI) / 180;
  const mm = rect.w * unit;
  return {
    mm,
    x:
      layer.x +
      layer.mm / 2 +
      dx * Math.cos(angle) -
      dy * Math.sin(angle) -
      mm / 2,
    y:
      layer.y +
      (layer.height * unit) / 2 +
      dx * Math.sin(angle) +
      dy * Math.cos(angle) -
      (rect.h * unit) / 2,
  };
}
// Unit-square -> convex image quadrilateral, in TL, TR, BR, BL order.
export function quadMap(points: Point[]) {
  if (points.length !== 4)
    throw new Error("左上・右上・右下・左下の4点を選んでください。");
  const crosses = points.map((p, i) => {
    const q = points[(i + 1) % 4],
      r = points[(i + 2) % 4];
    return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
  });
  if (crosses.some((c) => !Number.isFinite(c) || c < 1))
    throw new Error("4点が交差しないよう、左上から時計回りに選んでください。");
  const [p0, p1, p2, p3] = points;
  const dx1 = p1.x - p2.x,
    dx2 = p3.x - p2.x,
    dy1 = p1.y - p2.y,
    dy2 = p3.y - p2.y;
  const sx = p0.x - p1.x + p2.x - p3.x,
    sy = p0.y - p1.y + p2.y - p3.y;
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(den) < 1e-8)
    throw new Error("補正範囲が細すぎます。4点を選び直してください。");
  const g = (sx * dy2 - dx2 * sy) / den,
    h = (dx1 * sy - sx * dy1) / den;
  const a = p1.x - p0.x + g * p1.x,
    b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y,
    e = p3.y - p0.y + h * p3.y;
  return (u: number, v: number): Point => {
    const k = g * u + h * v + 1;
    if (Math.abs(k) < 1e-8) throw new Error("補正できない形状です。");
    return { x: (a * u + b * v + p0.x) / k, y: (d * u + e * v + p0.y) / k };
  };
}
