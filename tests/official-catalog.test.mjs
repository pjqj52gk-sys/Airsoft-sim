import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { novelProduct, vectorProduct } from "../lib/official-catalog.mjs";
import { matchCatalog } from "../lib/catalog-match.ts";
test("official galleries exclude logos, related items and thumbnail images", () => {
  const n = novelProduct(
    '<h1 class="entry-title">COMBAT T1 EVO</h1><img src="https://novelarms.co.jp/wp-content/uploads/logo.jpg"><div class="slideslider_item"><img data-src="https://novelarms.co.jp/wp-content/uploads/2020/original.jpg"></div><div class="thumbnails_item"><img src="https://novelarms.co.jp/wp-content/uploads/2020/original-288x196.jpg"></div><dl class="spec"><dt>全長</dt><dd>68.00 mm</dd><dt>重量</dt><dd>161g</dd></dl>',
  );
  assert.deepEqual(n.images, [
    "https://novelarms.co.jp/wp-content/uploads/2020/original.jpg",
  ]);
  assert.deepEqual(n.dimensions, [{ label: "全長", value: "68.00 mm" }]);
  const v = vectorProduct(
    '<h1 class="entry_title">Maverick 1&#215;22</h1><dt>アイテムナンバー：</dt><dd>SCRD-12II</dd><a href="https://www.vectoroptics.jp/wp-content/uploads/1.jpg" data-lightbox="group"><img src="thumb.jpg"></a><tr><th>全長</th><td>68mm</td></tr>',
  );
  assert.equal(v.name, "Maverick 1×22");
  assert.deepEqual(v.modelNumbers, ["SCRD-12II"]);
  assert.equal(v.dimensions[0].value, "68mm");
  assert.equal(v.images.length, 1);
});
test("published Vector model in retailer title matches exactly, with compatibility-only titles excluded", () => {
  const c = JSON.parse(
    fs.readFileSync(new URL("../lib/parts-catalog.json", import.meta.url)),
  );
  const hit = matchCatalog("ベクターオプティクス SCRD-12II Maverick Gen2", c);
  assert.equal(hit?.method, "model");
  assert.equal(hit.product.manufacturer, "Vector Optics");
  assert.equal(matchCatalog("SCRD-12II用カバー", c), null);
  assert.equal(matchCatalog("SCRD-12III", c), null);
  assert.equal(
    matchCatalog("NOVEL ARMS COMBAT T1 EVO", c)?.product.manufacturer,
    "NOVEL ARMS",
  );
});
