export type WishInput = {
  name: string;
  url: string;
  price: number;
  category: string;
  image?: string;
};
export type WishItem = WishInput & { id: string; savedAt: number };
// Keep product variants, remove only known referral/tracking parameters.
export function wishlistKey(
  item: Pick<WishInput, "url" | "name" | "category">,
) {
  try {
    let url = new URL(item.url);
    if (url.hostname === "hb.afl.rakuten.co.jp" && url.searchParams.has("pc")) {
      const product = new URL(url.searchParams.get("pc")!);
      if (product.hostname === "item.rakuten.co.jp") url = product;
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw Error();
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (
        /^(?:utm_.+|scid|sc2id|rafcid|gclid|fbclid|tag|linkCode|camp|creative)$/i.test(
          key,
        )
      )
        url.searchParams.delete(key);
    url.searchParams.sort();
    return "url:" + url.href;
  } catch {
    return "name:" + item.name.normalize("NFKC").trim() + ":" + item.category;
  }
}
export const wishTotal = (items: readonly WishInput[]) =>
  items.reduce((sum, item) => sum + item.price, 0);
