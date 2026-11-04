import test from "node:test";
import assert from "node:assert/strict";
import {
  cylinderGeometry,
  initialCylinderGuide,
  moveCylinderHandle,
} from "../lib/cylinder-guide.ts";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test("cylinder straightening uses a continuous side with evenly spaced axial samples", () => {
  const guide = {
    start: { x: 20, y: 30 },
    end: { x: 320, y: 130 },
    startRadius: 50,
    endRadius: 20,
  };
  const { map, corners, normal, length, aspect } = cylinderGeometry(guide);
  assert.deepEqual(map(0, 0.5), guide.start);
  assert.deepEqual(map(1, 0.5), guide.end);
  near(aspect, length / 70);
  for (const u of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
    const c = map(u, 0.5),
      top = map(u, 0),
      bottom = map(u, 1);
    near(c.x, 20 + 300 * u);
    near(c.y, 30 + 100 * u);
    near(
      Math.hypot(bottom.x - top.x, bottom.y - top.y),
      2 * (50 * (1 - u) + 20 * u),
    );
    near((top.x - c.x) * 300 + (top.y - c.y) * 100, 0);
  }
  assert.deepEqual(corners, [map(0, 0), map(1, 0), map(1, 1), map(0, 1)]);
  near(normal.x * normal.x + normal.y * normal.y, 1);
});
test("portrait, reverse and rotated parts retain their axis and length correction changes only output aspect", () => {
  const guide = initialCylinderGuide(100, 600);
  assert.ok(guide.end.y > guide.start.y);
  const base = cylinderGeometry(guide),
    stretched = cylinderGeometry(guide, 2);
  near(stretched.aspect, base.aspect * 2);
  assert.deepEqual(stretched.map(0.4, 0.7), base.map(0.4, 0.7));
  const reversed = cylinderGeometry({
    ...guide,
    start: guide.end,
    end: guide.start,
  });
  assert.deepEqual(reversed.map(0, 0.5), guide.end);
  assert.deepEqual(reversed.map(1, 0.5), guide.start);
});
test("handles can move beyond the image, change taper independently, and reject a collapsed axis", () => {
  const guide = initialCylinderGuide(600, 100);
  const moved = moveCylinderHandle(guide, 0, -200, 0);
  assert.ok(moved.start.x < 0);
  assert.deepEqual(guide.start, { x: 0, y: 49.5 });
  const widened = moveCylinderHandle(guide, 2, 0, -20);
  near(widened.startRadius, guide.startRadius + 20);
  assert.equal(widened.endRadius, guide.endRadius);
  const translated = moveCylinderHandle(guide, -1, 20, -10);
  near(cylinderGeometry(translated).length, cylinderGeometry(guide).length);
  assert.throws(() => cylinderGeometry({ ...guide, end: guide.start }));
  assert.throws(() => cylinderGeometry({ ...guide, startRadius: 0 }));
  assert.throws(() => cylinderGeometry(guide, Infinity));
});

test("axis length, diameter and angle can be set independently around the same center", async () => {
  const { setCylinderDimensions, cylinderEndRatio } = await import(
    "../lib/cylinder-guide.ts"
  );
  const source = initialCylinderGuide(601, 101);
  const edited = setCylinderDimensions(source, {
    length: 300,
    diameter: 40,
    angle: 30,
  });
  near(cylinderGeometry(edited).length, 300);
  near((edited.start.x + edited.end.x) / 2, 300);
  near((edited.start.y + edited.end.y) / 2, 50);
  near(
    (Math.atan2(edited.end.y - edited.start.y, edited.end.x - edited.start.x) *
      180) /
      Math.PI,
    30,
  );
  assert.equal(edited.startRadius, 20);
  assert.equal(edited.endRadius, 20);
  const thick = moveCylinderHandle(source, 4, 0, -10);
  assert.equal(thick.startRadius, 60);
  assert.equal(thick.endRadius, 60);
  assert.deepEqual(thick.start, source.start);
  assert.deepEqual(thick.end, source.end);
  assert.equal(cylinderEndRatio(0, 50), 0);
  assert.equal(cylinderEndRatio(25, 50), 0.5);
  assert.equal(cylinderEndRatio(50, 50), 1);
  assert.equal(cylinderEndRatio(100, 50), 1);
  assert.throws(() => setCylinderDimensions(source, { length: 0 }));
});
