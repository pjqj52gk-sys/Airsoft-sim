import { primaryProductMetadata } from "./product-metadata.ts";
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
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const code =
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .normalize("NFKC");
}
export function productIdentifiers(
  title: string,
  description = "",
  source = "",
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
  const primary = primaryProductMetadata(description, source);
  const structuredCodes: string[] = [],
    structuredModels: string[] = [];
  if (primary) {
    for (const key of ["gtin13", "gtin", "ean"]) {
      const code = String(primary[key] || "").normalize("NFKC");
      if (validJan(code)) structuredCodes.push(code);
    }
    if (
      typeof primary.mpn === "string" &&
      /^[A-Z0-9][A-Z0-9._/\s-]{2,39}$/i.test(primary.mpn)
    )
      structuredModels.push(primary.mpn.normalize("NFKC").toUpperCase().trim());
  }
  // Rakuten exposes the current item's JAN in Product microdata even when its
  // description has no JAN label. A merchant SKU/itemCode is not a JAN or MPN.
  for (const m of description.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = Object.fromEntries(
      [...m[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map((a) => [
        a[1].toLowerCase(),
        a[3],
      ]),
    );
    if (
      /^(?:gtin13|gtin|ean)$/i.test(attributes.itemprop || "") &&
      validJan(attributes.content || "")
    )
      codes.push(attributes.content);
  }
  return {
    janCodes: [
      ...new Set(
        structuredCodes.length ? structuredCodes : codes.filter(validJan),
      ),
    ].slice(0, 12),
    modelNumbers: [
      ...new Set(structuredModels.length ? structuredModels : models),
    ].slice(0, 12),
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
      /(本体|商品|製品|梱包|パッケージ|外箱)?\s*(全長|全幅|全高|直径|外径|長さ|高さ|幅|奥行き?|寸法|サイズ)(?:\([^)]{1,15}\))?\s*[:：]?\s*(?:約\s*)?((?:\d+(?:\.\d+)?\s*[x×*]\s*)*\d+(?:\.\d+)?(?:\s*[/~〜～-]\s*\d+(?:\.\d+)?)?\s*(?:mm|cm|ミリ|センチ))/gi;
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
      else value += after.match(/^\s*\([^)]{1,40}\)/)?.[0] || "";
      const label = (match[1] || "") + match[2];
      if (
        !dimensions.some(
          (d) => d.label === label && d.value === value && d.kind === kind,
        ) &&
        dimensions.length < 12
      )
        dimensions.push({ label, value, kind });
    }
    // Explicit axes are usable. Unlabelled triples (e.g. 46×27×27) stay whole,
    // because their width/height/length order is not universally defined.
    for (const axis of explicitAxisDimensions(line)) {
      const kind = section;
      if (
        !dimensions.some(
          (d) =>
            d.label === axis.label && d.value === axis.value && d.kind === kind,
        ) &&
        dimensions.length < 16
      )
        dimensions.push({ ...axis, kind });
    }
  }
  return dimensions;
}
function explicitAxisDimensions(
  value: string,
): { label: string; value: string }[] {
  const plain = value.normalize("NFKC");
  if (!/[×x*]/i.test(plain)) return [];
  const axes = [
    ...plain.matchAll(
      /(?:^|[\s(×x*,:：])(?:(幅|横|高さ|縦|奥行き?|長さ|W|H|D|L))\s*[):：]?\s*(\d+(?:\.\d+)?)\s*(mm|cm|ミリ|センチ)?/gi,
    ),
  ];
  if (axes.length < 2 || axes.length > 3) return [];
  const sharedUnit = axes.at(-1)?.[3];
  if (!sharedUnit) return [];
  const labels: Record<string, string> = {
    W: "幅",
    横: "幅",
    幅: "幅",
    H: "高さ",
    縦: "高さ",
    高さ: "高さ",
    D: "奥行き",
    奥行: "奥行き",
    奥行き: "奥行き",
    L: "長さ",
    長さ: "長さ",
  };
  return axes.map((m) => ({
    label: labels[m[1].toUpperCase()],
    value: `${m[2]}${m[3] || sharedUnit}`,
  }));
}
export function referenceLengthMm(dimensions: ProductDimension[]) {
  const lengths = dimensions
    .filter(
      (d) =>
        d.kind === "product" &&
        /^(?:(?:本体|商品|製品)?全長|長さ|length|overall length)$/i.test(
          d.label,
        ),
    )
    .map((d) => {
      const m = d.value.match(
        /^(?:約\s*)?(\d+(?:\.\d+)?)\s*(mm|cm|m|in(?:ch)?|インチ|ミリ|センチ)$/i,
      );
      const factor = m
        ? (
            {
              mm: 1,
              cm: 10,
              m: 1000,
              in: 25.4,
              inch: 25.4,
              インチ: 25.4,
              ミリ: 1,
              センチ: 10,
            } as Record<string, number>
          )[m[2].toLowerCase()]
        : 1;
      return m ? Number(m[1]) * factor : undefined;
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
export type ReferenceLengthOption = { mm: number; label: string };
export function referenceLengthOptions(
  official: ProductDimension[],
  retail: ProductDimension[] = [],
  published?: number | null,
): ReferenceLengthOption[] {
  const options: ReferenceLengthOption[] = [];
  const dimensions = mergeDimensions(official, retail)
    .flatMap((d) =>
      /サイズ|寸法|dimensions|size/i.test(d.label)
        ? [
            d,
            ...explicitAxisDimensions(d.value).map((axis) => ({
              ...d,
              ...axis,
            })),
          ]
        : [d],
    )
    .sort(
      (a, b) =>
        Number(/全長|overall length/i.test(b.label)) -
        Number(/全長|overall length/i.test(a.label)),
    );
  for (const d of dimensions) {
    if (
      d.kind !== "product" ||
      !/^(?:(?:本体|商品|製品)?(?:全長|全幅|全高|長さ|幅|高さ|奥行き?|直径|外径)|対物レンズ径|対物レンズ外径|チューブ径|length|overall length|width|height|depth)$/i.test(
        d.label,
      )
    )
      continue;
    const value = d.value.normalize("NFKC");
    const plain = value.replace(/\([^)]*\)/g, "");
    if (/[×x*]/i.test(plain)) continue;
    const inherited = plain.replace(
      /(\d+(?:\.\d+)?)\s*([/〜~～-])\s*(\d+(?:\.\d+)?)\s*(mm|cm|ミリ|センチ)/gi,
      "$1$4 $2 $3$4",
    );
    const values = [
      ...inherited.matchAll(/(\d+(?:\.\d+)?)\s*(mm|cm|ミリ|センチ)/gi),
    ];
    const note = value.match(/\(([^)]*)\)\s*$/)?.[1];
    for (const [i, m] of values.entries()) {
      const mm = Number(m[1]) * (/cm|センチ/i.test(m[2]) ? 10 : 1);
      if (mm <= 0 || mm > 5000 || options.some((o) => o.mm === mm)) continue;
      options.push({
        mm,
        label: `${d.source === "official" ? "公式" : "販売店"} · ${d.label} ${mm} mm${i === values.length - 1 && note ? `（${note}）` : ""}`,
      });
    }
  }
  if (
    published &&
    Number.isFinite(published) &&
    published > 0 &&
    published <= 5000 &&
    !options.some((o) => o.mm === published)
  )
    options.unshift({ mm: published, label: `公式 · 全長 ${published} mm` });
  return options.slice(0, 16);
}
const dimensionKey = (s: string) => {
  const key = s
    .normalize("NFKC")
    .replace(/^(本体|製品|商品)/, "")
    .replace(/\s/g, "")
    .toLowerCase();
  return /^(?:全長|長さ|length|overalllength)$/.test(key) ? "全長" : key;
};
const dimensionValue = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/\s/g, "")
    .replace(/センチ/gi, "cm")
    .replace(/ミリ/gi, "mm")
    .replace(/(\d+(?:\.\d+)?)cm/gi, (_, n) => `${Number(n) * 10}mm`)
    .replace(/\d+(?:\.\d+)?/g, (n) => String(Number(n)));
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
      (d) => d.conflict && dimensionKey(d.label) === "全長",
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
