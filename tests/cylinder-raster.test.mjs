import test from "node:test";
import assert from "node:assert/strict";
import { cylinderSideSurface } from "../lib/cylinder-guide.ts";
import { rectifyImage } from "../lib/image-processing.ts";

test("curved axial markings become straight and selected corner detail survives in preview and full image", async () => {
  const originalDocument = globalThis.document;
  let output;
  globalThis.document = {
    createElement() {
      return {
        getContext() {
          return {
            createImageData(width, height) {
              return {
                width,
                height,
                data: new Uint8ClampedArray(width * height * 4),
              };
            },
            putImageData(p) {
              output = p;
            },
          };
        },
        toDataURL() {
          return "data:image/png;base64,test";
        },
      };
    },
  };
  try {
    const guide = {
      start: { x: 60, y: 80 },
      end: { x: 660, y: 80 },
      startRadius: 60,
      endRadius: 60,
    };
    const surface = cylinderSideSurface(guide, 1, 0.6, "start");
    const pixels = {
      width: 720,
      height: 160,
      data: new Uint8ClampedArray(720 * 160 * 4),
    };
    for (let y = 0; y < pixels.height; y++)
      for (let x = 0; x < pixels.width; x++) {
        const t = (y - 80) / 60;
        if (Math.abs(t) > 1) continue;
        const shift = 36 * Math.sqrt(1 - t * t),
          u = (x - 60 - shift) / 600;
        const i = (y * pixels.width + x) * 4;
        if (((x - 60) / 36) ** 2 + t * t <= 1)
          pixels.data.set([255, 0, 255, 255], i);
        else if (u >= 0 && u <= 1)
          pixels.data.set([Math.round(u * 240), 180, 40, 255], i);
      }
    const original = pixels.data.slice();
    for (const maxEdge of [480, 2000]) {
      await rectifyImage(
        { src: "cached", mm: 155 },
        surface.corners,
        surface.aspect,
        surface.map,
        { pixels, pixelCenters: true, mask: surface.visible, maxEdge },
      );
      const at = (x, y) => [
        ...output.data.slice(
          (y * output.width + x) * 4,
          (y * output.width + x) * 4 + 4,
        ),
      ];
      for (const u of [0.02, 0.25, 0.5, 0.75, 0.98])
        for (const v of [0.03, 0.2, 0.5, 0.8, 0.97]) {
          const pixel = at(
            Math.floor(u * output.width),
            Math.floor(v * output.height),
          );
          assert.ok(
            Math.abs(pixel[0] - u * 240) < 2,
            JSON.stringify({ u, v, pixel }),
          );
          assert.equal(pixel[1], 180);
          assert.equal(pixel[2], 40);
          assert.equal(pixel[3], 255);
        }
      // A constant-width crop would discard this selected upper-left region.
      assert.ok(surface.map(0.02, 0.03).x < 96);
      for (let i = 0; i < output.data.length; i += 4)
        if (output.data[i + 3])
          assert.equal(
            output.data[i + 2],
            40,
            "end-cap color leaked into side",
          );
    }
    assert.deepEqual(pixels.data, original);
  } finally {
    globalThis.document = originalDocument;
  }
});
