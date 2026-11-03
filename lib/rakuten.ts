import { partCategory } from "./part-categories.ts";
import {
  productIdentifiers,
  productDimensions,
  referenceLengthMm,
  type ProductDimension,
  type ProductIdentifiers,
} from "./product-specs.ts";
// Rakuten Genre API: サバイバルゲーム・トイガン (verified 2026-11-03).
export const airsoftGenreId = "213684";
export function searchGenre(category: string, scope = "") {
  return (
    partCategory(category)?.genreId ||
    (scope === "guns" ? "213685" : airsoftGenreId)
  );
}
export type RakutenItem = {
  id: string;
  name: string;
  shop: string;
  price: number;
  image: string;
  images: string[];
  productUrl: string;
  url: string;
  sponsored: boolean;
  identifiers: ProductIdentifiers;
  dimensions: ProductDimension[];
  referenceMm?: number;
};
export type RakutenResults = {
  items: RakutenItem[];
  count: number;
  page: number;
  pageCount: number;
};
export function searchParams(params: URLSearchParams) {
  const keyword = (params.get("q") || "").trim().replace(/\s+/g, " ");
  const page = Number(params.get("page") || 1);
  const sort = params.get("sort") || "standard";
  if (
    !keyword ||
    new TextEncoder().encode(keyword).length > 128 ||
    /[\u0000-\u001f]/.test(keyword) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100 ||
    !["standard", "+itemPrice", "-itemPrice"].includes(sort)
  )
    throw new Error("検索語・ページ・並び順を確認してください。");
  return { keyword, page, sort };
}
function rakutenUrl(input: unknown, image = false) {
  if (typeof input !== "string") return "";
  try {
    const url = new URL(input);
    const host = url.hostname;
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return "";
    const allowed = image
      ? /(^|\.)(rakuten\.co\.jp|rakuten\.ne\.jp|r10s\.jp)$/
      : /(^|\.)(rakuten\.co\.jp|rakuten\.ne\.jp|r10\.to)$/;
    return allowed.test(host) ? url.href : "";
  } catch {
    return "";
  }
}
export function rakutenProductUrl(input: unknown): string {
  const safe = rakutenUrl(input);
  if (!safe) return "";
  const url = new URL(safe);
  if (
    url.hostname === "item.rakuten.co.jp" &&
    /^\/[^/]+\/[^/]+\/?$/.test(url.pathname)
  )
    return url.href;
  if (url.hostname === "hb.afl.rakuten.co.jp") {
    const target = rakutenUrl(url.searchParams.get("pc"));
    if (target) {
      const product = new URL(target);
      if (
        product.hostname === "item.rakuten.co.jp" &&
        /^\/[^/]+\/[^/]+\/?$/.test(product.pathname)
      )
        return product.href;
    }
  }
  return "";
}
export function normalizeRakuten(data: unknown): RakutenResults {
  if (!data || typeof data !== "object") throw new Error("Invalid response");
  const root = data as Record<string, unknown>;
  const rows = root.items ?? root.Items;
  if (!Array.isArray(rows)) throw new Error("Invalid response");
  const items: RakutenItem[] = rows.slice(0, 30).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row.item ?? row.Item ?? row;
    const caption =
      typeof item.itemCaption === "string" ? item.itemCaption : "";
    const dimensions = productDimensions(caption);
    const url = rakutenUrl(item.affiliateUrl) || rakutenUrl(item.itemUrl);
    const images = Array.isArray(item.mediumImageUrls)
      ? [
          ...new Set<string>(
            item.mediumImageUrls
              .slice(0, 3)
              .map((entry: unknown) =>
                rakutenUrl(
                  typeof entry === "string"
                    ? entry
                    : (entry as { imageUrl?: unknown } | null)?.imageUrl,
                  true,
                ),
              )
              .filter(Boolean),
          ),
        ]
      : [];
    const image = images[0];
    if (
      !url ||
      !image ||
      typeof item.itemName !== "string" ||
      !Number.isFinite(item.itemPrice) ||
      item.itemPrice < 0
    )
      return [];
    return [
      {
        id: String(item.itemCode || url),
        name: item.itemName.slice(0, 500),
        identifiers: productIdentifiers(item.itemName, caption),
        dimensions,
        referenceMm: referenceLengthMm(dimensions),
        shop: String(item.shopName || "").slice(0, 100),
        price: item.itemPrice,
        image,
        images,
        productUrl:
          rakutenProductUrl(item.itemUrl) ||
          rakutenProductUrl(item.affiliateUrl),
        url,
        sponsored: /(^|\.)(afl\.rakuten\.co\.jp|r10\.to)$/.test(
          new URL(url).hostname,
        ),
      },
    ];
  });
  const integer = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : fallback;
  return {
    items,
    count: integer(root.count, items.length),
    page: Math.max(1, integer(root.page, 1)),
    pageCount: Math.min(100, integer(root.pageCount, 0)),
  };
}
