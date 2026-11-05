import { normalizeYahoo, yahooAirsoftCategory } from "@/lib/yahoo-search";
import { searchParams } from "@/lib/rakuten";
import { yahooAffiliateUrl } from "@/lib/yahoo-link";
export const runtime = "nodejs";
export const maxDuration = 15;
export async function GET(request: Request) {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const params = new URL(request.url).searchParams,
    appid = process.env.YAHOO_APPLICATION_ID?.trim();
  if (!params.has("q"))
    return reply({
      configured: !!appid,
      affiliateConfigured: !!yahooAffiliateUrl(
        "https://store.shopping.yahoo.co.jp/shop/item.html",
        process.env.YAHOO_AFFILIATE_SID?.trim() || "",
        process.env.YAHOO_AFFILIATE_PID?.trim() || "",
      ),
    });
  let query;
  try {
    query = searchParams(params);
    if (query.page > 83) throw Error();
  } catch {
    return reply({ error: "検索語・ページ・並び順を確認してください。" }, 400);
  }
  if (!appid)
    return reply(
      {
        error:
          "Yahoo!ショッピングのAPI設定が必要です。管理者がアプリケーションIDを設定してください。",
      },
      503,
    );
  const url = new URL(
    "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch",
  );
  url.search = new URLSearchParams({
    appid,
    query: query.keyword,
    genre_category_id: yahooAirsoftCategory,
    image_size: "600",
    results: "12",
    start: String((query.page - 1) * 12 + 1),
    sort:
      query.sort === "standard"
        ? "-score"
        : query.sort === "+itemPrice"
          ? "+price"
          : "-price",
    in_stock: "true",
  }).toString();
  const template = yahooAffiliateUrl(
    "https://store.shopping.yahoo.co.jp/shop/item.html",
    process.env.YAHOO_AFFILIATE_SID?.trim() || "",
    process.env.YAHOO_AFFILIATE_PID?.trim() || "",
  );
  if (template) {
    const base = new URL(template);
    base.searchParams.set("vc_url", "");
    url.searchParams.set("affiliate_type", "vc");
    url.searchParams.set("affiliate_id", base.href);
  }
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 60 },
    });
    if (response.status === 429)
      return reply(
        {
          error: "Yahoo!の検索が混み合っています。少し待って検索してください。",
        },
        429,
      );
    if ([401, 403].includes(response.status))
      return reply(
        {
          error:
            "Yahoo!のアプリケーションIDとAPIの利用設定を確認してください。",
        },
        502,
      );
    if (!response.ok)
      return reply({ error: "Yahoo!の商品情報を取得できませんでした。" }, 502);
    return reply(normalizeYahoo(await response.json(), query.page));
  } catch {
    return reply(
      { error: "Yahoo!に接続できませんでした。時間をおいてお試しください。" },
      502,
    );
  }
}
