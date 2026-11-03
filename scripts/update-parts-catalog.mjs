// Update metadata only. Product images are fetched from the manufacturer at runtime.
import fs from "node:fs/promises";
import { productPhotos } from "../lib/catalog-photos.mjs";
import { maruiPrice } from "../lib/catalog-price.ts";
const origin = "https://www.tokyo-marui.co.jp";
const decode = (text) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) =>
      String.fromCodePoint(
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n),
      ),
    );
const clean = (text) =>
  decode(text.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
async function get(path) {
  const response = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(20000),
    headers: {
      "User-Agent": "AirsoftCustomStudio/0.4 (manufacturer catalog index)",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.text();
}
const paths = new Set();
for (const group of [2, 3, 4, 5]) {
  const base = `/products/option/${group}/`;
  const first = await get(base);
  const pages = [first];
  for (const n of new Set(
    [...first.matchAll(/index.html\?pno=(\d+)/g)].map((m) => m[1]),
  ))
    pages.push(await get(`${base}index.html?pno=${n}`));
  for (const page of pages)
    for (const match of page.matchAll(
      /href="(?:https:\/\/www.tokyo-marui.co.jp)?(\/products\/option\/\d+\/\d+)"/g,
    ))
      paths.add(match[1]);
}
const data = [];
for (const path of [...paths].sort()) {
  const text = await get(path);
  const title = text.match(/<meta property="og:title" content="([^"]+)"/);
  const image = text.match(/<meta property="og:image" content="([^"]+)"/);
  if (!title || !image) throw new Error(`Product metadata missing: ${path}`);
  const name = clean(title[1]).split(" - ")[0];
  const dimensions = [
    ...text.matchAll(
      /<tr>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g,
    ),
  ]
    .map((m) => ({ label: clean(m[1]), value: clean(m[2]) }))
    .filter((d) => /全長|寸法|サイズ|全幅|全高|直径|外径/.test(d.label));
  const length = dimensions
    .find((d) => d.label === "全長")
    ?.value.match(/^([\d.]+)\s*mm/);
  const images = productPhotos(text);
  const category = name.includes("グリップ")
    ? "グリップ"
    : name.includes("ストック")
      ? "ストック"
      : path.includes("/3/")
        ? "光学機器"
        : "外装";
  data.push({
    id: path.split("/").at(-1),
    name,
    manufacturer: "東京マルイ",
    category,
    image: decode(image[1]).replace("http:", "https:"),
    images,
    url: origin + path,
    dimensions,
    price: maruiPrice(text),
    lengthMm: length ? Number(length[1]) : null,
    checkedAt: new Date().toISOString().slice(0, 10),
  });
}
if (data.length < 20)
  throw new Error("Catalog unexpectedly small; existing file was not changed.");
const file = new URL("../lib/parts-catalog.json", import.meta.url);
const otherManufacturers = JSON.parse(await fs.readFile(file, "utf8")).filter(
  (p) => p.manufacturer !== "東京マルイ" || p.category === "本体",
);
await fs.writeFile(
  new URL("../lib/parts-catalog.json", import.meta.url),
  JSON.stringify([...data, ...otherManufacturers], null, 2) + "\n",
);
console.log(
  `Updated ${data.length} products (${data.filter((p) => p.dimensions.length).length} with published dimensions).`,
);
