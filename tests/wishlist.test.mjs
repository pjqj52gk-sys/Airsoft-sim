import test from "node:test";
import assert from "node:assert/strict";
import { wishlistKey, wishTotal } from "../lib/wishlist.ts";
import { listWishes, saveWish, deleteWish } from "../lib/storage.ts";

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
test("wishlist storage upgrades existing databases without changing drafts, builds or registered parts", async () => {
  const previous = globalThis.indexedDB;
  const stores = new Map([
    ["projects", new Map([["draft", { name: "existing custom" }]])],
    ["builds", new Map([["saved", { project: { name: "saved custom" } }]])],
    ["parts", new Map([["part", { name: "existing part" }]])],
  ]);
  let version = 2;
  const db = {
    objectStoreNames: { contains: (name) => stores.has(name) },
    createObjectStore(name) {
      stores.set(name, new Map());
    },
    close() {},
    transaction(name) {
      const tx = {
        objectStore() {
          return {
            put(value, key) {
              stores.get(name).set(key, structuredClone(value));
            },
            delete(key) {
              stores.get(name).delete(key);
            },
            getAll() {
              const request = {};
              queueMicrotask(() => {
                request.result = [...stores.get(name).values()];
                request.onsuccess();
              });
              return request;
            },
          };
        },
      };
      setTimeout(() => tx.oncomplete(), 0);
      return tx;
    },
  };
  globalThis.indexedDB = {
    open(name, requested) {
      assert.equal(name, "airsoft-studio");
      const request = { result: db };
      queueMicrotask(() => {
        if (requested > version) {
          assert.equal(requested, 3);
          request.onupgradeneeded();
          version = requested;
        }
        request.onsuccess();
      });
      return request;
    },
  };
  try {
    assert.deepEqual(await listWishes(), []);
    const item = {
      id: "product",
      name: "scope",
      url: "https://shop.example.com/scope",
      price: 4980,
      category: "光学機器",
      savedAt: 1,
    };
    await saveWish(item);
    await saveWish({ ...item, price: 5500 });
    assert.deepEqual(await listWishes(), [{ ...item, price: 5500 }]);
    assert.equal(stores.get("projects").get("draft").name, "existing custom");
    assert.equal(
      stores.get("builds").get("saved").project.name,
      "saved custom",
    );
    assert.equal(stores.get("parts").get("part").name, "existing part");
    await deleteWish(item.id);
    assert.deepEqual(await listWishes(), []);
  } finally {
    globalThis.indexedDB = previous;
  }
});
