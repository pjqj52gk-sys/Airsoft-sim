import test from "node:test";
import assert from "node:assert/strict";
import { prepareAddedLayer, restoreLayerImage } from "../lib/layer-image.ts";

test("adding an image automatically removes its background and detached margin logo, trims it, and retains the original", async () => {
  const oldImage = globalThis.Image,
    oldDocument = globalThis.document;
  const images = new Map();
  let serial = 0;
  const source = {
    width: 120,
    height: 80,
    data: new Uint8ClampedArray(120 * 80 * 4),
  };
  source.data.fill(255);
  function rect(x, y, w, h, color) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) source.data.set(color, (j * 120 + i) * 4);
  }
  rect(30, 25, 70, 40, [40, 50, 60, 255]);
  rect(5, 5, 12, 4, [80, 80, 80, 255]);
  rect(55, 40, 4, 3, [255, 255, 255, 255]);
  const src = "data:image/png;base64,b3JpZ2luYWw=";
  images.set(src, source);
  globalThis.Image = class {
    set src(value) {
      this.pixels = images.get(value);
      this.naturalWidth = this.pixels.width;
      this.naturalHeight = this.pixels.height;
      queueMicrotask(() => this.onload());
    }
  };
  globalThis.document = {
    createElement() {
      const c = {
        width: 0,
        height: 0,
        pixels: null,
        getContext() {
          return {
            drawImage(image, ...args) {
              const input = image.pixels;
              const cropped = args.length === 8;
              const sx = cropped ? args[0] : 0,
                sy = cropped ? args[1] : 0;
              const out = new Uint8ClampedArray(c.width * c.height * 4);
              for (let y = 0; y < c.height; y++)
                for (let x = 0; x < c.width; x++) {
                  const i = ((sy + y) * input.width + sx + x) * 4;
                  out.set(input.data.subarray(i, i + 4), (y * c.width + x) * 4);
                }
              c.pixels = { width: c.width, height: c.height, data: out };
            },
            getImageData() {
              return {
                ...c.pixels,
                data: new Uint8ClampedArray(c.pixels.data),
              };
            },
            putImageData(value) {
              c.pixels = { ...value, width: c.width, height: c.height };
            },
          };
        },
        toDataURL() {
          const key =
            "data:image/png;base64," +
            Buffer.from(String(++serial)).toString("base64");
          images.set(key, c.pixels);
          return key;
        },
      };
      return c;
    },
  };
  try {
    const layer = {
      id: "test",
      name: "part",
      src,
      width: 120,
      height: 80,
      mm: 150,
      x: 10,
      y: 20,
      rotation: 0,
      flip: false,
      visible: true,
      price: 0,
      url: "",
      category: "その他",
    };
    const result = await prepareAddedLayer(layer, false);
    assert.equal(result.width, 70);
    assert.equal(result.height, 40);
    assert.equal(result.originalSrc, src);
    assert.equal(result.attachedToBase, true);
    assert.deepEqual(result.originalFrame, {
      width: 120,
      height: 80,
      offsetX: 30,
      offsetY: 25,
    });
    const output = images.get(result.src);
    assert.equal(output.data[3], 255); // The product remains opaque.
    assert.deepEqual(
      [
        ...output.data.slice(
          ((40 - 25) * 70 + 55 - 30) * 4,
          ((40 - 25) * 70 + 55 - 30) * 4 + 4,
        ),
      ],
      [255, 255, 255, 0],
    );
    assert.equal(restoreLayerImage(result).src, src);
    assert.equal(restoreLayerImage(result).mm, 150);
    const reused = await prepareAddedLayer(result, false);
    assert.equal(reused.src, result.src);
  } finally {
    globalThis.Image = oldImage;
    globalThis.document = oldDocument;
  }
});
