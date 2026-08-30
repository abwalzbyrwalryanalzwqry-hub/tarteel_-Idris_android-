import { type QuranNavigationData, validateQuranNavigationData } from "../../../shared/quranNavigation";
import { storageUrl } from "./runtimeConfig";

declare global {
  interface Window {
    __TARTEEL_QURAN_NAVIGATION__?: QuranNavigationData;
  }
}

export const QURAN_NAVIGATION_URL = "/offline/quran/quran-navigation.js";
const CACHE_KEY = "tarteel:quran-navigation:v1";

let navigationPromise: Promise<QuranNavigationData> | null = null;

function readCachedNavigation() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as QuranNavigationData;
    return validateQuranNavigationData(value) ? value : null;
  } catch {
    return null;
  }
}

export function loadQuranNavigation() {
  const cached = readCachedNavigation();
  if (cached) return Promise.resolve(cached);
  if (navigationPromise) return navigationPromise;

  navigationPromise = new Promise<QuranNavigationData>((resolve, reject) => {
    const id = "tarteel-quran-navigation-data";
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.id = id;
      script.async = true;
      document.head.appendChild(script);
    }
    const finish = () => {
      const data = window.__TARTEEL_QURAN_NAVIGATION__;
      if (!data || !validateQuranNavigationData(data)) {
        reject(new Error("تعذر التحقق من فهرس القرآن."));
        return;
      }
      try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
      resolve(data);
    };
    script.onload = finish;
    script.onerror = () => {
      script.onerror = () => reject(new Error("تعذر تحميل فهرس القرآن."));
      script.src = storageUrl("/manus-storage/quran-navigation_d0a44e59.js");
    };
    script.src = QURAN_NAVIGATION_URL;
  });
  return navigationPromise;
}
