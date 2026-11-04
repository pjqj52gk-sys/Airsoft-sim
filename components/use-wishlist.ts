"use client";
import { useEffect, useRef, useState } from "react";
import { listWishes, saveWish, deleteWish } from "@/lib/storage";
import { wishlistKey, type WishInput, type WishItem } from "@/lib/wishlist";
export default function useWishlist() {
  const [items, setItems] = useState<WishItem[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    listWishes()
      .then((rows) => {
        if (active) setItems(rows.sort((a, b) => b.savedAt - a.savedAt));
      })
      .catch(() => {
        if (active) setError("ほしいものリストを読み込めません。");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function toggle(input: WishInput) {
    if (!ready || lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    const id = wishlistKey(input);
    try {
      const existing = items.find((item) => wishlistKey(item) === id);
      if (existing) {
        await deleteWish(existing.id);
        setItems((rows) => rows.filter((item) => item.id !== existing.id));
      } else {
        const item = { ...input, id, savedAt: Date.now() };
        await saveWish(item);
        setItems((rows) => [item, ...rows.filter((row) => row.id !== id)]);
      }
    } catch {
      setError("ほしいものリストを保存できませんでした。");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return {
    items,
    ready,
    pending,
    error,
    toggle,
    has: (input: WishInput) =>
      items.some((item) => wishlistKey(item) === wishlistKey(input)),
  };
}
export type WishlistState = ReturnType<typeof useWishlist>;
