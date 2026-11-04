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

// Contour estimation returns the outermost ends, whereas ellipse controls use face centers.
export function centerGuideOnEndFaces(
  bounds: CylinderGuide,
  ellipseRatio: number,
): CylinderGuide {
  if (!Number.isFinite(ellipseRatio) || ellipseRatio < 0 || ellipseRatio > 1)
    throw new Error("端面の開きを確認してください。");
  const geometry = cylinderGeometry(bounds);
  const start = bounds.startRadius * ellipseRatio,
    end = bounds.endRadius * ellipseRatio;
  if (geometry.length - start - end < 4)
    throw new Error("端面が大きすぎます。開きを小さくしてください。");
  const point = (along: number) => ({
    x:
      bounds.start.x +
      ((bounds.end.x - bounds.start.x) * along) / geometry.length,
    y:
      bounds.start.y +
      ((bounds.end.y - bounds.start.y) * along) / geometry.length,
  });
  const radius = (along: number) =>
    bounds.startRadius +
    ((bounds.endRadius - bounds.startRadius) * along) / geometry.length;
  return {
    start: point(start),
    end: point(geometry.length - end),
    startRadius: radius(start),
    endRadius: radius(geometry.length - end),
  };
}

export type CylinderEnd = "none" | "start" | "end" | "both";
export function cylinderSideSurface(
  guide: CylinderGuide,
  lengthScale: number,
  ellipseRatio: number,
  exclude: CylinderEnd,
) {
  const geometry = cylinderGeometry(guide, lengthScale);
  if (
    !Number.isFinite(ellipseRatio) ||
    ellipseRatio < 0 ||
    ellipseRatio > 1 ||
    !["none", "start", "end", "both"].includes(exclude)
  )
    throw new Error("除く端面と開きを確認してください。");
  const startExtent = guide.startRadius * ellipseRatio;
  const endExtent = guide.endRadius * ellipseRatio;
  // On a visible cylinder side both end arcs bend in the same direction.
  // The near cap is excluded; the far arc is the outer silhouette, not a crop.
  const startDirection =
    exclude === "start" || exclude === "both" ? 1 : exclude === "end" ? -1 : 0;
  const endDirection =
    exclude === "end" || exclude === "both" ? -1 : exclude === "start" ? 1 : 0;
  if (
    geometry.length +
      Math.min(0, endDirection * endExtent - startDirection * startExtent) <
    4
  )
    throw new Error(
      "側面の縁が重なっています。軸の両端と端面の開きを確認してください。",
    );
  const axis = {
    x: (guide.end.x - guide.start.x) / geometry.length,
    y: (guide.end.y - guide.start.y) / geometry.length,
  };
  const map = (u: number, v: number): Point => {
    const t = 2 * v - 1,
      arc = Math.sqrt(Math.max(0, 1 - t * t));
    const start = startDirection * startExtent * arc;
    const end = geometry.length + endDirection * endExtent * arc;
    const along = start * (1 - u) + end * u;
    const radius = guide.startRadius * (1 - u) + guide.endRadius * u;
    return {
      x: guide.start.x + axis.x * along + geometry.normal.x * radius * t,
      y: guide.start.y + axis.y * along + geometry.normal.y * radius * t,
    };
  };
  // Mask source cap pixels before interpolation, so their color cannot bleed
  // into the remapped side. Only a subpixel antialias rim is excluded.
  const visible = (x: number, y: number) => {
    const dx = x - guide.start.x,
      dy = y - guide.start.y;
    const along = dx * axis.x + dy * axis.y,
      cross = dx * geometry.normal.x + dy * geometry.normal.y;
    const inside = (center: number, extent: number, radius: number) => {
      if (extent === 0) return false;
      const a = extent + 0.6,
        b = radius + 0.6,
        px = along - center;
      return (
        Math.abs(px) <= a &&
        Math.abs(cross) <= b &&
        (px / a) ** 2 + (cross / b) ** 2 <= 1
      );
    };
    return !(
      ((exclude === "start" || exclude === "both") &&
        inside(0, startExtent, guide.startRadius)) ||
      ((exclude === "end" || exclude === "both") &&
        inside(geometry.length, endExtent, guide.endRadius))
    );
  };
  const outline = [
    map(0, 0),
    ...Array.from({ length: 65 }, (_, i) => map(1, i / 64)),
    ...Array.from({ length: 65 }, (_, i) => map(0, 1 - i / 64)),
  ];
  return {
    ...geometry,
    map,
    visible,
    outline,
    corners: [map(0, 0), map(1, 0), map(1, 1), map(0, 1)],
  };
}
