type ProductImages = { id: string; images: string[] };
export function catalogImageUrl(item: ProductImages, requested = 0) {
  const photo =
    Number.isInteger(requested) &&
    requested >= 0 &&
    requested < item.images.length
      ? requested
      : 0;
  const revision = item.images[photo]?.split("/").pop() || "missing";
  return `/api/part-image?id=${encodeURIComponent(item.id)}&photo=${photo}&v=${encodeURIComponent(revision)}`;
}
