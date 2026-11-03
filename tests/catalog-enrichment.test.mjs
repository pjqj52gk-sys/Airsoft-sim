import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { matchCatalog, strongestCatalogMatch } from "../lib/catalog-match.ts";
import { primaryProductMetadata } from "../lib/product-metadata.ts";
import {
  productIdentifiers,
  productDimensions,
  referenceLengthOptions,
  combinedReferenceLength,
} from "../lib/product-specs.ts";
import { extractShopProduct } from "../lib/shop-product.ts";
const catalog = JSON.parse(
  fs.readFileSync(new URL("../lib/parts-catalog.json", import.meta.url)),
);
test("retailer examples across four manufacturers resolve to the reviewed product or stay unlinked", () => {
  const fixtures = JSON.parse(
    fs.readFileSync(
      new URL("./fixtures/retailer-matching.json", import.meta.url),
    ),
  );
  for (const row of fixtures)
    assert.equal(
      matchCatalog(row.title, catalog, row.identifiers)?.product.id || null,
      row.expectedId,
      row.url,
    );
});
const json = (value) =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

test("primary product JSON-LD and Rakuten microdata provide identifiers, without treating shop SKU or recommendations as manufacturer codes", () => {
  const primary = {
    "@type": "Product",
    name: "current",
    gtin13: "4570189741422",
    mpn: "SCRD-12II",
    sku: "shop-999",
    isRelatedTo: { "@type": "Product", gtin13: "4952839142962" },
  };
  const page = json({
    "@graph": [
      {
        "@type": "ItemList",
        itemListElement: [{ "@type": "Product", gtin13: "4952839142962" }],
      },
      primary,
    ],
  });
  assert.deepEqual(productIdentifiers("current", page), {
    janCodes: ["4570189741422"],
    modelNumbers: ["SCRD-12II"],
  });
  assert.deepEqual(
    productIdentifiers(
      "current",
      '<meta content="4952839142962" itemprop="gtin13">',
    ),
    { janCodes: ["4952839142962"], modelNumbers: [] },
  );
  assert.equal(
    primaryProductMetadata(
      json({ "@type": "ItemList", itemListElement: [primary] }),
    ),
    null,
  );
  const graph = json([
    primary,
    {
      "@type": "Product",
      url: "https://example.com/other",
      gtin13: "4952839142962",
    },
  ]);
  assert.equal(primaryProductMetadata(graph), null);
  assert.deepEqual(
    productIdentifiers(
      "current",
      json({ "@type": "Product", sku: "SCRD-12II" }),
    ),
    { janCodes: [], modelNumbers: [] },
  );
});

test("the URL identifies the main product among multiple Product nodes and transfers JSON-LD dimensions", () => {
  const url = "https://example.com/current/";
  const html = json({
    "@graph": [
      {
        "@type": "Product",
        url: "https://example.com/other/",
        gtin13: "4952839142962",
      },
      {
        "@type": "Product",
        url,
        name: "current",
        mpn: "ABC-123",
        description: "全長80.3 / 87.8cm",
        width: { value: 25, unitCode: "MMT" },
      },
    ],
  });
  const product = extractShopProduct(html, url);
  assert.deepEqual(product.identifiers, {
    janCodes: [],
    modelNumbers: ["ABC-123"],
  });
  assert.ok(
    product.dimensions.some((d) => d.label === "幅" && d.value === "25 mm"),
  );
  assert.deepEqual(
    referenceLengthOptions([], product.dimensions)
      .filter((o) => o.label.includes("全長"))
      .map((o) => o.mm),
    [803, 878],
  );
});

test("model punctuation and full width variants match while model suffixes and compatibility-only mentions remain distinct", () => {
  for (const title of [
    "ベクターオプティクス scrd12ii",
    "Vector Optics ＳＣＲＤ－１２ＩＩ",
    "Vector Optics SCRD 12 II",
  ]) {
    assert.equal(
      matchCatalog(title, catalog)?.product.modelNumbers?.[0],
      "SCRD-12II",
      title,
    );
  }
  assert.equal(matchCatalog("SCRD12III", catalog), null);
  assert.equal(
    matchCatalog("Vector Optics SCRD-F19ll Frenzy2 1x17x24 FDE", catalog),
    null,
  );
  for (const title of ["SCRD12II用カバー", "SCRD-12II 対応マウント"]) {
    assert.equal(
      matchCatalog(title, catalog, {
        janCodes: [],
        modelNumbers: ["SCRD12II"],
      }),
      null,
      title,
    );
  }
});

