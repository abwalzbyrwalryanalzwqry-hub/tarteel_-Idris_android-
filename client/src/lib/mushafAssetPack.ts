import type { MushafVisualManifest } from "../../../shared/mushafVisual";
import { storageUrl } from "./runtimeConfig";

const DB_NAME = "tarteel-offline";
const DB_VERSION = 2;
const DB_STORE = "mushaf_assets";
const DB_META_STORE = "mushaf_asset_meta";
const PACK_ID = "mushaf-pages-v1";
const ASSET_PREFIX = "/offline/quran/";

type AssetPackStatus = {
  state: "not-downloaded" | "downloading" | "ready" | "error";
  completed: number;
  total: number;
  error?: string;
};

let status: AssetPackStatus = { state: "not-downloaded", completed: 0, total: 0 };
const listeners = new Set<(next: AssetPackStatus) => void>();

function publish(next: AssetPackStatus) {
  status = next;
  listeners.forEach((listener) => listener(status));
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE, { keyPath: "key" });
      if (!request.result.objectStoreNames.contains(DB_META_STORE)) request.result.createObjectStore(DB_META_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function getAsset(key: string) {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise<Blob | null>((resolve) => {
    const request = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(key);
    request.onsuccess = () => { db.close(); resolve(request.result?.blob ?? null); };
    request.onerror = () => { db.close(); resolve(null); };
  });
}

async function putMeta(key: string, value: unknown) {
  const db = await openDatabase();
  if (!db) return false;
  return new Promise<boolean>((resolve) => {
    const transaction = db.transaction(DB_META_STORE, "readwrite");
    transaction.objectStore(DB_META_STORE).put({ key, value, updatedAt: Date.now() });
    transaction.oncomplete = () => { db.close(); resolve(true); };
    transaction.onerror = () => { db.close(); resolve(false); };
  });
}

async function getMeta<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    const request = db.transaction(DB_META_STORE, "readonly").objectStore(DB_META_STORE).get(key);
    request.onsuccess = () => { db.close(); resolve((request.result?.value ?? null) as T | null); };
    request.onerror = () => { db.close(); resolve(null); };
  });
}

async function putAsset(key: string, blob: Blob) {
  const db = await openDatabase();
  if (!db) return false;
  return new Promise<boolean>((resolve) => {
    const transaction = db.transaction(DB_STORE, "readwrite");
    transaction.objectStore(DB_STORE).put({ key, blob, updatedAt: Date.now() });
    transaction.oncomplete = () => { db.close(); resolve(true); };
    transaction.onerror = () => { db.close(); resolve(false); };
  });
}

export function getMushafAssetPackStatus() {
  return status;
}

export function subscribeMushafAssetPack(listener: (next: AssetPackStatus) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function isMushafAssetPackReady() {
  return (await getMeta<boolean>(`${PACK_ID}:complete`)) === true;
}

export async function downloadMushafAssetPack(manifest: MushafVisualManifest) {
  if (status.state === "downloading") return;
  const assets = manifest.pages.flatMap((page) => [
    { key: `${PACK_ID}:page:${page.page}`, url: storageUrl(page.url) },
    { key: `${PACK_ID}:zones:${page.page}`, url: storageUrl(page.zonesUrl) },
  ]);
  const completedKeys = new Set(await getMeta<string[]>(`${PACK_ID}:completed`) ?? []);
  publish({ state: "downloading", completed: completedKeys.size, total: assets.length });
  try {
    let completed = completedKeys.size;
    for (const asset of assets) {
      if (completedKeys.has(asset.key) && await getAsset(asset.key)) continue;
      const response = await fetch(asset.url);
      if (!response.ok) throw new Error("تعذر تنزيل ملفات المصحف.");
      if (!(await putAsset(asset.key, await response.blob()))) throw new Error("تعذر حفظ ملفات المصحف على الجهاز.");
      completedKeys.add(asset.key);
      completed += 1;
      await putMeta(`${PACK_ID}:completed`, Array.from(completedKeys));
      publish({ state: "downloading", completed, total: assets.length });
    }
    await putMeta(`${PACK_ID}:completed`, Array.from(completedKeys));
    await putMeta(`${PACK_ID}:complete`, true);
    publish({ state: "ready", completed: assets.length, total: assets.length });
  } catch (error) {
    publish({ state: "error", completed: status.completed, total: assets.length, error: error instanceof Error ? error.message : "تعذر تنزيل المصحف." });
  }
}

export async function getMushafAssetUrl(kind: "page" | "zones", pageNumber: number, fallback: string) {
  const blob = await getAsset(`${PACK_ID}:${kind}:${pageNumber}`);
  return blob ? URL.createObjectURL(blob) : fallback;
}
