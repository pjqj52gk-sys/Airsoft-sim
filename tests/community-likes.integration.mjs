// Opt-in: node --env-file=.env.development.local tests/community-likes.integration.mjs
// Uses only the explicitly named development database; always unpublishes fixtures.
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import sharp from "sharp";
import {
  publishCommunity,
  getCommunity,
  listCommunity,
  setCommunityLike,
  setCommunityPublished,
} from "../lib/community-store.ts";
if (
  new URL(process.env.DATABASE_URL || "https://invalid").pathname !==
  "/airsoft_development"
)
  throw new Error(
    "This integration test requires the airsoft_development database.",
  );
const token = randomBytes(32).toString("hex");
const owner = createHash("sha256").update(token).digest("hex");
const visitor = randomBytes(32).toString("hex");
const ids = [randomUUID(), randomUUID()];
const tag = `likes-test-${randomUUID().slice(0, 8)}`;
const src = `data:image/png;base64,${(
  await sharp({
    create: { width: 24, height: 12, channels: 4, background: "#38bdf8" },
  })
    .png()
    .toBuffer()
).toString("base64")}`;
const input = (title) => ({
  title,
  author: "動作確認",
  description: "開発環境の自動テスト",
  gunType: "アサルトライフル",
  tags: [tag],
  preview: src,
  project: {
    version: 2,
    name: title,
    layers: [
      {
        id: "base",
        name: "テスト本体",
        src,
        width: 24,
        height: 12,
        mm: 800,
        x: 0,
        y: 0,
        rotation: 0,
        flip: false,
        visible: true,
        price: 10000,
        url: "",
        category: "本体",
      },
    ],
  },
});
const created = [];
try {
  for (const [index, id] of ids.entries()) {
    await publishCommunity(input(`${tag} ${index}`), owner, id);
    created.push(id);
  }
  assert.equal((await getCommunity(ids[0], owner)).likeCount, 0);
  const concurrent = await Promise.all(
    Array.from({ length: 5 }, () => setCommunityLike(ids[0], owner, true)),
  );
  assert.ok(concurrent.every((r) => r.liked && r.likeCount === 1));
  assert.equal((await setCommunityLike(ids[0], visitor, true)).likeCount, 2);
  assert.equal((await getCommunity(ids[0], visitor)).liked, true);
  assert.equal((await getCommunity(ids[0], "another-browser")).liked, false);
  const listed = await listCommunity(
    new URLSearchParams({ q: tag, sort: "likes" }),
    owner,
  );
  assert.equal(listed.items[0].id, ids[0]);
  assert.equal(listed.items[0].likeCount, 2);
  assert.equal(listed.items[0].liked, true);
  assert.equal((await setCommunityLike(ids[0], owner, false)).likeCount, 1);
  assert.equal((await setCommunityLike(ids[0], owner, false)).likeCount, 1);
  await setCommunityPublished(ids[0], owner, false);
  await assert.rejects(
    setCommunityLike(ids[0], visitor, false),
    (e) => e.status === 404,
  );
  await assert.rejects(
    setCommunityLike(randomUUID(), visitor, true),
    (e) => e.status === 404,
  );
  await setCommunityPublished(ids[0], owner, true);
  assert.equal((await getCommunity(ids[0], visitor)).likeCount, 1);
  assert.equal((await setCommunityLike(ids[0], visitor, false)).likeCount, 0);
  // Exercise HTTP validation and cookies against the local development server.
  const base = "http://localhost:3100";
  const path = `${base}/api/community/${ids[1]}/like`;
  const put = (body, origin = base) =>
    fetch(path, {
      method: "PUT",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: `airsoft-community-owner=${token}`,
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await put({ liked: true }, "https://other.example")).status,
    403,
  );
  assert.equal((await put({ liked: "true" })).status, 400);
  const added = await put({ liked: true });
  assert.equal(added.status, 200);
  assert.deepEqual(await added.json(), {
    id: ids[1],
    likeCount: 1,
    liked: true,
  });
  assert.match(added.headers.get("cache-control"), /no-store/);
  assert.match(added.headers.get("set-cookie"), /HttpOnly/i);
  assert.deepEqual(await (await put({ liked: false })).json(), {
    id: ids[1],
    likeCount: 0,
    liked: false,
  });
  console.log(
    "PASS: concurrent/repeated likes, distinct browsers, unlike, persistence, sorting, unpublished protection, HTTP origin/body validation and private responses",
  );
} finally {
  for (const id of created) {
    await setCommunityLike(id, owner, false).catch(() => {});
    await setCommunityLike(id, visitor, false).catch(() => {});
    await setCommunityPublished(id, owner, false);
  }
}
