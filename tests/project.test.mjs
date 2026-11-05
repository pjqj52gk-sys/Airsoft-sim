import test from "node:test";
import assert from "node:assert/strict";
import {
  dimensions,
  parseProject,
  safeImage,
  sampleProject,
  removeBackground,
} from "../lib/project.ts";

const png = "data:image/png;base64,aGVsbG8=";
globalThis.Image = class {
  naturalWidth = 200;
  naturalHeight = 100;
  set src(value) {
    queueMicrotask(() => this.onload());
  }
};

test("dimensions preserve image aspect ratio at the supplied real size", () => {
  assert.deepEqual(dimensions({ mm: 150, width: 200, height: 100 }), {
    w: 150,
    h: 75,
  });
});
test("V2 round-trip preserves coordinates, visibility, rotation and purchase notes", async () => {
  const source = sampleProject();
  source.layers[1] = {
    ...source.layers[1],
    x: 112.5,
    y: -30,
    rotation: 45,
    visible: false,
    price: 12000,
    owned: true,
    url: "https://item.rakuten.co.jp/shop/part/",
    attachedToBase: true,
    referenceMm: 67,
    referenceOptions: [
      { mm: 67, label: "公式 · 全長 67mm" },
      { mm: 71, label: "公式 · 全長 71mm（装着時）" },
      { mm: -1, label: "invalid" },
    ],
  };
  const result = await parseProject(JSON.parse(JSON.stringify(source)));
  const part = result.layers[1];
  assert.equal(result.name, source.name);
  assert.equal(part.x, 112.5);
  assert.equal(part.y, -30);
  assert.equal(part.rotation, 45);
  assert.equal(part.visible, false);
  assert.equal(part.price, 12000);
  assert.equal(part.owned, true);
  assert.equal(part.url, source.layers[1].url);
  assert.equal(part.attachedToBase, true);
  assert.equal(part.referenceMm, 67);
  assert.deepEqual(
    part.referenceOptions,
    source.layers[1].referenceOptions.slice(0, 2),
  );
  assert.notEqual(part.id, source.layers[1].id);
});
test("legacy pixel offsets and height-based dimensions migrate to millimetres", async () => {
  const result = await parseProject({
    version: 1,
    baseImg: { src: png, mm: 800, widthPx: 1600 },
    parts: [
      {
        src: png,
        mm: 100,
        metricType: "height",
        position: { x: 50, y: 100 },
        flip: true,
      },
    ],
  });
  assert.equal(result.layers[1].mm, 200);
  assert.equal(result.layers[1].x, 145);
  assert.equal(result.layers[1].y, 240);
  assert.equal(result.layers[1].flip, true);
  assert.equal(result.layers[0].attachedToBase, false);
});
test("untrusted image URLs, arbitrary SVG and unsupported project versions are rejected", async () => {
  for (const src of [
    "https://example.com/image.png",
    "javascript:alert(1)",
    "data:image/svg+xml,<svg/>",
    "blob:expired",
  ])
    assert.throws(() => safeImage(src));
  await assert.rejects(parseProject({ version: 99, layers: [] }));
  await assert.rejects(
    parseProject({ version: 2, layers: new Array(61).fill({}) }),
  );
  await assert.rejects(
    parseProject({
      version: 2,
      layers: [{ src: png, originalSrc: "data:image/png;base64,malformed!" }],
    }),
  );
});
test("invalid numbers are normalized and an empty project can be restored", async () => {
  const result = await parseProject({
    version: 2,
    layers: [{ src: png, mm: -2, x: Infinity, price: -500 }],
  });
  assert.equal(result.layers[0].mm, 1);
  assert.equal(result.layers[0].x, 120);
  assert.equal(result.layers[0].price, 0);
  assert.deepEqual((await parseProject({ version: 2, layers: [] })).layers, []);
});
test("background removal preserves an enclosed matching-color region", async () => {
  globalThis.Image = class {
    naturalWidth = 5;
    naturalHeight = 5;
    set src(value) {
      queueMicrotask(() => this.onload());
    }
  };
  const pixels = new Uint8ClampedArray(5 * 5 * 4);
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) {
      const border = x === 0 || y === 0 || x === 4 || y === 4;
      const color = border || (x === 2 && y === 2) ? 255 : 0;
      pixels.set([color, color, color, 255], (y * 5 + x) * 4);
    }
  let result;
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        drawImage() {},
        getImageData: () => ({ data: pixels }),
        putImageData: (data) => {
          result = data.data;
        },
      }),
      toDataURL: () => png,
    }),
  };
  await removeBackground(png, 0);
  assert.equal(result[3], 0); // Outer background is transparent.
  assert.equal(result[(2 * 5 + 2) * 4 + 3], 255); // Enclosed white detail is preserved.
  assert.equal(result[(1 * 5 + 1) * 4 + 3], 255); // Object boundary is preserved.
});

test("restoring a large project limits concurrent image decodes and preserves layer order", async () => {
  const original = globalThis.Image;
  let active = 0,
    peak = 0;
  globalThis.Image = class {
    naturalWidth = 200;
    naturalHeight = 100;
    set src(value) {
      peak = Math.max(peak, ++active);
      setTimeout(() => {
        active--;
        this.onload();
      }, 1);
    }
  };
  try {
    const result = await parseProject({
      version: 2,
      layers: Array.from({ length: 12 }, (_, i) => ({
        src: png,
        name: "part-" + i,
      })),
    });
    assert.equal(peak, 3);
    assert.deepEqual(
      result.layers.map((layer) => layer.name),
      Array.from({ length: 12 }, (_, i) => "part-" + i),
    );
  } finally {
    globalThis.Image = original;
  }
});
