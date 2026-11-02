export type RakutenItem = {
  id: string;
  name: string;
  shop: string;
  price: number;
  image: string;
  url: string;
  sponsored: boolean;
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
export function normalizeRakuten(data: unknown): RakutenResults {
  if (!data || typeof data !== "object") throw new Error("Invalid response");
  const root = data as Record<string, unknown>;
  const rows = root.items ?? root.Items;
  if (!Array.isArray(rows)) throw new Error("Invalid response");
  const items: RakutenItem[] = rows.slice(0, 30).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row.item ?? row.Item ?? row;
    const url = rakutenUrl(item.affiliateUrl) || rakutenUrl(item.itemUrl);
    const imageEntry = item.mediumImageUrls?.[0];
    const image = rakutenUrl(
      typeof imageEntry === "string" ? imageEntry : imageEntry?.imageUrl,
      true,
    );
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
        shop: String(item.shopName || "").slice(0, 100),
        price: item.itemPrice,
        image,
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
