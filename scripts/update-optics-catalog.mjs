import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { novelProduct, vectorProduct } from "../lib/official-catalog.mjs";
import { referenceLengthMm } from "../lib/product-specs.ts";
const read = async (url) => {
  const cache = process.env.CATALOG_CACHE_DIR;
  const file = cache
    ? `${cache}/${createHash("sha256").update(url).digest("hex")}.html`
    : null;
  if (file) {
    try {
      return await fs.readFile(file, "utf8");
    } catch {}
  }
  let html;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      html = await r.text();
      break;
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  if (file) {
    await fs.mkdir(cache, { recursive: true });
    await fs.writeFile(file, html);
  }
  return html;
};
const providers = [
  {
    name: "NOVEL ARMS",
    prefix: "novel",
    origin: "https://novelarms.co.jp",
    lists: [
      "/products_cat/02dot-sight/",
      "/products_cat/01rifle-scope/",
      "/products_cat/11prism-scopes/",
    ],
    parse: novelProduct,
  },
  {
    name: "Vector Optics",
    prefix: "vector",
    origin: "https://www.vectoroptics.jp",
    lists: [
      "/category/product/dotsite/",
      "/category/product/scope/",
      "/category/product/magnifier/",
    ],
    parse: vectorProduct,
  },
];
const path = new URL("../lib/parts-catalog.json", import.meta.url);
let catalog = JSON.parse(await fs.readFile(path, "utf8"));
for (const provider of providers) {
  const urls = new Set();
  const lists = [...provider.lists],
    visited = new Set();
  while (lists.length) {
    const list = lists.shift();
    if (visited.has(list)) continue;
    if (visited.size >= 60)
      throw new Error("Too many catalog pages; no data written");
    visited.add(list);
    // Discover actual product links from official category headings; never guess product URLs.
    const html = await read(provider.origin + list);
    for (const m of html.matchAll(/href="([^"]+)"/g)) {
      const u = new URL(m[1], provider.origin + list);
      if (
        u.origin === provider.origin &&
        provider.lists.some((base) =>
          new RegExp(`^${base}page/\\d+/$`).test(u.pathname),
        ) &&
        !visited.has(u.pathname)
      )
        lists.push(u.pathname);
    }
    const links =
      provider.prefix === "novel"
        ? [
            ...html.matchAll(
              /href="(https:\/\/novelarms\.co\.jp\/products\/[^"#]+)"/g,
            ),
          ].map((m) => m[1])
        : [...html.matchAll(/<h[23][^>]*>[\s\S]*?<a[^>]*href="([^"]+)"/g)].map(
            (m) => m[1],
          );
    for (const url of links) {
      const u = new URL(url, provider.origin);
      if (u.origin === provider.origin) urls.add(u.href);
    }
  }
  if (provider.prefix === "vector")
    urls.add("https://www.vectoroptics.jp/scrd-12ii/");
  const added = [],
    models = new Set();
  const queue = [...urls];
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (queue.length) {
        const url = queue.shift();
        const p = provider.parse(await read(url));
        if (!p.name || !p.images.length) continue;
        if (p.modelNumbers[0] && models.has(p.modelNumbers[0])) continue;
        p.modelNumbers.forEach((m) => models.add(m));
        const dimensions = p.dimensions.map((d) => ({ ...d, kind: "product" }));
        added.push({
          ...p,
          id: `${provider.prefix}-${new URL(url).pathname.split("/").filter(Boolean).pop()}`,
          manufacturer: provider.name,
          category: "光学機器",
          image: p.images[0],
          url,
          lengthMm: referenceLengthMm(dimensions) ?? null,
          checkedAt: new Intl.DateTimeFormat("sv-SE", {
            timeZone: "Asia/Tokyo",
          }).format(new Date()),
        });
      }
    }),
  );
  added.sort((a, b) => a.id.localeCompare(b.id));
  if (added.length < 3)
    throw new Error(`${provider.name}: incomplete catalog; no data written`);
  catalog = [
    ...catalog.filter((p) => p.manufacturer !== provider.name),
    ...added,
  ];
  console.log(
    `${provider.name}: ${added.length} products, ${added.reduce((n, p) => n + p.images.length, 0)} photos, ${added.filter((p) => p.dimensions.length).length} with dimensions`,
  );
}
await fs.writeFile(path, JSON.stringify(catalog, null, 2) + "\n");
