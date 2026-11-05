import { yahooAffiliateUrl } from "@/lib/yahoo-link";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url"),
    sid = process.env.YAHOO_AFFILIATE_SID?.trim() || "",
    pid = process.env.YAHOO_AFFILIATE_PID?.trim() || "";
  const href = yahooAffiliateUrl(url, sid, pid);
  if (!/^\d{3,20}$/.test(sid) || !/^\d{3,20}$/.test(pid))
    return new Response(
      "Yahoo!ショッピングの購入リンクは準備中です。管理者がアフィリエイト設定を確認してください。",
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  if (!href)
    return new Response("Yahoo!ショッピングの商品URLを確認してください。", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  return new Response(null, {
    status: 302,
    headers: {
      Location: href,
      "Cache-Control": "no-store",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}
