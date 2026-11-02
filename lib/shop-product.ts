import { shopUrl } from "./shop-url.ts";
import { productPhotos } from "./catalog-photos.mjs";
export type ShopDimension = {
  label: string;
  value: string;
  kind: "product" | "package";
};
export type ShopProduct = {
  url: string;
  name: string;
  site: string;
  images: string[];
  dimensions: ShopDimension[];
  referenceMm?: number;
  linkOnly?: boolean;
  notice?: string;
};
const decode = (s: string) =>
  s
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const code =
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return code <= 0x10ffff ? String.fromCodePoint(code) : "";
    });
const text = (s: unknown) =>
  typeof s === "string"
    ? decode(s.replace(/<[^>]*>/g, " "))
        .replace(/[\u200e\u200f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";
const attrs = (tag: string) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map((m) => [
      m[1].toLowerCase(),
      decode(m[3]),
    ]),
  );
function jsonValue(html: string, start: number) {
  let first = start;
  while (/\s/.test(html[first] || "")) first++;
  if (!["{", "["].includes(html[first])) return null;
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = first; i < Math.min(html.length, first + 600000); i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') {
      quoted = true;
      continue;
    }
    if (c === "{" || c === "[") depth++;
    if (c === "}" || c === "]") depth--;
    if (depth === 0) {
      try {
        return JSON.parse(html.slice(first, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}
export function extractShopProduct(html: string, source: string): ShopProduct {
  const url = shopUrl(source);
  if (
    /<title[^>]*>\s*(?:Amazon\s+)?(?:Robot Check|Captcha|Access Denied)|id=["']captchacharacters|Enter the characters you see below/i.test(
      html,
    )
  )
    throw new Error(
      "このページは画像認証が必要です。画像URLまたは画像ファイルから追加してください。",
    );
  const meta = new Map<string, string[]>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(match[0]),
      key = (a.property || a.name || "").toLowerCase();
    if (a.content) meta.set(key, [...(meta.get(key) || []), a.content]);
  }
  let product: any = null,
    visited = 0;
  function walk(value: any, depth = 0) {
    if (
      product ||
      !value ||
      typeof value !== "object" ||
      depth > 10 ||
      visited++ > 3000
    )
      return;
    if (
      [value["@type"]]
        .flat()
        .some(
          (type) => typeof type === "string" && /(?:^|[/#])Product$/.test(type),
        )
    ) {
      product = value;
      return;
    }
    for (const next of Array.isArray(value) ? value : Object.values(value))
      walk(next, depth + 1);
  }
  for (const match of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    if (!/application\/ld\+json/i.test(match[1]) || match[2].length > 800000)
      continue;
    try {
      walk(JSON.parse(match[2].trim()));
    } catch {
      /* Ignore scripts that are not valid JSON-LD. */
    }
  }
  const images: string[] = [];
  function addImage(value: any) {
    if (Array.isArray(value)) {
      value.forEach(addImage);
      return;
    }
    if (value && typeof value === "object") {
      addImage(value.contentUrl || value.url);
      return;
    }
    if (typeof value !== "string") return;
    try {
      const image = shopUrl(new URL(decode(value), url).href).href;
      if (
        !/\.svg(?:[?#]|$)/i.test(image) &&
        !images.includes(image) &&
        images.length < 16
      )
        images.push(image);
    } catch {
      /* Ignore local, inline, or non-HTTPS URLs. */
    }
  }
  if (url.hostname === "www.tokyo-marui.co.jp")
    productPhotos(html).forEach(addImage);
  const color = html.match(/["']colorImages["']\s*:\s*/);
  if (color) {
    const data = jsonValue(html, color.index! + color[0].length);
    const gallery =
      data?.initial || Object.values(data || {}).find(Array.isArray);
    if (Array.isArray(gallery))
      for (const image of gallery) addImage(image.hiRes || image.large);
  }
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    if (images.length) break;
    const a = attrs(match[0]);
    if (a.id !== "landingImage" && a.id !== "imgBlkFront") continue;
    if (a["data-old-hires"]) addImage(a["data-old-hires"]);
    if (a["data-a-dynamic-image"])
      try {
        const variants = JSON.parse(a["data-a-dynamic-image"]);
        const largest = Object.entries(variants).sort(
          (a: any, b: any) => b[1][0] * b[1][1] - a[1][0] * a[1][1],
        )[0];
        if (largest) addImage(largest[0]);
      } catch {}
    if (!images.length) addImage(a.src);
  }
  if (!images.length) addImage(product?.image);
  if (!images.length) {
    for (const key of ["og:image:secure_url", "og:image", "twitter:image"])
      for (const image of meta.get(key) || []) addImage(image);
  }
  const amazonName = html.match(
    /<[^>]+\bid=["']productTitle["'][^>]*>([\s\S]*?)<\//i,
  )?.[1];
  const name =
    text(
      product?.name ||
        amazonName ||
        meta.get("og:title")?.[0] ||
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
    ).slice(0, 200) || "ショップのパーツ";
  const dimensions: ShopDimension[] = [];
  function addDimension(label: unknown, value: unknown) {
    const l = text(label).replace(/[:：]\s*$/, ""),
      v = text(value);
    if (
      !l ||
      !v ||
      l.length > 80 ||
      v.length > 250 ||
      !/全長|寸法|サイズ|長さ|幅|高さ|奥行|length|width|height|depth|dimensions|size/i.test(
        l,
      )
    )
      return;
    if (
      dimensions.length < 8 &&
      !dimensions.some((d) => d.label === l && d.value === v)
    )
      dimensions.push({
        label: l,
        value: v,
        kind: /梱包|パッケージ|package|shipping/i.test(l)
          ? "package"
          : "product",
      });
  }
  const quantity = (v: any) =>
    typeof v === "object" && v
      ? `${v.value ?? ""} ${v.unitText || { MMT: "mm", CMT: "cm", MTR: "m", INH: "in" }[v.unitCode] || v.unitCode || ""}`
      : v;
  for (const [key, label] of [
    ["width", "幅"],
    ["height", "高さ"],
    ["depth", "奥行き"],
  ])
    if (product?.[key]) addDimension(label, quantity(product[key]));
  const properties = Array.isArray(product?.additionalProperty)
    ? product.additionalProperty
    : product?.additionalProperty
      ? [product.additionalProperty]
      : [];
  for (const p of properties)
    addDimension(
      p.name,
      p.unitText ? `${p.value} ${p.unitText}` : quantity(p.value),
    );
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [
      ...row[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi),
    ].map((m) => m[1]);
    if (cells.length >= 2) addDimension(cells[0], cells[1]);
  }
  for (const item of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const plain = text(item[1]);
    const m = plain.match(
      /^(.{1,60}?(?:製品サイズ|商品サイズ|梱包サイズ|全長|寸法|Product Dimensions|Package Dimensions))\s*[:：]\s*(.{1,150})$/i,
    );
    if (m) addDimension(m[1], m[2]);
  }
  const known = dimensions.find(
    (d) =>
      d.kind === "product" &&
      /^(?:全長|長さ|overall length|length)$/i.test(d.label),
  );
  const mm = known?.value.match(
    /^(?:約\s*)?([\d.]+)\s*(mm|cm|m|in(?:ch)?|インチ|ミリ|センチ)\b/i,
  );
  const reference = mm
    ? Number(mm[1]) *
      ({
        mm: 1,
        cm: 10,
        m: 1000,
        in: 25.4,
        inch: 25.4,
        インチ: 25.4,
        ミリ: 1,
        センチ: 10,
      }[mm[2].toLowerCase()] || 1)
    : undefined;
  return {
    url: url.href,
    name,
    site: url.hostname,
    images,
    dimensions,
    referenceMm:
      reference && reference > 0 && reference <= 5000 ? reference : undefined,
  };
}
