import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  validateSubmission,
  buildSearchText,
  normalizeSearch,
} from "../lib/community.ts";
import { cleanSubmission } from "../lib/community-store.ts";

const png =
  "data:image/png;base64," +
  (
    await sharp({
      create: { width: 24, height: 12, channels: 4, background: "#38bdf8" },
    })
      .png()
      .toBuffer()
  ).toString("base64");
const layer = {
  id: "private-id",
  name: "東京マルイ M4",
  src: png,
  width: 24,
  height: 12,
  mm: 800,
  x: 100,
  y: 100,
  rotation: 0,
  flip: false,
  visible: true,
  price: 12000,
  url: "https://example.com/item",
  category: "本体",
  originalSrc: png,
  owned: true,
  originalFrame: { width: 100, height: 100, offsetX: 0, offsetY: 0 },
};
const submission = () => ({
  title: " Ｍ４ カスタム ",
  author: "",
  description: "test",
  gunType: "アサルトライフル",
  tags: ["CQB", "ブラック", "CQB"],
  preview: png,
  project: {
    version: 2,
    name: "private name",
    layers: [
      { ...layer },
      { ...layer, id: "hidden", visible: false, name: "private hidden layer" },
    ],
  },
});
test("public builds omit hidden layers, original images, private frame and client IDs", () => {
  const result = validateSubmission(submission());
  assert.equal(result.project.layers.length, 1);
  assert.equal(result.project.name, "Ｍ４ カスタム");
  assert.equal(result.project.layers[0].originalSrc, undefined);
  assert.equal(result.project.layers[0].owned, undefined);
  assert.equal(result.project.layers[0].originalFrame, undefined);
  assert.equal(result.project.layers[0].id, "public-0");
  assert.equal(result.author, "ゲスト");
  assert.deepEqual(result.tags, ["CQB", "ブラック"]);
});
test("search includes names and parts with normalized full width characters", () => {
  const result = validateSubmission(submission());
  assert.ok(buildSearchText(result).includes("m4"));
  assert.ok(buildSearchText(result).includes("東京マルイ"));
  assert.equal(normalizeSearch(" ＣＱＢ "), "cqb");
});
test("rejects active content, invalid links, non-finite geometry, missing base and excess tags", () => {
  for (const patch of [
    { src: "data:image/svg+xml;base64,PHN2Zy8+" },
    { url: "javascript:alert(1)" },
    { url: "https://user:secret@example.com/" },
    { mm: Infinity },
    { width: 0 },
    { price: -1 },
    { visible: false },
  ]) {
    const input = submission();
    input.project.layers[0] = { ...input.project.layers[0], ...patch };
    assert.throws(() => validateSubmission(input));
  }
  const input = submission();
  input.tags = Array(7).fill("tag");
  assert.throws(() => validateSubmission(input));
});
test("server checks actual image bytes and re-encodes to WebP", async () => {
  const result = await cleanSubmission(submission());
  assert.match(result.project.layers[0].src, /^data:image\/webp;base64,/);
  const bad = submission();
  bad.project.layers[0].src = "data:image/png;base64,YmFk";
  await assert.rejects(cleanSubmission(bad));
  const mismatch = submission();
  mismatch.project.layers[0].width = 30;
  await assert.rejects(cleanSubmission(mismatch));
});
