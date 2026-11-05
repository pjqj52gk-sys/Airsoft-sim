import { yahooProductUrl } from "./yahoo-link.ts";
import { rakutenTarget } from "./rakuten-affiliate.ts";
export class ProductLinkError extends Error {}
const message =
  "対応していない商品URLです。楽天市場・Yahoo!ショッピング・Amazonの商品ページ、または対応メーカーの商品ページを指定してください。短縮URLや転送URLは使えません。";
function urlValue(value: unknown): URL {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    /[\u0000-\u0020\u007f]/.test(value)
  )
    throw new ProductLinkError(message);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProductLinkError(message);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hostname.endsWith(".")
  )
    throw new ProductLinkError(message);
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    throw new ProductLinkError(message);
  }
  if (
    /[\\?#\u0000-\u0020\u007f]/.test(decoded) ||
    /%[0-9a-f]{2}/i.test(decoded) ||
    decoded.split("/").length !== url.pathname.split("/").length
  )
    throw new ProductLinkError(message);
  return url;
}
const officialPaths: Record<string, RegExp> = {
  "www.tokyo-marui.co.jp": /^\/products\/[a-z0-9_/-]+$/i,
  "novelarms.co.jp": /^\/products\/[^/?#\\]+\/?$/u,
  "www.vectoroptics.jp": /^\/[a-z0-9_-]+\/?$/i,
  "laylax.com": /^\/products\/[a-z0-9_-]+\/?$/i,
  "pts-steelshop.com": /^\/products\/[a-z0-9_-]+\/?$/i,
};
export function approvedProductUrl(value: unknown, manualOnly = false): string {
  if (value === undefined || value === "") return "";
  const input = urlValue(value);
  const yahoo = yahooProductUrl(input.href);
  if (yahoo) return yahoo;
  const target = rakutenTarget(input.href);
  if (target) {
    const url = urlValue(target);
    if (
      url.hostname === "item.rakuten.co.jp" &&
      /^\/[a-z0-9_-]+\/[a-z0-9_.-]+\/?$/i.test(url.pathname)
    ) {
      for (const key of [...url.searchParams.keys()])
        if (!["variant", "sku_id", "color", "size"].includes(key))
          url.searchParams.delete(key);
      for (const val of url.searchParams.values())
        if (!/^[\p{L}\p{N} ._+-]{1,120}$/u.test(val))
          throw new ProductLinkError(message);
      url.hash = "";
      return url.href;
    }
  }
  if (["amazon.co.jp", "www.amazon.co.jp"].includes(input.hostname)) {
    const asin = input.pathname.match(
      /\/(?:dp|gp\/product|gp\/aw\/d)\/([a-z0-9]{10})(?:\/|$)/i,
    )?.[1];
    if (asin) return "https://www.amazon.co.jp/dp/" + asin.toUpperCase();
  }
  if (
    !manualOnly &&
    Object.hasOwn(officialPaths, input.hostname) &&
    officialPaths[input.hostname].test(input.pathname)
  ) {
    for (const [key, val] of input.searchParams)
      if (key !== "variant" || !/^\d{1,24}$/.test(val))
        throw new ProductLinkError(message);
    input.hash = "";
    return input.href;
  }
  throw new ProductLinkError(message);
}
export function safeImportedProductUrl(
  value: unknown,
  onInvalid?: () => void,
): string {
  try {
    return approvedProductUrl(value);
  } catch {
    onInvalid?.();
    return "";
  }
}
