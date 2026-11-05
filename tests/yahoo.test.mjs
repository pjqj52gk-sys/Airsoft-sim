import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as yahoo from "../lib/yahoo-search.ts";
import * as links from "../lib/yahoo-link.ts";
import * as rakuten from "../lib/rakuten.ts";
import { purchaseLink } from "../lib/commerce.ts";
import { approvedProductUrl } from "../lib/product-link-policy.ts";
const product =
  "https://store.shopping.yahoo.co.jp/military-base/h9523b155.html";
const affiliate =
  "https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=other&pid=other&vc_url=" +
  encodeURIComponent(product);
const hit = {
  name: "サイレンサー M&amp;P 全長155mm",
  description: "JAN:4952839176257 全長155mm 外径40mm",
  janCode: "4952839176257",
  code: "military-base_h9523b155",
  price: 4980,
  url: affiliate,
  image: { medium: "https://item-shopping.c.yimg.jp/i/g/shop_item" },
  exImage: {
    url: "https://item-shopping.c.yimg.jp/i/n/shop_item",
    width: 600,
    height: 600,
  },
  seller: { name: "MILITARY BASE" },
};
test("Yahoo results prefer the 600px image, retain JAN and dimensions, and normalize affiliate links to the same product", () => {
  const result = yahoo.normalizeYahoo(
    { hits: [hit], totalResultsAvailable: 10000 },
    2,
  );
  const item = result.items[0];
  assert.equal(item.image, hit.exImage.url);
  assert.ok(item.name.includes("M&P"));
  assert.equal(item.productUrl, product);
  assert.ok(item.identifiers.janCodes.includes(hit.janCode));
  assert.ok(item.dimensions.some((d) => d.value.includes("155")));
  assert.equal(result.page, 2);
  assert.equal(result.pageCount, 83);
  assert.ok(purchaseLink(item.url).href.startsWith("/api/yahoo/link?"));
  assert.equal(approvedProductUrl(affiliate), product);
});
test("Yahoo cannot import external products or images, private endpoints, fake domains or opaque redirects", () => {
  for (const url of [
    "https://evil.com/item",
    "https://store.shopping.yahoo.co.jp.evil.com/shop/item.html",
    "https://user@store.shopping.yahoo.co.jp/shop/item.html",
    "https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=1&vc_url=https://evil.com",
  ])
    assert.equal(
      yahoo.normalizeYahoo({ hits: [{ ...hit, url }] }).items.length,
      0,
    );
  assert.equal(
    yahoo.normalizeYahoo({
      hits: [
        {
          ...hit,
          image: { medium: "https://evil.com/image" },
          exImage: { url: "https://evil.com/image" },
        },
      ],
    }).items.length,
    0,
  );
  assert.equal(links.yahooAffiliateUrl(product, "bad", "123456"), null);
});
function route(
  path,
  env,
  fetch = () => {
    throw Error("Unexpected fetch");
  },
) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) =>
      name.includes("yahoo-search")
        ? yahoo
        : name.includes("yahoo-link")
          ? links
          : rakuten,
    process: { env },
    URL,
    URLSearchParams,
    Response,
    AbortSignal,
    fetch,
  });
  return exports.GET;
}
const env = {
  YAHOO_APPLICATION_ID: "server-app-id",
  YAHOO_AFFILIATE_SID: "1234567",
  YAHOO_AFFILIATE_PID: "123456789",
};
test("Yahoo search fixes the API, airsoft category and image size and only takes affiliate settings from the server", async () => {
  let called = false;
  const get = route(
    "../app/api/yahoo/search/route.ts",
    env,
    async (url, options) => {
      called = true;
      assert.equal(url.origin, "https://shopping.yahooapis.jp");
      assert.equal(url.pathname, "/ShoppingWebService/V3/itemSearch");
      assert.equal(url.searchParams.get("appid"), env.YAHOO_APPLICATION_ID);
      assert.equal(url.searchParams.get("genre_category_id"), "2313");
      assert.equal(url.searchParams.get("image_size"), "600");
      assert.equal(url.searchParams.get("start"), "13");
      assert.equal(url.searchParams.get("sort"), "+price");
      const vc = new URL(url.searchParams.get("affiliate_id"));
      assert.equal(vc.searchParams.get("sid"), env.YAHOO_AFFILIATE_SID);
      assert.equal(options.next.revalidate, 60);
      return Response.json({ hits: [hit], totalResultsAvailable: 20 });
    },
  );
  const response = await get(
    new Request(
      "https://studio.example/api/yahoo/search?q=グリップ&page=2&sort=%2BitemPrice&appid=attacker&sid=999",
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(called, true);
  assert.equal(
    (await response.text()).includes(env.YAHOO_APPLICATION_ID),
    false,
  );
});
test("missing Yahoo configuration and upstream failures stay explicit without leaking credentials", async () => {
  const get = route("../app/api/yahoo/search/route.ts", {});
  assert.equal(
    (await get(new Request("https://studio.example/api/yahoo/search?q=test")))
      .status,
    503,
  );
  const bad = route("../app/api/yahoo/search/route.ts", env, async () =>
    Response.json({ error: "server-app-id" }, { status: 403 }),
  );
  const response = await bad(
    new Request("https://studio.example/api/yahoo/search?q=test"),
  );
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes("server-app-id"), false);
  assert.equal(
    (
      await bad(
        new Request("https://studio.example/api/yahoo/search?q=test&page=84"),
      )
    ).status,
    400,
  );
});
test("Yahoo purchase redirects overwrite other affiliate IDs and reject external destinations", async () => {
  const get = route("../app/api/yahoo/link/route.ts", env);
  const response = await get(
    new Request(
      "https://studio.example/api/yahoo/link?url=" +
        encodeURIComponent(affiliate) +
        "&sid=attacker",
    ),
  );
  assert.equal(response.status, 302);
  const target = new URL(response.headers.get("location"));
  assert.equal(target.searchParams.get("sid"), env.YAHOO_AFFILIATE_SID);
  assert.equal(target.searchParams.get("pid"), env.YAHOO_AFFILIATE_PID);
  assert.equal(target.searchParams.get("vc_url"), product);
  assert.equal(
    (
      await get(
        new Request(
          "https://studio.example/api/yahoo/link?url=https://evil.com",
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await route(
        "../app/api/yahoo/link/route.ts",
        {},
      )(
        new Request(
          "https://studio.example/api/yahoo/link?url=" +
            encodeURIComponent(product),
        ),
      )
    ).status,
    503,
  );
});
