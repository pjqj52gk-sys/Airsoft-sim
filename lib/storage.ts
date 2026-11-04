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
    const request = indexedDB.open("airsoft-studio", 3);
    request.onupgradeneeded = () => {
      for (const store of ["projects", "parts", "builds", "wishlist"])
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
export const listParts = () => read<StoredPart[]>("parts");
export const listBuilds = () => read<StoredBuild[]>("builds");
export const savePart = (part: StoredPart) => write("parts", part.id, part);
export const saveBuild = (build: StoredBuild) =>
  write("builds", build.id, build);
export const deletePart = (id: string) => write("parts", id);
export const deleteBuild = (id: string) => write("builds", id);

export const listWishes = () => read<WishItem[]>("wishlist");
export const saveWish = (item: WishItem) => write("wishlist", item.id, item);
export const deleteWish = (id: string) => write("wishlist", id);
