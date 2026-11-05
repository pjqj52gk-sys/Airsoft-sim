import test from "node:test";
import assert from "node:assert/strict";
import {
  collectionInput,
  collectionKey,
  mergeCollectionItem,
  migrateCollection,
  applyCollectionOwnership,
} from "../lib/collection.ts";
import {
  listCollection,
  updateCollection,
  registerCollectionLayers,
} from "../lib/storage.ts";
const layer = (id = "optic", extra = {}) => ({
  id,
  name: "サイト",
  category: "光学機器",
  url: "https://item.rakuten.co.jp/shop/optic/?scid=old",
  src: "data:image/png;base64,eA==",
  price: 4000,
  mm: 150,
  width: 100,
  height: 50,
  owned: false,
  ...extra,
});
test("owned and wanted are independent subsets of one registered product, and removing either keeps its image", () => {
  const first = mergeCollectionItem(
    undefined,
    collectionInput(layer()),
    { wished: true },
    1,
  );
  const owned = mergeCollectionItem(
    first,
    collectionInput(layer()),
    { owned: true },
    2,
  );
  assert.equal(owned.wished, true);
  assert.equal(owned.owned, true);
  assert.equal(owned.id, first.id);
  const removed = mergeCollectionItem(
    owned,
    { name: "サイト", category: "光学機器", url: first.url, price: 4000 },
    { wished: false },
    3,
  );
  assert.equal(removed.owned, true);
  assert.equal(removed.wished, false);
  assert.equal(removed.layer.src, first.layer.src);
});
test("migration merges old wishes, registered edits and builds, preserving ownership and highest quality registered image", () => {
  const saved = layer("saved", { src: "edited-image", owned: true });
  const rows = migrateCollection(
    [{ layer: saved, savedAt: 10 }],
    [
      {
        name: "サイト",
        category: "光学機器",
        url: "https://item.rakuten.co.jp/shop/optic/?rafcid=new",
        price: 4500,
        image: "thumbnail",
        id: "legacy",
        savedAt: 12,
      },
    ],
    [{ version: 2, name: "ビルド", layers: [layer()] }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].owned, true);
  assert.equal(rows[0].wished, true);
  assert.equal(rows[0].layer.src, "edited-image");
  assert.equal(rows[0].image, "edited-image");
  assert.equal(collectionKey(collectionInput(layer())), rows[0].id);
});
test("library ownership is applied to every plan without mutating saved layers and stable identity survives renaming", () => {
  const original = { version: 2, name: "A", layers: [layer()] };
  const entry = mergeCollectionItem(
    undefined,
    collectionInput(original.layers[0]),
    { owned: true },
  );
  const next = applyCollectionOwnership(original, [entry]);
  assert.equal(next.layers[0].owned, true);
  assert.equal(original.layers[0].owned, false);
  assert.equal(applyCollectionOwnership(next, [entry]), next);
  const renamed = {
    ...next.layers[0],
    name: "マイサイト",
    url: "https://example.com/new",
  };
  assert.equal(collectionKey(collectionInput(renamed)), entry.id);
  assert.equal(
    applyCollectionOwnership({ version: 2, name: "B", layers: [renamed] }, [
      { ...entry, owned: false },
    ]).layers[0].owned,
    false,
  );
});
// The mock commits all involved stores together, and rolls back a failed migration.
function fakeDatabase(initial) {
  const stores = new Map(
    Object.entries(initial).map(([k, v]) => [k, new Map(v)]),
  );
  let fail = false;
  const indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        const db = {
          objectStoreNames: { contains: (n) => stores.has(n) },
          createObjectStore: (n) => stores.set(n, new Map()),
          close() {},
          transaction(names) {
            const working = new Map(
              (Array.isArray(names) ? names : [names]).map((n) => [
                n,
                new Map(stores.get(n)),
              ]),
            );
            let pending = 0,
              ended = false;
            const tx = {
              objectStore(name) {
                return {
                  getAll() {
                    return operation(() => [...working.get(name).values()]);
                  },
                  get(key) {
                    return operation(() => working.get(name).get(key));
                  },
                  put(value, key) {
                    return operation(() => {
                      if (fail && name === "items") {
                        fail = false;
                        throw Error("quota");
                      }
                      working.get(name).set(key, structuredClone(value));
                    });
                  },
                  delete(key) {
                    return operation(() => working.get(name).delete(key));
                  },
                };
              },
            };
            function check() {
              setTimeout(() => {
                if (!pending && !ended) {
                  ended = true;
                  for (const [n, v] of working) stores.set(n, v);
                  tx.oncomplete?.();
                }
              }, 0);
            }
            function operation(fn) {
              pending++;
              const req = {};
              queueMicrotask(() => {
                try {
                  req.result = structuredClone(fn());
                  req.onsuccess?.();
                } catch (e) {
                  ended = true;
                  tx.error = e;
                  tx.onabort?.();
                } finally {
                  pending--;
                  check();
                }
              });
              return req;
            }
            check();
            return tx;
          },
        };
        request.result = db;
        request.onupgradeneeded?.();
        request.onsuccess();
      });
      return request;
    },
  };
  return {
    indexedDB,
    stores,
    fail: () => {
      fail = true;
    },
  };
}
test("collection migration and updates commit atomically; retry and later seeding never restore removed wishlist flags", async () => {
  const old = globalThis.indexedDB,
    source = layer();
  const fake = fakeDatabase({
    parts: [["old", { id: "old", layer: source, savedAt: 1 }]],
    wishlist: [
      ["oldwish", { ...collectionInput(source), id: "oldwish", savedAt: 2 }],
    ],
    projects: [["draft", { version: 2, name: "Existing", layers: [source] }]],
    builds: [],
  });
  globalThis.indexedDB = fake.indexedDB;
  try {
    fake.fail();
    await assert.rejects(listCollection());
    assert.equal(fake.stores.get("projects").has("collection-v1"), false);
    assert.equal(fake.stores.get("items").size, 0);
    const rows = await listCollection();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].wished, true);
    await Promise.all([
      updateCollection(collectionInput(source), { owned: true }),
      updateCollection(collectionInput(source), { wished: false }),
    ]);
    await registerCollectionLayers([
      source,
      layer("another", {
        name: "別サイト",
        url: "https://example.com/another",
      }),
    ]);
    const after = await listCollection(),
      item = after.find((i) => i.id === rows[0].id);
    assert.equal(after.length, 2);
    assert.equal(item.owned, true);
    assert.equal(item.wished, false);
    assert.equal(fake.stores.get("wishlist").size, 1);
    assert.equal(fake.stores.get("parts").size, 1);
    assert.equal(fake.stores.get("projects").get("draft").name, "Existing");
  } finally {
    globalThis.indexedDB = old;
  }
});
