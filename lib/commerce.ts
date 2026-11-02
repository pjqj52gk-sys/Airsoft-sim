// Public affiliate identifiers only. Set the operator's approved ID before enabling.
export const monetization = { amazonAssociateTag: "" };
export function amazonStore(input: string) {
  try {
    return /(?:^|\.)(?:amazon\.(?:co\.jp|com|co\.uk|de|fr|it|es|ca|com\.au|in|ae|com\.br|com\.mx|nl|se|pl|sg|com\.be|com\.tr|sa|eg|ie)|amzn\.to)$/.test(
      new URL(input).hostname.toLowerCase().replace(/\.$/, ""),
    );
  } catch {
    return false;
  }
}
export function amazonImage(input: string) {
  try {
    return /(?:^|\.)(?:media-amazon\.com|images-amazon\.com|ssl-images-amazon\.com)$/.test(
      new URL(input).hostname.toLowerCase().replace(/\.$/, ""),
    );
  } catch {
    return false;
  }
}
export function purchaseLink(
  input: string,
  tag = monetization.amazonAssociateTag,
) {
  try {
    const url = new URL(input);
    url.hostname = url.hostname.replace(/\.$/, "");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    const asin = url.pathname
      .match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1]
      ?.toUpperCase();
    const sponsored =
      amazonStore(input) &&
      url.hostname.endsWith("amazon.co.jp") &&
      !!asin &&
      /^[A-Za-z0-9_-]{3,80}$/.test(tag);
    if (sponsored)
      return {
        href: `https://www.amazon.co.jp/dp/${asin}?tag=${encodeURIComponent(tag)}`,
        sponsored: true,
      };
    return {
      href: url.href,
      sponsored: amazonStore(input) && !!url.searchParams.get("tag"),
    };
  } catch {
    return null;
  }
}
