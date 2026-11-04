import type { NextRequest } from "next/server";
import {
  communityBody,
  communityFailure,
  communityOwner,
  communityResponse,
  validCommunityId,
} from "@/lib/community-http";
import { getCommunity, setCommunityPublished } from "@/lib/community-store";
import { CommunityError } from "@/lib/community";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function identity(request: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!validCommunityId(id))
    throw new CommunityError("カスタムが見つかりません。", 404);
  return { id, owner: communityOwner(request) };
}
export async function GET(request: NextRequest, context: Context) {
  try {
    const { id, owner } = await identity(request, context);
    return communityResponse(await getCommunity(id, owner.hash), owner.token);
  } catch (error) {
    return communityFailure(error);
  }
}
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id, owner } = await identity(request, context),
      body = await communityBody(request, 1024);
    if (
      !body ||
      typeof body !== "object" ||
      typeof (body as { published?: unknown }).published !== "boolean"
    )
      throw new CommunityError("公開状態を指定してください。");
    return communityResponse(
      await setCommunityPublished(
        id,
        owner.hash,
        (body as { published: boolean }).published,
      ),
      owner.token,
    );
  } catch (error) {
    return communityFailure(error);
  }
}
