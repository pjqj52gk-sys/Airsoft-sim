import { quadHomography } from "./image-edit.ts";
import type { Point } from "./image-edit";
export type Vec = { x: number; y: number; z: number };
export type Angles = { yaw: number; pitch: number; roll: number };
type Guide = {
  front: Vec[];
  back: Vec[];
  center: Vec;
  focal: number;
  cx: number;
  cy: number;
  flat: Angles;
  projection: "perspective" | "orthographic";
};
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
): Guide {
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
  return {
    front,
    back,
    center,
    focal,
    cx,
    cy,
    flat,
    projection: "perspective",
  };
}
export function projectGuide(
  guide: ReturnType<typeof makeGuide>,
  angles: Angles,
) {
  return [...guide.front, ...guide.back].map((p): Point => {
    const v = rotate(sub(p, guide.center), angles);
    // Recenter during orbit so the model stays under the pointer.
    const z =
      guide.projection === "orthographic"
        ? 1
        : Math.max(0.08, guide.center.z + v.z);
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

export const guidePoint = (guide: Guide, p: Vec): Point => ({
  x:
    guide.cx +
    (guide.focal * p.x) / (guide.projection === "orthographic" ? 1 : p.z),
  y:
    guide.cy +
    (guide.focal * p.y) / (guide.projection === "orthographic" ? 1 : p.z),
});

// Three adjoining edges meet at front[1]: width, depth, and height form a Y.
export function yControls(guide: Guide): Point[] {
  return [guide.front[1], guide.front[0], guide.back[1], guide.front[2]].map(
    (p) => guidePoint(guide, p),
  );
}

const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const add = (a: Vec, b: Vec): Vec => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});
const multiply = (a: Vec, k: number): Vec => ({
  x: a.x * k,
  y: a.y * k,
  z: a.z * k,
});

// Orthogonal box edges satisfy zi*zj = -(xi*xj + yi*yj).
// Solve the depths from the CURRENT Y directions instead of retaining the default pose.
function edgeDepths(axes: Point[]) {
  const k = [
    -(axes[0].x * axes[1].x + axes[0].y * axes[1].y),
    -(axes[0].x * axes[2].x + axes[0].y * axes[2].y),
    -(axes[1].x * axes[2].x + axes[1].y * axes[2].y),
  ];
  const epsilon = Math.max(...k.map(Math.abs), 1e-12) * 1e-7;
  const zeros = k.map((v) => Math.abs(v) < epsilon);
  if (zeros.filter(Boolean).length >= 2) {
    const index = k.findIndex((_, i) => !zeros[i]);
    if (index < 0) throw new Error("枝先を中心から離してください。");
    const [a, b] = [
        [0, 1],
        [0, 2],
        [1, 2],
      ][index],
      result = [0, 0, 0];
    result[a] = Math.sqrt(Math.abs(k[index]));
    result[b] = Math.sign(k[index]) * result[a];
    return result;
  }
  const squared = (k[0] * k[1]) / k[2];
  if (!Number.isFinite(squared) || squared <= 0 || zeros.some(Boolean))
    throw new Error("3つの枝が中心を囲むY字になるように合わせてください。");
  const a = Math.sqrt(squared);
  return [a, k[0] / a, k[1] / a];
}

export function guideFaceAspect(guide: Guide) {
  return (
    length(sub(guide.front[1], guide.front[0])) /
    length(sub(guide.front[3], guide.front[0]))
  );
}

export function guideFromY(
  controls: Point[],
  template: Guide,
  perspective = 0.35,
): Guide {
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
  const strength = Number.isFinite(perspective)
    ? Math.min(1, Math.max(0, perspective))
    : 0.35;
  const size = Math.max(template.cx * 2, template.cy * 2);
  const focal = strength === 0 ? size : (size * 1.5) / strength;
  const projection = strength === 0 ? "orthographic" : "perspective";
  // Anchor the principal point to the Y centre so moving the box preserves its shape.
  const camera = {
    ...template,
    cx: controls[0].x,
    cy: controls[0].y,
    focal,
    projection,
  } as Guide;
  let origin: Vec, left: Vec, back: Vec, down: Vec;
  if (strength === 0) {
    const axes = controls
      .slice(1)
      .map((p) => ({
        x: (p.x - controls[0].x) / focal,
        y: (p.y - controls[0].y) / focal,
      }));
    const depths = edgeDepths(axes);
    origin = { x: 0, y: 0, z: 1 };
    [left, back, down] = axes.map((p, i) =>
      add(origin, { ...p, z: depths[i] }),
    );
  } else {
    const rays = controls.map((p): Vec => ({
      x: (p.x - camera.cx) / focal,
      y: (p.y - camera.cy) / focal,
      z: 1,
    }));
    origin = rays[0];
    const forward = unit(origin);
    const right = unit(sub({ x: 1, y: 0, z: 0 }, multiply(forward, forward.x)));
    const up = cross(forward, right);
    const axes = rays
      .slice(1)
      .map((ray) => ({
        x: dot(ray, right) / dot(ray, forward),
        y: dot(ray, up) / dot(ray, forward),
      }));
    const depths = edgeDepths(axes),
      originDepth = length(origin);
    if (depths.some((z) => z >= 0.95))
      throw new Error("パースを弱めるか、枝先を近づけてください。");
    [left, back, down] = axes.map((p, i) =>
      multiply(
        add(add(multiply(right, p.x), multiply(up, p.y)), forward),
        originDepth / (1 - depths[i]),
      ),
    );
  }
  const opposite = {
    x: left.x + down.x - origin.x,
    y: left.y + down.y - origin.y,
    z: left.z + down.z - origin.z,
  };
  const front = [left, origin, down, opposite];
  quadHomography(front.map((p) => guidePoint(camera, p)));
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
    ...camera,
    front,
    back: rear,
    center,
    flat: { yaw, pitch, roll: (-Math.atan2(edge.y, edge.x) * 180) / Math.PI },
  };
}
