import { Project } from "./project";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("airsoft-studio", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("projects");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function readDraft(): Promise<unknown> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects");
    const r = tx.objectStore("projects").get("draft");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}
export async function writeDraft(project: Project) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(project, "draft");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
