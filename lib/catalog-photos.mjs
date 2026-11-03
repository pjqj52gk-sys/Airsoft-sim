const origin = "https://www.tokyo-marui.co.jp";
const decode = (text) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
function officialImage(value) {
  try {
    const url = new URL(decode(value), origin);
    if (
      url.protocol === "https:" &&
      url.hostname === "www.tokyo-marui.co.jp" &&
      /^\/appimg\/(?:option|product)\/[^/]+\.(?:jpg|jpeg|png|webp|gif)$/i.test(
        url.pathname,
      )
    )
      return url.href;
  } catch {
    /* Ignore invalid or external image references. */
  }
  return null;
}
export function productPhotos(html) {
  // The hero/og:image is an advertising banner. Only use the full-size product gallery.
  const gallery = html.match(
    /<ul\b[^>]*\bclass\s*=\s*["'][^"']*\bproducts-Slider_List\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i,
  )?.[1];
  if (!gallery) return [];
  const photos = [];
  for (const image of gallery.matchAll(/<img\b[^>]*>/gi)) {
    const attrs = Object.fromEntries(
      [...image[0].matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)].map((m) => [
        m[1].toLowerCase(),
        m[3],
      ]),
    );
    const variants = (attrs.srcset || "")
      .split(",")
      .map((part) => {
        const [url, descriptor = "1x"] = part.trim().split(/\s+/);
        return { url, size: parseFloat(descriptor) || 0 };
      })
      .sort((a, b) => b.size - a.size);
    const candidates = [
      attrs["data-original"],
      attrs["data-full"],
      ...variants.map((v) => v.url),
      attrs["data-src"],
      attrs.src,
    ];
    const url = candidates.filter(Boolean).map(officialImage).find(Boolean);
    if (url && !photos.includes(url)) photos.push(url);
  }
  return photos;
}
