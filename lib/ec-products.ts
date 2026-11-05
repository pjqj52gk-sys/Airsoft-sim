import { matchCatalog, type CatalogProduct } from "./catalog-match.ts";
import { normalizeGtin, productText } from "./product-specs.ts";
import { normalizeModelNumber } from "./product-metadata.ts";
import type { RakutenItem } from "./rakuten.ts";

// Remove advertising copy only; retain model suffixes, colors and package contents.
export function conciseProductName(input: string): string {
  const original = productText(input)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  const cleaned = original
    .replace(/[【\[]([^】\]]*)[】\]]/g, (whole, inner: string) =>
      /ポイント|クーポン|エントリー|抽選|送料無料|あす楽|全力価格|限定特別価格|楽天.*(?:位|冠)|お買い物マラソン|セール|SALE/i.test(
        inner,
      ) &&
      !/東京マルイ|VECTOR|LAYLAX|[A-Z]{2,}[-. ]?\d|ブラック|タンカラー|プラス|ハイサイクル|ガスガン|電動ガン|セット|キット/i.test(
        inner,
      )
        ? " "
        : whole,
    )
    .replace(/(?:送料無料|あす楽|要エントリー)[!！★☆]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || original;
}

function variantKey(name: string) {
  const text = name.normalize("NFKC").toUpperCase();
  const patterns: [string, RegExp][] = [
    ["black", /ブラック|\b(?:BK|BLACK)\b/],
    ["fde", /フラットダークアース|タンカラー|\b(?:FDE|DE|TAN|DARK EARTH)\b/],
    ["white", /ホワイト|\b(?:WH|WHITE)\b/],
    ["od", /オリーブ|\b(?:OD|ODG|OLIVE)\b/],
    ["grey", /グレ[ーイ]|\bGR[AE]Y\b/],
    ["gas", /ガス|\bGBB(?:R)?\b/],
    ["co2", /\bCO2\b/],
    ["electric", /電動|\bAEG\b/],
    ["spring", /エアコキ|エアー?コッキング/],
    ["highcycle", /ハイサイ|HIGH[ -]*CYCLE|\bHC\b/],
    ["nextgen", /次世代|NEXT[ -]*GEN/],
    ["plus", /プラス|\bPLUS\b|[A-Z0-9]\s*\+/],
    ["standard", /スタンダード|STANDARD/],
    ["boys", /ボーイズ|\bBOYS\b/],
    ["lightpro", /ライトプロ|LIGHT[ -]*PRO/],
  ];
  const versions =
    text.match(
      /GEN(?:ERATION)?[. -]*(?:[1-9]|I{1,3}|IV|V)\b|VER(?:SION)?[. -]*[1-9]|第[1-9]世代|[0-9]+(?:才|歳)/g,
    ) || [];
  return [
    ...patterns.filter(([, regex]) => regex.test(text)).map(([key]) => key),
    ...versions.map((version) => {
      const value = version.replace(/[. -]/g, "").replace("GENERATION", "GEN");
      const roman: Record<string, string> = {
        I: "1",
        II: "2",
        III: "3",
        IV: "4",
        V: "5",
      };
      return value
        .replace(
          /^GEN(IV|III|II|I|V)$/,
          (_, number: string) => "GEN" + roman[number],
        )
        .replace(/^第([1-9])世代$/, "GEN$1")
        .replace(/才$/, "歳");
    }),
  ]
    .filter((flag, index, all) => all.indexOf(flag) === index)
    .sort()
    .join(":");
}
function separateOffer(name: string) {
  return (
    /セット|キット|SET\b|KIT\b|中古|ジャンク|訳あり|レプリカ|互換|対応|専用|[0-9]+個|[0-9]+本|[0-9]+点|[&＆]/i.test(
      name.replace(/(?:H\s*&\s*K|G\s*&\s*G)/gi, "BRAND"),
    ) || /用/.test(name.replace(/(?:[0-9]+[才歳]以上用|対象年齢)/g, ""))
  );
}
export function productDisplayName(
  input: string,
  official?: CatalogProduct | null,
) {
  const name = conciseProductName(input);
  if (
    !official ||
    /セット|キット|SET\b|KIT\b|中古|ジャンク|訳あり/i.test(
      name.replace(official.name, ""),
    )
  )
    return name;
  const base = official.name.startsWith(official.manufacturer)
    ? official.name
    : official.manufacturer + " " + official.name;
  const known = new Set(variantKey(base).split(":"));
  const labels: Record<string, string> = {
    black: "ブラック",
    fde: "FDE",
    white: "ホワイト",
    od: "OD",
    grey: "グレー",
    gas: "ガス",
    co2: "CO2",
    electric: "電動",
    spring: "エアコッキング",
    highcycle: "ハイサイクル",
    nextgen: "次世代",
    plus: "プラス",
    standard: "スタンダード",
    boys: "ボーイズ",
    lightpro: "ライトプロ",
  };
  return [
    base,
    ...variantKey(name)
      .split(":")
      .filter((flag) => flag && !known.has(flag))
      .map((flag) => labels[flag] || flag),
  ].join(" ");
}
export type EcProduct = {
  id: string;
  name: string;
  offers: RakutenItem[];
  official?: CatalogProduct;
};
export function groupEcProducts(
  items: RakutenItem[],
  catalog: CatalogProduct[] = [],
  sort = "standard",
): EcProduct[] {
  const groups = new Map<string, EcProduct>();
  const urls = new Set<string>();
  items.forEach((item, index) => {
    if (urls.has(item.productUrl)) return;
    urls.add(item.productUrl);
    const name = conciseProductName(item.name);
    const isolated = separateOffer(name);
    const janCodes = [
      ...new Set(
        item.identifiers.janCodes
          .map(normalizeGtin)
          .filter((code): code is string => !!code),
      ),
    ].sort();
    const matched = matchCatalog(item.name, catalog, item.identifiers);
    const official = matched?.product;
    // A display name may use a unique catalog-name match; merging still requires identifiers.
    const identityOfficial =
      matched && matched.method !== "name" ? matched.product : undefined;
    const identity =
      !isolated && janCodes.length <= 1
        ? identityOfficial
          ? "catalog:" + identityOfficial.id
          : janCodes[0]
            ? "jan:" + janCodes[0]
            : ""
        : "";
    const key = identity
      ? [
          identity,
          janCodes.join(","),
          [...new Set(item.identifiers.modelNumbers.map(normalizeModelNumber))]
            .sort()
            .join(","),
          variantKey(name),
        ].join("|")
      : "offer:" + index;
    const group = groups.get(key);
    if (group) group.offers.push(item);
    else
      groups.set(key, {
        id: key,
        name: productDisplayName(name, official),
        offers: [item],
        official,
      });
  });
  const products = [...groups.values()];
  for (const product of products)
    product.offers.sort((a, b) => a.price - b.price);
  if (sort === "+itemPrice")
    products.sort((a, b) => a.offers[0].price - b.offers[0].price);
  if (sort === "-itemPrice")
    products.sort((a, b) => b.offers[0].price - a.offers[0].price);
  return products;
}
export function ecMarket(item: RakutenItem) {
  return item.productUrl.includes("shopping.yahoo.co.jp")
    ? "Yahoo!ショッピング"
    : "楽天市場";
}
