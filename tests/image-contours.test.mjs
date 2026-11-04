import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeContours,
  estimateCylinderGuide,
  isolatedCandidates,
  removeIsolatedCandidates,
} from "../lib/image-contours.ts";
function image(w = 300, h = 200) {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
}
function rect(p, x, y, w, h) {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++)
      p.data.set([50, 80, 100, 255], (j * p.width + i) * 4);
  return p;
}
function cylinder(angle) {
  const p = image();
  const u = Math.cos(angle),
    v = Math.sin(angle);
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) {
      const a = (x - 150) * u + (y - 100) * v,
        b = -(x - 150) * v + (y - 100) * u;
      if (Math.abs(a) < 90 && Math.abs(b) < 12)
        p.data.set([20, 30, 40, 255], (y * p.width + x) * 4);
    }
  return p;
}
for (const angle of [0, 0.5, Math.PI / 2])
  test(`cylinder contour estimates angle ${angle} and ignores detached marks`, () => {
    const p = cylinder(angle);
    rect(p, 5, 5, 15, 5);
    const g = estimateCylinderGuide(p);
    assert.ok(g);
    assert.ok(
      Math.abs(Math.hypot(g.end.x - g.start.x, g.end.y - g.start.y) - 180) < 5,
    );
    assert.ok(Math.abs(g.startRadius - 12) < 2);
    const actual = Math.atan2(g.end.y - g.start.y, g.end.x - g.start.x);
    assert.ok(Math.abs(Math.sin(actual - angle)) < 0.03);
  });
test("opaque, empty and round shapes are not used as cylinder guides", () => {
  const opaque = rect(image(), 0, 0, 300, 200);
  assert.equal(estimateCylinderGuide(opaque), null);
  assert.equal(estimateCylinderGuide(image()), null);
  assert.equal(estimateCylinderGuide(rect(image(), 100, 70, 60, 60)), null);
  assert.deepEqual(isolatedCandidates(analyzeContours(opaque)), []);
});
test("multiple comparable objects are not assumed to be a cylinder", () => {
  const p = image();
  for (let i = 0; i < 3; i++) rect(p, 20, 20 + i * 60, 200, 20);
  assert.equal(estimateCylinderGuide(p), null);
});
test("margin marks are grouped while nearby disconnected parts remain protected", () => {
  const p = rect(image(), 50, 60, 200, 60);
  rect(p, 10, 10, 8, 8);
  rect(p, 21, 10, 8, 8);
  rect(p, 100, 125, 10, 4);
  const a = analyzeContours(p),
    c = isolatedCandidates(a);
  assert.equal(c.length, 1);
  assert.equal(c[0].regions.length, 2);
  const data = removeIsolatedCandidates(p, a, c, [c[0].id]);
  assert.equal(data[(12 * p.width + 12) * 4 + 3], 0);
  assert.equal(data[(126 * p.width + 105) * 4 + 3], 255);
  assert.equal(p.data[(12 * p.width + 12) * 4 + 3], 255);
  for (let y = 60; y < 120; y++)
    for (let x = 50; x < 250; x++)
      assert.equal(data[(y * p.width + x) * 4 + 3], 255);
});
test("unchecked candidates and source pixels remain unchanged", () => {
  const p = rect(image(), 50, 60, 200, 60);
  rect(p, 10, 10, 8, 8);
  rect(p, 280, 180, 8, 8);
  const a = analyzeContours(p),
    c = isolatedCandidates(a);
  assert.equal(c.length, 2);
  assert.deepEqual(removeIsolatedCandidates(p, a, c, []), p.data);
  const data = removeIsolatedCandidates(p, a, c, [c[0].id]);
  assert.equal(data[(182 * p.width + 282) * 4 + 3], 255);
  assert.equal(data[(12 * p.width + 12) * 4 + 3], 0);
});
