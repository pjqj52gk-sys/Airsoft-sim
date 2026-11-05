export type LinkOrigin = "search" | "upload" | "shared";
export type LinkReference = { url: string; linkOrigin?: LinkOrigin };
// Older affiliate links did not record their origin. Preserve their existing destination.
export function linkOrigin(item: LinkReference): LinkOrigin {
  if (item.linkOrigin) return item.linkOrigin;
  try {
    const url = new URL(item.url);
    if (
      /(^|\.)(afl\.rakuten\.co\.jp|r10\.to)$/.test(url.hostname) ||
      url.searchParams.has("rafcid") ||
      url.searchParams.has("tag")
    )
      return "search";
  } catch {}
  return "upload";
}
export const canEditLink = (item: LinkReference) =>
  linkOrigin(item) === "upload";
export function protectLinkPatch<T extends LinkReference>(
  current: T,
  patch: Partial<T>,
): Partial<T> {
  return canEditLink(current)
    ? patch
    : { ...patch, url: current.url, linkOrigin: linkOrigin(current) };
}
