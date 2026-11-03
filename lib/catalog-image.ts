type ProductImages = { id: string; images: string[] };
export function catalogImageUrl(item: ProductImages, requested = 0) {
  const photo =
    Number.isInteger(requested) &&
    requested >= 0 &&
    requested < item.images.length
      ? requested
      : 0;
  const source = item.images[photo] ? new URL(item.images[photo]) : null;
  const revision = source
    ? `${source.pathname.split("/").pop()}${source.search}`
    : "missing";
  return `/api/part-image?id=${encodeURIComponent(item.id)}&photo=${photo}&v=${encodeURIComponent(revision)}`;
}
