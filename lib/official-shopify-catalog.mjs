import {
  productDimensions,
  referenceLengthMm,
  normalizeGtin,
} from "./product-specs.ts";
import { variantPrice } from "./catalog-price.ts";

export const officialShops = {
  laylax: {
    manufacturer: "LAYLAX",
    origin: "https://laylax.com",
    imagePath: "/s/files/1/0843/1095/0186/",
    currency: "JPY",
  },
  krytac: {
    manufacturer: "KRYTAC",
    origin: "https://laylax.com",
    imagePath: "/s/files/1/0843/1095/0186/",
    currency: "JPY",
  },
  pts: {
    manufacturer: "PTS",
    origin: "https://pts-steelshop.com",
    imagePath: "/s/files/1/0592/0368/2494/",
  },
};
function categoryOf(product, provider) {
  const title = product.title || "";
  const type = product.product_type || "";
  if (provider === "laylax") {
    if (String(product.vendor).toUpperCase() !== "LAYLAX") return null;
    if (
      !product.catalogInclude &&
      !/グリップ|ハンドストップ|ストック|スコープ|サイト|ハンドガード|ハイダー|サプレッサー|サイレンサー|マガジン|マウント|バイポッド|レイル|レール|フレーム|スライド|アウターバレル|バレルジャケット|MODE-2|NITRO.VO|QUINTES.SENCE/i.test(
        title,
      )
    )
      return null;
    if (/グリップ|ハンドストップ/.test(title)) return "グリップ";
    if (/ストック/.test(title)) return "ストック";
    if (/スコープ|サイト|レンズプロテクター/.test(title)) return "光学機器";
    if (/マガジン/.test(title)) return "マガジン";
    return "外装";
  }
  if (provider === "krytac") {
    if (product.vendor !== "KRYTAC") return null;
    if (/電動ガン本体|ガスブローバック.*(?:対象年齢|本体)/.test(title))
      return "本体";
    if (/マガジン/.test(title)) return "マガジン";
    if (/ストック/.test(title) && !/パーツ|スプリング/.test(title))
      return "ストック";
    if (/ハンドガード|サプレッサー|フラッシュハイダー/.test(title))
      return "外装";
    return null;
  }
  // This manufacturer-operated shop also sells unrelated brands and gear.
  if (!/^PTS(?: |$)/.test(product.vendor || "")) return null;
  if (/^(?:Pistols|.* Rifles)$/.test(type)) return "本体";
  if (/^(?:AEG|GBB|ERG|Pistol) Magazine$/.test(type)) return "マガジン";
  if (type === "Grips" || type === "Foregrips") return "グリップ";
  if (type === "Stocks") return "ストック";
  if (/Optic Mounts|Iron Sights|Laser & Illuminator/.test(type))
    return "光学機器";
  if (
    /Mock Suppressors|Compensator|Rails \/ Handguards|Rail Sections|Stock Adapters|Silencer Accessories|Sling Mounts/.test(
      type,
    )
  )
    return "外装";
  return null;
}
export function shopifyCatalogProducts(product, provider, checkedAt) {
  const shop = officialShops[provider];
  if (!shop) throw new Error("Unknown official provider");
  const category = categoryOf(product, provider);
  if (!category) return [];
  const usableImage = (image) => {
    try {
      const url = new URL(image.src);
      return (
        url.protocol === "https:" &&
        url.hostname === "cdn.shopify.com" &&
        url.pathname.startsWith(shop.imagePath)
      );
    } catch {
      return false;
    }
  };
  const gallery = (product.images || []).filter(usableImage);
  const variants = (product.variants || []).filter(
    (v) =>
      !/-set(?:$|-)|starter/i.test(v.sku || "") &&
      !/スターターセット/.test(v.title || ""),
  );
  const dimensions = productDimensions(product.body_html || "").filter(
    (d) => d.kind === "product",
  );
  // Shared page descriptions may list several sizes. Only auto-select a length
  // when variant options change color or packaging, not the product's geometry.
  const sizeVariants = (product.options || []).some(
    (o) =>
      o.values?.length > 1 &&
      !/^(?:カラー|色|color|colour|セット)$/i.test(o.name),
  );
  return variants.flatMap((variant) => {
    const featured = usableImage(variant.featured_image || {})
      ? variant.featured_image
      : null;
    const images = [
      ...new Set([
        ...(featured ? [featured.src] : []),
        ...gallery
          .filter(
            (image) =>
              !image.variant_ids?.length ||
              image.variant_ids.includes(variant.id),
          )
          .map((image) => image.src),
      ]),
    ].slice(0, 16);
    if (!images.length) return [];
    const code = String(variant.sku || "").trim();
    const jan = normalizeGtin(code);
    const variantName = /^(?:Default Title|本体のみ)$/i.test(
      variant.title || "",
    )
      ? ""
      : variant.title.replace(/^本体のみ\s*\/\s*/, "");
    const base = product.title.replace(/\/対象年齢\d+歳以上.*$/, "").trim();
    return [
      {
        id:
          provider === "laylax" && variants.length === 1
            ? `laylax-${product.id}`
            : `${provider}-${product.id}-${variant.id}`,
        name: `${base}${variantName ? ` [${variantName}]` : ""}`,
        manufacturer: shop.manufacturer,
        nameAliases:
          provider === "pts"
            ? [
                ...new Set([
                  ...[...base.matchAll(/\(([A-Z][A-Z0-9-]{2,18})\)/g)].map(
                    (m) => m[1],
                  ),
                  ...(base.match(/^([A-Z]{2,6}\d[A-Z0-9-]*)\b/)?.slice(1) ||
                    []),
                ]),
              ].filter(
                (s) =>
                  ![
                    "GBB",
                    "AEG",
                    "ERG",
                    "DAS",
                    "M-LOK",
                    "USA",
                    "MIL-SPEC",
                  ].includes(s),
              )
            : [],
        category,
        image: images[0],
        images,
        url: `${shop.origin}/products/${product.handle}?variant=${variant.id}`,
        dimensions: dimensions.map(({ label, value }) => ({
          label: sizeVariants ? `${label}（仕様別）` : label,
          value,
        })),
        lengthMm: sizeVariants ? null : (referenceLengthMm(dimensions) ?? null),
        // Per-variant SKU from the manufacturer, never a retailer's itemCode.
        janCodes: jan ? [jan] : [],
        modelNumbers:
          !jan && /[a-z]/i.test(code) && /^[A-Z0-9._/-]{3,40}$/i.test(code)
            ? [code.toUpperCase()]
            : [],
        // JPY prices only: the PTS storefront selects currency by visitor location.
        price: shop.currency === "JPY" ? variantPrice([variant]) : null,
        checkedAt,
      },
    ];
  });
}
