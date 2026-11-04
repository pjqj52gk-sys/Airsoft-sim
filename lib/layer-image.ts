import {
  analyzeContours,
  isolatedCandidates,
  removeIsolatedCandidates,
} from "./image-contours.ts";
import { loadImage, removeBackground } from "./project.ts";
import type { Layer } from "./project.ts";
import { croppedPlacement } from "./image-edit.ts";

export function visiblePixelBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  return right < left
    ? null
    : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

export async function trimTransparentLayer(layer: Layer): Promise<Layer> {
  const image = await loadImage(layer.src),
    canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  const bounds = visiblePixelBounds(
    ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    canvas.width,
    canvas.height,
  );
  if (
    !bounds ||
    (bounds.x === 0 &&
      bounds.y === 0 &&
      bounds.w === canvas.width &&
      bounds.h === canvas.height)
  )
    return layer;
  const out = document.createElement("canvas");
  out.width = bounds.w;
  out.height = bounds.h;
  out
    .getContext("2d")!
    .drawImage(
      canvas,
      bounds.x,
      bounds.y,
      bounds.w,
      bounds.h,
      0,
      0,
      bounds.w,
      bounds.h,
    );
  const frame = layer.originalFrame || {
    width: layer.width,
    height: layer.height,
    offsetX: 0,
    offsetY: 0,
  };
  return {
    ...layer,
    ...croppedPlacement(layer, bounds),
    src: out.toDataURL("image/png"),
    width: bounds.w,
    height: bounds.h,
    originalSrc: layer.originalSrc || layer.src,
    originalFrame: {
      ...frame,
      offsetX: frame.offsetX + bounds.x,
      offsetY: frame.offsetY + bounds.y,
    },
  };
}

export async function removeMarginMarks(src: string): Promise<string> {
  const image = await loadImage(src),
    canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d")!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const analysis = analyzeContours(pixels),
    candidates = isolatedCandidates(analysis);
  if (!candidates.length) return src;
  pixels.data.set(
    removeIsolatedCandidates(
      pixels,
      analysis,
      candidates,
      candidates.map((c) => c.id),
    ),
  );
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

export async function prepareAddedLayer(
  layer: Layer,
  isBase: boolean,
  tolerance = 28,
): Promise<Layer> {
  const transparent = layer.originalSrc
    ? layer.src
    : await removeBackground(layer.src, tolerance, true);
  const src = layer.originalSrc
    ? transparent
    : await removeMarginMarks(transparent);
  return trimTransparentLayer({
    ...layer,
    src,
    originalSrc:
      src !== layer.src ? layer.originalSrc || layer.src : layer.originalSrc,
    attachedToBase: !isBase,
  });
}

export function restoreLayerImage(layer: Layer): Partial<Layer> {
  if (!layer.originalSrc) return {};
  const frame = layer.originalFrame;
  return {
    src: layer.originalSrc,
    originalSrc: undefined,
    originalFrame: undefined,
    ...(frame
      ? {
          ...croppedPlacement(layer, {
            x: -frame.offsetX,
            y: -frame.offsetY,
            w: frame.width,
            h: frame.height,
          }),
          width: frame.width,
          height: frame.height,
        }
      : {}),
  };
}
