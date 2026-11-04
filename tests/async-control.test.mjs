import test from "node:test";
import assert from "node:assert/strict";
import { mapConcurrent, createTaskQueue } from "../lib/async-control.ts";
import { writeWorkspace, writeDraft } from "../lib/storage.ts";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
test("image work is bounded, finishes in input order, and supports empty batches", async () => {
  let active = 0,
    peak = 0;
  const result = await mapConcurrent([8, 2, 5, 1, 3], 2, async (value) => {
    peak = Math.max(peak, ++active);
    await delay(value);
    active--;
    return value * 2;
  });
  assert.equal(peak, 2);
  assert.equal(active, 0);
  assert.deepEqual(result, [16, 4, 10, 2, 6]);
  assert.deepEqual(await mapConcurrent([], 3, async (x) => x), []);
  await assert.rejects(mapConcurrent([1], 0, async (x) => x));
});
test("a failed batch stops starting jobs and waits for in-flight work before rejecting", async () => {
  let finished = false;
  const started = [];
  await assert.rejects(
    mapConcurrent([0, 1, 2, 3], 2, async (value) => {
      started.push(value);
      if (value === 0) {
        await delay(1);
        throw Error("decode failed");
      }
      await delay(10);
      finished = true;
      return value;
    }),
    /decode failed/,
  );
  assert.deepEqual(started, [0, 1]);
  assert.equal(finished, true);
});
test("a failed queued save rejects its caller without blocking later saves", async () => {
  const queue = createTaskQueue(),
    writes = [];
  const first = queue(async () => {
    await delay(2);
    writes.push(1);
    throw Error("quota");
  });
  const second = queue(async () => {
    writes.push(2);
    return "saved";
  });
  await assert.rejects(first, /quota/);
  assert.equal(await second, "saved");
  assert.deepEqual(writes, [1, 2]);
});
test("workspace and draft writes preserve invocation order despite delayed database opening", async () => {
  const previous = globalThis.indexedDB,
    stored = new Map(),
    snapshots = [];
  let opened = 0,
    closed = 0;
  globalThis.indexedDB = {
    open() {
      const request = {};
      const number = ++opened;
      setTimeout(
        () => {
          request.result = {
            close() {
              closed++;
            },
            transaction() {
              const values = [];
              const tx = {
                objectStore() {
                  return {
                    put(value, key) {
                      values.push([key, value]);
                    },
                  };
                },
              };
              setTimeout(() => {
                for (const [key, value] of values) stored.set(key, value);
                snapshots.push([...stored]);
                tx.oncomplete();
              }, 0);
              return tx;
            },
          };
          request.onsuccess();
        },
        number === 1 ? 15 : 0,
      );
      return request;
    },
  };
  try {
    const project = (name) => ({ version: 2, name, layers: [] });
    await Promise.all([
      writeWorkspace(project("old"), { active: "a" }),
      writeWorkspace(project("new"), { active: "b" }),
      writeDraft(project("latest")),
    ]);
    assert.deepEqual(
      snapshots.map((rows) => rows.find(([key]) => key === "draft")[1].name),
      ["old", "new", "latest"],
    );
    assert.equal(stored.get("comparison").active, "b");
    assert.equal(opened, 3);
    assert.equal(closed, 3);
  } finally {
    globalThis.indexedDB = previous;
  }
});
