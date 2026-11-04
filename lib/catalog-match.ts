import {
  bodyVariantCompatible,
  bodyVariantMatcher,
  bodyVariantIdentity,
} from "./catalog-variant.ts";
import type { ProductIdentifiers } from "./product-specs.ts";
import type { CatalogPrice } from "./catalog-price.ts";
import { normalizeModelNumber } from "./product-metadata.ts";
import { normalizeGtin } from "./product-specs.ts";
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
  nameAliases?: string[];
  series?: string;
};
// Shared vocabulary, rather than per-retailer titles. Keep generation, size,
// magnification and model suffixes: they distinguish physically different items.
const vocabulary: [RegExp, string][] = [
  [/TOKYO\s*MARUI|マルイ/gi, "東京マルイ"],
  [/H\s*&\s*K|HECKLER\s*(?:&|AND)\s*KOCH/gi, ""],
  [/NOVEL\s*ARMS|ノーベルアームズ/gi, "NOVELARMS"],
  [/VECTOR\s*OPTICS|ベクターオプティクス/gi, "VECTOROPTICS"],
  [/LAYLAX|ライラクス/gi, "LAYLAX"],
  [/KRYTAC|クライタック/gi, "KRYTAC"],
  [/\bPLUS\b/gi, "プラス"],
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
      s.normalize("NFKC").replace(/([A-Z0-9])\s*\+(?![A-Z0-9])/gi, "$1プラス"),
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
    /\b(?:FDE|DE|TAN|DARK EARTH|FLAT DARK EARTH)\b|フラットダークアース|タンカラー/.test(
      value,
    )
      ? "fde"
      : "",
    /ホワイト|\b(?:WHITE|WH)\b/.test(value) ? "white" : "",
    /グレー|グレイ|\b(?:GREY|GRAY)\b/.test(value) ? "grey" : "",
    /オリーブドラブ|\b(?:OD|ODG|OLIVE DRAB)\b/.test(value) ? "od" : "",
  ].filter(Boolean);
}
const bodyFamilies = new WeakMap<CatalogProduct, string>();
function bodyFamily(product: CatalogProduct) {
  const cached = bodyFamilies.get(product);
  if (cached !== undefined) return cached;
  const family = normalize(
    product.name
      .replace(
        /【(?:電動ガンプラス|ハイグレード\/ホップアップ|ホップアップ)】/g,
        "",
      )
      .replace(/\(ハイグレードバージョン\)/g, ""),
  ).replace(/^(?:コルト|COLT|HK|FN)/, "");
  bodyFamilies.set(product, family);
  return family;
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
  const actual = colors(title);
  const compatibleVariant = bodyVariantMatcher(title);
  if (/レプリカ|互換|社外/.test(text)) return null;
  for (const method of ["jan", "model"] as const) {
    const values =
      method === "jan"
        ? identifiers?.janCodes
            .map(normalizeGtin)
            .filter((s): s is string => !!s)
        : identifiers?.modelNumbers;
    const hits = catalog.filter(
      (product) =>
        compatibleVariant(product) &&
        // Explicit variant conflicts must not inherit another variant's image.
        !(
          colors(product.name).length &&
          actual.length &&
          actual.some((c) => !colors(product.name).includes(c))
        ) &&
        !(
          method === "model" &&
          identifiers?.janCodes.length &&
          product.janCodes?.length &&
          identifiers.janCodes.some(
            (c) => !product.janCodes!.includes(normalizeGtin(c) || c),
          )
        ) &&
        !/(?:セット|キット)/.test(title.replace(product.name, "")) &&
        (method === "jan" ? product.janCodes : product.modelNumbers)?.some(
          (code) =>
            method === "jan"
              ? values?.includes(normalizeGtin(code) || code)
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
    if (
      product.janCodes?.length &&
      identifiers?.janCodes.some(
        (code) => !product.janCodes!.includes(normalizeGtin(code) || code),
      )
    )
      continue;
    if (
      product.modelNumbers?.length &&
      identifiers?.modelNumbers.some(
        (code) =>
          !product.modelNumbers!.some(
            (mpn) => normalizeModelNumber(mpn) === normalizeModelNumber(code),
          ),
      )
    )
      continue;
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
    if (!compatibleVariant(product, true)) continue;
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
    } else if (product.manufacturer === "KRYTAC") {
      if (!/KRYTAC/.test(text)) continue;
    } else if (product.manufacturer === "PTS") {
      if (!/\bPTS\b/i.test(title)) continue;
      const expectedGas = /\bGBB\b/.test(product.name);
      const expectedElectric = /\bAEG\b|\bERG\b/.test(product.name);
      const actualGas = /\bGBB\b|ガスブロ|ガスガン/i.test(title);
      const actualElectric = /\bAEG\b|\bERG\b|電動/i.test(title);
      if (
        (expectedGas && (!actualGas || actualElectric)) ||
        (expectedElectric && (!actualElectric || actualGas))
      )
        continue;
    } else continue;
    const expected = colors(product.name);
    if (
      expected.length &&
      (!actual.length || actual.some((color) => !expected.includes(color)))
    )
      continue;
    const stem = product.name
      .replace(
        /\s*【(?:電動ガンプラス|ハイグレード\/ホップアップ|ホップアップ)】\s*$/,
        "",
      )
      .replace(/\s*\[[^\]]+\]\s*$/, "")
      .replace(/\s*(?:ブラック|ホワイト|FDE|BLACK|WHITE)$/i, "");
    const names = [
      normalize(stem),
      ...(product.category === "本体" ? [bodyFamily(product)] : []),
      ...(aliases[product.id] || []).map(normalize),
      ...(product.nameAliases || []).map(normalize),
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
      const publishedAlias = product.nameAliases?.some(
        (alias) => normalize(alias) === name,
      );
      if (
        publishedAlias &&
        (!/^[A-Z0-9]+$/.test(name) ||
          !new RegExp(
            `(?:^|[^A-Z0-9])${[...name].join("[\\s-]*")}(?![A-Z0-9-])`,
            "i",
          ).test(title.normalize("NFKC")))
      )
        continue;
      if (
        !publishedAlias &&
        /^[A-Z0-9]{1,5}$/.test(name) &&
        !new RegExp(
          `(?:^|[^A-Z0-9])${[...name].join("[\\s._-]*")}(?![A-Z0-9])`,
          "i",
        ).test(title.normalize("NFKC"))
      )
        continue;
      const rest = text
        .slice(index + name.length)
        .replaceAll(normalize(product.series || ""), "")
        .replace(/電動ガンスタンダードタイプ|電動ガンハンドガンタイプ/g, "")
        .replace(/^(?:BK|BLACK|FDE|WHITE|WH|ブラック|ホワイト)/, "");
      // Do not let a base model stand in for its PLUS edition, even when the
      // edition is absent from a partial catalog or excluded by other evidence.
      if (!names[0].includes("プラス") && /^プラス/.test(rest)) continue;
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
  const chosen = candidates[0].product;
  if (chosen.category === "本体") {
    const family = bodyFamily(chosen),
      variant = bodyVariantIdentity(chosen);
    // Manufacturer prefixes and display annotations are not evidence of a different
    // gun. A longer title must not win over an otherwise indistinguishable mechanism.
    if (
      catalog.some(
        (p) =>
          p.category === "本体" &&
          p.manufacturer === chosen.manufacturer &&
          p.id !== chosen.id &&
          bodyFamily(p) === family &&
          compatibleVariant(p, true) &&
          bodyVariantIdentity(p) !== variant,
      )
    )
      return null;
  }
  return { product: chosen, method: "name" };
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

// Search captions and the current shop page often provide different parts of
// the evidence. Combine them without retaining a stale name-only match when
// the page publishes a conflicting barcode or manufacturer part number.
export function resolveCatalogMatch(
  initial: { name: string; identifiers?: ProductIdentifiers },
  page: { name: string; identifiers?: ProductIdentifiers },
  catalog: CatalogProduct[],
) {
  const identifiers: ProductIdentifiers = {
    janCodes: [
      ...new Set(
        [
          ...(initial.identifiers?.janCodes || []),
          ...(page.identifiers?.janCodes || []),
        ]
          .map(normalizeGtin)
          .filter((s): s is string => !!s),
      ),
    ],
    modelNumbers: [
      ...new Set([
        ...(initial.identifiers?.modelNumbers || []),
        ...(page.identifiers?.modelNumbers || []),
      ]),
    ],
  };
  const separate = strongestCatalogMatch(
    matchCatalog(initial.name, catalog, initial.identifiers),
    matchCatalog(page.name, catalog, page.identifiers),
  );
  const combined = matchCatalog(initial.name, catalog, identifiers);
  const chosen =
    combined?.method !== "name"
      ? strongestCatalogMatch(separate, combined)
      : separate;
  if (!chosen) return null;
  const product = chosen.product;
  if (
    !bodyVariantCompatible(initial.name, product) ||
    !bodyVariantCompatible(page.name, product)
  )
    return null;
  if (
    product.janCodes?.length &&
    identifiers.janCodes.some((code) => !product.janCodes!.includes(code))
  )
    return null;
  if (
    product.modelNumbers?.length &&
    identifiers.modelNumbers.some(
      (code) =>
        !product.modelNumbers!.some(
          (mpn) => normalizeModelNumber(mpn) === normalizeModelNumber(code),
        ),
    )
  )
    return null;
  return chosen;
}
