import test from "node:test";
import assert from "node:assert/strict";
import { canEditLink, protectLinkPatch } from "../lib/link-policy.ts";
import {
  collectionInput,
  mergeCollectionItem,
  applyCollectionOwnership,
} from "../lib/collection.ts";
import { parseProject } from "../lib/project.ts";
const url = "https://item.rakuten.co.jp/shop/sight/";
const layer = {
  id: "sight",
  name: "サイト",
  src: "data:image/png;base64,eA==",
  category: "光学機器",
  price: 5000,
  url,
  linkOrigin: "search",
  width: 100,
  height: 50,
  mm: 150,
  x: 0,
  y: 0,
  visible: true,
  rotation: 0,
  flip: false,
};
test("search and shared links cannot be replaced or downgraded by other editor patches; uploaded links remain editable", () => {
  assert.equal(canEditLink(layer), false);
  assert.equal(canEditLink({ url: url + "?rafcid=operator" }), false);
  const patch = protectLinkPatch(layer, {
    url: "https://example.com/other",
    linkOrigin: "upload",
    price: 6000,
  });
  assert.deepEqual(patch, { url, linkOrigin: "search", price: 6000 });
  assert.equal(canEditLink({ ...layer, linkOrigin: "shared" }), false);
  const manual = { ...layer, linkOrigin: "upload" };
  assert.equal(canEditLink(manual), true);
  assert.equal(
    protectLinkPatch(manual, { url: "https://example.com/own" }).url,
    "https://example.com/own",
  );
});
test("common collection retains locked links during registration and ownership or wishlist changes", () => {
  const first = mergeCollectionItem(undefined, collectionInput(layer));
  const edited = mergeCollectionItem(
    first,
    {
      ...collectionInput(layer),
      url: "https://example.com/other",
      linkOrigin: "upload",
      layer: {
        ...layer,
        url: "https://example.com/other",
        linkOrigin: "upload",
      },
    },
    { owned: true, wished: true },
  );
  assert.equal(edited.url, url);
  assert.equal(edited.linkOrigin, "search");
  assert.equal(edited.layer.url, url);
  const p = {
    version: 2,
    name: "test",
    layers: [
      {
        ...layer,
        libraryId: first.id,
        url: "https://example.com/other",
        linkOrigin: "upload",
      },
    ],
  };
  assert.equal(applyCollectionOwnership(p, [first]).layers[0].url, url);
  assert.equal(p.layers[0].url, "https://example.com/other");
});
test("link provenance and registration identity survive JSON import", async () => {
  const previous = globalThis.Image;
  globalThis.Image = class {
    naturalWidth = 100;
    naturalHeight = 50;
    set src(v) {
      queueMicrotask(() => this.onload());
    }
  };
  try {
    const parsed = await parseProject({
      version: 2,
      name: "test",
      layers: [{ ...layer, libraryId: "registered" }],
    });
    assert.equal(parsed.layers[0].linkOrigin, "search");
    assert.equal(parsed.layers[0].libraryId, "registered");
  } finally {
    globalThis.Image = previous;
  }
});
