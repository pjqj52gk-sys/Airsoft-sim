import type { Point, Rect } from "./image-edit.ts";

export function fitImageViewport(
  width: number,
  height: number,
  points: Point[] = [],
): Rect {
  const x = Math.min(0, ...points.map((p) => p.x));
  const y = Math.min(0, ...points.map((p) => p.y));
  const right = Math.max(width, ...points.map((p) => p.x));
  const bottom = Math.max(height, ...points.map((p) => p.y));
  const padding = Math.max(right - x, bottom - y) * 0.2;
  return {
    x: x - padding,
    y: y - padding,
    w: right - x + padding * 2,
    h: bottom - y + padding * 2,
  };
}
export function zoomViewport(
  view: Rect,
  factor: number,
  anchor: Point,
  minWidth: number,
  maxWidth: number,
): Rect {
  const scale =
    Math.max(minWidth, Math.min(maxWidth, view.w * factor)) / view.w;
  return {
    x: anchor.x + (view.x - anchor.x) * scale,
    y: anchor.y + (view.y - anchor.y) * scale,
    w: view.w * scale,
    h: view.h * scale,
  };
}
export function moveGuideControls(
  points: Point[],
  index: number,
  dx: number,
  dy: number,
): Point[] {
  return points.map((p, i) =>
    index <= 0 || i === index ? { x: p.x + dx, y: p.y + dy } : p,
  );
}
