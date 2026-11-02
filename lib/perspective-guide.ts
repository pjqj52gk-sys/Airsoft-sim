import { quadHomography } from "./image-edit.ts";
import type { Point } from "./image-edit";
export type Vec = { x: number; y: number; z: number };
export type Angles = { yaw: number; pitch: number; roll: number };
export function initialCubeFace(width: number, height: number): Point[] {
  // Project an actual cube, rather than opening with two nested rectangles.
  const corners = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
  const projected = [-0.5, 0.5].flatMap((z) =>
    corners.map(([x, y]) => {
      const p = rotate({ x, y, z }, { yaw: 32, pitch: 24, roll: 0 });
      return { x: p.x / (3 + p.z), y: p.y / (3 + p.z) };
    }),
  );
  const scale =
    0.4 *
    Math.min(
      width / Math.max(...projected.map((p) => Math.abs(p.x))),
      height / Math.max(...projected.map((p) => Math.abs(p.y))),
    );
  return projected.slice(0, 4).map((p) => ({
    x: width / 2 + p.x * scale,
    y: height / 2 + p.y * scale,
  }));
}
const sub = (a: Vec, b: Vec): Vec => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
const cross = (a: Vec, b: Vec): Vec => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const length = (a: Vec) => Math.hypot(a.x, a.y, a.z);
const unit = (a: Vec): Vec => {
  const n = length(a);
  return { x: a.x / n, y: a.y / n, z: a.z / n };
};
export function rotate(p: Vec, a: Angles): Vec {
  const y = (a.yaw * Math.PI) / 180,
    x = (a.pitch * Math.PI) / 180,
    z = (a.roll * Math.PI) / 180;
  const u = {
    x: Math.cos(y) * p.x + Math.sin(y) * p.z,
    y: p.y,
    z: -Math.sin(y) * p.x + Math.cos(y) * p.z,
  };
  const v = {
    x: u.x,
    y: Math.cos(x) * u.y - Math.sin(x) * u.z,
    z: Math.sin(x) * u.y + Math.cos(x) * u.z,
  };
  return {
    x: Math.cos(z) * v.x - Math.sin(z) * v.y,
    y: Math.sin(z) * v.x + Math.cos(z) * v.y,
    z: v.z,
  };
}
export function makeGuide(
  points: Point[],
  width: number,
  height: number,
  depth: number,
) {
  const { a, b, c, d, e, f, g, h } = quadHomography(points);
  const cx = width / 2,
    cy = height / 2;
  // Focal length is only a visual guide: a single photo cannot recover a unique 3D object.
  const f2 =
    -((a - cx * g) * (b - cx * h) + (d - cy * g) * (e - cy * h)) / (g * h);
  const focal =
    Number.isFinite(f2) &&
    f2 > width * height * 0.1 &&
    f2 < (width + height) ** 2 * 16
      ? Math.sqrt(f2)
      : Math.max(width, height) * 1.5;
  const front = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ].map(([u, v]): Vec => {
    const z = g * u + h * v + 1;
    if (z <= 0.02) throw new Error("角を交差させずに合わせてください。");
    return {
      x: (a * u + b * v + c - cx * z) / focal,
      y: (d * u + e * v + f - cy * z) / focal,
      z,
    };
  });
  const u = sub(front[1], front[0]),
    v = sub(front[3], front[0]);
  const normal = unit(cross(u, v));
  const center = front.reduce(
    (s, p) => ({ x: s.x + p.x / 4, y: s.y + p.y / 4, z: s.z + p.z / 4 }),
    { x: 0, y: 0, z: 0 },
  );
  const extrusion = Math.min(length(u), length(v)) * depth;
  const back = front.map((p) => ({
    x: p.x + normal.x * extrusion,
    y: p.y + normal.y * extrusion,
    z: p.z + normal.z * extrusion,
  }));
  const yaw = (-Math.atan2(normal.x, normal.z) * 180) / Math.PI;
  const n = rotate(normal, { yaw, pitch: 0, roll: 0 });
  const pitch = (Math.atan2(n.y, n.z) * 180) / Math.PI;
  const edge = rotate(u, { yaw, pitch, roll: 0 });
  const flat = {
    yaw,
    pitch,
    roll: (-Math.atan2(edge.y, edge.x) * 180) / Math.PI,
  };
  return { front, back, center, focal, cx, cy, flat };
}
export function projectGuide(
  guide: ReturnType<typeof makeGuide>,
  angles: Angles,
) {
  return [...guide.front, ...guide.back].map((p): Point => {
    const v = rotate(sub(p, guide.center), angles);
    // Recenter during orbit so the model stays under the pointer.
    const z = Math.max(0.08, guide.center.z + v.z);
    return {
      x: guide.cx + (guide.focal * v.x) / z,
      y: guide.cy + (guide.focal * v.y) / z,
    };
  });
}
export function textureTransform(
  points: Point[],
  width: number,
  height: number,
) {
  const { a, b, c, d, e, f, g, h } = quadHomography(points);
  return `matrix3d(${a / width},${d / width},0,${g / width},${b / height},${e / height},0,${h / height},0,0,1,0,${c},${f},0,1)`;
}

