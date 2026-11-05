import type { Layer, Project } from "./project.ts";

export const gunTypes = [
  "アサルトライフル",
  "サブマシンガン",
  "ライトマシンガン",
  "スナイパーライフル",
  "ショットガン",
  "ハンドガン",
  "リボルバー",
  "その他",
] as const;
export const communityBodyLimit = 3_500_000;
export type CommunitySubmission = {
  title: string;
  author: string;
  description: string;
  gunType: string;
  tags: string[];
  preview: string;
  project: Project;
};
export type CommunityCard = Omit<CommunitySubmission, "project"> & {
  id: string;
  baseName: string;
  budget: number;
  partCount: number;
  createdAt: string;
  published: boolean;
  owned: boolean;
  likeCount: number;
  liked: boolean;
};
export type CommunityLike = { id: string; likeCount: number; liked: boolean };
export type CommunityBuild = CommunityCard & { project: Project };
export type CommunityList = {
  items: CommunityCard[];
  hasMore: boolean;
  configured: boolean;
};
export class CommunityError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export const normalizeSearch = (text: string) =>
  text.normalize("NFKC").toLocaleLowerCase("ja").trim();
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CommunityError("公開データの形式が正しくありません。");
  return value as Record<string, unknown>;
};
const text = (value: unknown, max: number, required = false) => {
  if (typeof value !== "string" || value.length > max)
    throw new CommunityError("入力内容の長さを確認してください。");
  const result = value
    .trim()
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
  if (required && !result)
    throw new CommunityError("タイトルと本体を設定してください。");
  return result;
};
const finite = (value: unknown, min: number, max: number) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new CommunityError("パーツの寸法・位置・価格を確認してください。");
  return value;
};
export function publicImage(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 2_700_000 ||
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    throw new CommunityError("画像を読み込み直してください。");
  return value;
}
function link(value: unknown) {
  const input = text(value, 2500);
  if (!input) return "";
  try {
    const url = new URL(input);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error();
    return url.href;
  } catch {
    throw new CommunityError("購入リンクの形式を確認してください。");
  }
}
export function validateSubmission(value: unknown): CommunitySubmission {
  const input = object(value),
    source = object(input.project);
  if (
    source.version !== 2 ||
    !Array.isArray(source.layers) ||
    !source.layers.length ||
    source.layers.length > 60 ||
    object(source.layers[0]).visible !== true
  )
    throw new CommunityError("表示中の本体が必要です。");
  const title = text(input.title, 80, true);
  const layers: Layer[] = source.layers
    .filter((v) => object(v).visible === true)
    .map((value, index) => {
      const l = object(value);
      if (typeof l.flip !== "boolean")
        throw new CommunityError("画像の向きを確認してください。");
      return {
        id: `public-${index}`,
        name: text(l.name, 100, true),
        src: publicImage(l.src),
        width: finite(l.width, 1, 2000),
        height: finite(l.height, 1, 2000),
        mm: finite(l.mm, 1, 5000),
        x: finite(l.x, -10000, 10000),
        y: finite(l.y, -10000, 10000),
        rotation: finite(l.rotation, -36000, 36000),
        flip: l.flip,
        visible: true,
        attachedToBase: index > 0 && l.attachedToBase === true,
        price: Math.round(finite(l.price, 0, 10_000_000)),
        url: link(l.url),
        linkOrigin: "shared",
        category: text(l.category, 30),
      };
    });
  if (!gunTypes.includes(input.gunType as (typeof gunTypes)[number]))
    throw new CommunityError("銃種を選択してください。");
  if (!Array.isArray(input.tags) || input.tags.length > 6)
    throw new CommunityError("タグは6個まで設定できます。");
  const tags = [...new Set(input.tags.map((t) => text(t, 20, true)))];
  return {
    title,
    author: text(input.author, 30) || "ゲスト",
    description: text(input.description, 600),
    gunType: input.gunType as string,
    tags,
    preview: publicImage(input.preview),
    project: { version: 2, name: title, layers },
  };
}
export function buildSearchText(build: CommunitySubmission) {
  return normalizeSearch(
    [
      build.title,
      build.author,
      build.description,
      build.gunType,
      ...build.tags,
      ...build.project.layers.map((l) => l.name),
    ].join(" "),
  );
}
