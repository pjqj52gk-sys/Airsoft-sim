export function yahooProductUrl(input: unknown, depth = 0): string | null {
  if (typeof input !== "string" || input.length > 4096 || depth > 2)
    return null;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    if (
      url.hostname === "ck.jp.ap.valuecommerce.com" &&
      url.pathname === "/servlet/referral"
    )
      return yahooProductUrl(url.searchParams.get("vc_url"), depth + 1);
    if (
      url.hostname !== "store.shopping.yahoo.co.jp" ||
      !/^\/[a-z0-9_-]+\/[a-z0-9_.-]+\.html$/i.test(url.pathname)
    )
      return null;
    const code = url.pathname.split("/")[2]?.replace(/\.html$/i, "");
    if (
      ["search", "index", "top", "ranking", "category", "redirect"].includes(
        code.toLowerCase(),
      )
    )
      return null;
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}
export function yahooAffiliateUrl(input: unknown, sid: string, pid: string) {
  const target = yahooProductUrl(input);
  if (!target || !/^\d{3,20}$/.test(sid) || !/^\d{3,20}$/.test(pid))
    return null;
  const url = new URL("https://ck.jp.ap.valuecommerce.com/servlet/referral");
  url.searchParams.set("sid", sid);
  url.searchParams.set("pid", pid);
  url.searchParams.set("vc_url", target);
  return url.href;
}
export function yahooPurchasePath(input: string) {
  const target = yahooProductUrl(input);
  return target ? "/api/yahoo/link?url=" + encodeURIComponent(target) : null;
}
