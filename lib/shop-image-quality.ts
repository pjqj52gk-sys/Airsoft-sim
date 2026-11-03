import sharp from "sharp";
import { readShopFile } from "./shop-fetch.ts";
import { amazonImage, amazonStore } from "./commerce.ts";
export async function rankShopImages(images: string[], read = readShopFile) {
  const candidates = [...new Set(images)]
    .filter((url) => !amazonImage(url) && !amazonStore(url))
    .slice(0, 16);
  const checked = candidates.slice(0, 8);
  const details: {
    url: string;
    width: number;
    height: number;
    index: number;
  }[] = [];
  const deadline = Date.now() + 8000;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < checked.length && Date.now() < deadline) {
        const index = cursor++,
          url = checked[index];
        try {
          const file = await read(url, "image", 0, deadline);
          if (amazonImage(file.url) || amazonStore(file.url)) continue;
          const meta = await sharp(file.bytes, {
            limitInputPixels: 40000000,
          }).metadata();
          if (meta.width && meta.height)
            details.push({
              url,
              width: meta.width,
              height: meta.height,
              index,
            });
        } catch {
          /* Keep another available product photo when one cannot be inspected. */
        }
      }
    }),
  );
  details.sort(
    (a, b) => b.width * b.height - a.width * a.height || a.index - b.index,
  );
  const ranked = details.map(({ url, width, height }) => ({
    url,
    width,
    height,
  }));
  return {
    images: ranked.length
      ? [...ranked.map((d) => d.url), ...candidates.slice(8)]
      : candidates,
    imageDetails: ranked,
  };
}
