import type { ProductIdentifiers } from "./product-specs.ts";
import type { CatalogPrice } from "./catalog-price.ts";
export type CatalogProduct = {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  images: string[];
  url: string;
  dimensions: { label: string; value: string }[];
  lengthMm: number | null;
  checkedAt: string;
  price?: CatalogPrice | null;
  janCodes?: string[];
  modelNumbers?: string[];
};
const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
const aliases: Record<string, string[]> = {
  "396": ["マイクロプロサイト"],
  "397": ["グロック用マイクロプロサイトマウント"],
  "456": ["MTD", "マルイタクティカルドットサイト"],
  "081": ["バーチカルフォアグリップ"],
};
function colors(s: string) {
  const value = s.normalize("NFKC").toUpperCase();
  return [
    /ブラック|\b(?:BK|BLACK)\b/.test(value) ? "black" : "",
    /\b(?:FDE|DE|TAN)\b|フラットダークアース|タンカラー/.test(value)
      ? "fde"
      : "",
    /ホワイト|\b(?:WHITE|WH)\b/.test(value) ? "white" : "",
  ].filter(Boolean);
}
// Conservative name matching. Ambiguous colors, replicas, bundles and compatibility-only mentions stay unlinked.
export function matchCatalog(
  title: string,
  catalog: CatalogProduct[],
  identifiers?: ProductIdentifiers,
): { product: CatalogProduct; method: "jan" | "model" | "name" } | null {
  const text = normalize(title);
  if (/レプリカ|互換|社外/.test(text)) return null;
  for (const method of ["jan", "model"] as const) {
    const values =
      method === "jan" ? identifiers?.janCodes : identifiers?.modelNumbers;
    const hits = catalog.filter((product) =>
      (method === "jan" ? product.janCodes : product.modelNumbers)?.some(
        (code) =>
          values?.includes(code) ||
          (method === "model" &&
            code.length >= 5 &&
            /[A-Z]/i.test(code) &&
            /[0-9]/.test(code) &&
            new RegExp(
              `(?:^|[^A-Z0-9])${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Z0-9]|\\s*(?:用|対応|互換))`,
              "i",
            ).test(title.normalize("NFKC"))),
      ),
    );
    if (hits.length === 1) return { product: hits[0], method };
    if (hits.length > 1) return null;
  }
  const candidates: { product: CatalogProduct; score: number }[] = [];
  for (const product of catalog) {
    if (product.manufacturer === "東京マルイ") {
      if (
        !/東京マルイ|TOKYOMARUI/.test(text) ||
        /(?:東京マルイ|TOKYOMARUI)(?:用|対応|適合)/.test(text)
      )
        continue;
    } else if (product.manufacturer === "LAYLAX") {
      if (
        !/LAYLAX|ライラクス|MODE2|モードツー|NITROVO|ニトロヴォイス|NINEBALL|ナインボール|FIRSTFACTORY|ファーストファクトリー|QUINTESSENCE/.test(
          text,
        )
      )
        continue;
    } else if (product.manufacturer === "NOVEL ARMS") {
      if (!/NOVELARMS|ノーベルアームズ/.test(text)) continue;
    } else if (product.manufacturer === "Vector Optics") {
      // Published model codes are more reliable than translated English names.
      continue;
    } else continue;
    const expected = colors(product.name),
      actual = colors(title);
    if (
      expected.length &&
      (!actual.length || actual.some((color) => !expected.includes(color)))
    )
      continue;
    const stem = product.name
      .replace(/\s*\[[^\]]+\]\s*$/, "")
      .replace(/\s*(?:ブラック|ホワイト|FDE|BLACK|WHITE)$/i, "");
    const names = [
      normalize(stem),
      ...(aliases[product.id] || []).map(normalize),
    ];
    let score = 0;
    for (const name of names) {
      const index = text.indexOf(name);
      if (index < 0) continue;
      const prefix = text
        .slice(0, index)
        .replace(/東京マルイ製|TOKYOMARUI製/g, "");
      if (/用|対応|適合|互換|専用|[A-Z0-9]{2,}製/.test(prefix)) continue;
      if (
        /^[A-Z0-9]{1,5}$/.test(name) &&
        (/[A-Z0-9]/.test(text[index - 1] || "") ||
          /[A-Z0-9]/.test(text[index + name.length] || ""))
      )
        continue;
      const rest = text
        .slice(index + name.length)
        .replace(/^(?:BK|BLACK|FDE|WHITE|WH|ブラック|ホワイト)/, "");
      if (
        /用|専用|対応|マウント|カバー|保護|アダプター|ホルスター|リング|電池|ネジ|レンズ|セット|キット|タイプ|レプリカ/.test(
          rest,
        )
      )
        continue;
      score = Math.max(score, name.length);
    }
    if (score)
      candidates.push({ product, score: score + (expected.length ? 2 : 0) });
  }
  candidates.sort((a, b) => b.score - a.score);
  if (
    !candidates.length ||
    (candidates[1] && candidates[0].score === candidates[1].score)
  )
    return null;
  return { product: candidates[0].product, method: "name" };
}
export function findCatalogMatch(
  title: string,
  catalog: CatalogProduct[],
  identifiers?: ProductIdentifiers,
) {
  return matchCatalog(title, catalog, identifiers)?.product || null;
}
