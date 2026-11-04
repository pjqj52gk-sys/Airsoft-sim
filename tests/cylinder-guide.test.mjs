import test from "node:test";
import assert from "node:assert/strict";
import {
  cylinderGeometry,
  initialCylinderGuide,
  moveCylinderHandle,
  cylinderSideSurface,
  centerGuideOnEndFaces,
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

const guide = {
  start: { x: 40, y: 60 },
  end: { x: 240, y: 60 },
  startRadius: 40,
  endRadius: 40,
};
test("selected curved side is stretched to straight edges without cropping its upper and lower tips", () => {
  const side = cylinderSideSurface(guide, 1, 0.5, "start");
  for (const v of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    const arc = Math.sqrt(1 - (2 * v - 1) ** 2);
    near(side.map(0, v).x, 40 + 20 * arc);
    near(side.map(1, v).x, 240 + 20 * arc);
    near(side.map(0.3, v).x, 100 + 20 * arc);
    near(side.map(0.3, v).y, 20 + 80 * v);
  }
  assert.equal(side.map(0, 0).x, 40);
  assert.equal(side.map(0, 0.5).x, 60);
  near(side.aspect, 2.5);
  assert.ok(side.outline.some((p) => p.x === 260));
});
test("opposite visible cap reverses both curved boundaries; no cap preserves the planar map", () => {
  const side = cylinderSideSurface(guide, 1, 0.5, "end");
  near(side.map(0, 0.5).x, 20);
  near(side.map(1, 0.5).x, 220);
  const both = cylinderSideSurface(guide, 1, 0.5, "both");
  near(both.map(0, 0.5).x, 60);
  near(both.map(1, 0.5).x, 220);
  const full = cylinderSideSurface(guide, 1, 0.5, "none");
  assert.deepEqual(full.map(0.3, 0.4), cylinderGeometry(guide).map(0.3, 0.4));
  assert.deepEqual(
    cylinderSideSurface(guide, 2, 0.5, "start").map(0.3, 0.4),
    cylinderSideSurface(guide, 1, 0.5, "start").map(0.3, 0.4),
  );
  near(cylinderSideSurface(guide, 2, 0.5, "start").aspect, 5);
  assert.throws(() =>
    cylinderSideSurface({ ...guide, end: { x: 65, y: 60 } }, 1, 1, "both"),
  );
});
test("source cap mask excludes cap and its subpixel rim but retains far silhouette and nearby side", () => {
  const side = cylinderSideSurface(guide, 1, 0.5, "start");
  assert.equal(side.visible(40, 60), false);
  assert.equal(side.visible(60.4, 60), false);
  assert.equal(side.visible(61, 60), true);
  assert.equal(side.visible(260, 60), true);
  assert.equal(side.visible(49, 21), true);
  assert.equal(cylinderSideSurface(guide, 1, 0, "start").visible(40, 60), true);
});
test("arc mapping follows rotated tapered cylinders without modifying the guide", () => {
  const g = {
    start: { x: 100, y: 30 },
    end: { x: 100, y: 230 },
    startRadius: 30,
    endRadius: 15,
  };
  const s = cylinderSideSurface(g, 1, 0.6, "end");
  for (const u of [0, 0.3, 1])
    for (const v of [0.1, 0.5, 0.9]) {
      const t = 2 * v - 1,
        r = 30 * (1 - u) + 15 * u;
      near(s.map(u, v).x, 100 - r * t);
      near(s.map(u, v).y, 30 + 200 * u - 0.6 * r * Math.sqrt(1 - t * t));
    }
  assert.equal(s.visible(100, 230), false);
  assert.equal(s.visible(100, 210), true);
  assert.deepEqual(g.start, { x: 100, y: 30 });
});
test("automatic contour endpoints move to ellipse centers, with curved selection retaining outer tips", () => {
  const bounds = {
    start: { x: 30, y: 50 },
    end: { x: 370, y: 50 },
    startRadius: 30,
    endRadius: 30,
  };
  const centered = centerGuideOnEndFaces(bounds, 2 / 3);
  assert.deepEqual(centered.start, { x: 50, y: 50 });
  assert.deepEqual(centered.end, { x: 350, y: 50 });
  const surface = cylinderSideSurface(centered, 1, 2 / 3, "start");
  near(surface.map(0, 0).x, 50);
  near(surface.map(0, 0.5).x, 70);
  near(surface.map(1, 0.5).x, 370);
  assert.deepEqual(bounds.start, { x: 30, y: 50 });
  assert.throws(() => centerGuideOnEndFaces(bounds, Infinity));
});
