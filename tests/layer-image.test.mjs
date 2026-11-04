import test from "node:test";
import assert from "node:assert/strict";
import { visiblePixelBounds, restoreLayerImage } from "../lib/layer-image.ts";
import { croppedPlacement } from "../lib/image-edit.ts";

test("visible bounds exclude transparent RGB residue and retain partially transparent edge pixels", () => {
  const data = new Uint8ClampedArray(8 * 6 * 4);
  data.fill(100);
  for (let i = 3; i < data.length; i += 4) data[i] = 0;
  data[(2 * 8 + 3) * 4 + 3] = 255;
  data[(4 * 8 + 6) * 4 + 3] = 1;
  assert.deepEqual(visiblePixelBounds(data, 8, 6), { x: 3, y: 2, w: 4, h: 3 });
  data[(2 * 8 + 3) * 4 + 3] = 0;
  data[(4 * 8 + 6) * 4 + 3] = 0;
  assert.equal(visiblePixelBounds(data, 8, 6), null);
});

test("trimming and restoring padded images preserves visible geometry through rotation, flip and later movement", () => {
  for (const flip of [false, true])
    for (const rotation of [0, 45, -90, 180]) {
      const original = {
        id: "p",
        src: "original",
        width: 200,
        height: 100,
        mm: 400,
        x: 15,
        y: 35,
        flip,
        rotation,
      };
      const rect = { x: 30, y: 20, w: 100, h: 50 };
      const trimmed = {
        ...original,
        ...croppedPlacement(original, rect),
        src: "trimmed",
        width: rect.w,
        height: rect.h,
        originalSrc: original.src,
        originalFrame: { width: 200, height: 100, offsetX: 30, offsetY: 20 },
      };
      assert.equal(trimmed.mm, 200);
      const moved = { ...trimmed, x: trimmed.x + 12, y: trimmed.y - 7 };
      const restored = restoreLayerImage(moved);
      assert.ok(Math.abs(restored.x - (original.x + 12)) < 1e-8);
      assert.ok(Math.abs(restored.y - (original.y - 7)) < 1e-8);
      assert.equal(restored.mm, original.mm);
      assert.equal(restored.width, 200);
      assert.equal(restored.height, 100);
      assert.equal(restored.originalSrc, undefined);
      assert.equal(restored.originalFrame, undefined);
    }
});

test("restoring legacy edited images without trim metadata preserves current placement", () => {
  assert.deepEqual(
    restoreLayerImage({ src: "changed", originalSrc: "original" }),
    { src: "original", originalSrc: undefined, originalFrame: undefined },
  );
  assert.deepEqual(restoreLayerImage({ src: "original" }), {});
});
