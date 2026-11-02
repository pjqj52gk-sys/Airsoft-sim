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
      assert.equal(url.searchParams.has("accessKey"), false);
      assert.equal(options.headers.accessKey, "test-private-access");
      assert.equal(options.headers.Origin, "https://registered.example");
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
