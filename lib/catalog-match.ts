import type { ProductIdentifiers } from "./product-specs.ts";
import type { CatalogPrice } from "./catalog-price.ts";
import { normalizeModelNumber } from "./product-metadata.ts";
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
  series?: string;
};
// Shared vocabulary, rather than per-retailer titles. Keep generation, size,
// magnification and model suffixes: they distinguish physically different items.
const vocabulary: [RegExp, string][] = [
  [/TOKYO\s*MARUI|マルイ/gi, "東京マルイ"],
  [/NOVEL\s*ARMS|ノーベルアームズ/gi, "NOVELARMS"],
  [/VECTOR\s*OPTICS|ベクターオプティクス/gi, "VECTOROPTICS"],
  [/LAYLAX|ライラクス/gi, "LAYLAX"],
  [/SOPMOD/gi, "ソップモッド"],
  [/DELTA\s*CUSTOM/gi, "デルタカスタム"],
  [/GLOCK/gi, "グロック"],
  [/HI[\s-]*CAPA/gi, "ハイキャパ"],
  [/DESERT\s*EAGLE/gi, "デザートイーグル"],
  [/DEVGRU|デブグル/gi, "DEVGRU"],
  [/COMBAT|コンバット/gi, "COMBAT"],
  [/SURE[\s-]*HIT|シュアヒット/gi, "SUREHIT"],
  [/ABSOLUTE|アブソリュート/gi, "ABSOLUTE"],
  [/EVOLUTION|エボリューション/gi, "EVOLUTION"],
  [/GEN(?:ERATION)?\s*(?:II|2)(?![I\d])|第2世代|ジェネレーション2/gi, "GEN2"],
];
const normalize = (s: string) =>
  vocabulary
    .reduce(
      (text, [pattern, value]) => text.replace(pattern, value),
      s.normalize("NFKC"),
    )
    .toUpperCase()
    .replace(/[\s\p{P}\p{S}]/gu, "")
    .replace(/M4ソップモッド/g, "ソップモッドM4")
    .replace(/東京東京マルイ/g, "東京マルイ");
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
function seriesKind(s: string) {
  if (/電動ブローバック\s*フルオート/.test(s)) return "electric:blowbackauto";
  if (/電動ブローバック/.test(s)) return "electric:blowback";
  if (/BOYS|ボーイズ/i.test(s)) return "electric:boys";
  if (/ライトプロ|LIGHT\s*PRO/i.test(s)) return "electric:lightpro";
  if (/電動(?:ガン\s*)?ハンドガン|電動ガン\s*ハンドガンタイプ/.test(s))
    return "electric:handgun";
  if (/電動コンパクト/.test(s)) return "electric:compact";
  if (/エア[ー]?ハンドガン.*10[才歳]/.test(s)) return "air:handgun10";
  if (/エア[ー]?ハンドガン.*18[才歳]/.test(s)) return "air:handgun18";
  if (/次世代|NEXT\s*GEN/i.test(s)) return "nextgeneration";
  if (/ハイサイクル|HIGH\s*CYCLE/i.test(s)) return "highcycle";
  if (/電動.*(?:スタンダード|標準)|スタンダード.*電動/.test(s))
    return "standard";
  if (/ガスブローバック|GAS\s*BLOWBACK|\bGBB\b/i.test(s)) return "gas";
  if (
    /エア[ー]?コッキング|エア[ー]?ハンドガン|ボルトアクション|BOLT\s*ACTION/i.test(
      s,
    )
  )
    return "air";
  return "";
}
const modelPatterns = new Map<string, RegExp | null>();
function modelExpression(code: string) {
  if (modelPatterns.has(code)) return modelPatterns.get(code)!;
  const normalized = normalizeModelNumber(code);
  if (
    normalized.length < 5 ||
    !/^[A-Z0-9]+$/.test(normalized) ||
    !/[A-Z]/.test(normalized) ||
    !/\d/.test(normalized)
  )
    return null;
  const pattern = new RegExp(
    `(?:^|[^A-Z0-9])(${[...normalized].join("[\\s._/‐‑–—−-]*")})(?![A-Z0-9]|[\\s._/‐‑–—−-]+[IVX]{1,5}(?![A-Z0-9]))`,
    "i",
  );
  if (modelPatterns.size < 2000) modelPatterns.set(code, pattern);
  return pattern;
}
function compatibleCode(title: string, code: string) {
  const match = modelExpression(code)?.exec(title.normalize("NFKC"));
  return (
    !!match &&
    /^[\s\])）】]*?(?:用|専用|対応|適合|互換)/.test(
      title.normalize("NFKC").slice(match.index + match[0].length),
    )
  );
}
// Conservative name matching. Ambiguous colors, replicas, bundles and compatibility-only mentions stay unlinked.
export function matchCatalog(
  title: string,
  catalog: CatalogProduct[],
  identifiers?: ProductIdentifiers,
): { product: CatalogProduct; method: "jan" | "model" | "name" } | null {
  const text = normalize(title);
  const actual = colors(title),
    actualSeries = seriesKind(title);
  if (/レプリカ|互換|社外/.test(text)) return null;
  for (const method of ["jan", "model"] as const) {
    const values =
      method === "jan" ? identifiers?.janCodes : identifiers?.modelNumbers;
    const hits = catalog.filter(
      (product) =>
        !/(?:セット|キット)/.test(title.replace(product.name, "")) &&
        (method === "jan" ? product.janCodes : product.modelNumbers)?.some(
          (code) =>
            method === "jan"
              ? values?.includes(code)
              : !compatibleCode(title, code) &&
                (values?.some(
                  (value) =>
                    normalizeModelNumber(value) === normalizeModelNumber(code),
                ) ||
                  !!modelExpression(code)?.test(title.normalize("NFKC"))),
        ),
    );
    if (hits.length === 1) {
      if (
        method === "jan" &&
        values?.some((code) => !hits[0].janCodes?.includes(code))
      )
        return null;
      return { product: hits[0], method };
    }
    if (hits.length > 1) return null;
  }
  const candidates: { product: CatalogProduct; score: number }[] = [];
  for (const product of catalog) {
    // A published-looking model in the title must pass identifier matching.
    // Falling back to a shorter family name could substitute a different color
    // or generation (e.g. SCRD-F19II vs SCRD-19II).
    if (
      product.modelNumbers?.some((code) => {
        const prefix = normalizeModelNumber(code).match(/^[A-Z]+/)?.[0];
        return (
          prefix &&
          new RegExp(
            `(?:^|[^A-Z0-9])${prefix}[\\s-]*(?:[A-Z]{0,2})[0-9]`,
            "i",
          ).test(title.normalize("NFKC"))
        );
      })
    )
      continue;
    const expectedSeries =
      seriesKind(product.series || "") ||
      (product.url.includes("/nextgeneration/")
        ? "nextgeneration"
        : product.url.includes("/highcycle/")
          ? "highcycle"
          : product.url.includes("/standard/")
            ? "standard"
            : product.url.includes("/gas/")
              ? "gas"
              : product.url.includes("/aircocking/")
                ? "air"
                : product.url.includes("/electric/")
                  ? `electric:${product.url.split("/")[5]}`
                  : "");
    if (
      product.category === "本体" &&
      actualSeries &&
      expectedSeries &&
      actualSeries !== expectedSeries &&
      !(actualSeries === "air" && expectedSeries.startsWith("air:"))
    )
      continue;
    if (
      product.id === "marui-body-201" &&
      /URGI|ブロック[123]|BLOCK[123]/.test(text)
    )
      continue;
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
      if (!/VECTOROPTICS|VICTOPTICS|ビクトオプティクス/.test(text)) continue;
    } else continue;
    const expected = colors(product.name);
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
        .replace(/\d+(?:才|歳)(?:以上)?用|あす楽対応/g, "")
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
        .replaceAll(normalize(product.series || ""), "")
        .replace(/電動ガンスタンダードタイプ|電動ガンハンドガンタイプ/g, "")
        .replace(/^(?:BK|BLACK|FDE|WHITE|WH|ブラック|ホワイト)/, "");
      if (
        /用|専用|対応|マウント|カバー|保護|アダプター|ホルスター|リング|電池|ネジ|レンズ|セット|キット|(?<!軽量化)タイプ|レプリカ/.test(
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
export function strongestCatalogMatch(
  initial: ReturnType<typeof matchCatalog>,
  page: ReturnType<typeof matchCatalog>,
) {
  if (!initial) return page;
  if (!page) return initial;
  const rank = { name: 1, model: 2, jan: 3 };
  if (
    initial.product.id !== page.product.id &&
    rank[initial.method] === rank[page.method]
  )
    return null;
  return rank[page.method] > rank[initial.method] ? page : initial;
}
