import { loadImage } from "./project.ts";
import type { Layer } from "./project";
import {
  croppedPlacement,
  quadMap,
  distance,
  lassoPolygon,
} from "./image-edit.ts";
import type { Rect, Point } from "./image-edit";
export async function eraseImage(
  layer: Layer,
  points: Point[],
  source = layer.src,
  outside = false,
): Promise<Partial<Layer>> {
  const polygon = lassoPolygon(points);
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = layer.width;
  canvas.height = layer.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  if (outside) ctx.rect(0, 0, layer.width, layer.height);
  ctx.moveTo(polygon[0].x, polygon[0].y);
  polygon.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.fill("evenodd");
  return {
    src: canvas.toDataURL("image/png"),
    originalSrc: layer.originalSrc || layer.src,
  };
}
export async function cropImage(
  layer: Layer,
  rect: Rect,
): Promise<Partial<Layer>> {
  const placement = croppedPlacement(layer, rect);
  if (placement.mm < 1)
    throw new Error(
      "切り出した画像の実寸が1mm未満です。実寸合わせか範囲を調整してください。",
    );
  const image = await loadImage(layer.src);
  const c = document.createElement("canvas");
  c.width = rect.w;
  c.height = rect.h;
  c.getContext("2d")!.drawImage(
    image,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    0,
    0,
    rect.w,
    rect.h,
  );
  return {
    src: c.toDataURL("image/png"),
    width: rect.w,
    height: rect.h,
    ...placement,
    originalSrc: undefined,
    originalFrame: undefined,
  };
}
export async function readImagePixels(src: string): Promise<ImageData> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d")!;
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
export async function rectifyImage(
  layer: Layer,
  points: Point[],
  aspectRatio?: number,
  surfaceMap?: (u: number, v: number) => Point,
  options?: { maxEdge?: number; pixels?: ImageData },
): Promise<Partial<Layer>> {
  const map = surfaceMap || quadMap(points);
  const source = options?.pixels || (await readImagePixels(layer.src));
  const src = source.data;
  let w = (distance(points[0], points[1]) + distance(points[3], points[2])) / 2;
  let h = (distance(points[0], points[3]) + distance(points[1], points[2])) / 2;
  if (aspectRatio !== undefined) {
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0)
      throw new Error("面の比率を確認してください。");
    const area = w * h;
    w = Math.sqrt(area * aspectRatio);
    h = Math.sqrt(area / aspectRatio);
  }
  const maxEdge = options?.maxEdge ?? 2000;
  if (!Number.isFinite(maxEdge) || maxEdge < 32 || maxEdge > 2000)
    throw new Error("補正画像のサイズを確認してください。");
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  w = Math.max(2, Math.round(w * scale));
  h = Math.max(2, Math.round(h * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const output = ctx.createImageData(w, h);
  // Bilinear interpolation in premultiplied-alpha space avoids dark fringes around transparent edges.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = map(x / (w - 1), y / (h - 1));
      if (p.x < 0 || p.y < 0 || p.x > source.width || p.y > source.height)
        continue;
      const px = Math.max(0, Math.min(source.width - 1, p.x)),
        py = Math.max(0, Math.min(source.height - 1, p.y));
      const x0 = Math.floor(px),
        y0 = Math.floor(py),
        x1 = Math.min(source.width - 1, x0 + 1),
        y1 = Math.min(source.height - 1, y0 + 1),
        fx = px - x0,
        fy = py - y0;
      const i00 = (y0 * source.width + x0) * 4,
        i10 = (y0 * source.width + x1) * 4;
      const i01 = (y1 * source.width + x0) * 4,
        i11 = (y1 * source.width + x1) * 4;
      const a00 = src[i00 + 3] * (1 - fx) * (1 - fy),
        a10 = src[i10 + 3] * fx * (1 - fy);
      const a01 = src[i01 + 3] * (1 - fx) * fy,
        a11 = src[i11 + 3] * fx * fy;
      const alpha = a00 + a10 + a01 + a11;
      const i = (y * w + x) * 4;
      output.data[i + 3] = alpha;
      for (let k = 0; k < 3; k++)
        output.data[i + k] = alpha
          ? (src[i00 + k] * a00 +
              src[i10 + k] * a10 +
              src[i01 + k] * a01 +
              src[i11 + k] * a11) /
            alpha
          : 0;
    }
  ctx.putImageData(output, 0, 0);
  return {
    src: c.toDataURL("image/png"),
    width: w,
    height: h,
    mm: layer.mm,
    originalSrc: undefined,
    originalFrame: undefined,
  };
}
