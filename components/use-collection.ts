"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  listCollection,
  updateCollection,
  registerCollectionLayers,
  toggleCollectionWish,
} from "@/lib/storage";
import {
  collectionInput,
  collectionKey,
  type CollectionInput,
  type CollectionItem,
} from "@/lib/collection";
import type { Layer } from "@/lib/project";
export default function useCollection() {
  const [all, setAll] = useState<CollectionItem[]>([]),
    [ready, setReady] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const active = useRef(false),
    count = useRef(0);
  const refresh = useCallback(async () => {
    const rows = await listCollection();
    if (active.current) setAll(rows);
  }, []);
  useEffect(() => {
    active.current = true;
    const load = () => {
      void refresh()
        .catch(() => {
          if (active.current) setError("ライブラリを読み込めません。");
        })
        .finally(() => {
          if (active.current) setReady(true);
        });
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      active.current = false;
      window.removeEventListener("focus", load);
    };
  }, [refresh]);
  const mutate = useCallback(
    async (work: () => Promise<unknown>) => {
      count.current++;
      setPending(true);
      setError("");
      try {
        await work();
        await refresh();
        return true;
      } catch {
        setError("ライブラリを保存できませんでした。");
        return false;
      } finally {
        count.current--;
        if (active.current) setPending(count.current > 0);
      }
    },
    [refresh],
  );
  const register = useCallback(
    (input: CollectionInput) => mutate(() => updateCollection(input)),
    [mutate],
  );
  const setOwned = useCallback(
    (input: CollectionInput, owned: boolean) =>
      mutate(() => updateCollection(input, { owned })),
    [mutate],
  );
  const index = useMemo(
    () => new Map(all.map((item) => [item.id, item])),
    [all],
  );
  const get = useCallback(
    (input: CollectionInput) => index.get(collectionKey(input)),
    [index],
  );
  const toggle = useCallback(
    (input: CollectionInput) => mutate(() => toggleCollectionWish(input)),
    [mutate],
  );
  const seed = useCallback(
    (layers: Layer[]) => mutate(() => registerCollectionLayers(layers)),
    [mutate],
  );
  return {
    all,
    items: all.filter((item) => item.wished),
    owned: all.filter((item) => item.owned),
    ready,
    pending,
    error,
    refresh,
    register,
    setOwned,
    toggle,
    get,
    has: (input: CollectionInput) => get(input)?.wished === true,
    isOwned: (layer: Layer) =>
      get(collectionInput(layer))?.owned ?? layer.owned === true,
    seed,
  };
}
export type CollectionState = ReturnType<typeof useCollection>;
