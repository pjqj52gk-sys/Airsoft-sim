import type { NextRequest } from "next/server";
import {
  communityBody,
  communityFailure,
  communityOwner,
  communityResponse,
  validCommunityId,
} from "@/lib/community-http";
import { listCommunity, publishCommunity } from "@/lib/community-store";
import { CommunityError } from "@/lib/community";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  try {
    const owner = communityOwner(request);
    return communityResponse(
      await listCommunity(request.nextUrl.searchParams, owner.hash),
      owner.token,
    );
  } catch (error) {
    return communityFailure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const input = await communityBody(request),
      owner = communityOwner(request);
    const id = request.headers.get("idempotency-key") || "";
    if (!validCommunityId(id))
      throw new CommunityError("公開操作をやり直してください。");
    return communityResponse(
      await publishCommunity(input, owner.hash, id),
      owner.token,
      201,
    );
  } catch (error) {
    return communityFailure(error);
  }
}
