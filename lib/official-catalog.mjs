// Parse product galleries only, excluding site logos, related products and thumbnails.
import { publishedPrice } from "./catalog-price.ts";
import { productIdentifiers } from "./product-specs.ts";
export const cleanText = (s) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
export function novelProduct(html) {
  const name = cleanText(
    html.match(/<h1[^>]*class="entry-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "",
  );
  const images = [
    ...new Set(
      [
        ...html.matchAll(/<div class="slideslider_item">([\s\S]*?)<\/div>/g),
      ].flatMap((m) =>
        [
          ...m[1].matchAll(
            /(?:src|data-src)="(https:\/\/novelarms\.co\.jp\/wp-content\/uploads\/[^" ]+\.(?:jpg|png|webp))"/g,
          ),
        ].map((m) => m[1]),
      ),
    ),
  ];
  const specs = html.match(/<dl class="spec">([\s\S]*?)<\/dl>/)?.[1] || "";
  const dimensions = [
    ...specs.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g),
  ]
    .map((m) => ({ label: cleanText(m[1]), value: cleanText(m[2]) }))
    .filter(
      (d) =>
        /^(全長|全幅|全高|高さ|幅|対物レンズ径|チューブ径)$/.test(d.label) &&
        /mm|cm/.test(d.value),
    );
  const priceRow = [
    ...specs.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g),
  ].find((m) => cleanText(m[1]) === "価格");
  return {
    name,
    janCodes: productIdentifiers(name, html).janCodes,
    images,
    dimensions,
    modelNumbers: [],
    price: priceRow ? publishedPrice(priceRow[1], priceRow[2]) : null,
  };
}
export function vectorProduct(html) {
  const name = cleanText(
    html.match(/<h1[^>]*class="entry_title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "",
  );
  const images = [
    ...new Set(
      [
        ...html.matchAll(
          /<a\b[^>]*href="(https:\/\/www\.vectoroptics\.jp\/wp-content\/uploads\/[^" ]+)"[^>]*data-lightbox="group"/g,
        ),
      ].map((m) => m[1]),
    ),
  ];
  const model = cleanText(
    html.match(
      /<dt[^>]*>\s*アイテムナンバー\s*[：:]?\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/,
    )?.[1] || "",
  ).toUpperCase();
  const dimensions = [
    ...html.matchAll(
      /<tr[^>]*>\s*<t[hd][^>]*>([\s\S]*?)<\/t[hd]>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi,
    ),
  ]
    .map((m) => ({ label: cleanText(m[1]), value: cleanText(m[2]) }))
    .filter(
      (d) =>
        /^(全長|全幅|全高|高さ|幅|サイズ|対物レンズ径|チューブ径)$/.test(
          d.label,
        ) && /mm|cm/.test(d.value),
    );
  return {
    name,
    janCodes: productIdentifiers(name, html).janCodes,
    price: (() => {
      const m = html.match(
        /<dt>(希望小売価格[^<]*)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/,
      );
      return m ? publishedPrice(m[1], m[2]) : null;
    })(),
    images,
    dimensions,
    modelNumbers: [
      ...new Set(model.match(/\b[A-Z]{2,6}-?\d[A-Z0-9-]{0,15}\b/g) || []),
    ],
  };
}
