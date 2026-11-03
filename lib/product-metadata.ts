// Only top-level/main-entity Product data. Recommendation ItemLists and related
// products must never lend their identifiers or dimensions to the current item.
export function primaryProductMetadata(
  html: string,
  source = "",
): Record<string, unknown> | null {
  const products: Record<string, unknown>[] = [];
  function walk(value: unknown, depth = 0) {
    if (
      !value ||
      typeof value !== "object" ||
      depth > 6 ||
      products.length > 20
    )
      return;
    if (Array.isArray(value)) {
      value.slice(0, 50).forEach((v) => walk(v, depth + 1));
      return;
    }
    const row = value as Record<string, unknown>;
    if (
      [row["@type"]]
        .flat()
        .some((t) => typeof t === "string" && /(?:^|[/#])Product$/.test(t))
    ) {
      products.push(row);
      return;
    }
    for (const key of ["@graph", "mainEntity", "mainEntityOfPage"])
      walk(row[key], depth + 1);
  }
  for (const m of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    if (m[1].length > 800000) continue;
    try {
      walk(JSON.parse(m[1]));
    } catch {
      /* Invalid JSON-LD is optional. */
    }
  }
  if (products.length === 1) return products[0];
  if (!source) return null;
  const key = (input: unknown) => {
    if (typeof input !== "string") return "";
    try {
      const u = new URL(input, source);
      return u.origin + u.pathname.replace(/\/$/, "");
    } catch {
      return "";
    }
  };
  const matches = products.filter(
    (p) => key(p.url) === key(source) || key(p["@id"]) === key(source),
  );
  return matches.length === 1 ? matches[0] : null;
}

export const normalizeModelNumber = (code: string) =>
  code
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s._/‐‑–—−-]+/g, "");
