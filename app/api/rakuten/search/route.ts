import { searchGenre, normalizeRakuten, searchParams } from "@/lib/rakuten";
export const runtime = "nodejs";
export const maxDuration = 15;
export async function GET(request: Request) {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const applicationId = process.env.RAKUTEN_APPLICATION_ID?.trim();
  const accessKey = process.env.RAKUTEN_ACCESS_KEY?.trim();
  const params = new URL(request.url).searchParams;
  const configured = !!applicationId && !!accessKey;
  if (!params.has("q")) return reply({ configured });
  let query;
  try {
    query = searchParams(params);
  } catch {
    return reply(
      {
        error:
          "検索語は128バイト以内で入力してください。ページ・並び順も確認してください。",
      },
      400,
    );
  }
  if (!configured)
    return reply(
      {
        error:
          "楽天APIの設定が必要です。管理者がアプリID・アクセスキーを設定してください。",
      },
      503,
    );
  const url = new URL(
    "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701",
  );
  url.search = new URLSearchParams({
    applicationId,
    keyword: query.keyword,
    genreId: searchGenre(
      params.get("category") || "",
      params.get("scope") || "",
    ),
    page: String(query.page),
    sort: query.sort,
    hits: "12",
    formatVersion: "2",
    imageFlag: "1",
    availability: "1",
  }).toString();
  if (process.env.RAKUTEN_AFFILIATE_ID?.trim())
    url.searchParams.set(
      "affiliateId",
      process.env.RAKUTEN_AFFILIATE_ID.trim(),
    );
  const headers: Record<string, string> = {
    accessKey,
    Accept: "application/json",
  };
  const origin = process.env.RAKUTEN_ALLOWED_ORIGIN?.trim();
  if (origin) {
    try {
      const registered = new URL(origin);
      if (
        !["http:", "https:"].includes(registered.protocol) ||
        registered.username ||
        registered.password
      )
        throw new Error();
      headers.Origin = registered.origin;
      headers.Referer = `${registered.origin}/`;
    } catch {
      return reply(
        { error: "楽天APIの登録サイト設定を確認してください。" },
        503,
      );
    }
  }
  try {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 429)
      return reply(
        {
          error: "楽天の検索が混み合っています。少し待って再検索してください。",
        },
        429,
      );
    if (response.status === 404)
      return reply({ items: [], count: 0, page: query.page, pageCount: 0 });
    if ([401, 403].includes(response.status))
      return reply(
        { error: "楽天APIのキーと許可サイトの設定を確認してください。" },
        502,
      );
    if (!response.ok)
      return reply(
        {
          error:
            "楽天の検索を取得できませんでした。検索語を変えて再検索してください。",
        },
        502,
      );
    return reply(normalizeRakuten(await response.json()));
  } catch {
    return reply(
      { error: "楽天に接続できませんでした。時間をおいて再検索してください。" },
      502,
    );
  }
}
