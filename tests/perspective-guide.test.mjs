import test from "node:test";
import assert from "node:assert/strict";
import {
  makeGuide,
  rotate,
  textureTransform,
  initialCubeFace,
  yControls,
  guideFromY,
  guidePoint,
} from "../lib/perspective-guide.ts";
import { matchesPart } from "../lib/part-search.ts";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const points = [
  { x: 30, y: 20 },
  { x: 200, y: 35 },
  { x: 190, y: 140 },
  { x: 20, y: 160 },
];
test("the cube front face projects exactly onto the selected image corners", () => {
  const guide = makeGuide(points, 250, 180, 0.5);
  guide.front.forEach((p, i) => {
    close(guide.cx + (guide.focal * p.x) / p.z, points[i].x);
    close(guide.cy + (guide.focal * p.y) / p.z, points[i].y);
  });
});
test("front alignment rotates the selected plane to constant depth", () => {
  const guide = makeGuide(points, 250, 180, 0.5);
  const rotated = guide.front.map((p) => rotate(p, guide.flat));
  rotated.forEach((p) => close(p.z, rotated[0].z));
  close(rotated[0].y, rotated[1].y);
});
test("the projective CSS matrix maps all texture corners to the cube face", () => {
  const m = textureTransform(points, 400, 200)
    .slice(9, -1)
    .split(",")
    .map(Number);
  [
    [0, 0],
    [400, 0],
    [400, 200],
    [0, 200],
  ].forEach(([x, y], i) => {
    const w = m[3] * x + m[7] * y + m[15];
    close((m[0] * x + m[4] * y + m[12]) / w, points[i].x);
    close((m[1] * x + m[5] * y + m[13]) / w, points[i].y);
  });
});
test("catalog search matches Japanese full-width text and multiple terms", () => {
  assert.equal(
    matchesPart("ｍｔｄ マルイ", ["MTD（マルイタクティカルドットサイト）"]),
    true,
  );
  assert.equal(
    matchesPart("123 サイレンサー", ["タクティカルサイレンサー", "123 mm"]),
    true,
  );
  assert.equal(matchesPart("ストック", ["フォアグリップ"]), false);
});
test("Y arms follow dragged endpoints while every model edge stays orthogonal", () => {
  const template = makeGuide(initialCubeFace(400, 300), 400, 300, 1);
  const handles = yControls(template);
  const original = guideFromY(handles, template);
  const a = original.front[0],
    o = original.front[1],
    b = original.back[1],
    c = original.front[2];
  const axes = [a, b, c].map((p) => ({
    x: p.x - o.x,
    y: p.y - o.y,
    z: p.z - o.z,
  }));
  for (const [i, j] of [
    [0, 1],
    [0, 2],
    [1, 2],
  ])
    close(
      axes[i].x * axes[j].x + axes[i].y * axes[j].y + axes[i].z * axes[j].z,
      0,
    );
  for (const index of [1, 2, 3]) {
    const changed = handles.map((p, i) =>
      i === index ? { x: p.x + 5, y: p.y + 4 } : p,
    );
    const actual = yControls(guideFromY(changed, template));
    actual.forEach((p, i) => {
      close(p.x, changed[i].x);
      close(p.y, changed[i].y);
    });
  }
});
test("moving the Y centre translates all eight projected corners without changing shape", () => {
  const template = makeGuide(initialCubeFace(400, 300), 400, 300, 1);
  const handles = yControls(template);
  const original = guideFromY(handles, template);
  const moved = guideFromY(
    handles.map((p) => ({ x: p.x + 12, y: p.y - 8 })),
    template,
  );
  [...moved.front, ...moved.back].forEach((p, i) => {
    const before = guidePoint(
        original,
        [...original.front, ...original.back][i],
      ),
      after = guidePoint(moved, p);
    close(after.x, before.x + 12);
    close(after.y, before.y - 8);
  });
  assert.throws(() =>
    guideFromY([handles[0], handles[0], handles[2], handles[3]], template),
  );
});
test("perspective reconstructs a known rectangular box from its Y instead of the default cube depths", () => {
  const template = makeGuide(initialCubeFace(600, 400), 600, 400, 1);
  const o = { x: 0, y: 0, z: 1 };
  const axes = [
    rotate({ x: -0.45, y: 0, z: 0 }, { yaw: 32, pitch: 24, roll: 0 }),
    rotate({ x: 0, y: 0, z: 0.7 }, { yaw: 32, pitch: 24, roll: 0 }),
    rotate({ x: 0, y: 0.16, z: 0 }, { yaw: 32, pitch: 24, roll: 0 }),
  ];
  const vertices = [
    o,
    ...axes.map((p) => ({ x: o.x + p.x, y: o.y + p.y, z: o.z + p.z })),
  ];
  const controls = vertices.map((p) => ({
    x: 300 + (900 * p.x) / p.z,
    y: 200 + (900 * p.y) / p.z,
  }));
  const guide = guideFromY(controls, template, 1);
  const expected = [
    vertices[1],
    o,
    vertices[3],
    {
      x: axes[0].x + axes[2].x,
      y: axes[0].y + axes[2].y,
      z: 1 + axes[0].z + axes[2].z,
    },
  ];
  guide.front.forEach((p, i) => {
    close(p.x, expected[i].x);
    close(p.y, expected[i].y);
    close(p.z, expected[i].z);
  });
});
test("a wide shallow Y like the reported photo stays pinned as perspective changes", () => {
  const template = makeGuide(initialCubeFace(510, 210), 510, 210, 1);
  const controls = [
    { x: 178, y: 94 },
    { x: 95, y: 62 },
    { x: 397, y: 70 },
    { x: 178, y: 160 },
  ];
  for (const strength of [0, 0.01, 0.35, 0.7, 1]) {
    const guide = guideFromY(controls, template, strength);
    yControls(guide).forEach((p, i) => {
      close(p.x, controls[i].x);
      close(p.y, controls[i].y);
    });
    const transformed = guide.front.map((p) => rotate(p, guide.flat));
    transformed.forEach((p) => close(p.z, transformed[0].z));
    for (const p of [...guide.front, ...guide.back])
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.z > 0);
  }
  const guide = guideFromY(controls, template, 0);
  const opposite = guidePoint(guide, guide.front[3]);
  close(opposite.x, 95);
  close(opposite.y, 128);
});
