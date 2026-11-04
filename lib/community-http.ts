import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { CommunityError, communityBodyLimit } from "./community.ts";

const cookieName = "airsoft-community-owner";
export function communityOwner(request: NextRequest) {
  const existing = request.cookies.get(cookieName)?.value;
  const token =
    existing && /^[a-f0-9]{64}$/.test(existing)
      ? existing
      : randomBytes(32).toString("hex");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}
export function communityResponse(
  value: unknown,
  token?: string,
  status = 200,
) {
  const response = NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
  if (token)
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  return response;
}
export function communityFailure(error: unknown) {
  if (error instanceof CommunityError)
    return communityResponse({ error: error.message }, undefined, error.status);
  console.error(
    "Community request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return communityResponse(
    {
      error:
        "カスタムを取得・保存できませんでした。時間をおいてお試しください。",
    },
    undefined,
    503,
  );
}
export async function communityBody(
  request: NextRequest,
  limit = communityBodyLimit,
): Promise<unknown> {
  let sameOrigin = false;
  try {
    const origin = new URL(request.headers.get("origin") || "");
    sameOrigin =
      ["https:", "http:"].includes(origin.protocol) &&
      origin.host === request.headers.get("host");
  } catch {
    /* A browser write must carry a valid Origin. */
  }
  if (!sameOrigin || request.headers.get("sec-fetch-site") === "cross-site")
    throw new CommunityError("このサイトから操作してください。", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new CommunityError("JSON形式で送信してください。", 415);
  if (Number(request.headers.get("content-length")) > limit)
    throw new CommunityError("画像の合計サイズが大きすぎます。", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new CommunityError("公開データがありません。");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new CommunityError("画像の合計サイズが大きすぎます。", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new CommunityError("公開データの形式が正しくありません。");
  }
}
export const validCommunityId = (id: string) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
    id,
  );
