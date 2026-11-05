// Shared by every purchase-link surface. Affiliate IDs are supplied only by the server.
const marketHosts = new Set([
  "item.rakuten.co.jp",
  "www.rakuten.co.jp",
  "search.rakuten.co.jp",
  "books.rakuten.co.jp",
  "m.rakuten.co.jp",
  "www.rakuten.ne.jp",
]);
function parsed(input: string): URL | null {
  try {
    const url = new URL(input);
    if (
      input.length > 4096 ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    url.hostname = url.hostname.replace(/\.$/, "");
    url.protocol = "https:";
    return url;
  } catch {
    return null;
  }
}
export function isRakutenShort(input: string) {
  const url = parsed(input);
  return !!url && ["r10.to", "www.r10.to"].includes(url.hostname);
}
export function rakutenTarget(input: string, depth = 0): string | null {
  if (depth > 3) return null;
  const url = parsed(input);
  if (!url) return null;
  if (url.hostname === "hb.afl.rakuten.co.jp") {
    const pc = url.searchParams.get("pc") || url.searchParams.get("m");
    return pc ? rakutenTarget(pc, depth + 1) : null;
  }
  if (!marketHosts.has(url.hostname)) return null;
  url.hash = "";
  for (const name of [...url.searchParams.keys()])
    if (/^(?:utm_.+|scid|sc2id|rafcid|gclid|fbclid|link_type|ut)$/i.test(name))
      url.searchParams.delete(name);
  return url.href;
}
export function rakutenAffiliateUrl(
  input: string,
  affiliateId: string,
): string | null {
  const target = rakutenTarget(input);
  if (!target || !/^[A-Za-z0-9][A-Za-z0-9._-]{5,127}$/.test(affiliateId))
    return null;
  const url = new URL(
    "https://hb.afl.rakuten.co.jp/hgc/" + encodeURIComponent(affiliateId) + "/",
  );
  url.searchParams.set("pc", target);
  url.searchParams.set("m", target);
  return url.href;
}
export function rakutenPurchasePath(input: string): string | null {
  return rakutenTarget(input) ||
    isRakutenShort(input) ||
    parsed(input)?.hostname === "hb.afl.rakuten.co.jp"
    ? "/api/rakuten/link?url=" + encodeURIComponent(input)
    : null;
}
export async function resolveRakutenTarget(
  input: string,
  request: typeof fetch = fetch,
): Promise<string | null> {
  let current = input;
  for (let hop = 0; hop < 4; hop++) {
    const target = rakutenTarget(current);
    if (target) return target;
    if (!isRakutenShort(current)) return null;
    const response = await request(parsed(current)!.href, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return null;
    const location = response.headers.get("location");
    if (!location) return null;
    current = new URL(location, current).href;
  }
  return null;
}
