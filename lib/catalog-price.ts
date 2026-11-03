import { productText } from "./product-specs.ts";
export type CatalogPrice = {
  amount: number;
  maxAmount: number;
  tax: "included" | "excluded" | "unspecified";
  kind: "msrp" | "retail";
};
function amount(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value)
    .normalize("NFKC")
    .replace(/[,￥¥\s]/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isInteger(n) && n > 0 && n <= 10000000 ? n : null;
}
export function publishedPrice(
  label: string,
  value: string,
  kind: CatalogPrice["kind"] = "msrp",
): CatalogPrice | null {
  const text = productText(value).replace(/\s+/g, " ").trim();
  // A labeled currency value only; do not pick up model numbers or an open price.
  const found = text.match(/^[￥¥]\s*([\d,]+)/) || text.match(/^([\d,]+)\s*円/);
  const n = found ? amount(found[1]) : null;
  if (!n || /オープン|未定|お問い合わせ|[〜~～]/.test(text)) return null;
  const context = productText(label + value);
  const tax = /税別|税抜|税ぬき/.test(context)
    ? "excluded"
    : /税込|税を含/.test(context)
      ? "included"
      : "unspecified";
  return { amount: n, maxAmount: n, tax, kind };
}
export function maruiPrice(html: string) {
  const text = productText(html).replace(/\s+/g, " ");
  const m = text.match(
    /メーカー希望小売価格[：:]\s*([￥¥]\s*[\d,]+\s*(?:[（(][^）)]{0,15}[）)])?)/,
  );
  return m ? publishedPrice("メーカー希望小売価格", m[1]) : null;
}
export function variantPrice(
  variants: { price?: unknown }[],
): CatalogPrice | null {
  const values = variants.map((v) => amount(v.price));
  if (!values.length || values.some((n) => n === null)) return null;
  const prices = values as number[];
  return {
    amount: Math.min(...prices),
    maxAmount: Math.max(...prices),
    tax: "unspecified",
    kind: "retail",
  };
}
export function referenceCatalogPrice(price?: CatalogPrice | null) {
  if (!price || price.amount !== price.maxAmount) return 0;
  return price.tax === "excluded"
    ? Math.round((price.amount * 110) / 100)
    : price.amount;
}
export function catalogPriceLabel(price: CatalogPrice) {
  const tax =
    price.tax === "excluded"
      ? "税別"
      : price.tax === "included"
        ? "税込"
        : "税区分未確認";
  const range = price.amount !== price.maxAmount;
  const converted = price.tax === "excluded" && !range;
  const value = converted ? referenceCatalogPrice(price) : price.amount;
  return `${price.kind === "msrp" ? "希望小売価格" : "公式販売価格"} ¥${value.toLocaleString("ja-JP")}${range ? `〜${price.maxAmount.toLocaleString("ja-JP")}` : ""}（${converted ? "税込換算" : tax}）`;
}
