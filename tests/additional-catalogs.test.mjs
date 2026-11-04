import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { shopifyCatalogProducts } from "../lib/official-shopify-catalog.mjs";
import {
  productIdentifiers,
  productDimensions,
  referenceLengthMm,
  referenceLengthOptions,
  combinedReferenceLength,
  mergeDimensions,
} from "../lib/product-specs.ts";
import { matchCatalog, resolveCatalogMatch } from "../lib/catalog-match.ts";
const catalog = JSON.parse(
  fs.readFileSync(new URL("../lib/parts-catalog.json", import.meta.url)),
);

test("published PTS abbreviations match retailer names without mixing AEG, GBB, colors or accessories", () => {
  const found = matchCatalog(
    "PTS EPF2-S バーティカルフォアグリップ BK",
    catalog,
  );
  assert.equal(found?.product.modelNumbers[0], "PT151450307");
  assert.equal(
    matchCatalog("PTS EPF2-S バーティカルフォアグリップ", catalog),
    null,
  );
  assert.equal(matchCatalog("PTS EPF2-S用カバー BK", catalog), null);
  assert.equal(matchCatalog("PTS EPG-C グリップ BK", catalog), null);
  assert.equal(
    matchCatalog("PTS EPG-C グリップ AEG BK", catalog)?.product.modelNumbers[0],
    "PT123450307",
  );
  assert.equal(
    matchCatalog("PTS EPG-C グリップ GBB BK", catalog)?.product.modelNumbers[0],
    "PT124450307",
  );
});

test("official PTS manufacturer MPN and KRYTAC UPC/EAN select the correct variant", () => {
  const pts = matchCatalog(
    "PTS EPG-C2 M4 AEG グリップ BK PT193450307",
    catalog,
  );
  assert.equal(pts?.product.manufacturer, "PTS");
  assert.match(pts.product.name, /Black/);
  assert.match(pts.product.images[0], /PTS-EPG-C2-01/);
  const ids = productIdentifiers("KRISS VECTOR V2", "UPC: 810172120341");
  assert.deepEqual(ids.janCodes, ["0810172120341"]);
  const body = matchCatalog("クライタック KRISS VECTOR V2 BK", catalog, ids);
  assert.equal(body?.product.manufacturer, "KRYTAC");
  assert.equal(body.product.category, "本体");
  assert.deepEqual(
    referenceLengthOptions(
      body.product.dimensions.map((d) => ({ ...d, kind: "product" })),
    ).map((o) => o.mm),
    [448.9, 669, 178],
  );
  assert.equal(matchCatalog("KRISS VECTOR V2 FDE", catalog, ids), null);
  assert.equal(matchCatalog("PTS EPG-C2 PT193450307用カバー", catalog), null);
  assert.equal(
    matchCatalog("PTS EPG-C2 PT193450307 Dark Earth", catalog),
    null,
  );
});

