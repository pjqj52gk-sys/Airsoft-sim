import type { RakutenResults } from "./rakuten.ts";
import {
  productIdentifiers,
  productText,
  productDimensions,
  referenceLengthMm,
} from "./product-specs.ts";
import { yahooProductUrl } from "./yahoo-link.ts";
export const yahooAirsoftCategory = "2313";
export function normalizeYahoo(data: unknown, page = 1): RakutenResults {
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray((data as { hits?: unknown }).hits)
  )
    throw new Error("Invalid Yahoo response");
  const root = data as {
    hits: Record<string, unknown>[];
    totalResultsAvailable?: number;
  };
  const items = root.hits.slice(0, 12).flatMap((hit) => {
    const url = yahooProductUrl(hit.url),
      name =
        typeof hit.name === "string"
          ? productText(hit.name).trim().slice(0, 500)
          : "",
      price = hit.price;
    const ex = hit.exImage as { url?: unknown } | undefined,
      images = hit.image as { medium?: unknown; small?: unknown } | undefined;
    const photos = [
      ...new Set(
        [ex?.url, images?.medium, images?.small].flatMap((value) => {
          if (typeof value !== "string") return [];
          try {
            const image = new URL(value);
            return image.protocol === "https:" &&
              !image.port &&
              !image.username &&
              !image.password &&
              /(^|\.)yimg\.jp$/.test(image.hostname)
              ? [image.href]
              : [];
          } catch {
            return [];
          }
        }),
      ),
    ];
    if (
      !url ||
      !name ||
      !photos.length ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0
    )
      return [];
    const description =
      typeof hit.description === "string"
        ? hit.description.slice(0, 30000)
        : "";
    const identifiers = productIdentifiers(
      name,
      description +
        "\n" +
        (typeof hit.janCode === "string" ? "JAN: " + hit.janCode : ""),
    );
    const dimensions = productDimensions(description);
    return [
      {
        id: String(hit.code || url),
        name,
        price,
        image: photos[0],
        images: photos,
        productUrl: url,
        url,
        sponsored: true,
        identifiers,
        dimensions,
        referenceMm: referenceLengthMm(dimensions),
        shop: String((hit.seller as { name?: string })?.name || "").slice(
          0,
          100,
        ),
      },
    ];
  });
  const count =
    Number.isSafeInteger(root.totalResultsAvailable) &&
    root.totalResultsAvailable! >= 0
      ? root.totalResultsAvailable!
      : items.length;
  return { items, count, page, pageCount: Math.min(83, Math.ceil(count / 12)) };
}
