// Match the border's dominant background color across the entire image, including holes.
// Transparent padding has no reliable RGB; catalog cutouts conventionally use white.
export function transparentBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance: number,
  preserveObject = false,
) {
  const bins = new Map<number, { count: number; color: number[] }>();
  let border = 0,
    opaqueBorder = 0;
  const sample = (x: number, y: number) => {
    border++;
    const i = (y * width + x) * 4;
    if (data[i + 3] < 250) return;
    opaqueBorder++;
    const key =
      (data[i] >> 4) * 256 + (data[i + 1] >> 4) * 16 + (data[i + 2] >> 4);
    const bin = bins.get(key);
    if (bin) bin.count++;
    else
      bins.set(key, { count: 1, color: [data[i], data[i + 1], data[i + 2]] });
  };
  for (let x = 0; x < width; x++) {
    sample(x, 0);
    if (height > 1) sample(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    sample(0, y);
    if (width > 1) sample(width - 1, y);
  }
  let color = [255, 255, 255],
    peak = 0;
  if (opaqueBorder >= border / 2)
    for (const bin of bins.values()) {
      if (bin.count > peak) {
        peak = bin.count;
        color = bin.color;
      }
    }
  const output = new Uint8ClampedArray(data);
  const threshold = Number.isFinite(tolerance)
    ? Math.max(0, Math.min(100, tolerance))
    : 28;
  let visible = 0,
    removed = 0;
  for (let i = 0; i < output.length; i += 4) {
    if (!output[i + 3]) continue;
    visible++;
    if (
      Math.max(
        Math.abs(output[i] - color[0]),
        Math.abs(output[i + 1] - color[1]),
        Math.abs(output[i + 2] - color[2]),
      ) <= threshold
    ) {
      output[i + 3] = 0;
      removed++;
    }
  }
  return preserveObject && removed === visible
    ? new Uint8ClampedArray(data)
    : output;
}
