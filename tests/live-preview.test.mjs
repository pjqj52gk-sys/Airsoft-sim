import test from "node:test";
import assert from "node:assert/strict";
import { rectifyImage } from "../lib/image-processing.ts";
test("fast previews use cached pixels and preserve alpha while full application keeps source resolution", async () => {
  const originalDocument = globalThis.document,
    originalImage = globalThis.Image;
  const outputs = [];
  globalThis.Image = class {
    constructor() {
      throw Error("Cached source must not be decoded again");
    }
  };
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            createImageData(w, h) {
              return {
                width: w,
                height: h,
                data: new Uint8ClampedArray(w * h * 4),
              };
            },
            putImageData(value) {
              outputs.push(value);
            },
          };
        },
        toDataURL() {
          return "data:image/png;base64,cHJldmlldw==";
        },
      };
    },
  };
  try {
    const pixels = {
      width: 800,
      height: 400,
      data: new Uint8ClampedArray(800 * 400 * 4),
    };
    for (let i = 0; i < pixels.data.length; i += 4)
      pixels.data.set([100, 200, 50, 128], i);
    const sourceCopy = pixels.data.slice();
    const layer = { src: "cached", mm: 120 };
    const quad = [
      { x: 0, y: 0 },
      { x: 799, y: 0 },
      { x: 799, y: 399 },
      { x: 0, y: 399 },
    ];
    const preview = await rectifyImage(layer, quad, 2, undefined, {
      pixels,
      maxEdge: 480,
    });
    const full = await rectifyImage(layer, quad, 2, undefined, { pixels });
    assert.equal(preview.width, 480);
    assert.equal(preview.height, 240);
    assert.ok(full.width > preview.width);
    assert.ok(full.height > preview.height);
    assert.equal(full.mm, 120);
    assert.deepEqual(pixels.data, sourceCopy);
    for (const output of outputs)
      for (const i of [
        0,
        Math.floor(output.data.length / 8) * 4,
        output.data.length - 4,
      ])
        assert.deepEqual([...output.data.slice(i, i + 4)], [100, 200, 50, 128]);
    await assert.rejects(
      rectifyImage(layer, quad, 2, undefined, { pixels, maxEdge: Infinity }),
    );
  } finally {
    globalThis.document = originalDocument;
    globalThis.Image = originalImage;
  }
});