test("shared vocabulary, manufacturer, and series distinguish actual retailer body names", () => {
  for (const title of [
    "東京マルイ 18歳以上用ガスブローバックハンドガン Glock17 Gen.4 【あす楽】",
    "あす楽対応/東京マルイ グロック17 Gen.4 ガスブローバック GEN4",
  ])
    assert.equal(
      matchCatalog(title, catalog)?.product.name,
      "グロック17 Gen.4",
      title,
    );
  const electric = matchCatalog(
    "東京マルイ GLOCK18C 電動ハンドガン",
    catalog,
  )?.product;
  const gas = matchCatalog(
    "東京マルイ GLOCK18C ガスブローバック",
    catalog,
  )?.product;
  assert.ok(electric?.url.includes("/electric/handgun/"));
  assert.ok(gas?.url.includes("/gas/"));
  assert.equal(matchCatalog("東京マルイ GLOCK18C", catalog), null);
  assert.equal(
    matchCatalog("ノーベルアームズ コンバット T1 EVO 軽量化タイプ", catalog)
      ?.product.name,
    "COMBAT T1 EVO",
  );
});

test("JAN and manufacturer MPN evidence outrank a name candidate and equal conflicting evidence stays unlinked", () => {
  const [a, b] = catalog;
  assert.equal(
    strongestCatalogMatch(
      { product: a, method: "name" },
      { product: b, method: "jan" },
    ).product.id,
    b.id,
  );
  assert.equal(
    strongestCatalogMatch(
      { product: a, method: "model" },
      { product: b, method: "model" },
    ),
    null,
  );
  assert.equal(
    strongestCatalogMatch({ product: a, method: "jan" }, null).product.id,
    a.id,
  );
});

test("dimensions retain units, conditions and explicitly labelled axes without guessing unlabelled size order", () => {
  assert.equal(
    combinedReferenceLength(
      [{ label: "全長", value: "68.00 mm", kind: "product" }],
      [{ label: "長さ", value: "6.8cm", kind: "product" }],
      68,
    ),
    68,
  );
  assert.equal(
    combinedReferenceLength(
      [{ label: "全長", value: "68.00 mm", kind: "product" }],
      [{ label: "長さ", value: "70mm", kind: "product" }],
      68,
    ),
    undefined,
  );
  assert.deepEqual(
    referenceLengthOptions(
      productDimensions("全長：８０．３～８７．８ｃｍ（ストック伸長時）"),
    ).map((o) => o.mm),
    [803, 878],
  );
  const dims = referenceLengthOptions([
    { label: "サイズ", value: "W46 × H27 × D30mm", kind: "product" },
  ]);
  assert.deepEqual(
    dims.map((o) => o.mm),
    [46, 27, 30],
  );
  assert.ok(dims[0].label.includes("幅"));
  assert.deepEqual(
    referenceLengthOptions([
      { label: "サイズ", value: "46×27×30mm", kind: "product" },
    ]),
    [],
  );
  const a = [
    {
      label: "全長",
      value: "803 mm / 878 mm（ストック伸長時）",
      kind: "product",
    },
  ];
  const b = [
    {
      label: "全長",
      value: "803 mm / 878 mm(ストック伸長時)",
      kind: "product",
    },
  ];
  assert.equal(combinedReferenceLength(a, b), undefined);
  assert.deepEqual(
    referenceLengthOptions(a, b).map((o) => o.mm),
    [803, 878],
  );
});

test("expanded official catalog covers multiple Marui body families and preserves all current official galleries", () => {
  for (const family of [
    "/electric/standard/",
    "/electric/nextgeneration/",
    "/gas/blowback/",
    "/gas/machinegun/",
    "/aircocking/boltaction/",
  ]) {
    const items = catalog.filter((p) => p.url.includes(family));
    assert.ok(items.length > 2, family);
    assert.ok(
      items.every((p) => p.images.length && p.dimensions.length && p.series),
    );
  }
  assert.equal(new Set(catalog.map((p) => p.id)).size, catalog.length);
});
