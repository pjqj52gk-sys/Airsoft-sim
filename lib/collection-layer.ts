import { readImage, uid, type Layer } from "./project";
import type { CollectionItem } from "./collection";
export async function collectionLayer(
  item: CollectionItem,
): Promise<{ layer: Layer; reuse: boolean }> {
  if (item.layer)
    return {
      layer: {
        ...item.layer,
        url: item.url,
        linkOrigin: item.linkOrigin,
        owned: item.owned,
        libraryId: item.id,
      },
      reuse: true,
    };
  if (!item.image)
    throw new Error("画像が未登録です。検索から画像を追加してください。");
  const response =
    item.image.startsWith("/api/part-image?") ||
    item.image.startsWith("data:image/")
      ? await fetch(item.image)
      : await fetch("/api/shop-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: item.image }),
        });
  if (!response.ok)
    throw new Error("画像を取得できません。検索から別の画像を選んでください。");
  const blob = await response.blob(),
    image = await readImage(
      new File([blob], "registered-image", { type: blob.type }),
    );
  return {
    reuse: false,
    layer: {
      ...image,
      id: uid(),
      libraryId: item.id,
      name: item.name,
      category: item.category,
      url: item.url,
      linkOrigin: item.linkOrigin,
      price: item.price,
      owned: item.owned,
      mm: item.category === "本体" ? 800 : 150,
      x: 0,
      y: 0,
      rotation: 0,
      flip: false,
      visible: true,
    },
  };
}
