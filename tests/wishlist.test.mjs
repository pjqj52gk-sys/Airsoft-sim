import test from "node:test";
import assert from "node:assert/strict";
import { wishlistKey, wishTotal } from "../lib/wishlist.ts";

test("wishlist identity ignores referral tracking but retains product variants", () => {
  const input = {
    name: "グリップ",
    category: "グリップ",
    url: "https://item.rakuten.co.jp/shop/grip/?scid=one&rafcid=affiliate#top",
  };
  assert.equal(
    wishlistKey(input),
    wishlistKey({
      ...input,
      url: "https://item.rakuten.co.jp/shop/grip/?scid=two&sc2id=three",
    }),
  );
  assert.equal(
    wishlistKey(input),
    wishlistKey({
      ...input,
      url:
        "https://hb.afl.rakuten.co.jp/hgc/referral/?pc=" +
        encodeURIComponent(
          "https://item.rakuten.co.jp/shop/grip/?scid=another",
        ),
    }),
  );
  assert.notEqual(
    wishlistKey({
      ...input,
      url: "https://shop.example.com/part?variant=black",
    }),
    wishlistKey({ ...input, url: "https://shop.example.com/part?variant=tan" }),
  );
  assert.equal(
    wishlistKey({ ...input, url: "" }),
    wishlistKey({ ...input, name: "グリップ", url: "javascript:alert(1)" }),
  );
  assert.equal(
    wishTotal([
      { ...input, price: 4980 },
      { ...input, price: 1200 },
    ]),
    6180,
  );
});
