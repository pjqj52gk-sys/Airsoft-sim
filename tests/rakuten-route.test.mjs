import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as rakuten from "../lib/rakuten.ts";

const source = await readFile(
  new URL("../app/api/rakuten/search/route.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
function route(env, fetch) {
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: () => rakuten,
    process: { env },
    URL,
    URLSearchParams,
    Response,
    AbortSignal,
    fetch,
  });
  return exports.GET;
}
test("missing credentials produce a useful response without an upstream request", async () => {
  const get = route({}, () => {
    throw new Error("Unexpected fetch");
  });
  assert.deepEqual(
    await (
      await get(new Request("http://localhost/api/rakuten/search"))
    ).json(),
    { configured: false },
  );
  const response = await get(
    new Request("http://localhost/api/rakuten/search?q=site"),
  );
  assert.equal(response.status, 503);
});
test("server uses the current fixed API and keeps access keys out of the query and response", async () => {
  let called = false;
  const get = route(
    {
      RAKUTEN_APPLICATION_ID: "test-app",
      RAKUTEN_ACCESS_KEY: "test-private-access",
      RAKUTEN_AFFILIATE_ID: "test-affiliate",
      RAKUTEN_ALLOWED_ORIGIN: "https://registered.example/",
    },
    async (url, options) => {
      called = true;
      assert.equal(url.origin, "https://openapi.rakuten.co.jp");
      assert.ok(url.pathname.endsWith("/20260701"));
      assert.equal(url.searchParams.get("genreId"), "213684");
      assert.equal(url.searchParams.has("accessKey"), false);
      assert.equal(options.headers.accessKey, "test-private-access");
      assert.equal(options.headers.Origin, "https://registered.example");
      assert.equal(options.headers.Referer, "https://registered.example/");
      return Response.json({ items: [], count: 0, page: 1, pageCount: 0 });
    },
  );
  const response = await get(
    new Request("http://localhost/api/rakuten/search?q=site"),
  );
  assert.equal(response.status, 200);
  assert.equal(called, true);
  assert.equal((await response.text()).includes("test-private-access"), false);
});
test("upstream authentication errors cannot echo credentials into the browser", async () => {
  const get = route(
    { RAKUTEN_APPLICATION_ID: "app", RAKUTEN_ACCESS_KEY: "private-access" },
    async () => Response.json({ error: "private-access" }, { status: 403 }),
  );
  const response = await get(
    new Request("http://localhost/api/rakuten/search?q=site"),
  );
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes("private-access"), false);
});
test("generic grip searches stay in airsoft even if a client requests all genres", async () => {
  const get = route(
    { RAKUTEN_APPLICATION_ID: "app", RAKUTEN_ACCESS_KEY: "private-access" },
    async (url) => {
      assert.equal(url.searchParams.get("keyword"), "グリップ");
      assert.equal(url.searchParams.get("genreId"), "213684");
      assert.equal(url.searchParams.get("page"), "2");
      assert.equal(url.searchParams.get("sort"), "+itemPrice");
      return Response.json({ items: [], count: 0, page: 2, pageCount: 0 });
    },
  );
  const response = await get(
    new Request(
      "http://localhost/api/rakuten/search?" +
        new URLSearchParams({
          q: "グリップ",
          genreId: "0",
          page: "2",
          sort: "+itemPrice",
        }),
    ),
  );
  assert.equal(response.status, 200);
});
test("no matches in airsoft return zero results instead of broadening the search", async () => {
  let requests = 0;
  const get = route(
    { RAKUTEN_APPLICATION_ID: "app", RAKUTEN_ACCESS_KEY: "private-access" },
    async (url) => {
      requests++;
      assert.equal(url.searchParams.get("genreId"), "213684");
      return Response.json({ error: "not_found" }, { status: 404 });
    },
  );
  const response = await get(
    new Request("http://localhost/api/rakuten/search?q=nonexistent"),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [],
    count: 0,
    page: 1,
    pageCount: 0,
  });
  assert.equal(requests, 1);
});
test("airsoft body categories and manual body scope use the body genre, never the whole marketplace", async () => {
  let requests = 0;
  const get = route(
    { RAKUTEN_APPLICATION_ID: "app", RAKUTEN_ACCESS_KEY: "private-access" },
    async (url) => {
      requests++;
      assert.equal(url.searchParams.get("genreId"), "213685");
      return Response.json({ items: [], count: 0, page: 1, pageCount: 0 });
    },
  );
  for (const search of [
    { q: "M4", category: "gun-m4" },
    { q: "M4", scope: "guns" },
  ])
    assert.equal(
      (
        await get(
          new Request(
            "http://localhost/api/rakuten/search?" +
              new URLSearchParams(search),
          ),
        )
      ).status,
      200,
    );
  assert.equal(requests, 2);
});
