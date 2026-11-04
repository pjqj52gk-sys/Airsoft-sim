// Manufacturer-owned collections. Preserve variant-specific identifiers/photos.
import fs from "node:fs/promises";
import { shopifyCatalogProducts } from "../lib/official-shopify-catalog.mjs";
const collections = [
  "mode-2",
  "nitro-vo",
  "quintes-sence",
  "nine-ball",
  "f-factory",
];
const products = new Map();
for (const collection of collections) {
  let complete = false;
  const seen = new Set();
  for (let page = 1; page <= 8; page++) {
    const response = await fetch(
      `https://laylax.com/collections/${collection}/products.json?limit=250&page=${page}`,
      { signal: AbortSignal.timeout(20000) },
    );
    if (!response.ok)
      throw new Error(`LAYLAX ${collection}: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.products)) throw new Error("Invalid product data");
    for (const product of data.products) {
      if (seen.has(product.id)) throw new Error("Repeated pagination");
      seen.add(product.id);
      products.set(product.id, {
        ...product,
        catalogInclude:
          products.get(product.id)?.catalogInclude ||
          ["mode-2", "nitro-vo", "quintes-sence"].includes(collection),
      });
    }
    if (data.products.length < 250) {
      complete = true;
      break;
    }
  }
  if (!complete) throw new Error(`Incomplete collection: ${collection}`);
}
const checkedAt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
}).format(new Date());
const added = [...products.values()].flatMap((p) =>
  shopifyCatalogProducts(p, "laylax", checkedAt),
);
if (added.length < 40)
  throw new Error(
    "Catalog unexpectedly small; existing catalog was not changed.",
  );
const path = new URL("../lib/parts-catalog.json", import.meta.url);
const existing = JSON.parse(await fs.readFile(path, "utf8")).filter(
  (p) => p.manufacturer !== "LAYLAX",
);
await fs.writeFile(
  path,
  JSON.stringify([...existing, ...added], null, 2) + "\n",
);
console.log(
  `LAYLAX: ${added.length} variants, ${added.filter((p) => p.dimensions.length).length} with dimensions, ${added.filter((p) => p.janCodes.length).length} with JAN.`,
);