test("manufacturer variants preserve their own SKU, photo and geometry instead of pooling colors", () => {
  const image = (n, ids = []) => ({
    src: `https://cdn.shopify.com/s/files/1/0592/0368/2494/files/${n}.jpg`,
    variant_ids: ids,
  });
  const product = {
    id: 1,
    title: "Example Grip",
    vendor: "PTS EP Series",
    product_type: "Grips",
    handle: "example",
    body_html:
      "<p>Dimensions: 70 (L) x 41 (W) x 26 (H) mm</p><p>Packaging Size: 120 x 60 x 50 mm</p>",
    options: [{ name: "Color", values: ["Black", "Dark Earth"] }],
    variants: [
      {
        id: 1,
        title: "Black",
        sku: "PT193450307",
        featured_image: image("black", [1]),
      },
      {
        id: 2,
        title: "Dark Earth",
        sku: "PT193450313",
        featured_image: image("fde", [2]),
      },
    ],
    images: [
      image("black", [1]),
      image("fde", [2]),
      image("detail"),
      { src: "https://evil.example/photo.jpg" },
    ],
  };
  const records = shopifyCatalogProducts(product, "pts", "2026-11-04");
  assert.equal(records.length, 2);
  assert.deepEqual(records[0].modelNumbers, ["PT193450307"]);
  assert.deepEqual(records[0].images, [
    image("black").src,
    image("detail").src,
  ]);
  assert.equal(records[0].lengthMm, 70);
  assert.equal(records[0].price, null);
  assert.ok(records[0].dimensions.every((d) => !d.value.includes("120")));
  assert.deepEqual(
    shopifyCatalogProducts(
      { ...product, vendor: "Other brand" },
      "pts",
      "today",
    ),
    [],
  );
  const sizes = shopifyCatalogProducts(
    { ...product, options: [{ name: "Size", values: ["S", "L"] }] },
    "pts",
    "today",
  );
  assert.equal(sizes[0].lengthMm, null);
  assert.deepEqual(
    referenceLengthOptions(
      sizes[0].dimensions.map((d) => ({ ...d, kind: "product" })),
    ),
    [],
  );
});

test("English axes, units and Japanese stock conditions survive without using package or barrel lengths", () => {
  const dims = productDimensions(
    "<p>Overall Length: 5 inches</p><p>Barrel Length: 99mm</p><p>Rail Width: 20mm</p><p>Packaging Dimensions: 200 x 80 x 60 mm</p>",
  );
  assert.equal(referenceLengthMm(dims), 127);
  assert.deepEqual(
    referenceLengthOptions(dims).map((o) => o.mm),
    [127],
  );
  const axes = productDimensions(
    "Product Size: 202(L) x 140(W) x 48(H) mm\nPackaging Size: 263(L) x 142(W) x 50(H) mm",
  );
  assert.deepEqual(
    referenceLengthOptions(axes).map((o) => o.mm),
    [202, 140, 48],
  );
  assert.deepEqual(
    referenceLengthOptions(
      productDimensions("Dimensions: 70 x 41 x 26 mm (L x W x H)"),
    ).map((o) => o.mm),
    [70, 41, 26],
  );
  assert.deepEqual(
    referenceLengthOptions(productDimensions("Dimensions: 70 x 41 x 26 mm")),
    [],
  );
  const stock = productDimensions(
    "全長（縮めた状態）：448.9 mm 全長（伸ばした状態）：669 mm",
  );
  assert.match(referenceLengthOptions(stock)[0].label, /縮めた状態/);
  assert.equal(
    combinedReferenceLength(stock, productDimensions("全長:669mm")),
    undefined,
  );
  assert.equal(
    mergeDimensions(
      productDimensions("Width:25.4mm"),
      productDimensions("幅:2.54cm"),
    ).length,
    1,
  );
});

test("search and page identifiers complement each other and conflicting variant evidence removes an initial match", () => {
  const initial = {
    name: "PTS EPG-C2 PT193450307 BK",
    identifiers: { janCodes: [], modelNumbers: [] },
  };
  const page = {
    name: "グリップ",
    identifiers: productIdentifiers(
      "グリップ",
      "Manufacturer Part Number: PT193450307",
    ),
  };
  assert.equal(
    resolveCatalogMatch(initial, page, catalog)?.product.modelNumbers[0],
    "PT193450307",
  );
  assert.equal(
    resolveCatalogMatch(
      initial,
      { ...page, identifiers: { janCodes: [], modelNumbers: ["PT193450313"] } },
      catalog,
    ),
    null,
  );
  const official = [{ label: "幅", value: "25mm", kind: "product" }];
  assert.equal(
    combinedReferenceLength(official, productDimensions("全長:54mm")),
    54,
  );
  assert.equal(
    productIdentifiers("test", "GTIN-14: 00810172120341").janCodes[0],
    "0810172120341",
  );
  assert.deepEqual(
    productIdentifiers("test", "商品コード: PT193450307").modelNumbers,
    [],
  );
});
