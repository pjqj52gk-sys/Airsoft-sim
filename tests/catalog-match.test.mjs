import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { findCatalogMatch, matchCatalog } from "../lib/catalog-match.ts";
const catalog = JSON.parse(
  await readFile(new URL("../lib/parts-catalog.json", import.meta.url), "utf8"),
);
test("manufacturer and exact model names link genuine products despite formatting and color abbreviations", () => {
  for (const name of [
    "東京マルイ ドットサイト マイクロプロサイト BK 【あす楽】",
    "東京マルイ マイクロプロサイト ブラック (4952839177254)",
    "TOKYO MARUI マイクロプロサイト BLACK",
  ])
    assert.equal(findCatalogMatch(name, catalog)?.id, "396");
  assert.equal(
    findCatalogMatch("東京マルイ NEW プロサイト", catalog)?.id,
    "144",
  );
  assert.equal(findCatalogMatch("東京マルイ MTD", catalog)?.id, "456");
});
test("related mounting accessories use their own catalog entry rather than the sight dimensions", () => {
  assert.equal(
    findCatalogMatch(
      "東京マルイ マイクロプロサイト用 ミドル/ハイマウント",
      catalog,
    )?.id,
    "405",
  );
  assert.equal(
    findCatalogMatch("東京マルイ グロック用マイクロプロサイトマウント", catalog)
      ?.id,
    "397",
  );
  assert.equal(
    findCatalogMatch(
      "東京マルイ LEDプロライト用リモートスイッチキット",
      catalog,
    )?.id,
    "363",
  );
});
test("unconfirmed variants, third party accessories, compatibility mentions and bundles stay unlinked", () => {
  for (const name of [
    "マイクロプロサイト ブラック",
    "東京マルイ マイクロプロサイト FDE",
    "東京マルイ マイクロプロサイト ホワイト",
    "東京マルイ マイクロプロサイト",
    "東京マルイ マイクロプロサイト BK レプリカ",
    "東京マルイ マイクロプロサイト用カバー ブラック",
    "東京マルイ マイクロプロサイト BK マウントセット",
    "東京マルイ M4対応 タクティカルバイポッド",
    "FMA製 東京マルイ タクティカルバイポッド",
    "東京マルイ対応 マイクロプロサイト BK",
  ])
    assert.equal(findCatalogMatch(name, catalog), null, name);
});
test("equally plausible catalog entries cannot silently choose one", () => {
  const product = catalog.find((item) => item.id === "396");
  assert.equal(
    findCatalogMatch("東京マルイ マイクロプロサイト BK", [
      product,
      { ...product, id: "duplicate" },
    ]),
    null,
  );
});
test("official LAYLAX JAN and published model identifiers can match without guessing a name", () => {
  const product = catalog.find(
    (p) => p.manufacturer === "LAYLAX" && p.janCodes?.length,
  );
  assert.ok(product);
  assert.equal(
    matchCatalog("商品", catalog, {
      janCodes: [product.janCodes[0]],
      modelNumbers: [],
    })?.method,
    "jan",
  );
  assert.equal(
    matchCatalog("商品", [{ ...product, modelNumbers: ["ABC-123"] }], {
      janCodes: [],
      modelNumbers: ["ABC-123"],
    })?.method,
    "model",
  );
  assert.equal(
    matchCatalog("商品", [product, { ...product, id: "duplicate" }], {
      janCodes: [product.janCodes[0]],
      modelNumbers: [],
    }),
    null,
  );
});
