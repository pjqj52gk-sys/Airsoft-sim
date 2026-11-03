import test from "node:test";
import assert from "node:assert/strict";
import {
  publishedPrice,
  maruiPrice,
  variantPrice,
  referenceCatalogPrice,
  catalogPriceLabel,
} from "../lib/catalog-price.ts";
import { novelProduct, vectorProduct } from "../lib/official-catalog.mjs";
test("manufacturer prices preserve tax basis and convert exclusive prices for the budget", () => {
  const price = maruiPrice(
    "<p>メーカー希望小売価格：<strong>￥6,800</strong><span>（税別）</span></p>",
  );
  assert.equal(price.amount, 6800);
  assert.equal(price.tax, "excluded");
  assert.equal(referenceCatalogPrice(price), 7480);
  assert.match(catalogPriceLabel(price), /7,480（税込換算）/);
  const included = publishedPrice("価格", "￥21,450.-（税込）");
  assert.equal(referenceCatalogPrice(included), 21450);
  assert.equal(included.tax, "included");
  assert.equal(publishedPrice("価格", "オープン価格"), null);
  assert.equal(publishedPrice("価格", "商品コード 1234"), null);
  assert.equal(publishedPrice("価格", "￥1,000〜2,000"), null);
  assert.equal(referenceCatalogPrice(null), 0);
});
test("variant prices never substitute compare-at discounts or silently pick the cheapest variant", () => {
  const single = variantPrice([{ price: "5280", compare_at_price: "6000" }]);
  assert.equal(single.amount, 5280);
  assert.equal(single.tax, "unspecified");
  const range = variantPrice([{ price: "1000" }, { price: "2000" }]);
  assert.equal(referenceCatalogPrice(range), 0);
  assert.match(catalogPriceLabel(range), /1,000〜2,000/);
  assert.equal(variantPrice([{ price: "1000" }, { price: "bad" }]), null);
});
test("optics parsers read only the labeled official product price", () => {
  const novel = novelProduct(
    '<dl class="spec"><dt>全長</dt><dd>68mm</dd><dt>価格</dt><dd>￥21,450.-（税込）</dd></dl>',
  );
  assert.equal(referenceCatalogPrice(novel.price), 21450);
  const vector = vectorProduct(
    "<dt>アイテムナンバー：</dt><dd>SCRD-12II</dd><dt>希望小売価格(税抜）：</dt><dd>9800円</dd>",
  );
  assert.equal(referenceCatalogPrice(vector.price), 10780);
  assert.equal(vector.price.tax, "excluded");
});
