import { type MushafVisualManifest, type MushafVisualPageData, validateMushafPageData, validateMushafVisualManifest } from "../../../shared/mushafVisual";
import { storageUrl } from "./runtimeConfig";
import { getMushafAssetUrl } from "./mushafAssetPack";

const MANIFEST_SCRIPT_ID = "tarteel-mushaf-page-manifest";
const PAGE_SCRIPT_PREFIX = "tarteel-mushaf-page-data-";
export const MUSHAF_MANIFEST_URL = "/offline/quran/mushaf-page-manifest.js";

const OFFLINE_ASSET_PREFIX = "/offline/quran/";

declare global {
  interface Window {
    __TARTEEL_MUSHAF_PAGE_MANIFEST__?: MushafVisualManifest;
    __TARTEEL_MUSHAF_PAGE_CACHE__?: Record<number, MushafVisualPageData>;
  }
}

let manifestPromise: Promise<MushafVisualManifest> | null = null;
const pagePromises = new Map<number, Promise<MushafVisualPageData>>();

function localOfflineAsset(path: string, kind: "pages" | "zones") {
  const filename = path.split("/").pop();
  return filename ? `${OFFLINE_ASSET_PREFIX}${kind}/${filename}` : path;
}

function loadScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") { resolve(); return; }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("تعذر تحميل بيانات المصحف.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error("تعذر تحميل بيانات المصحف."));
    document.head.appendChild(script);
  });
}

export function loadMushafVisualManifest() {
  if (window.__TARTEEL_MUSHAF_PAGE_MANIFEST__) return Promise.resolve(window.__TARTEEL_MUSHAF_PAGE_MANIFEST__);
  if (manifestPromise) return manifestPromise;
  manifestPromise = loadScript(MANIFEST_SCRIPT_ID, MUSHAF_MANIFEST_URL)
    .catch(() => loadScript(MANIFEST_SCRIPT_ID, storageUrl("/manus-storage/mushaf-page-manifest_d0219729.js")))
    .then(() => {
    const manifest = window.__TARTEEL_MUSHAF_PAGE_MANIFEST__;
    if (!manifest || !validateMushafVisualManifest(manifest)) throw new Error("تعذر التحقق من فهرس صفحات المصحف.");
    return manifest;
  });
  return manifestPromise;
}

export function loadMushafVisualPage(manifest: MushafVisualManifest, pageNumber: number) {
  const cached = window.__TARTEEL_MUSHAF_PAGE_CACHE__?.[pageNumber];
  const page = manifest.pages[pageNumber - 1];
  if (!page) return Promise.reject(new Error("صفحة المصحف غير موجودة."));
  if (cached && validateMushafPageData(page, cached)) return Promise.resolve(cached);
  const pending = pagePromises.get(pageNumber);
  if (pending) return pending;
  const onlineSrc = storageUrl(page.zonesUrl);
  const offlineSrc = localOfflineAsset(page.zonesUrl, "zones");
  const promise = getMushafAssetUrl("zones", pageNumber, offlineSrc)
    .then((assetUrl) => loadScript(`${PAGE_SCRIPT_PREFIX}${pageNumber}`, assetUrl))
    .catch(() => loadScript(`${PAGE_SCRIPT_PREFIX}${pageNumber}`, onlineSrc))
    .then(() => {
      const data = window.__TARTEEL_MUSHAF_PAGE_CACHE__?.[pageNumber];
      if (!data || !validateMushafPageData(page, data)) throw new Error("تعذر التحقق من مناطق تفاعل الصفحة.");
      return data;
    });
  pagePromises.set(pageNumber, promise);
  return promise;
}

export function mushafPageImageUrl(pageUrl: string) {
  return localOfflineAsset(pageUrl, "pages");
}

export async function mushafPageImageUrlAsync(pageNumber: number, pageUrl: string) {
  return getMushafAssetUrl("page", pageNumber, mushafPageImageUrl(pageUrl));
}
