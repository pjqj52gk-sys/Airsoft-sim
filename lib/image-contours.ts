import type { CylinderGuide } from "./cylinder-guide.ts";
export type PixelSource = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};
type Region = {
  id: number;
  area: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
};
export type ContourAnalysis = {
  width: number;
  height: number;
  labels: Int32Array;
  regions: Region[];
  main: Region | null;
  transparent: boolean;
  sourceWidth: number;
  sourceHeight: number;
};
export function analyzeContours(source: PixelSource): ContourAnalysis {
  const scale = Math.min(1, 512 / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale)),
    height = Math.max(1, Math.round(source.height * scale));
  const labels = new Int32Array(width * height),
    mask = new Uint8Array(width * height),
    queue = new Int32Array(width * height);
  let transparent = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const sx = Math.min(
          source.width - 1,
          Math.floor(((x + 0.5) * source.width) / width),
        ),
        sy = Math.min(
          source.height - 1,
          Math.floor(((y + 0.5) * source.height) / height),
        );
      const a = source.data[(sy * source.width + sx) * 4 + 3];
      mask[y * width + x] = a >= 32 ? 1 : 0;
      if (a < 32) transparent++;
    }
  const regions: Region[] = [];
  for (let seed = 0; seed < mask.length; seed++) {
    if (!mask[seed] || labels[seed]) continue;
    const id = regions.length + 1;
    const r: Region = {
      id,
      area: 0,
      left: width,
      top: height,
      right: 0,
      bottom: 0,
    };
    let head = 0,
      tail = 1;
    queue[0] = seed;
    labels[seed] = id;
    while (head < tail) {
      const i = queue[head++],
        x = i % width,
        y = Math.floor(i / width);
      r.area++;
      r.left = Math.min(r.left, x);
      r.right = Math.max(r.right, x);
      r.top = Math.min(r.top, y);
      r.bottom = Math.max(r.bottom, y);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (mask[ni] && !labels[ni]) {
            labels[ni] = id;
            queue[tail++] = ni;
          }
        }
    }
    regions.push(r);
  }
  const main = regions.reduce<Region | null>(
    (best, r) => (!best || r.area > best.area ? r : best),
    null,
  );
  return {
    width,
    height,
    labels,
    regions,
    main,
    transparent: transparent > mask.length * 0.005,
    sourceWidth: source.width,
    sourceHeight: source.height,
  };
}
const quantile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
export function estimateCylinderGuide(
  source: PixelSource,
): CylinderGuide | null {
  const a = analyzeContours(source),
    main = a.main;
  if (!a.transparent || !main || main.area < 24) return null;
  const total = a.regions.reduce((sum, r) => sum + r.area, 0);
  if (main.area < total * 0.45) return null;
  const xs: number[] = [],
    ys: number[] = [];
  let mx = 0,
    my = 0;
  for (let i = 0; i < a.labels.length; i++)
    if (a.labels[i] === main.id) {
      const x = (((i % a.width) + 0.5) * source.width) / a.width,
        y = ((Math.floor(i / a.width) + 0.5) * source.height) / a.height;
      xs.push(x);
      ys.push(y);
      mx += x;
      my += y;
    }
  mx /= xs.length;
  my /= xs.length;
  let xx = 0,
    yy = 0,
    xy = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i] - mx,
      y = ys[i] - my;
    xx += x * x;
    yy += y * y;
    xy += x * y;
  }
  const delta = Math.sqrt((xx - yy) ** 2 + 4 * xy * xy),
    major = (xx + yy + delta) / 2,
    minor = (xx + yy - delta) / 2;
  if (major / Math.max(1, minor) < 2.5) return null;
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy),
    ux = Math.cos(angle),
    uy = Math.sin(angle),
    nx = -uy,
    ny = ux;
  const axial = xs.map((x, i) => (x - mx) * ux + (ys[i] - my) * uy),
    cross = xs.map((x, i) => (x - mx) * nx + (ys[i] - my) * ny);
  const sorted = [...axial].sort((a, b) => a - b),
    left = quantile(sorted, 0.005),
    right = quantile(sorted, 0.995);
  const widths: number[] = [],
    centers: number[] = [];
  for (let bin = 1; bin < 9; bin++) {
    const values = cross
      .filter(
        (_, i) =>
          axial[i] >= left + ((right - left) * bin) / 10 &&
          axial[i] < left + ((right - left) * (bin + 1)) / 10,
      )
      .sort((a, b) => a - b);
    if (values.length < 4) continue;
    const lo = quantile(values, 0.02),
      hi = quantile(values, 0.98);
    widths.push((hi - lo) / 2);
    centers.push((lo + hi) / 2);
  }
  if (!widths.length) return null;
  widths.sort((a, b) => a - b);
  centers.sort((a, b) => a - b);
  const radius =
      quantile(widths, 0.5) +
      0.5 / Math.min(a.width / source.width, a.height / source.height),
    offset = quantile(centers, 0.5);
  if (right - left < 4 || radius < 1 || (right - left) / (radius * 2) < 1.5)
    return null;
  return {
    start: { x: mx + ux * left + nx * offset, y: my + uy * left + ny * offset },
    end: { x: mx + ux * right + nx * offset, y: my + uy * right + ny * offset },
    startRadius: radius,
    endRadius: radius,
  };
}
export type IsolatedCandidate = {
  id: number;
  regions: number[];
  x: number;
  y: number;
  width: number;
  height: number;
};
export function isolatedCandidates(a: ContourAnalysis): IsolatedCandidate[] {
  const main = a.main;
  if (!a.transparent || !main) return [];
  const total = a.regions.reduce((sum, r) => sum + r.area, 0);
  if (main.area < total * 0.5) return [];
  const size = Math.max(main.right - main.left + 1, main.bottom - main.top + 1),
    gap = Math.max(3, size * 0.04);
  const candidates = a.regions.filter(
    (r) =>
      r.id !== main.id &&
      r.area <= main.area * 0.15 &&
      Math.max(
        r.left - main.right,
        main.left - r.right,
        r.top - main.bottom,
        main.top - r.bottom,
      ) >= gap,
  );
  if (candidates.length > 200) return [];
  const groups: {
    regions: Region[];
    left: number;
    right: number;
    top: number;
    bottom: number;
  }[] = [];
  for (const r of candidates) {
    let group = {
      regions: [r],
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
    };
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      const dx = Math.max(0, group.left - g.right, g.left - group.right),
        dy = Math.max(0, group.top - g.bottom, g.top - group.bottom);
      if (Math.hypot(dx, dy) > Math.max(4, size * 0.03)) continue;
      group = {
        regions: [...group.regions, ...g.regions],
        left: Math.min(group.left, g.left),
        right: Math.max(group.right, g.right),
        top: Math.min(group.top, g.top),
        bottom: Math.max(group.bottom, g.bottom),
      };
      groups.splice(i, 1);
    }
    groups.push(group);
  }
  return groups.map((g, i) => ({
    id: i,
    regions: g.regions.map((r) => r.id),
    x: (g.left * a.sourceWidth) / a.width,
    y: (g.top * a.sourceHeight) / a.height,
    width: ((g.right - g.left + 1) * a.sourceWidth) / a.width,
    height: ((g.bottom - g.top + 1) * a.sourceHeight) / a.height,
  }));
}
export function removeIsolatedCandidates(
  source: PixelSource,
  a: ContourAnalysis,
  candidates: IsolatedCandidate[],
  selected: number[],
) {
  const selectedIds = new Set(selected),
    removed = new Set(
      candidates.filter((c) => selectedIds.has(c.id)).flatMap((c) => c.regions),
    );
  removed.delete(a.main?.id || 0);
  const mask = new Uint8Array(a.labels.length);
  for (let i = 0; i < a.labels.length; i++)
    if (removed.has(a.labels[i])) {
      const x = i % a.width,
        y = Math.floor(i / a.width);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= a.width || ny >= a.height) continue;
          const j = ny * a.width + nx;
          if (a.labels[j] === 0 || removed.has(a.labels[j])) mask[j] = 1;
        }
    }
  const data = new Uint8ClampedArray(source.data);
  for (let y = 0; y < source.height; y++)
    for (let x = 0; x < source.width; x++)
      if (
        mask[
          Math.min(a.height - 1, Math.floor((y * a.height) / source.height)) *
            a.width +
            Math.min(a.width - 1, Math.floor((x * a.width) / source.width))
        ]
      )
        data[(y * source.width + x) * 4 + 3] = 0;
  return data;
}
