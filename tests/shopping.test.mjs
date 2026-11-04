import test from "node:test";
import assert from "node:assert/strict";
import { shoppingSummary, copyCommunityShoppingPlan } from "../lib/shopping.ts";
import { createComparisonPlans, capturePlan } from "../lib/comparison-plans.ts";
import { parseProject } from "../lib/project.ts";
globalThis.Image = class {
  naturalWidth = 200;
  naturalHeight = 100;
  set src(value) {
    queueMicrotask(() => this.onload());
  }
};
const project = () => ({
  version: 2,
  name: "M4",
  layers: [
    { id: "base", name: "本体", price: 20000, owned: true, visible: true },
    { id: "grip", name: "グリップ", price: 3000, visible: true },
    { id: "sight", name: "サイト", price: 10000, owned: false, visible: false },
    { id: "stock", name: "ストック", price: 0, owned: false, visible: true },
  ],
});
test("purchase budget excludes owned equipment and includes pending base, hidden parts and missing-price counts", () => {
  assert.deepEqual(shoppingSummary(project()), {
    plannedCount: 3,
    ownedCount: 1,
    plannedTotal: 13000,
    total: 33000,
    missingPrices: 1,
  });
  const p = project();
  p.layers[0].owned = false;
  assert.equal(shoppingSummary(p).plannedTotal, 33000);
  assert.deepEqual(shoppingSummary({ ...p, layers: [] }), {
    plannedCount: 0,
    ownedCount: 0,
    plannedTotal: 0,
    total: 0,
    missingPrices: 0,
  });
});
test("ownership edits stay independent across comparison plans and affect additional cost, not total value", () => {
  const plans = createComparisonPlans(project(), "a", "b");
  const edited = {
    ...plans.a,
    layers: plans.a.layers.map((l) =>
      l.id === "sight" ? { ...l, owned: true } : l,
    ),
  };
  const updated = capturePlan(plans, edited);
  assert.equal(shoppingSummary(updated.a).plannedTotal, 3000);
  assert.equal(shoppingSummary(updated.b).plannedTotal, 13000);
  assert.equal(
    shoppingSummary(updated.a).total,
    shoppingSummary(updated.b).total,
  );
  const copy = copyCommunityShoppingPlan(updated.a);
  assert.ok(copy.layers.every((l) => l.owned === false));
  assert.equal(shoppingSummary(copy).plannedTotal, 33000);
  assert.equal(updated.a.layers[0].owned, true);
});
test("JSON import preserves explicit boolean ownership and legacy or malformed values remain planned", async () => {
  const p = project();
  p.layers = p.layers.map((layer) => ({
    ...layer,
    src: "data:image/png;base64,aGVsbG8=",
    width: 200,
    height: 100,
    mm: 100,
    x: 0,
    y: 0,
    rotation: 0,
    flip: false,
    url: "",
    category: "その他",
  }));
  p.layers[2].owned = "true";
  const imported = await parseProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(
    imported.layers.map((l) => l.owned),
    [true, false, false, false],
  );
});
