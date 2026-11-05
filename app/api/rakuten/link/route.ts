import { approvedProductUrl } from "@/lib/product-link-policy";
import {
  rakutenAffiliateUrl,
  resolveRakutenTarget,
} from "@/lib/rakuten-affiliate";
export const runtime = "nodejs";
export const maxDuration = 20;
export async function GET(request: Request) {
  const noStore = { "Cache-Control": "no-store" };
  const input = new URL(request.url).searchParams.get("url") || "";
  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID?.trim() || "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{5,127}$/.test(affiliateId))
    return new Response(
      "商品リンクを準備できません。管理者が楽天アフィリエイトIDを設定してください。",
      { status: 503, headers: noStore },
    );
  try {
    const target = await resolveRakutenTarget(input),
      href =
        target &&
        rakutenAffiliateUrl(approvedProductUrl(target, true), affiliateId);
    if (!href)
      return new Response("楽天市場の商品URLを確認してください。", {
        status: 400,
        headers: noStore,
      });
    return new Response(null, {
      status: 302,
      headers: {
        ...noStore,
        Location: href,
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    });
  } catch {
    return new Response(
      "商品リンクを確認できませんでした。時間をおいてお試しください。",
      { status: 502, headers: noStore },
    );
  }
}
