import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { rankShopImages } from "../lib/shop-image-quality.ts";
import { extractShopProduct } from "../lib/shop-product.ts";
test("Rakuten product microdata and related detail photos replace the share thumbnail without banners", () => {
  const p = extractShopProduct(
    `<meta property="og:image" content="https://shop.r10s.jp/shop/cabinet/sku.jpg"><meta itemprop="image" content="https://tshop.r10s.jp/shop/cabinet/sku.jpg"><meta itemprop="image" content="https://tshop.r10s.jp/shop/cabinet/side.jpg"><img src="https://image.rakuten.co.jp/shop/cabinet/sku-2.jpg"><img src="https://image.rakuten.co.jp/shop/cabinet/banner.jpg">`,
    "https://item.rakuten.co.jp/shop/sku/",
  );
  assert.deepEqual(p.images, [
    "https://tshop.r10s.jp/shop/cabinet/sku.jpg",
    "https://tshop.r10s.jp/shop/cabinet/side.jpg",
    "https://image.rakuten.co.jp/shop/cabinet/sku-2.jpg",
  ]);
});
test("explicit zoom and largest srcset versions are used only for identified product photos", () => {
  const p = extractShopProduct(
    `<script type="application/ld+json">{"@type":"Product","name":"Part","image":"https://cdn.example.com/part_300x300.jpg"}</script><img src="https://cdn.example.com/part_300x300.jpg" data-zoom-image="https://cdn.example.com/part.jpg" srcset="https://cdn.example.com/part_600x600.jpg 600w, https://cdn.example.com/part_1600x1600.jpg 1600w"><img src="banner.jpg" data-zoom-image="https://cdn.example.com/banner.jpg">`,
    "https://shop.example.com/product",
  );
  assert.equal(p.images[0], "https://cdn.example.com/part.jpg");
  assert.ok(p.images.includes("https://cdn.example.com/part_1600x1600.jpg"));
  assert.ok(!p.images.some((s) => s.includes("banner")));
});
test("image choice uses measured source pixels, skips broken images, and preserves source URLs", async () => {
  const small = await sharp({
    create: { width: 300, height: 300, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  const large = await sharp({
    create: { width: 800, height: 337, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  const data = await rankShopImages(
    [
      "https://cdn.example.com/small.png",
      "https://cdn.example.com/large.png",
      "https://cdn.example.com/broken.png",
    ],
    async (url, kind, redirects, deadline) => {
      assert.equal(kind, "image");
      assert.ok(deadline > Date.now());
      if (url.includes("broken")) throw new Error("unavailable");
      return {
        url,
        type: "image/png",
        bytes: url.includes("large") ? large : small,
      };
    },
  );
  assert.deepEqual(
    data.imageDetails.map((d) => [d.width, d.height]),
    [
      [800, 337],
      [300, 300],
    ],
  );
  assert.equal(data.images[0], "https://cdn.example.com/large.png");
  const fallback = await rankShopImages(
    ["https://cdn.example.com/other.png"],
    async () => {
      throw new Error("unavailable");
    },
  );
  assert.equal(fallback.images.length, 1);
});
