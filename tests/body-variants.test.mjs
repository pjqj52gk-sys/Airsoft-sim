import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { matchCatalog, resolveCatalogMatch } from "../lib/catalog-match.ts";
import { bodyVariantCompatible } from "../lib/catalog-variant.ts";
const catalog = JSON.parse(
  fs.readFileSync(new URL("../lib/parts-catalog.json", import.meta.url)),
);
const bodies = catalog.filter(
  (p) => p.category === "本体" && p.manufacturer === "東京マルイ",
);
const png = "https://www.tokyo-marui.co.jp/appimg/product/example.jpg";
function body(id, series, group, name = "テストモデル") {
  return {
    id,
    name,
    manufacturer: "東京マルイ",
    category: "本体",
    series,
    url: `https://www.tokyo-marui.co.jp/products/${group}/1`,
    images: [png],
    dimensions: [],
    lengthMm: null,
    checkedAt: "",
  };
}
const examples = [
  body("standard", "電動ガン スタンダードタイプ", "electric/standard"),
  body("gas", "ガスブローバック", "gas/blowback"),
  body("air10", "エアーハンドガン(10才用モデル)", "aircocking/handgun10"),
  body("air18", "エアーハンドガン(18才用モデル)", "aircocking/handgun18"),
  body("hc", "電動ガン ハイサイクルカスタム", "electric/highcycle"),
  body("next", "次世代電動ガン", "electric/nextgeneration"),
  body("ebb", "電動ブローバック", "electric/blowback"),
  body("ebba", "電動ブローバック フルオート", "electric/blowbackauto"),
  body("boys", "電動ガンBOYs", "electric/boys"),
  body("light", "電動ガン ライトプロ", "electric/lightpro"),
  body("ehg", "電動ガン ハンドガンタイプ", "electric/handgun"),
  body("fixed", "固定スライドガスガン", "gas/slide"),
];
for (const [suffix, id] of [
  ["電動ガン スタンダード", "standard"],
  ["ガスガン GBB", "gas"],
  ["ガスブロ", "gas"],
  ["エアコキ 10歳以上", "air10"],
  ["エアコキ 10禁", "air10"],
  ["エアコキ 18禁", "air18"],
  ["エアコッキング 18才以上", "air18"],
  ["ハイサイクル", "hc"],
  ["HC", "hc"],
  ["次世代電動ガン", "next"],
  ["NGRS", "next"],
  ["電動ブローバック", "ebb"],
  ["電動ブローバック フルオート", "ebba"],
  ["電動ガン BOYS", "boys"],
  ["電動ガン ライトプロ", "light"],
  ["電動ハンドガン", "ehg"],
  ["固定スライドガスガン", "fixed"],
]) {
  test(`variant evidence chooses ${id}: ${suffix}`, () => {
    const title = "東京マルイ テストモデル " + suffix;
    assert.equal(matchCatalog(title, examples)?.product.id, id);
    assert.equal(
      matchCatalog(
        title,
        examples.filter((p) => p.id !== id),
      ),
      null,
      "missing edition must not fall back",
    );
  });
}
test("unknown or contradictory firing systems remain unlinked", () => {
  for (const title of [
    "東京マルイ テストモデル",
    "東京マルイ テストモデル ガスガン 電動ガン",
    "東京マルイ テストモデル 10歳 18歳",
    "東京マルイ テストモデル ハイサイクル 次世代",
  ])
    assert.equal(matchCatalog(title, examples), null, title);
});
test("JAN and manufacturer numbers do not override explicit mechanism and age conflicts", () => {
  const p = {
    ...examples.find((p) => p.id === "standard"),
    janCodes: ["4952839171153"],
    modelNumbers: ["TEST123"],
  };
  for (const ids of [
    { janCodes: p.janCodes, modelNumbers: [] },
    { janCodes: [], modelNumbers: p.modelNumbers },
  ]) {
    assert.equal(
      matchCatalog("東京マルイ テストモデル ガスガン", [p], ids),
      null,
    );
    assert.equal(matchCatalog("商品", [p], ids)?.product.id, p.id);
  }
  const young = {
    ...examples.find((p) => p.id === "air10"),
    janCodes: p.janCodes,
  };
  assert.equal(
    matchCatalog("東京マルイ テストモデル エアコキ18歳", [young], {
      janCodes: p.janCodes,
      modelNumbers: [],
    }),
    null,
  );
  assert.equal(
    resolveCatalogMatch(
      { name: "東京マルイ テストモデル ガスガン" },
      { name: "商品", identifiers: { janCodes: p.janCodes, modelNumbers: [] } },
      [p],
    ),
    null,
  );
});
test("generations and CO2 variants never inherit a different edition", () => {
  const first = body(
    "g3",
    "ガスブローバック",
    "gas/blowback",
    "グロック17 Gen.3",
  );
  const fourth = body(
    "g4",
    "ガスブローバック",
    "gas/blowback",
    "グロック17 Gen.4",
  );
  assert.equal(
    matchCatalog("東京マルイ グロック17 Gen4 ガスガン", [first, fourth])
      ?.product.id,
    "g4",
  );
  assert.equal(
    matchCatalog("東京マルイ グロック17Gen4 ガスガン", [first]),
    null,
  );
  assert.equal(
    bodyVariantCompatible("東京マルイ グロック17 CO2 ガスガン", fourth),
    false,
  );
  assert.equal(
    bodyVariantCompatible("東京マルイ グロック17 Gen3", fourth),
    false,
  );
});
test("real catalog body names with published series never choose another product", () => {
  for (const p of bodies) {
    const title = `東京マルイ ${p.name} ${p.series || ""}`;
    const result = matchCatalog(title, catalog);
    if (result) assert.equal(result.product.id, p.id, title);
  }
});

test("real G36C variants stay ambiguous without the series and resolve with sufficient evidence", () => {
  assert.equal(matchCatalog("東京マルイ G36C 電動ガン", catalog), null);
  for (const [name, id] of [
    ["東京マルイ H&K G36C スタンダード 電動ガン", "marui-body-22"],
    ["東京マルイ G36C BOYS", "marui-body-46"],
    ["東京マルイ H&K G36C ライトプロ", "marui-body-297"],
    ["東京マルイ G36Cカスタム 次世代電動ガン", "marui-body-263"],
  ])
    assert.equal(matchCatalog(name, catalog)?.product.id, id, name);
});
