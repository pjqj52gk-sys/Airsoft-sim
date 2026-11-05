import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import {
  conciseProductName,
  groupEcProducts,
  productDisplayName,
} from "../lib/ec-products.ts";
const jan = "4952839176257";
const offer = (id, name, options = {}) => ({
  id,
  name,
  shop: id,
  price: 5000,
  image: "https://example.com/image.jpg",
  images: [],
  productUrl: "https://item.rakuten.co.jp/shop/" + id + "/",
  url: "https://item.rakuten.co.jp/shop/" + id + "/",
  sponsored: true,
  identifiers: { janCodes: [jan], modelNumbers: [] },
  dimensions: [],
  ...options,
});
test("sale copy is removed while model, generation, color, age and kit contents remain", () => {
  assert.equal(
    conciseProductName(
      "【11/5限定★抽選で2人に1人最大100%ポイントバック!要エントリー】東京マルイ P90プラス ブラック【対象年齢18歳以上】",
    ),
    "東京マルイ P90プラス ブラック【対象年齢18歳以上】",
  );
  assert.equal(
    conciseProductName(
      "【全力価格!】Vector Optics SCRD-12II Gen II TAN セット【あす楽】",
    ),
    "Vector Optics SCRD-12II Gen II TAN セット",
  );
  assert.equal(conciseProductName("【送料無料】"), "【送料無料】");
  assert.equal(
    conciseProductName("【セール SCRD-12 ブラック】"),
    "【セール SCRD-12 ブラック】",
  );
});
test("same JAN and variant combine shops, preserve original offers and order prices without mutating input", () => {
  const a = offer("a", "【送料無料】東京マルイ サイト ブラック", {
    price: 7000,
  });
  const b = offer("b", "東京マルイ サイト BK", {
    price: 6000,
    productUrl: "https://store.shopping.yahoo.co.jp/shop/b.html",
  });
  const groups = groupEcProducts([a, b]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].offers, [b, a]);
  assert.equal(a.name, "【送料無料】東京マルイ サイト ブラック");
});
test("colors, power systems, P90 Plus, highcycle, generations and packages never collapse even with a reused JAN", () => {
  const names = [
    "東京マルイ P90 電動ガン",
    "東京マルイ P90プラス 電動ガン",
    "東京マルイ P90 ハイサイクル 電動ガン",
    "東京マルイ P90 ガスガン",
    "東京マルイ P90 エアコッキング",
    "東京マルイ P90 電動ガン TAN",
    "東京マルイ P90 電動ガン Gen II",
    "東京マルイ P90 電動ガン セット",
    "東京マルイ P90 電動ガン マガジンセット",
    "東京マルイ P90用マウント",
    "東京マルイ P90 電動ガン 中古",
  ];
  assert.equal(
    groupEcProducts(names.map((name, i) => offer(String(i), name))).length,
    names.length,
  );
});
test("unknown identities, conflicting model numbers and multiple barcodes remain separate", () => {
  const a = offer("a", "ドットサイト", {
    identifiers: { janCodes: [], modelNumbers: [] },
  });
  assert.equal(
    groupEcProducts([a, { ...a, id: "b", productUrl: a.productUrl + "b" }])
      .length,
    2,
  );
  const b = offer("b", "サイト", {
    identifiers: { janCodes: [jan], modelNumbers: ["SCRD-12"] },
  });
  const c = offer("c", "サイト", {
    identifiers: { janCodes: [jan], modelNumbers: ["SCRD-38"] },
  });
  assert.equal(groupEcProducts([b, c]).length, 2);
  const d = offer("d", "サイト", {
    identifiers: { janCodes: [jan, "4952839176202"], modelNumbers: [] },
  });
  assert.equal(
    groupEcProducts([d, { ...d, id: "e", productUrl: d.productUrl + "e" }])
      .length,
    2,
  );
});
test("exact official model matches provide a concise manufacturer name; fuzzy names do not authorize merging", () => {
  const official = {
    id: "scrd",
    name: "Maverick 1×22",
    manufacturer: "Vector Optics",
    category: "光学機器",
    modelNumbers: ["SCRD-12"],
    janCodes: [],
    images: [],
    url: "https://www.vectoroptics.jp/scrd-12/",
    dimensions: [],
    lengthMm: null,
    checkedAt: "2026-11-05",
  };
  const a = offer("a", "Vector Optics SCRD-12 Maverick ブラック", {
    identifiers: { janCodes: [], modelNumbers: ["SCRD-12"] },
  });
  const b = offer("b", "Vector Optics SCRD-12 BK", {
    identifiers: { janCodes: [], modelNumbers: ["SCRD-12"] },
  });
  const groups = groupEcProducts([a, b], [official]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "Vector Optics Maverick 1×22 ブラック");
  assert.equal(groups[0].official, official);
});
test("repeated product URLs are deduplicated and price ordering uses each group's lowest listed product price", () => {
  const a = offer("a", "サイト BK", { price: 9000 });
  const b = offer("b", "サイト TAN", { price: 2000 });
  assert.equal(groupEcProducts([a, a, b]).length, 2);
  assert.equal(groupEcProducts([a, b], [], "+itemPrice")[0].offers[0], b);
  assert.equal(groupEcProducts([a, b], [], "-itemPrice")[0].offers[0], a);
});

