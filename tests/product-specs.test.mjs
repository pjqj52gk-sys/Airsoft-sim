import test from "node:test";
import assert from "node:assert/strict";
import {
  productIdentifiers,
  validJan,
  productDimensions,
  referenceLengthMm,
  mergeDimensions,
  combinedReferenceLength,
} from "../lib/product-specs.ts";
test("published JAN codes and manufacturer model numbers are extracted separately from shop item codes", () => {
  assert.equal(validJan("4570189741422"), true);
  assert.equal(validJan("4570189741423"), false);
  assert.deepEqual(
    productIdentifiers(
      "商品 4570189741422",
      "<p>JANコード：4570189741422</p><p>メーカー型番: ABC-123</p><p>商品コード: shop:999</p>",
    ),
    { janCodes: ["4570189741422"], modelNumbers: ["ABC-123"] },
  );
  assert.deepEqual(productIdentifiers("商品", "商品コード: 4570189741422"), {
    janCodes: [],
    modelNumbers: [],
  });
});
test("product dimensions do not inherit packaging size and compatible equipment dimensions", () => {
  const dims = productDimensions(
    "<p>■サイズ:<br>全長 約54mm<br>直径 約30mm</p><p>パッケージサイズ:100×200×40mm</p>",
  );
  assert.equal(referenceLengthMm(dims), 54);
  assert.equal(dims.find((d) => d.value.includes("200")).kind, "package");
  assert.equal(
    referenceLengthMm(productDimensions("パッケージサイズ:全長100mm")),
    undefined,
  );
  assert.equal(
    referenceLengthMm(productDimensions("対応する機器の全長100mm")),
    undefined,
  );
  assert.equal(
    referenceLengthMm(
      productDimensions("全長48mm パッケージサイズ91x140x55mm"),
    ),
    48,
  );
});
test("ranges and multiple length variants cannot silently become a single calibration value", () => {
  assert.equal(
    referenceLengthMm(productDimensions("全長:100mm～150mm")),
    undefined,
  );
  assert.equal(
    referenceLengthMm(productDimensions("■サイズ:<br>全長54mm<br>全長70mm")),
    undefined,
  );
  assert.equal(
    referenceLengthMm(productDimensions("全長(本体のみ) 24cm")),
    240,
  );
});
test("flattened shop descriptions keep package contents and rail compatibility separate from product length", () => {
  const dims = productDimensions(
    "【パッケージ内容】本体、説明書【商品仕様】20mm幅マウントレイル対応ルビーコート樹脂レンズ採用全長：48 mm重量16gパッケージサイズ：横91 x 縦140 x 厚55 mm",
  );
  assert.equal(referenceLengthMm(dims), 48);
  assert.equal(
    referenceLengthMm(
      productDimensions("マウントの幅20mmのレイルに装着が可能です。全長：48mm"),
    ),
    48,
  );
  const table = productDimensions(
    "<table><tr><td>全長</td><td>54mm</td></tr><tr><td>パッケージサイズ</td><td>100x200x40mm</td></tr></table>",
  );
  assert.equal(referenceLengthMm(table), 54);
});
test("retail dimensions fill missing official dimensions and preserve conflicts with provenance", () => {
  const official = [{ label: "全幅", value: "25mm", kind: "product" }];
  const retail = [{ label: "全長", value: "54mm", kind: "product" }];
  assert.equal(combinedReferenceLength(official, retail), 54);
  assert.deepEqual(
    mergeDimensions(official, retail).map((d) => d.source),
    ["official", "retail"],
  );
  const length = [{ label: "全長", value: "48 mm", kind: "product" }];
  const conflict = [{ label: "全長", value: "50mm", kind: "product" }];
  assert.equal(combinedReferenceLength(length, conflict, 48), undefined);
  assert.ok(mergeDimensions(length, conflict).every((d) => d.conflict));
  assert.equal(
    mergeDimensions(length, [
      { label: "全長", value: "4.8cm", kind: "product" },
    ]).length,
    1,
  );
});
