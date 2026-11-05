import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRakuten,
  searchParams,
  rakutenProductUrl,
} from "../lib/rakuten.ts";
import { purchaseLink } from "../lib/commerce.ts";

const product = {
  itemCode: "shop:123",
  itemName: "マイクロプロサイト",
  itemPrice: 9800,
  shopName: "ショップ",
  itemUrl: "https://item.rakuten.co.jp/shop/item/",
  mediumImageUrls: [
    {
      imageUrl:
        "https://thumbnail.image.rakuten.co.jp/@0_mall/shop/cabinet/item.jpg?_ex=128x128",
    },
  ],
};
test("Rakuten thumbnails keep their supplied URL and preserve all photo choices", () => {
  const data = normalizeRakuten({
    items: [product],
    count: 1,
    page: 1,
    pageCount: 1,
  });
  assert.equal(data.items[0].image, product.mediumImageUrls[0].imageUrl);
  assert.deepEqual(data.items[0].images, [product.mediumImageUrls[0].imageUrl]);
  assert.equal(data.items[0].productUrl, product.itemUrl);
  assert.equal(data.items[0].price, 9800);
  assert.equal(data.items[0].sponsored, false);
  assert.equal("src" in data.items[0], false);
  assert.equal(
    normalizeRakuten({ Items: [{ Item: product }] }).items.length,
    1,
  );
});
test("only actual Rakuten product destinations are used for gallery lookup", () => {
  const target = "https://item.rakuten.co.jp/shop/item/";
  assert.equal(
    rakutenProductUrl(
      `https://hb.afl.rakuten.co.jp/hgc/test/?pc=${encodeURIComponent(target)}`,
    ),
    target,
  );
  for (const url of [
    "https://hb.afl.rakuten.co.jp/hgc/test/?pc=https%3A%2F%2Flocalhost%2F",
    "https://item.rakuten.co.jp.evil.example/shop/item/",
    "https://hb.afl.rakuten.co.jp/hgc/test/?pc=https%3A%2F%2Fexample.com%2F",
    "https://item.rakuten.co.jp/",
    "javascript:alert(1)",
  ])
    assert.equal(rakutenProductUrl(url), "");
  const images = [
    product.mediumImageUrls[0].imageUrl,
    "https://image.rakuten.co.jp/shop/cabinet/second.jpg",
    "https://image.rakuten.co.jp/shop/cabinet/third.jpg",
  ];
  const item = normalizeRakuten({
    items: [
      {
        ...product,
        mediumImageUrls: [
          ...images,
          "https://image.rakuten.co.jp/shop/cabinet/fourth.jpg",
        ],
      },
    ],
  }).items[0];
  assert.deepEqual(item.images, images);
});
test("API-issued affiliate URLs stay intact and have advertising attribution", () => {
  const affiliateUrl =
    "https://hb.afl.rakuten.co.jp/hgc/example/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fshop%2Fitem%2F";
  const result = normalizeRakuten({ items: [{ ...product, affiliateUrl }] })
    .items[0];
  assert.equal(result.url, affiliateUrl);
  assert.equal(result.sponsored, true);
  assert.equal(purchaseLink(result.url).sponsored, true);
  assert.equal(purchaseLink("https://afl.rakuten.co.jp.evil.example/"), null);
});
test("untrusted or malformed product links and thumbnails cannot become cards", () => {
  for (const patch of [
    { itemUrl: "javascript:alert(1)" },
    { itemUrl: "https://item.rakuten.co.jp.evil.example/" },
    { mediumImageUrls: [{ imageUrl: "https://localhost/a.jpg" }] },
    { itemPrice: -1 },
  ]) {
    assert.equal(
      normalizeRakuten({ items: [{ ...product, ...patch }] }).items.length,
      0,
    );
  }
  assert.throws(() => normalizeRakuten({ error: "auth error" }));
});
test("keyword size, pagination and sorting are checked before contacting Rakuten", () => {
  assert.deepEqual(
    searchParams(
      new URLSearchParams({
        q: "  東京マルイ   サイト ",
        page: "2",
        sort: "+itemPrice",
      }),
    ),
    { keyword: "東京マルイ サイト", page: 2, sort: "+itemPrice" },
  );
  for (const values of [
    { q: "" },
    { q: "あ".repeat(43) },
    { q: "site", page: "101" },
    { q: "site", page: "1.5" },
    { q: "site", sort: "unknown" },
  ])
    assert.throws(() => searchParams(new URLSearchParams(values)));
});