type Guide = ReturnType<typeof makeGuide>;
export const guidePoint = (guide: Guide, p: Vec): Point => ({
  x: guide.cx + (guide.focal * p.x) / p.z,
  y: guide.cy + (guide.focal * p.y) / p.z,
});

// Three adjoining edges meet at front[1]: width, depth, and height form a Y.
export function yControls(guide: Guide): Point[] {
  return [guide.front[1], guide.front[0], guide.back[1], guide.front[2]].map(
    (p) => guidePoint(guide, p),
  );
}

export function guideFromY(controls: Point[], template: Guide): Guide {
  if (
    controls.length !== 4 ||
    controls.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    throw new Error("中心と3つの枝先を合わせてください。");
  if (
    controls
      .slice(1)
      .some((p) => Math.hypot(p.x - controls[0].x, p.y - controls[0].y) < 2)
  )
    throw new Error("枝先を中心から離してください。");
  // Keep the initial camera depths while moving the projected endpoints.
  // Complete the other corners in 3D so each drag updates the whole box.
  const depths = [
    template.front[1].z,
    template.front[0].z,
    template.back[1].z,
    template.front[2].z,
  ];
  const [origin, left, back, down] = controls.map((p, i): Vec => ({
    x: ((p.x - template.cx) * depths[i]) / template.focal,
    y: ((p.y - template.cy) * depths[i]) / template.focal,
    z: depths[i],
  }));
  const opposite = {
    x: left.x + down.x - origin.x,
    y: left.y + down.y - origin.y,
    z: left.z + down.z - origin.z,
  };
  const front = [left, origin, down, opposite];
  quadHomography(front.map((p) => guidePoint(template, p)));
  const offset = sub(back, origin);
  const rear = front.map((p) => ({
    x: p.x + offset.x,
    y: p.y + offset.y,
    z: p.z + offset.z,
  }));
  const u = sub(front[1], front[0]),
    v = sub(front[3], front[0]);
  const normal = unit(cross(u, v));
  const center = front.reduce(
    (s, p) => ({ x: s.x + p.x / 4, y: s.y + p.y / 4, z: s.z + p.z / 4 }),
    { x: 0, y: 0, z: 0 },
  );
  const yaw = (-Math.atan2(normal.x, normal.z) * 180) / Math.PI;
  const n = rotate(normal, { yaw, pitch: 0, roll: 0 });
  const pitch = (Math.atan2(n.y, n.z) * 180) / Math.PI;
  const edge = rotate(u, { yaw, pitch, roll: 0 });
  return {
    ...template,
    front,
    back: rear,
    center,
    flat: { yaw, pitch, roll: (-Math.atan2(edge.y, edge.x) * 180) / Math.PI },
  };
}
