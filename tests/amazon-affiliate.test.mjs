import test from "node:test";
import assert from "node:assert/strict";
import { purchaseLink, monetization } from "../lib/commerce.ts";
test("operator Amazon ID replaces a provided competing tag on every supported product URL", () => {
  assert.equal(monetization.amazonAssociateTag, "airsoftsimafi-22");
  for (const path of [
    "/dp/B0777MMRVJ",
    "/name/dp/B0777MMRVJ",
    "/gp/product/B0777MMRVJ",
    "/gp/aw/d/B0777MMRVJ",
  ]) {
    const result = purchaseLink(
      "https://www.amazon.co.jp" + path + "?tag=someone-22",
    );
    assert.equal(
      result.href,
      "https://www.amazon.co.jp/dp/B0777MMRVJ?tag=airsoftsimafi-22",
    );
    assert.equal(result.sponsored, true);
  }
});
