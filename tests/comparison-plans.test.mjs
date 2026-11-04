import test from "node:test";
import assert from "node:assert/strict";
import {
  createComparisonPlans,
  capturePlan,
  alignComparisonPlans,
  planTotal,
} from "../lib/comparison-plans.ts";
import { comparisonBounds } from "../lib/comparison.ts";
const project = () => ({
  version: 2,
  name: "M4",
  layers: [
    {
      id: "base",
      mm: 800,
      width: 800,
      height: 240,
      x: 120,
      y: 190,
      rotation: 0,
      visible: true,
      price: 20000,
    },
    {
      id: "part",
      mm: 100,
      width: 200,
      height: 100,
      x: 400,
      y: 160,
      rotation: 30,
      visible: false,
      price: 4000,
    },
  ],
});
test("initial plans are independent of each other and the original build", () => {
  const original = project();
  const plans = createComparisonPlans(original, "a", "b");
  plans.b.layers[1].price = 8000;
  plans.b.layers[1].mm = 150;
  assert.equal(plans.a.layers[1].price, 4000);
  assert.equal(original.layers[1].mm, 100);
  const edited = {
    ...plans.a,
    layers: [...plans.a.layers, { ...plans.a.layers[1], id: "new" }],
  };
  const saved = capturePlan(plans, edited);
  assert.equal(saved.a.layers.length, 3);
  assert.equal(saved.b.layers.length, 2);
  assert.equal(plans.a.layers.length, 2);
});
test("preview alignment preserves scale and relative placement without modifying the saved positions", () => {
  const a = project(),
    b = project();
  b.layers = b.layers.map((layer) => ({
    ...layer,
    x: layer.x + 300,
    y: layer.y - 80,
  }));
  const before = structuredClone(b);
  const [left, right] = alignComparisonPlans(a, b);
  assert.deepEqual(right.layers, left.layers);
  assert.deepEqual(b, before);
  assert.equal(comparisonBounds([left]), comparisonBounds([right]));
  const smaller = project();
  smaller.layers[0].mm = 600;
  const [, aligned] = alignComparisonPlans(a, smaller);
  assert.equal(aligned.layers[0].mm, 600);
  assert.equal(aligned.layers[0].x + 300, a.layers[0].x + 400);
});
test("price totals include base and hidden parts and produce signed variant differences", () => {
  const a = project(),
    b = project();
  b.layers[1].price = 6000;
  assert.equal(planTotal(a), 24000);
  assert.equal(planTotal(b) - planTotal(a), 2000);
  assert.equal(planTotal({ ...a, layers: [] }), 0);
});
