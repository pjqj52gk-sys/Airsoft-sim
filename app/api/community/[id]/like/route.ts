import type { NextRequest } from "next/server";
import {
  communityBody,
  communityFailure,
  communityOwner,
  communityResponse,
  validCommunityId,
} from "@/lib/community-http";
import { setCommunityLike } from "@/lib/community-store";
import { CommunityError } from "@/lib/community";
export const runtime = "nodejs";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!validCommunityId(id))
      throw new CommunityError("カスタムが見つかりません。", 404);
    const body = await communityBody(request, 128);
    if (
      !body ||
      typeof body !== "object" ||
      typeof (body as { liked?: unknown }).liked !== "boolean"
    )
      throw new CommunityError("いいねの状態を指定してください。");
    const owner = communityOwner(request);
    return communityResponse(
      await setCommunityLike(
        id,
        owner.hash,
        (body as { liked: boolean }).liked,
      ),
      owner.token,
    );
  } catch (error) {
    return communityFailure(error);
  }
}
