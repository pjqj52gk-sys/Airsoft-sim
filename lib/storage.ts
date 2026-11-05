import {
  migrateCollection,
  cleanStoredCollectionItem,
  mergeCollectionItem,
  collectionKey,
  type CollectionInput,
  type CollectionItem,
} from "./collection.ts";
import type { WishItem } from "./wishlist.ts";
import type { Project, Layer } from "./project";
import type { ComparisonPlans } from "./comparison-plans";
import { createTaskQueue } from "./async-control.ts";
const enqueueWorkspace = createTaskQueue();
export type StoredPart = { id: string; savedAt: number; layer: Layer };
export type StoredBuild = { id: string; savedAt: number; project: Project };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let abandoned = false;
    const request = indexedDB.open("airsoft-studio", 4);
    request.onupgradeneeded = () => {
      for (const store of ["projects", "parts", "builds", "wishlist", "items"])
        if (!request.result.objectStoreNames.contains(store))
          request.result.createObjectStore(store);
    };
    request.onsuccess = () => {
      if (abandoned) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      abandoned = true;
      reject(
        new Error("別のタブのエディターを閉じてから、もう一度お試しください。"),
      );
    };
  });
}
async function read<T>(store: string, key?: string): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store);
    const request =
      key === undefined
        ? tx.objectStore(store).getAll()
        : tx.objectStore(store).get(key);
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error || request.error);
    };
  });
}
async function write(store: string, key: string, value?: unknown) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    if (value === undefined) tx.objectStore(store).delete(key);
    else tx.objectStore(store).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export const readDraft = () => read<unknown>("projects", "draft");
export const readComparison = () => read<unknown>("projects", "comparison");
async function persistWorkspace(
  project: Project,
  comparison: ComparisonPlans | null,
) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    const store = tx.objectStore("projects");
    store.put(project, "draft");
    store.put(comparison, "comparison");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export const writeWorkspace = (
  project: Project,
  comparison: ComparisonPlans | null,
) => enqueueWorkspace(() => persistWorkspace(project, comparison));
export const writeDraft = (project: Project) =>
  enqueueWorkspace(() => write("projects", "draft", project));
export const listBuilds = () => read<StoredBuild[]>("builds");
export const saveBuild = (build: StoredBuild) =>
  write("builds", build.id, build);
export const deleteBuild = (id: string) => write("builds", id);

// One transaction migrates and updates the common collection, including across tabs.
const enqueueCollection = createTaskQueue();
function collectionTransaction<T>(
  change: (store: IDBObjectStore, rows: CollectionItem[]) => T,
): Promise<T> {
  return enqueueCollection(async () => {
    const db = await database();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(
        ["items", "parts", "wishlist", "projects", "builds"],
        "readwrite",
      );
      const items = tx.objectStore("items"),
        projects = tx.objectStore("projects");
      let rows: CollectionItem[] = [],
        migrated = false,
        pending = 2,
        result: T;
      const finish = () => {
        if (--pending) return;
        if (migrated) {
          result = change(items, rows);
          return;
        }
        let oldParts: StoredPart[] = [],
          oldWishes: WishItem[] = [],
          oldProjects: Project[] = [],
          oldBuilds: StoredBuild[] = [];
        let waiting = 4;
        const done = () => {
          if (--waiting) return;
          const legacy = migrateCollection(oldParts, oldWishes, [
            ...oldBuilds.map((b) => b.project),
            ...oldProjects,
          ]);
          const merged = new Map(legacy.map((r) => [r.id, r]));
          for (const row of rows) merged.set(row.id, row);
          rows = [...merged.values()];
          for (const row of rows) items.put(row, row.id);
          projects.put(true, "collection-v1");
          result = change(items, rows);
        };
        const a = tx.objectStore("parts").getAll();
        a.onsuccess = () => {
          oldParts = a.result;
          done();
        };
        const b = tx.objectStore("wishlist").getAll();
        b.onsuccess = () => {
          oldWishes = b.result;
          done();
        };
        const c = projects.getAll();
        c.onsuccess = () => {
          oldProjects = c.result.flatMap(
            (value: Project & { a?: Project; b?: Project }) =>
              value?.layers ? [value] : [value?.a, value?.b].filter(Boolean),
          );
          done();
        };
        const d = tx.objectStore("builds").getAll();
        d.onsuccess = () => {
          oldBuilds = d.result;
          done();
        };
      };
      const a = items.getAll();
      a.onsuccess = () => {
        rows = a.result;
        finish();
      };
      const b = projects.get("collection-v1");
      b.onsuccess = () => {
        migrated = b.result === true;
        finish();
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("ライブラリを保存できません。"));
      };
    });
  });
}
export const listCollection = () =>
  collectionTransaction((store, rows) =>
    rows
      .map((row) => {
        const clean = cleanStoredCollectionItem(row);
        if (clean !== row) store.put(clean, clean.id);
        return clean;
      })
      .sort((a, b) => b.savedAt - a.savedAt),
  );
export const updateCollection = (
  input: CollectionInput,
  flags: Partial<Pick<CollectionItem, "owned" | "wished">> = {},
) =>
  collectionTransaction((store, rows) => {
    const item = mergeCollectionItem(
      rows.find((r) => r.id === collectionKey(input)),
      input,
      flags,
    );
    store.put(item, item.id);
    return item;
  });
export const removeCollection = (id: string) =>
  collectionTransaction((store) => {
    store.delete(id);
  });

export const registerCollectionLayers = (layers: Layer[]) =>
  collectionTransaction((store, rows) => {
    const known = new Set(rows.map((r) => r.id));
    for (const layer of layers) {
      const input = {
        name: layer.name,
        url: layer.url,
        price: layer.price,
        category: layer.category,
        image: layer.src,
        libraryId: layer.libraryId,
        linkOrigin: layer.linkOrigin,
        layer,
      };
      const id = collectionKey(input);
      if (known.has(id)) continue;
      const item = mergeCollectionItem(undefined, input);
      store.put(item, item.id);
      known.add(item.id);
    }
  });

export const toggleCollectionWish = (input: CollectionInput) =>
  collectionTransaction((store, rows) => {
    const previous = rows.find((row) => row.id === collectionKey(input));
    const item = mergeCollectionItem(previous, input, {
      wished: !previous?.wished,
    });
    store.put(item, item.id);
    return item;
  });
