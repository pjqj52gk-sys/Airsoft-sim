// Public manufacturer / authorized Japanese distributor product feeds only.
// Bounded pagination, sequential requests, and atomic all-provider replacement.
import fs from "node:fs/promises";
import { shopifyCatalogProducts } from "../lib/official-shopify-catalog.mjs";
const checkedAt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
}).format(new Date());
const added = [];
for (const [provider, origin, path] of [
  ["krytac", "https://laylax.com", "/collections/krytac/products.json"],
  ["pts", "https://pts-steelshop.com", "/products.json"],
]) {
  const seen = new Set();
  let complete = false;
  const records = [];
  for (let page = 1; page <= 12; page++) {
    const response = await fetch(`${origin}${path}?limit=250&page=${page}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`${provider}: HTTP ${response.status}`);
    const { products } = await response.json();
    if (!Array.isArray(products))
      throw new Error(`${provider}: invalid product feed`);
    for (const product of products) {
      if (seen.has(product.id))
        throw new Error(`${provider}: repeated pagination`);
      seen.add(product.id);
      records.push(...shopifyCatalogProducts(product, provider, checkedAt));
    }
    if (products.length < 250) {
      complete = true;
      break;
    }
  }
  if (!complete || records.length < 10)
    throw new Error(`${provider}: incomplete catalog; no changes written`);
  added.push(...records);
  console.log(
    `${provider}: ${records.length} variants; ${records.filter((p) => p.dimensions.length).length} with dimensions; ${records.filter((p) => p.janCodes.length || p.modelNumbers.length).length} with identifiers`,
  );
}
const file = new URL("../lib/parts-catalog.json", import.meta.url);
const existing = JSON.parse(await fs.readFile(file, "utf8")).filter(
  (p) => !["KRYTAC", "PTS"].includes(p.manufacturer),
);
const catalog = [...existing, ...added];
if (new Set(catalog.map((p) => p.id)).size !== catalog.length)
  throw new Error("Duplicate catalog ID");
await fs.writeFile(file, JSON.stringify(catalog, null, 2) + "\n");
