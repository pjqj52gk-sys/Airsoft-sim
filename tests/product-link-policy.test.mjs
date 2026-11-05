import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  approvedProductUrl,
  safeImportedProductUrl,
} from "../lib/product-link-policy.ts";
import { parseProject } from "../lib/project.ts";
import { validateSubmission } from "../lib/community.ts";
import { purchaseLink } from "../lib/commerce.ts";
const png = "data:image/png;base64,eA==";
const layer = {
  id: "base",
  name: "本体",
  src: png,
  width: 100,
  height: 50,
  mm: 800,
  x: 120,
  y: 190,
  price: 0,
  rotation: 0,
  flip: false,
  visible: true,
  url: "",
  category: "本体",
};
test("all current catalog links and archived product paths remain valid without requiring a saved database record", () => {
  const catalog = JSON.parse(
    fs.readFileSync(
      new URL("../lib/parts-catalog.json", import.meta.url),
      "utf8",
    ),
  );
  for (const item of catalog) assert.ok(approvedProductUrl(item.url), item.url);
  assert.equal(
    approvedProductUrl(
      "https://www.tokyo-marui.co.jp/products/electric/nextgeneration/9999",
    ),
    "https://www.tokyo-marui.co.jp/products/electric/nextgeneration/9999",
  );
});
test("manual links accept canonical marketplace products and remove competing affiliate IDs or forwarding parameters", () => {
  const item = "https://item.rakuten.co.jp/shop/item/?sku_id=123";
  assert.equal(
    approvedProductUrl(item + "&redirect=https://evil.com&rafcid=other", true),
    item,
  );
  const wrapped =
    "https://hb.afl.rakuten.co.jp/hgc/other/?pc=" +
    encodeURIComponent(item) +
    "&m=" +
    encodeURIComponent("https://evil.com");
  assert.equal(approvedProductUrl(wrapped), item);
  assert.equal(
    approvedProductUrl(
      "https://www.amazon.co.jp/gp/product/B0777MMRVJ?tag=other-22",
      true,
    ),
    "https://www.amazon.co.jp/dp/B0777MMRVJ",
  );
  assert.ok(purchaseLink(wrapped).href.startsWith("/api/rakuten/link?"));
  assert.ok(
    purchaseLink(
      "https://store.shopping.yahoo.co.jp/shop/item.html?sc_i=other",
    ).href.startsWith("/api/yahoo/link?"),
  );
});
test("unknown sites, private addresses, credential tricks, non-product paths, unsafe protocols and opaque short URLs are not clickable", () => {
  for (const input of [
    "https://evil.com/item",
    "https://localhost/item",
    "https://127.0.0.1/item",
    "javascript:alert(1)",
    "data:text/html,x",
    "https://item.rakuten.co.jp.evil.com/shop/item/",
    "https://user:pass@item.rakuten.co.jp/shop/item/",
    "https://item.rakuten.co.jp:444/shop/item/",
    "https://item.rakuten.co.jp/shop/%2fredirect/",
    "https://www.amazon.co.jp/redirect?to=evil",
    "https://r10.to/opaque",
    "https://amzn.to/opaque",
    "https://laylax.com/account/login",
    "https://laylax.com/products/example?redirect=https://evil.com",
  ]) {
    assert.throws(() => approvedProductUrl(input), input);
    assert.equal(purchaseLink(input), null, input);
  }
  assert.throws(() =>
    approvedProductUrl("https://laylax.com/products/example", true),
  );
});
test("JSON keeps images and placement but disables unsupported links, while publishing rejects forged link provenance", async () => {
  const previous = globalThis.Image;
  globalThis.Image = class {
    naturalWidth = 100;
    naturalHeight = 50;
    set src(v) {
      queueMicrotask(() => this.onload());
    }
  };
  const project = {
    version: 2,
    name: "復元",
    layers: [{ ...layer, url: "https://evil.com/item", linkOrigin: "search" }],
  };
  let count = 0;
  try {
    const restored = await parseProject(project, () => count++);
    assert.equal(count, 1);
    assert.equal(restored.layers[0].url, "");
    assert.equal(restored.layers[0].src, png);
    assert.equal(restored.layers[0].x, 120);
    assert.equal(restored.layers[0].mm, 800);
    assert.throws(() =>
      validateSubmission({
        title: "カスタム",
        author: "ゲスト",
        description: "",
        gunType: "アサルトライフル",
        tags: [],
        preview: png,
        project,
      }),
    );
    assert.equal(safeImportedProductUrl("https://evil.com"), "");
  } finally {
    globalThis.Image = previous;
  }
});
