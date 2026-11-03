import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { matchCatalog } from "../lib/catalog-match.ts";
import { productPhotos } from "../lib/catalog-photos.mjs";
const catalog = JSON.parse(
  fs.readFileSync(new URL("../lib/parts-catalog.json", import.meta.url)),
);
test("SOPMOD M4 translated and reordered retailer names match the same official body without matching URG-I or accessories", () => {
  for (const title of [
    "【楽天市場】東京マルイ Colt M4 SOPMOD｜No.03（次世代電動ガン）：HBLT",
    "東京マルイ SOPMOD M4 次世代電動ガン",
    "東京マルイ ソップモッドM4 次世代電動ガン",
  ])
    assert.equal(matchCatalog(title, catalog)?.product.id, "marui-body-201");
  assert.equal(matchCatalog("東京マルイ M4 SOPMOD用マガジン", catalog), null);
  assert.equal(matchCatalog("東京マルイ SOPMOD M4", catalog), null); // BOYs and next-generation have different dimensions.
  assert.notEqual(
    matchCatalog("東京マルイ URG-I SOPMOD M4 ブロック3", catalog)?.product.id,
    "marui-body-201",
  );
});
test("the reported Rakuten HK416 black item links to its official body, excluding the tan variant and compatible accessories", () => {
  const found = matchCatalog(
    "東京マルイ HK416 デルタカスタム ブラック No.25 [次世代電動ガン(対象年令18才以上)]",
    catalog,
  );
  assert.equal(found?.product.id, "marui-body-457");
  assert.equal(found.product.category, "本体");
  assert.ok(
    found.product.images.every((s) =>
      s.startsWith("https://www.tokyo-marui.co.jp/appimg/product/"),
    ),
  );
  assert.equal(found.product.lengthMm, null); // Retracted/extended lengths must be chosen by the user.
  assert.notEqual(
    matchCatalog("東京マルイ HK416 デルタカスタム", catalog)?.product.id,
    "marui-body-457",
  );
  assert.equal(
    matchCatalog(
      "東京マルイ HK416 デルタカスタム ブラック用ハンドガード",
      catalog,
    ),
    null,
  );
});
test("gun body galleries use original product photos and exclude promotional and thumbnail images", () => {
  const base = "https://www.tokyo-marui.co.jp/appimg/product/";
  const html = `<meta property="og:image" content="${base}banner.jpg"><ul class="products-Slider_List"><li><img src="${base}p_sub1.jpg"></li></ul><ul class="products-Slider_Menu"><li><img src="${base}small.jpg"></li></ul>`;
  assert.deepEqual(productPhotos(html), [base + "p_sub1.jpg"]);
});
