import type { Point } from "./image-edit.ts";
export type CylinderGuide = {
  start: Point;
  end: Point;
  startRadius: number;
  endRadius: number;
};
export function initialCylinderGuide(
  width: number,
  height: number,
): CylinderGuide {
  return width >= height
    ? {
        start: { x: 0, y: (height - 1) / 2 },
        end: { x: width - 1, y: (height - 1) / 2 },
        startRadius: (height - 1) / 2,
        endRadius: (height - 1) / 2,
      }
    : {
        start: { x: (width - 1) / 2, y: 0 },
        end: { x: (width - 1) / 2, y: height - 1 },
        startRadius: (width - 1) / 2,
        endRadius: (width - 1) / 2,
      };
}
export function cylinderGeometry(guide: CylinderGuide, lengthScale = 1) {
  const { start, end, startRadius, endRadius } = guide;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (
    ![
      start.x,
      start.y,
      end.x,
      end.y,
      startRadius,
      endRadius,
      lengthScale,
    ].every(Number.isFinite) ||
    length < 4 ||
    startRadius < 1 ||
    endRadius < 1 ||
    lengthScale < 0.5 ||
    lengthScale > 3
  )
    throw new Error("両端を離して、太さを合わせてください。");
  const normal = {
    x: -(end.y - start.y) / length,
    y: (end.x - start.x) / length,
  };
  // A single continuous strip, with uniform distance along the axis. Unlike a
  // box or a planar homography this does not split or squeeze the curved side
  // into separate planes. No hidden surface or cylinder texture is invented.
  const map = (u: number, v: number): Point => {
    const radius = startRadius * (1 - u) + endRadius * u;
    return {
      x: start.x + (end.x - start.x) * u + normal.x * radius * (2 * v - 1),
      y: start.y + (end.y - start.y) * u + normal.y * radius * (2 * v - 1),
    };
  };
  return {
    length,
    normal,
    aspect: (length * lengthScale) / (startRadius + endRadius),
    map,
    corners: [map(0, 0), map(1, 0), map(1, 1), map(0, 1)],
    handles: [start, end, map(0, 0), map(1, 0)],
  };
}
export function moveCylinderHandle(
  guide: CylinderGuide,
  index: number,
  dx: number,
  dy: number,
): CylinderGuide {
  if (index === -1)
    return {
      ...guide,
      start: { x: guide.start.x + dx, y: guide.start.y + dy },
      end: { x: guide.end.x + dx, y: guide.end.y + dy },
    };
  if (index === 0 || index === 1) {
    const key = index === 0 ? "start" : "end";
    return { ...guide, [key]: { x: guide[key].x + dx, y: guide[key].y + dy } };
  }
  const { normal } = cylinderGeometry(guide);
  if (index === 4) {
    const radius = Math.max(
      1,
      (guide.startRadius + guide.endRadius) / 2 - dx * normal.x - dy * normal.y,
    );
    return { ...guide, startRadius: radius, endRadius: radius };
  }
  const key = index === 2 ? "startRadius" : "endRadius";
  return {
    ...guide,
    [key]: Math.max(1, guide[key] - dx * normal.x - dy * normal.y),
  };
}

export function setCylinderDimensions(
  guide: CylinderGuide,
  values: { length?: number; diameter?: number; angle?: number },
): CylinderGuide {
  const current = cylinderGeometry(guide);
  const length = values.length ?? current.length;
  const angle =
    ((values.angle ??
      (Math.atan2(guide.end.y - guide.start.y, guide.end.x - guide.start.x) *
        180) /
        Math.PI) *
      Math.PI) /
    180;
  const cx = (guide.start.x + guide.end.x) / 2,
    cy = (guide.start.y + guide.end.y) / 2;
  const next = {
    ...guide,
    start: {
      x: cx - (Math.cos(angle) * length) / 2,
      y: cy - (Math.sin(angle) * length) / 2,
    },
    end: {
      x: cx + (Math.cos(angle) * length) / 2,
      y: cy + (Math.sin(angle) * length) / 2,
    },
    ...(values.diameter !== undefined
      ? { startRadius: values.diameter / 2, endRadius: values.diameter / 2 }
      : {}),
  };
  cylinderGeometry(next);
  return next;
}
export function cylinderEndRatio(extent: number, radius: number) {
  if (!Number.isFinite(extent) || !Number.isFinite(radius) || radius < 1)
    throw new Error("端面の太さを確認してください。");
  return Math.max(0, Math.min(1, extent / radius));
}
