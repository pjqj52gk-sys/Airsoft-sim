import test from "node:test";
import assert from "node:assert/strict";
import { transparentBackground } from "../lib/background-removal.ts";
function fixture() {
  const data = new Uint8ClampedArray(7 * 7 * 4);
  data.fill(255);
  for (let y = 1; y < 6; y++)
    for (let x = 1; x < 6; x++) data.set([30, 40, 50, 255], (y * 7 + x) * 4);
  data.set([255, 255, 255, 255], (3 * 7 + 3) * 4);
  return data;
}
test("enclosed holes and external background become transparent without changing dark product pixels or the source", () => {
  const data = fixture(),
    out = transparentBackground(data, 7, 7, 28);
  assert.equal(out[3], 0);
  assert.equal(out[(3 * 7 + 3) * 4 + 3], 0);
  assert.equal(out[(2 * 7 + 2) * 4 + 3], 255);
  assert.equal(data[3], 255);
});
test("the dominant border, not an object at the top-left corner, defines the background", () => {
  const data = fixture();
  data.set([0, 0, 0, 255], 0);
  const out = transparentBackground(data, 7, 7, 0);
  assert.equal(out[3], 255);
  assert.equal(out[7], 0);
  assert.equal(out[(3 * 7 + 3) * 4 + 3], 0);
});
test("tolerance applies inside the object and existing alpha is preserved", () => {
  const data = fixture();
  data.set([240, 242, 244, 255], (3 * 7 + 3) * 4);
  data.set([30, 40, 50, 90], (2 * 7 + 2) * 4);
  assert.equal(transparentBackground(data, 7, 7, 10)[(3 * 7 + 3) * 4 + 3], 255);
  const out = transparentBackground(data, 7, 7, 20);
  assert.equal(out[(3 * 7 + 3) * 4 + 3], 0);
  assert.equal(out[(2 * 7 + 2) * 4 + 3], 90);
});
test("a transparent exterior does not prevent clearing a white hole inside", () => {
  const data = fixture();
  for (let i = 0; i < 49; i++)
    if (i < 7 || i >= 42 || i % 7 === 0 || i % 7 === 6)
      data.set([0, 0, 0, 0], i * 4);
  const out = transparentBackground(data, 7, 7, 28, true);
  assert.equal(out[(3 * 7 + 3) * 4 + 3], 0);
  assert.equal(out[(2 * 7 + 2) * 4 + 3], 255);
});
test("automatic preparation preserves an image if matching would erase every visible pixel", () => {
  const data = new Uint8ClampedArray(16);
  data.fill(255);
  assert.deepEqual(transparentBackground(data, 2, 2, 0, true), data);
  assert.equal(transparentBackground(data, 2, 2, 0, false)[3], 0);
});
