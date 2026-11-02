import { readShopFile, decodeShopHtml, ShopReadError } from "@/lib/shop-fetch";
import { extractShopProduct } from "@/lib/shop-product";
import { amazonStore } from "@/lib/commerce";
import { shopUrl } from "@/lib/shop-url";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 8192)
      return Response.json({ error: "URLが長すぎます。" }, { status: 400 });
    const data = JSON.parse(body);
    const source = shopUrl(data.url);
    const amazon = (url: string) =>
      Response.json(
        {
          url,
          name: "Amazonの商品",
          site: new URL(url).hostname,
          images: [],
          dimensions: [],
          linkOnly: true,
          notice:
            "Amazonは購入リンクを登録できます。編集用には自分の写真・利用許諾のある画像を追加してください。",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (amazonStore(source.href)) return amazon(source.href);
    const file = await readShopFile(data.url, "page");
    if (amazonStore(file.url)) return amazon(file.url);
    return Response.json(extractShopProduct(decodeShopHtml(file), file.url), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error(
      "[shop-product]",
      e instanceof ShopReadError ? e.code : "parse",
    );
    return Response.json(
      {
        error: e instanceof Error ? e.message : "商品情報を取得できません。",
        code: e instanceof ShopReadError ? e.code : "page",
      },
      { status: 422 },
    );
  }
}
