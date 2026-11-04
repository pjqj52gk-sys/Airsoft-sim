import catalog from "@/lib/parts-catalog.json";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const item = catalog.find((p) => p.id === id);
  if (!item)
    return Response.json({ error: "商品が見つかりません。" }, { status: 404 });
  const index = Number(params.get("photo") || "0");
  if (!Number.isInteger(index) || index < 0 || index >= item.images.length)
    return Response.json({ error: "画像が見つかりません。" }, { status: 404 });
  const url = new URL(item.images[index]);
  const revision = params.get("v");
  if (revision && revision !== `${url.pathname.split("/").pop()}${url.search}`)
    return Response.json(
      { error: "写真が更新されました。画面を再読み込みしてください。" },
      { status: 409 },
    );
  const manufacturerImage =
    (item.manufacturer === "東京マルイ" &&
      url.hostname === "www.tokyo-marui.co.jp" &&
      (url.pathname.startsWith("/appimg/option/") ||
        (item.category === "本体" &&
          url.pathname.startsWith("/appimg/product/")))) ||
    (["LAYLAX", "KRYTAC"].includes(item.manufacturer) &&
      url.hostname === "cdn.shopify.com" &&
      url.pathname.startsWith("/s/files/1/0843/1095/0186/")) ||
    (item.manufacturer === "PTS" &&
      url.hostname === "cdn.shopify.com" &&
      url.pathname.startsWith("/s/files/1/0592/0368/2494/")) ||
    (item.manufacturer === "NOVEL ARMS" &&
      url.hostname === "novelarms.co.jp" &&
      url.pathname.startsWith("/wp-content/uploads/")) ||
    (item.manufacturer === "Vector Optics" &&
      url.hostname === "www.vectoroptics.jp" &&
      url.pathname.startsWith("/wp-content/uploads/"));
  if (url.protocol !== "https:" || !manufacturerImage)
    return Response.json({ error: "画像を取得できません。" }, { status: 400 });
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      redirect: "error",
      next: { revalidate: 86400 },
    });
    const type = response.headers.get("content-type")?.split(";")[0] || "";
    if (
      !response.ok ||
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type) ||
      !response.body
    )
      throw new Error("Invalid image");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 5 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Too large");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return new Response(bytes, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      {
        error: "画像を取得できません。公式ページから保存して追加してください。",
      },
      { status: 502 },
    );
  }
}
