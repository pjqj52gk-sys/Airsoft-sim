import { readShopFile, ShopReadError } from "@/lib/shop-fetch";
import { amazonImage, amazonStore } from "@/lib/commerce";
import { shopUrl } from "@/lib/shop-url";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 8192)
      return Response.json({ error: "URLが長すぎます。" }, { status: 400 });
    const data = JSON.parse(body);
    const url = shopUrl(data.url);
    if (amazonImage(url.href) || amazonStore(url.href))
      return Response.json(
        {
          error:
            "Amazonの画像は編集用に取り込めません。自分の写真や利用許諾のあるメーカー画像を使ってください。",
        },
        { status: 422 },
      );
    const file = await readShopFile(data.url, "image");
    if (amazonImage(file.url) || amazonStore(file.url))
      return Response.json(
        {
          error:
            "Amazonの画像は編集用に取り込めません。利用許諾のある画像を使ってください。",
        },
        { status: 422 },
      );
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.type.split(";")[0],
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[shop-image]", e instanceof ShopReadError ? e.code : "url");
    return Response.json(
      { error: e instanceof Error ? e.message : "画像を取得できません。" },
      { status: 422 },
    );
  }
}
