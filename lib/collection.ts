import { canEditLink, linkOrigin } from "./link-policy.ts";
import type { Layer, Project } from "./project";
import { wishlistKey, type WishInput, type WishItem } from "./wishlist.ts";
export type CollectionInput = WishInput & { libraryId?: string; layer?: Layer };
export type CollectionItem = CollectionInput & {
  id: string;
  savedAt: number;
  owned: boolean;
  wished: boolean;
};
export const collectionInput = (layer: Layer): CollectionInput => ({
  libraryId: layer.libraryId,
  linkOrigin: linkOrigin(layer),
  name: layer.name,
  url: layer.url,
  price: layer.price,
  category: layer.category,
  image: layer.src,
  layer,
});
export const collectionKey = (input: CollectionInput) =>
  input.libraryId || wishlistKey(input);
export function mergeCollectionItem(
  previous: CollectionItem | undefined,
  input: CollectionInput,
  flags: Partial<Pick<CollectionItem, "owned" | "wished">> = {},
  time = Date.now(),
): CollectionItem {
  const id = previous?.id || collectionKey(input);
  const origin =
    previous && !canEditLink(previous)
      ? linkOrigin(previous)
      : input.linkOrigin || previous?.linkOrigin;
  const url = previous && !canEditLink(previous) ? previous.url : input.url;
  return {
    ...previous,
    ...input,
    id,
    url,
    linkOrigin: origin,
    libraryId: id,
    savedAt: time,
    owned: previous?.owned ?? input.layer?.owned === true,
    wished: previous?.wished ?? false,
    ...flags,
    layer: input.layer
      ? { ...input.layer, libraryId: id, url, linkOrigin: origin }
      : previous?.layer,
    image:
      input.layer?.src ||
      previous?.layer?.src ||
      input.image ||
      previous?.image,
  };
}
export function migrateCollection(
  parts: { layer: Layer; savedAt: number }[],
  wishes: WishItem[],
  projects: Project[],
): CollectionItem[] {
  const rows = new Map<string, CollectionItem>();
  const insert = (
    input: CollectionInput,
    time: number,
    flags: Partial<Pick<CollectionItem, "owned" | "wished">> = {},
  ) => {
    const id = collectionKey(input),
      previous = rows.get(id);
    rows.set(
      id,
      mergeCollectionItem(
        previous,
        input,
        { ...flags, owned: previous?.owned || input.layer?.owned === true },
        time,
      ),
    );
  };
  for (const project of projects)
    if (Array.isArray(project?.layers))
      for (const layer of project.layers) insert(collectionInput(layer), 0);
  for (const part of [...parts]
    .filter((p) => p.layer)
    .sort((a, b) => a.savedAt - b.savedAt))
    insert(collectionInput(part.layer), part.savedAt);
  for (const wish of wishes) insert(wish, wish.savedAt, { wished: true });
  return [...rows.values()];
}
export function applyCollectionOwnership(
  project: Project,
  items: readonly CollectionItem[],
): Project {
  const index = new Map(items.map((item) => [item.id, item]));
  let changed = false;
  const layers = project.layers.map((layer) => {
    const item = index.get(collectionKey(collectionInput(layer)));
    const locked = item && !canEditLink(item);
    if (
      !item ||
      (layer.owned === item.owned &&
        layer.libraryId === item.id &&
        (!locked ||
          (layer.url === item.url && layer.linkOrigin === linkOrigin(item))))
    )
      return layer;
    changed = true;
    return {
      ...layer,
      owned: item.owned,
      libraryId: item.id,
      ...(locked ? { url: item.url, linkOrigin: linkOrigin(item) } : {}),
    };
  });
  return changed ? { ...project, layers } : project;
}
