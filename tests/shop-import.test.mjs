import test from "node:test";
import assert from "node:assert/strict";
import { extractShopProduct } from "../lib/shop-product.ts";
import { shopUrl, publicIPv4 } from "../lib/shop-url.ts";
import { publicAddresses } from "../lib/shop-fetch.ts";
import { amazonStore, amazonImage, purchaseLink } from "../lib/commerce.ts";

test("public shop URLs reject credentials, local networks, IP tricks and unsupported schemes", () => {
  for (const url of [
    "http://www.amazon.co.jp/dp/B000000001",
    "https://127.1/",
    "https://0x7f000001/",
    "https://2130706433/",
    "https://[::1]/",
    "https://localhost/",
    "https://metadata.google.internal/",
    "https://user:pass@www.amazon.co.jp/",
    "https://www.amazon.co.jp:8443/",
    "file:///secret",
  ])
    assert.throws(() => shopUrl(url));
  assert.equal(
    shopUrl("https://www.amazon.co.jp/dp/B000000001#images").href,
    "https://www.amazon.co.jp/dp/B000000001",
  );
  for (const ip of [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "192.0.2.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
  ])
    assert.equal(publicIPv4(ip), false, ip);
  assert.equal(publicIPv4("8.8.8.8"), true);
});
test("DNS is checked before connecting, including mixed public/private answers", async () => {
  await assert.rejects(
    publicAddresses("shop.example.com", async () => ["127.0.0.1"]),
  );
  await assert.rejects(
    publicAddresses("shop.example.com", async () => ["8.8.8.8", "10.0.0.1"]),
  );
  assert.deepEqual(
    await publicAddresses("shop.example.com", async () => ["8.8.8.8"]),
    ["8.8.8.8"],
  );
});
test("Amazon gallery selects original hiRes photos and does not evaluate JavaScript", () => {
  const html = `<title>Amazon.co.jp</title><span id="productTitle">エアガン &amp; グリップ</span><script>window.data={"colorImages":{"initial":[{"hiRes":"https://m.media-amazon.com/images/I/original.jpg","large":"https://m.media-amazon.com/images/I/small.jpg","thumb":"https://m.media-amazon.com/images/I/thumb.jpg"},{"hiRes":null,"large":"https://m.media-amazon.com/images/I/other.jpg"}]}};throw new Error('never execute');</script><table><tr><th>全長</th><td>12 cm</td></tr><tr><th>梱包サイズ</th><td>20 × 15 × 10 cm</td></tr></table>`;
  const product = extractShopProduct(
    html,
    "https://www.amazon.co.jp/dp/B000000001",
  );
  assert.equal(product.name, "エアガン & グリップ");
  assert.equal(product.referenceMm, 120);
  assert.deepEqual(product.images, [
    "https://m.media-amazon.com/images/I/original.jpg",
    "https://m.media-amazon.com/images/I/other.jpg",
  ]);
  assert.equal(
    product.dimensions.find((d) => d.label === "梱包サイズ").kind,
    "package",
  );
});
test("Shopify/JSON-LD product photos and product sizes work without a marketplace API", () => {
  const html = `<meta property="og:image" content="https://cdn.shopify.com/banner.jpg"><script type="application/ld+json">{"@graph":[{"@type":"Organization","name":"not the product"},{"@type":"Product","name":"テストストック","image":["//cdn.shopify.com/products/large.jpg",{"contentUrl":"https://cdn.shopify.com/products/side.jpg"}],"width":{"value":50,"unitCode":"MMT"},"additionalProperty":[{"name":"全長","value":22.7,"unitText":"cm"}],"offers":{"shippingDetails":{"height":"999 cm"}}}]}</script>`;
  const p = extractShopProduct(html, "https://shop.example.com/products/test");
  assert.equal(p.name, "テストストック");
  assert.equal(p.referenceMm, 227);
  assert.equal(p.images.length, 2);
  assert.ok(!p.images.some((s) => s.includes("banner")));
  assert.ok(!p.dimensions.some((d) => d.value.includes("999")));
});
test("package size never becomes the airsoft part calibration reference", () => {
  const p = extractShopProduct(
    "<title>Parts</title><table><tr><td>Package Dimensions</td><td>30 × 20 × 10 cm</td></tr></table>",
    "https://shop.example.com/item",
  );
  assert.equal(p.dimensions[0].kind, "package");
  assert.equal(p.referenceMm, undefined);
});
test("HBLT-style plain description stock lengths are retained without silently choosing the first number", () => {
  const p = extractShopProduct(
    '<title>東京マルイ Colt M4 SOPMOD</title><div class="contentBox">●全長：803 mm / 878 mm（ストック伸長時）<br>●パッケージサイズ：横860 x 縦290 x 厚100 mm</div>',
    "https://item.rakuten.co.jp/hblt/hb000022786/",
  );
  assert.ok(
    p.dimensions.some(
      (d) =>
        d.kind === "product" && d.label === "全長" && d.value.includes("878"),
    ),
  );
  assert.equal(p.referenceMm, undefined);
});
test("image URLs and page challenges cannot turn into unsafe or fabricated product results", () => {
  const p = extractShopProduct(
    `<script type="application/ld+json">{"@type":"Product","name":"safe","image":["http://127.0.0.1/a.jpg","data:image/png;base64,abc","https://cdn.example.com/picture.jpg"]}</script>`,
    "https://shop.example.com/item",
  );
  assert.deepEqual(p.images, ["https://cdn.example.com/picture.jpg"]);
  assert.throws(() =>
    extractShopProduct(
      '<title>Amazon Robot Check</title><input id="captchacharacters">',
      "https://www.amazon.co.jp/dp/B000000001",
    ),
  );
});
test("purchase links keep product sources separate from the operator affiliate tag", () => {
  assert.equal(amazonStore("https://www.amazon.co.jp/dp/B0777MMRVJ"), true);
  assert.equal(amazonStore("https://www.amazon.co.jp./dp/B0777MMRVJ"), true);
  assert.equal(amazonStore("https://www.amazon.com.be/dp/B0777MMRVJ"), true);
  assert.equal(
    amazonStore("https://www.amazon.co.jp.evil.com/dp/B0777MMRVJ"),
    false,
  );
  assert.equal(
    amazonImage("https://m.media-amazon.com/images/I/file.jpg"),
    true,
  );
  assert.equal(purchaseLink("javascript:alert(1)"), null);
  const plain = purchaseLink("https://www.amazon.co.jp/dp/B0777MMRVJ", "");
  assert.equal(plain.sponsored, false);
  const affiliate = purchaseLink(
    "https://www.amazon.co.jp/name/dp/B0777MMRVJ?tag=old-22",
    "unit-test-22",
  );
  assert.deepEqual(affiliate, {
    href: "https://www.amazon.co.jp/dp/B0777MMRVJ?tag=unit-test-22",
    sponsored: true,
  });
  assert.equal(
    purchaseLink("https://shop.example.com/item", "unit-test-22"),
    null,
  );
});

test("linked recommendations do not lend dimensions to the current product", () => {
  const p = extractShopProduct(
    `<title>KM企画 LW155</title><h3>商品スペック</h3><p>●サイズ：全長155mm/外径40mm</p><p><a href="#spec">全長155mm</a></p><h3>関連商品</h3><ul><li><a href="/military-base/other/">全長110mm 外径35mm</a></li><li><a href="https://other.example.com/item">外径25mm 全長60mm</a></li></ul>`,
    "https://item.rakuten.co.jp/military-base/h9523b155/",
  );
  assert.equal(p.referenceMm, 155);
  assert.ok(p.dimensions.some((d) => d.value.includes("40")));
  assert.ok(p.dimensions.every((d) => !/(?:110|35|25|60)/.test(d.value)));
});
