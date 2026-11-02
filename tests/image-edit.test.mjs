import test from "node:test";
import assert from "node:assert/strict";
import { resizeAroundCenter } from "../lib/image-edit.ts";
import {
  cropRect,
  croppedPlacement,
  measuredWidth,
  quadMap,
} from "../lib/image-edit.ts";
import { comparisonBounds } from "../lib/comparison.ts";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test("two-point calibration uses the selected distance instead of image padding", () => {
  close(
    measuredWidth(
      1000,
      [
        { x: 100, y: 50 },
        { x: 900, y: 50 },
      ],
      800,
    ),
    1000,
  );
  close(
    measuredWidth(
      1000,
      [
        { x: 0, y: 0 },
        { x: 300, y: 400 },
      ],
      100,
    ),
    200,
  );
  assert.throws(() =>
    measuredWidth(
      1000,
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
      10,
    ),
  );
  for (const value of [0, -1, NaN, Infinity])
    assert.throws(() =>
      measuredWidth(
        1000,
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        value,
      ),
    );
});
test("crop normalizes reversed corners and clips to image boundaries", () => {
  assert.deepEqual(
    cropRect(
      [
        { x: 50 - 1e-12, y: 50 - 1e-12 },
        { x: 350 + 1e-12, y: 150 + 1e-12 },
      ],
      400,
      200,
    ),
    { x: 50, y: 50, w: 300, h: 100 },
  );
  assert.deepEqual(
    cropRect(
      [
        { x: 90.2, y: 70.1 },
        { x: 10.6, y: -10 },
      ],
      100,
      80,
    ),
    { x: 10, y: 0, w: 81, h: 71 },
  );
  assert.throws(() =>
    cropRect(
      [
        { x: 10, y: 10 },
        { x: 10, y: 30 },
      ],
      100,
      80,
    ),
  );
});
test("cropping preserves every retained pixel position under flip and rotation", () => {
  const rect = { x: 30, y: 10, w: 90, h: 50 };
  for (const flip of [false, true])
    for (const rotation of [0, 45, 90, 180, -135]) {
      const layer = {
        width: 200,
        height: 100,
        mm: 400,
        x: 120,
        y: 190,
        flip,
        rotation,
      };
      const changed = croppedPlacement(layer, rect);
      const a = (rotation * Math.PI) / 180,
        s = flip ? -1 : 1;
      const original = (x, y) => ({
        x: 320 + s * (x - 100) * 2 * Math.cos(a) - (y - 50) * 2 * Math.sin(a),
        y: 290 + s * (x - 100) * 2 * Math.sin(a) + (y - 50) * 2 * Math.cos(a),
      });
      const cropped = (x, y) => ({
        x:
          changed.x +
          90 +
          s * (x - 45) * 2 * Math.cos(a) -
          (y - 25) * 2 * Math.sin(a),
        y:
          changed.y +
          50 +
          s * (x - 45) * 2 * Math.sin(a) +
          (y - 25) * 2 * Math.cos(a),
      });
      for (const [x, y] of [
        [0, 0],
        [90, 50],
        [20, 15],
      ]) {
        const old = original(x + 30, y + 10),
          next = cropped(x, y);
        close(old.x, next.x);
        close(old.y, next.y);
      }
      assert.equal(changed.mm, 180);
    }
});
test("perspective map reaches all four selected corners", () => {
  for (const points of [
    [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 0, y: 100 },
    ],
    [
      { x: 30, y: 10 },
      { x: 190, y: 30 },
      { x: 170, y: 95 },
      { x: 0, y: 80 },
    ],
  ]) {
    const map = quadMap(points);
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ].forEach(([x, y], i) => {
      const actual = map(x, y);
      close(actual.x, points[i].x);
      close(actual.y, points[i].y);
    });
  }
  assert.throws(() =>
    quadMap([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ]),
  );
  assert.throws(() => quadMap(new Array(4).fill({ x: 0, y: 0 })));
});
test("comparison bounds contain rotated visible items from both builds", () => {
  const layer = {
    id: "x",
    visible: true,
    width: 200,
    height: 100,
    mm: 200,
    x: 0,
    y: 0,
    rotation: 90,
  };
  const bounds = comparisonBounds([
    { layers: [layer] },
    { layers: [{ ...layer, x: 500 }] },
  ])
    .split(" ")
    .map(Number);
  close(bounds[0], 20);
  close(bounds[1], -80);
  close(bounds[2], 660);
  close(bounds[3], 260);
  assert.equal(
    comparisonBounds([{ layers: [{ ...layer, visible: false }] }]),
    "0 0 1120 620",
  );
});
test("wheel resizing preserves the image centre and clamps actual dimensions", () => {
  const layer = { mm: 150, width: 300, height: 100, x: 430, y: 160 };
  const result = resizeAroundCenter(layer, 2);
  assert.equal(result.mm, 300);
  assert.equal(result.x + result.mm / 2, layer.x + layer.mm / 2);
  assert.equal(
    result.y + (result.mm * layer.height) / layer.width / 2,
    layer.y + (layer.mm * layer.height) / layer.width / 2,
  );
  assert.equal(resizeAroundCenter(layer, 1e10).mm, 5000);
  assert.equal(resizeAroundCenter(layer, 1e-10).mm, 1);
  assert.equal(resizeAroundCenter(layer, NaN).mm, 150);
});
