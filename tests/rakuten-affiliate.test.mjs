import * as policy from "../lib/product-link-policy.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  rakutenTarget,
  rakutenAffiliateUrl,
  rakutenPurchasePath,
  resolveRakutenTarget,
} from "../lib/rakuten-affiliate.ts";
import { purchaseLink } from "../lib/commerce.ts";
import ts from "typescript";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import * as affiliate from "../lib/rakuten-affiliate.ts";
const product =
  "https://item.rakuten.co.jp/military-base/h9523b155/?variant=tan";
const old =
  "https://hb.afl.rakuten.co.jp/hgc/other-person/?pc=" +
  encodeURIComponent(product + "&scid=old&rafcid=other");
test("every purchase surface uses the server-controlled affiliate redirect, preserving product options and replacing other affiliate IDs", () => {
  for (const input of [product, old]) {
    assert.equal(rakutenTarget(input), product);
    const link = purchaseLink(input);
    assert.equal(link.sponsored, true);
    assert.ok(link.href.startsWith("/api/rakuten/link?"));
    const result = new URL(rakutenAffiliateUrl(input, "operator.id.123456"));
    assert.equal(result.pathname, "/hgc/operator.id.123456/");
    assert.equal(result.searchParams.get("pc"), product);
    assert.equal(result.searchParams.get("m"), product);
  }
  assert.equal(purchaseLink("https://example.com/part"), null);
});
test("conversion rejects external destinations, lookalike hosts, credentials, unsupported protocols and nonstandard ports", () => {
  for (const bad of [
    "javascript:alert(1)",
    "https://item.rakuten.co.jp.evil.com/p",
    "https://user@item.rakuten.co.jp/p",
    "https://item.rakuten.co.jp:8080/p",
    "https://127.0.0.1/p",
    "https://hb.afl.rakuten.co.jp/hgc/other/?pc=" +
      encodeURIComponent("https://example.com/evil"),
  ])
    assert.equal(rakutenAffiliateUrl(bad, "operator.id"), null);
  assert.equal(rakutenAffiliateUrl(product, "operator/id"), null);
  assert.equal(rakutenAffiliateUrl(product, ""), null);
});
test("short links resolve only through the fixed short-link hosts and stop before contacting affiliate trackers or unrelated sites", async () => {
  const visited = [];
  const target = await resolveRakutenTarget(
    "https://r10.to/test",
    async (url, options) => {
      visited.push(url);
      assert.equal(options.redirect, "manual");
      return new Response(null, { status: 302, headers: { Location: old } });
    },
  );
  assert.equal(target, product);
  assert.deepEqual(visited, ["https://r10.to/test"]);
  const invalid = await resolveRakutenTarget(
    "https://r10.to/bad",
    async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1/private" },
      }),
  );
  assert.equal(invalid, null);
});
const compiled = ts.transpileModule(
  await readFile(
    new URL("../app/api/rakuten/link/route.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
function route(env) {
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => name.includes("product-link-policy") ? policy : affiliate,
    process: { env },
    URL,
    Response,
  });
  return exports.GET;
}
test("redirect uses only operator configuration, has no cache, and never redirects arbitrary external URLs", async () => {
  const get = route({ RAKUTEN_AFFILIATE_ID: "operator.id.123456" });
  const response = await get(
    new Request(
      "https://studio.example/api/rakuten/link?url=" +
        encodeURIComponent(old) +
        "&affiliateId=attacker",
    ),
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(
    new URL(response.headers.get("location")).pathname.includes(
      "operator.id.123456",
    ),
  );
  assert.equal(
    (
      await get(
        new Request(
          "https://studio.example/api/rakuten/link?url=https://evil.com",
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await route({})(
        new Request(
          "https://studio.example/api/rakuten/link?url=" +
            encodeURIComponent(product),
        ),
      )
    ).status,
    503,
  );
});
