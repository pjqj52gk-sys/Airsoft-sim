import fs from "node:fs/promises";
import { productPhotos } from "../lib/catalog-photos.mjs";
import { maruiPrice } from "../lib/catalog-price.ts";
import { productText, referenceLengthMm } from "../lib/product-specs.ts";
const origin = "https://www.tokyo-marui.co.jp";
const base = "/products/electric/nextgeneration/";
const get = async (path) => {
  const r = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Manufacturer page: ${r.status}`);
  return r.text();
};
const first = await get(base),
  pages = [first];
for (const n of new Set(
  [...first.matchAll(/index.html\?pno=(\d+)/g)].map((m) => m[1]),
))
  pages.push(await get(`${base}index.html?pno=${n}`));
const paths = new Set(
  pages.flatMap((h) =>
    [...h.matchAll(/href="([^"]+)"/g)]
      .map((m) => new URL(m[1], origin + base))
      .filter(
        (u) =>
          u.origin === origin &&
          /^\/products\/electric\/nextgeneration\/\d+$/.test(u.pathname),
      )
      .map((u) => u.pathname),
  ),
);
const clean = (s) => productText(s).replace(/\s+/g, " ").trim();
const added = [];
for (const path of paths) {
  const html = await get(path);
  const name = clean(
    html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || "",
  ).split(" - ")[0];
  const images = productPhotos(html);
  if (!name || !images.length) throw new Error(`Missing gallery: ${path}`);
  const dimensions = [
    ...html.matchAll(
      /<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g,
    ),
  ]
    .map((m) => ({ label: clean(m[1]), value: clean(m[2]) }))
    .filter((d) => /全長|全幅|全高|寸法|サイズ/.test(d.label));
  added.push({
    id: `marui-body-${path.split("/").at(-1)}`,
    name,
    manufacturer: "東京マルイ",
    category: "本体",
    image: images[0],
    images,
    url: origin + path,
    dimensions,
    price: maruiPrice(html),
    lengthMm:
      referenceLengthMm(dimensions.map((d) => ({ ...d, kind: "product" }))) ??
      null,
    checkedAt: new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Tokyo",
    }).format(new Date()),
  });
}
if (added.length < 15)
  throw new Error("Incomplete body catalog; no data written");
const file = new URL("../lib/parts-catalog.json", import.meta.url);
const existing = JSON.parse(await fs.readFile(file, "utf8")).filter(
  (p) => !p.id.startsWith("marui-body-"),
);
await fs.writeFile(
  file,
  JSON.stringify([...existing, ...added], null, 2) + "\n",
);
console.log(
  `Tokyo Marui bodies: ${added.length} products / ${added.reduce((n, p) => n + p.images.length, 0)} original photos`,
);
