export type ProductDimension = {
  label: string;
  value: string;
  kind: "product" | "package" | "compatibility";
};
export type ProductIdentifiers = { janCodes: string[]; modelNumbers: string[] };
export function validJan(code: string) {
  if (!/^\d{13}$/.test(code)) return false;
  const total = [...code.slice(0, 12)].reduce(
    (sum, n, i) => sum + Number(n) * (i % 2 ? 3 : 1),
    0,
  );
  return (10 - (total % 10)) % 10 === Number(code[12]);
}
export function productText(input: string) {
  return input
    .slice(0, 150000)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<(?:br\s*\/?|\/(?:p|li|tr|div))>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .normalize("NFKC");
}
export function productIdentifiers(
  title: string,
  description = "",
): ProductIdentifiers {
  const text = productText(description),
    name = productText(title);
  const codes = [...name.matchAll(/(?<!\d)(\d{13})(?!\d)/g)].map((m) => m[1]);
  for (const m of text.matchAll(
    /(?:JAN(?:コード)?(?:\s*\/\s*UPC)?|EAN|GTIN)\s*[:：]?\s*(\d{13})(?!\d)/gi,
  ))
    if (
      !/(?:対応|互換|参考)[^。\n]{0,20}$/.test(
        text.slice(Math.max(0, m.index! - 25), m.index),
      )
    )
      codes.push(m[1]);
  const models = [
    ...text.matchAll(
      /(?:メーカー\s*)?(?:型番|品番|MPN)\s*[:：]?\s*([A-Z0-9][A-Z0-9._\/-]{2,39})/gi,
    ),
  ].map((m) => m[1].toUpperCase());
  return {
    janCodes: [...new Set(codes.filter(validJan))].slice(0, 12),
    modelNumbers: [...new Set(models)].slice(0, 12),
  };
}
export function productDimensions(description: string): ProductDimension[] {
  const text = productText(description).replace(
    /(?=(?:パッケージ|梱包|外箱)(?:サイズ|寸法))/g,
    "\n",
  );
  const dimensions: ProductDimension[] = [];
  let section: ProductDimension["kind"] = "product";
  for (const line of text.split(/\n/)) {
    if (
      /^\s*[■●・【]?\s*(?:梱包|パッケージ|外箱)\s*(?:サイズ|寸法|情報)\s*[:：】]?/.test(
        line,
      )
    )
      section = "package";
    else if (
      /^\s*[■●・]?\s*(?:商品仕様|製品仕様|本体サイズ|製品サイズ|商品サイズ|サイズ)\s*[:：]/.test(
        line,
      )
    )
      section = "product";
    const regex =
      /(本体|商品|製品|梱包|パッケージ|外箱)?\s*(全長|全幅|全高|直径|外径|長さ|高さ|幅|寸法|サイズ)(?:\([^)]{1,15}\))?\s*[:：]?\s*(?:約\s*)?((?:\d+(?:\.\d+)?\s*[x×*]\s*)*\d+(?:\.\d+)?\s*(?:mm|cm|ミリ|センチ))/gi;
    for (const match of line.matchAll(regex)) {
      const prefix = line.slice(Math.max(0, match.index! - 25), match.index);
      let kind: ProductDimension["kind"] = /梱包|パッケージ|外箱/.test(
        match[1] || "",
      )
        ? "package"
        : section;
      if (/本体|商品|製品/.test(match[1] || "")) kind = "product";
      if (
        /(?:対応|適合|取付)(?:する)?(?:機器|製品|銃|本体|レイル|レール)?(?:の)?$/.test(
          prefix,
        )
      )
        kind = "compatibility";
      let value = match[3].trim();
      const after = line.slice(match.index! + match[0].length);
      if (/^\s*(?:の)?(?:マウント)?(?:レイル|レール)/.test(after))
        kind = "compatibility";
      const range = after.match(
        /^\s*(?:~|〜|～|\/|から|-)\s*\d+(?:\.\d+)?\s*(?:mm|cm|ミリ|センチ)(?:\s*\([^)]{0,40}\))?/i,
      );
      if (range) value += range[0];
      const label = (match[1] || "") + match[2];
      if (
        !dimensions.some(
          (d) => d.label === label && d.value === value && d.kind === kind,
        ) &&
        dimensions.length < 12
      )
        dimensions.push({ label, value, kind });
    }
  }
  return dimensions;
}
export function referenceLengthMm(dimensions: ProductDimension[]) {
  const lengths = dimensions
    .filter(
      (d) => d.kind === "product" && /^(?:本体|商品|製品)?全長$/.test(d.label),
    )
    .map((d) => {
      const m = d.value.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|ミリ|センチ)$/i);
      return m ? Number(m[1]) * (/cm|センチ/i.test(m[2]) ? 10 : 1) : undefined;
    });
  const unique = [...new Set(lengths)];
  return unique.length === 1 &&
    unique[0] !== undefined &&
    unique[0] > 0 &&
    unique[0] <= 5000
    ? unique[0]
    : undefined;
}
export type SourcedDimension = ProductDimension & {
  source: "official" | "retail";
  conflict?: boolean;
};
const dimensionKey = (s: string) =>
  s.replace(/^(本体|製品|商品)/, "").replace(/\s/g, "");
const dimensionValue = (s: string) =>
  s
    .replace(/\s/g, "")
    .replace(/(\d+(?:\.\d+)?)cm/gi, (_, n) => `${Number(n) * 10}mm`);
export function mergeDimensions(
  official: ProductDimension[],
  retail: ProductDimension[],
): SourcedDimension[] {
  const result: SourcedDimension[] = official.map((d) => ({
    ...d,
    source: "official",
  }));
  for (const d of retail) {
    if (
      result.some(
        (x) =>
          dimensionKey(x.label) === dimensionKey(d.label) &&
          dimensionValue(x.value) === dimensionValue(d.value) &&
          x.kind === d.kind,
      )
    )
      continue;
    const same = result.filter(
      (x) =>
        x.source === "official" &&
        x.kind === "product" &&
        d.kind === "product" &&
        dimensionKey(x.label) === dimensionKey(d.label),
    );
    same.forEach((x) => (x.conflict = true));
    result.push({ ...d, source: "retail", conflict: same.length > 0 });
  }
  return result;
}
export function combinedReferenceLength(
  official: ProductDimension[],
  retail: ProductDimension[],
  published?: number | null,
) {
  if (
    mergeDimensions(official, retail).some(
      (d) => d.conflict && /全長$/.test(d.label),
    )
  )
    return undefined;
  if (
    published &&
    Number.isFinite(published) &&
    published > 0 &&
    published <= 5000
  )
    return published;
  return referenceLengthMm(official) ?? referenceLengthMm(retail);
}
