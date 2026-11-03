// Discover product/category links on the official site. No product URLs or
// identifiers are inferred from retailer data. Keep existing entries on failure.
import fs from "node:fs/promises";
import { productPhotos } from "../lib/catalog-photos.mjs";
import { maruiPrice } from "../lib/catalog-price.ts";
import {
  productText,
  productIdentifiers,
  referenceLengthMm,
} from "../lib/product-specs.ts";
const origin = "https://www.tokyo-marui.co.jp";
const cache = process.env.CATALOG_CACHE_DIR;
async function read(path) {
  const file = cache ? `${cache}/${encodeURIComponent(path)}.html` : null;
  if (file) {
    try {
      return await fs.readFile(file, "utf8");
    } catch {}
  }
  const r = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  const html = await r.text();
  if (file) {
    await fs.mkdir(cache, { recursive: true });
    await fs.writeFile(file, html);
  }
  return html;
}
const links = (html, base = origin) =>
  [...html.matchAll(/href=["']([^"']+)["']/g)].flatMap((m) => {
    try {
      const u = new URL(m[1].replace(/&amp;/g, "&"), base);
      return u.origin === origin ? [u] : [];
    } catch {
      return [];
    }
  });
const groups = new Set();
for (const root of [
  "/products/electric/",
  "/products/gas/",
  "/products/aircocking/",
]) {
  for (const u of links(await read(root)))
    if (
      /^\/products\/(?:electric|gas|aircocking)\/[a-z0-9_-]+\/$/.test(
        u.pathname,
      )
    )
      groups.add(u.pathname);
}
const paths = new Set();
for (const group of [...groups].sort()) {
  const first = await read(group),
    pages = [first];
  for (const n of new Set(
    [...first.matchAll(/index.html\?pno=(\d+)/g)].map((m) => m[1]),
  ))
    pages.push(await read(`${group}index.html?pno=${n}`));
  for (const html of pages)
    for (const u of links(html, origin + group))
      if (
        /^\/products\/(?:electric|gas|aircocking)\/[a-z0-9_-]+\/\d+$/.test(
          u.pathname,
        )
      )
        paths.add(u.pathname);
}
if (paths.size < 60)
  throw new Error(`Incomplete discovery (${paths.size}); no catalog written`);
const file = new URL("../lib/parts-catalog.json", import.meta.url);
const existing = JSON.parse(await fs.readFile(file, "utf8"));
const byUrl = new Map(existing.map((p) => [p.url, p]));
const updates = [],
  failures = [];
const clean = (s) => productText(s).replace(/\s+/g, " ").trim();
const queue = [...paths].sort();
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const path = queue.shift();
      try {
        const html = await read(path),
          url = origin + path;
        const name = clean(
          html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || "",
        ).split(" - ")[0];
        const images = productPhotos(html);
        if (!name || !images.length) throw new Error("Missing product gallery");
        const dimensions = [
          ...html.matchAll(
            /<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g,
          ),
        ]
          .map((m) => ({ label: clean(m[1]), value: clean(m[2]) }))
          .filter((d) => /全長|全幅|全高|寸法|サイズ/.test(d.label));
        const old = byUrl.get(url);
        updates.push({
          ...old,
          id: old?.id || `marui-body-${path.split("/").at(-1)}`,
          name,
          manufacturer: "東京マルイ",
          category: "本体",
          image: images[0],
          images,
          url,
          dimensions,
          ...productIdentifiers(name, html, url),
          lengthMm:
            referenceLengthMm(
              dimensions.map((d) => ({ ...d, kind: "product" })),
            ) ?? null,
          price: maruiPrice(html),
          series:
            clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
              .split(" - ")[1]
              ?.split("|")[0]
              ?.trim() || "",
          checkedAt: new Intl.DateTimeFormat("sv-SE", {
            timeZone: "Asia/Tokyo",
          }).format(new Date()),
        });
      } catch (e) {
        failures.push({ path, error: e.message });
      }
    }
  }),
);
if (failures.length)
  throw new Error(`Catalog unchanged: ${JSON.stringify(failures)}`);
const merged = new Map(existing.map((p) => [p.url, p]));
updates.forEach((p) => merged.set(p.url, p));
const result = [...merged.values()].sort(
  (a, b) =>
    a.manufacturer.localeCompare(b.manufacturer) || a.id.localeCompare(b.id),
);
if (new Set(result.map((p) => p.id)).size !== result.length)
  throw new Error("Duplicate catalog IDs");
await fs.writeFile(file, JSON.stringify(result, null, 2) + "\n");
console.log(
  JSON.stringify({
    officialGroups: groups.size,
    maruiBodies: updates.length,
    total: result.length,
    photos: result.reduce((n, p) => n + p.images.length, 0),
  }),
);
