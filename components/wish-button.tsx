"use client";
import type { CollectionInput } from "@/lib/collection";
import type { WishlistState } from "./use-wishlist";
export default function WishButton({
  item,
  wishlist,
}: {
  item: CollectionInput;
  wishlist?: WishlistState;
}) {
  if (!wishlist) return null;
  const added = wishlist.has(item);
  return (
    <button
      type="button"
      className={`mini-button ${added ? "toggled" : ""}`}
      aria-pressed={added}
      aria-label={`${added ? "ほしいものリストから外す" : "ほしいものリストに追加"}：${item.name}`}
      disabled={!wishlist.ready || wishlist.pending}
      onClick={() => void wishlist.toggle(item)}
    >
      {added ? "✓ ほしいものリストに追加済み" : "ほしいものリストに追加"}
    </button>
  );
}
