// Read publicly published manufacturer product data only. Never fetch account/cart data.
import fs from "node:fs/promises";
import {
  productDimensions,
  referenceLengthMm,
  validJan,
} from "../lib/product-specs.ts";
const collections = ["mode-2", "nitro-vo", "quintes-sence"];
const items = new Map();
for (const collection of collections) {
  const response = await fetch(
    `https://laylax.com/collections/${collection}/products.json?limit=50`,
    { signal: AbortSignal.timeout(20000) },
  );
  if (!response.ok)
    throw new Error(`LAYLAX collection ${collection}: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.products)) throw new Error("Invalid product data");
  for (const product of data.products) {
    if (String(product.vendor).toLowerCase() !== "laylax") continue;
    const images = [
      ...new Set(
        product.images
          .map((image) => image.src)
          .filter((src) => {
            try {
              const u = new URL(src);
              return (
                u.protocol === "https:" &&
                u.hostname === "cdn.shopify.com" &&
                u.pathname.startsWith("/s/files/1/0843/1095/0186/")
              );
            } catch {
              return false;
            }
          }),
      ),
    ].slice(0, 12);
    if (!images.length) continue;
    const dimensions = productDimensions(product.body_html || "").filter(
      (d) => d.kind === "product",
    );
    const variants = product.variants || [];
    const skus = variants.map((v) => String(v.sku || "").trim());
    const category = /グリップ|ハンドストップ/.test(product.title)
      ? "グリップ"
      : /ストック/.test(product.title)
        ? "ストック"
        : /スコープ|ダットサイト|ドットサイト|レンズプロテクター/.test(
              product.title,
            )
          ? "光学機器"
          : "外装";
    items.set(product.id, {
      id: `laylax-${product.id}`,
      name: product.title,
      manufacturer: "LAYLAX",
      category,
      image: images[0],
      images,
      url: `https://laylax.com/products/${product.handle}`,
      dimensions: dimensions.map(({ label, value }) => ({ label, value })),
      lengthMm:
        variants.length === 1 ? (referenceLengthMm(dimensions) ?? null) : null,
      janCodes: [...new Set(skus.filter(validJan))],
      modelNumbers: [
        ...new Set(
          skus
            .filter((s) => /[a-z]/i.test(s) && /^[A-Z0-9._/-]{3,40}$/i.test(s))
            .map((s) => s.toUpperCase()),
        ),
      ],
      checkedAt: new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Tokyo",
      }).format(new Date()),
    });
  }
}
if (items.size < 20)
  throw new Error(
    "Catalog unexpectedly small; existing catalog was not changed.",
  );
const path = new URL("../lib/parts-catalog.json", import.meta.url);
const existing = JSON.parse(await fs.readFile(path, "utf8")).filter(
  (p) => p.manufacturer !== "LAYLAX",
);
const added = [...items.values()];
await fs.writeFile(
  path,
  JSON.stringify([...existing, ...added], null, 2) + "\n",
);
console.log(
  `LAYLAX: ${added.length} products, ${added.reduce((sum, p) => sum + p.images.length, 0)} original photos, ${added.filter((p) => p.dimensions.length).length} with published dimensions, ${added.filter((p) => p.janCodes.length).length} with JAN codes.`,
);
