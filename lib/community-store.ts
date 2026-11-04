import { neon } from "@neondatabase/serverless";
import sharp from "sharp";
import {
  buildSearchText,
  CommunityError,
  normalizeSearch,
  validateSubmission,
  communityBodyLimit,
  type CommunityBuild,
  type CommunityCard,
  type CommunitySubmission,
} from "./community.ts";

export const communityConfigured = () => Boolean(process.env.DATABASE_URL);
let schema: Promise<unknown> | undefined;
function sqlClient() {
  if (!communityConfigured())
    throw new CommunityError("公開機能は準備中です。", 503);
  return neon(process.env.DATABASE_URL!);
}
async function database() {
  const sql = sqlClient();
  // The lock serializes the first cold starts; no credentials or database work at build time.
  schema ??= sql
    .transaction([
      sql`SELECT pg_advisory_xact_lock(70924118)`,
      sql`CREATE TABLE IF NOT EXISTS community_builds (
      id text PRIMARY KEY, owner_hash text NOT NULL, title text NOT NULL, author text NOT NULL,
      description text NOT NULL, gun_type text NOT NULL, tags jsonb NOT NULL, base_name text NOT NULL,
      budget integer NOT NULL, part_count integer NOT NULL, preview text NOT NULL, project jsonb NOT NULL,
      search_text text NOT NULL, published boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
      sql`CREATE INDEX IF NOT EXISTS community_public_created ON community_builds (published, created_at DESC)`,
      sql`CREATE INDEX IF NOT EXISTS community_owner_created ON community_builds (owner_hash, created_at DESC)`,
    ])
    .catch((error) => {
      schema = undefined;
      throw error;
    });
  await schema;
  return sql;
}
async function cleanImage(src: string, preview = false) {
  try {
    const image = sharp(Buffer.from(src.split(",")[1], "base64"), {
      limitInputPixels: 4_000_000,
      animated: false,
    });
    const meta = await image.metadata();
    if (
      !["png", "jpeg", "webp"].includes(meta.format!) ||
      (meta.pages ?? 1) > 1 ||
      !meta.width ||
      !meta.height ||
      Math.max(meta.width, meta.height) > 2000
    )
      throw new Error();
    let { data, info } = await image
      .rotate()
      .resize({
        width: preview ? 960 : 1200,
        height: preview ? 480 : 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toBuffer({ resolveWithObject: true });
    if (preview && data.length > 120_000) {
      ({ data, info } = await sharp(data)
        .resize({ width: 640, height: 320, fit: "inside" })
        .webp({ quality: 65 })
        .toBuffer({ resolveWithObject: true }));
      if (data.length > 120_000) throw new Error();
    }
    return {
      src: `data:image/webp;base64,${data.toString("base64")}`,
      width: info.width,
      height: info.height,
    };
  } catch {
    throw new CommunityError("画像を読み込み直してから公開してください。");
  }
}
export async function cleanSubmission(
  input: unknown,
): Promise<CommunitySubmission> {
  const build = validateSubmission(input);
  // Sequential decode bounds memory, including hostile compressed images.
  for (const layer of build.project.layers) {
    const image = await cleanImage(layer.src);
    if (
      Math.abs(image.width / image.height - layer.width / layer.height) > 0.02
    )
      throw new CommunityError("画像の寸法が一致しません。");
    layer.src = image.src;
    layer.width = image.width;
    layer.height = image.height;
  }
  build.preview = (await cleanImage(build.preview, true)).src;
  if (Buffer.byteLength(JSON.stringify(build)) > communityBodyLimit)
    throw new CommunityError(
      "公開する画像が大きすぎます。画像やパーツ数を減らしてください。",
      413,
    );
  return build;
}
function card(row: Record<string, unknown>, owner: string): CommunityCard {
  return {
    id: row.id as string,
    title: row.title as string,
    author: row.author as string,
    description: row.description as string,
    gunType: row.gun_type as string,
    tags: row.tags as string[],
    preview: row.preview as string,
    baseName: row.base_name as string,
    budget: Number(row.budget),
    partCount: Number(row.part_count),
    createdAt: new Date(row.created_at as string).toISOString(),
    published: row.published as boolean,
    owned: row.owner_hash === owner,
  };
}
export async function listCommunity(params: URLSearchParams, owner: string) {
  if (!communityConfigured())
    return { items: [], hasMore: false, configured: false };
  const sql = await database();
  const query = `%${normalizeSearch((params.get("q") || "").slice(0, 100)).replace(/[\\%_]/g, "\\$&")}%`;
  const type = (params.get("type") || "").slice(0, 40),
    mine = params.get("mine") === "1";
  const budget = Number(params.get("budget") || 0);
  const max =
    Number.isFinite(budget) && budget > 0
      ? Math.min(budget, 600_000_000)
      : 600_000_000;
  const page = Math.max(1, Math.min(200, Number(params.get("page")) || 1));
  const cheap = params.get("sort") === "budget";
  const rows =
    await sql`SELECT id, owner_hash, title, author, description, gun_type, tags, preview,
      base_name, budget, part_count, created_at, published FROM community_builds
    WHERE (${mine} AND owner_hash = ${owner} OR NOT ${mine} AND published = true)
      AND search_text LIKE ${query} AND (${type} = '' OR gun_type = ${type}) AND budget <= ${max}
    ORDER BY CASE WHEN ${cheap} THEN budget END ASC, created_at DESC, id DESC LIMIT 13 OFFSET ${(Math.floor(page) - 1) * 12}`;
  return {
    items: rows.slice(0, 12).map((r) => card(r, owner)),
    hasMore: rows.length > 12,
    configured: true,
  };
}
export async function publishCommunity(
  input: unknown,
  owner: string,
  requestId: string,
) {
  const build = await cleanSubmission(input),
    sql = await database();
  const id = requestId;
  const budget = build.project.layers.reduce((sum, l) => sum + l.price, 0);
  const result = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtext(${owner}))`,
    sql`INSERT INTO community_builds (id, owner_hash, title, author, description, gun_type, tags, base_name, budget, part_count, preview, project, search_text)
      SELECT ${id}, ${owner}, ${build.title}, ${build.author}, ${build.description}, ${build.gunType}, ${JSON.stringify(build.tags)}::jsonb,
        ${build.project.layers[0].name}, ${budget}, ${build.project.layers.length - 1}, ${build.preview}, ${JSON.stringify(build.project)}::jsonb, ${buildSearchText(build)}
      WHERE (SELECT count(*) FROM community_builds WHERE owner_hash=${owner} AND created_at > now()-interval '1 hour') < 5
      ON CONFLICT (id) DO NOTHING RETURNING id`,
  ]);
  if (!result[1].length) {
    const existing =
      await sql`SELECT id FROM community_builds WHERE id=${id} AND owner_hash=${owner}`;
    if (!existing.length)
      throw new CommunityError(
        "公開は1時間に5件までです。時間をおいてお試しください。",
        429,
      );
  }
  return getCommunity(id, owner);
}
export async function getCommunity(
  id: string,
  owner: string,
): Promise<CommunityBuild> {
  const sql = await database();
  const rows =
    await sql`SELECT * FROM community_builds WHERE id=${id} AND (published=true OR owner_hash=${owner})`;
  if (!rows.length)
    throw new CommunityError("このカスタムは公開されていません。", 404);
  return { ...card(rows[0], owner), project: rows[0].project };
}
export async function setCommunityPublished(
  id: string,
  owner: string,
  published: boolean,
) {
  const sql = await database();
  const rows =
    await sql`UPDATE community_builds SET published=${published} WHERE id=${id} AND owner_hash=${owner} RETURNING id`;
  if (!rows.length)
    throw new CommunityError(
      "投稿を管理できるブラウザーで開いてください。",
      403,
    );
  return getCommunity(id, owner);
}