test("equivalent generation notation merges without adding a duplicate generation to the title", () => {
  const a = offer("g1", "Vector SCRD-12II Gen2 ブラック", {
    identifiers: { janCodes: [], modelNumbers: ["SCRD-12II"] },
  });
  const b = offer("g2", "Vector SCRD-12II Gen II BK", {
    identifiers: { janCodes: [], modelNumbers: ["SCRD-12II"] },
  });
  const c = {
    id: "gen2",
    name: "Maverick Gen II",
    manufacturer: "Vector",
    category: "光学機器",
    modelNumbers: ["SCRD-12II"],
    janCodes: [],
    images: [],
    url: "https://www.vectoroptics.jp/scrd-12ii/",
    dimensions: [],
    lengthMm: null,
    checkedAt: "2026-11-05",
  };
  const groups = groupEcProducts([a, b], [c]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "Vector Maverick Gen II ブラック");
});

test("a unique catalog-name match uses the official display name without merging uncertain offers", () => {
  const catalog = JSON.parse(
    fs.readFileSync(
      new URL("../lib/parts-catalog.json", import.meta.url),
      "utf8",
    ),
  );
  const a = offer(
    "name-a",
    "【送料無料】東京マルイ マイクロプロサイト ブラック ドットサイト",
    { identifiers: { janCodes: [], modelNumbers: [] } },
  );
  const b = offer("name-b", "東京マルイ マイクロプロサイト BK", {
    identifiers: { janCodes: [], modelNumbers: [] },
  });
  const groups = groupEcProducts([a, b], catalog);
  assert.equal(groups.length, 2);
  for (const group of groups) {
    assert.equal(group.official?.id, "396");
    assert.equal(group.name, "東京マルイ マイクロプロサイト ブラック");
  }
  assert.equal(productDisplayName(a.name, groups[0].official), groups[0].name);
});
test("official display names never hide bundled contents or replace unknown products", () => {
  const official = {
    name: "マイクロプロサイト ブラック",
    manufacturer: "東京マルイ",
  };
  const title = "東京マルイ マイクロプロサイト ブラック 予備マガジンセット";
  assert.equal(productDisplayName(title, official), title);
  assert.equal(
    productDisplayName("【送料無料】不明なドットサイト"),
    "不明なドットサイト",
  );
});

test("official accessory names also apply when compatibility wording prevents offer grouping", () => {
  const catalog = JSON.parse(
    fs.readFileSync(
      new URL("../lib/parts-catalog.json", import.meta.url),
      "utf8",
    ),
  );
  const item = offer(
    "mount",
    "【送料無料】東京マルイ マイクロプロサイト用 ミドル/ハイマウント",
    { identifiers: { janCodes: [], modelNumbers: [] } },
  );
  const groups = groupEcProducts([item], catalog);
  assert.equal(groups[0].official?.id, "405");
  assert.equal(
    groups[0].name,
    "東京マルイ マイクロプロサイト用 ミドル/ハイマウント",
  );
});
