const configuredAppOrigin = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
const configuredApiOrigin = import.meta.env.VITE_API_BASE_URL?.trim();
const nativeApiOrigin = "https://tarteel-qura-8kmxg5hu.manus.space";
const configuredStorageOrigin = import.meta.env.VITE_STORAGE_BASE_URL?.trim();

function normalizeOrigin(value: string | undefined) {
  return value?.replace(/\/+$/, "") || "";
}

export const PUBLIC_APP_ORIGIN = normalizeOrigin(configuredAppOrigin) || window.location.origin;
export const API_BASE_URL = normalizeOrigin(configuredApiOrigin) ||
  (typeof window !== "undefined" && window.location.protocol === "capacitor:" ? nativeApiOrigin : "");
export const STORAGE_BASE_URL = normalizeOrigin(configuredStorageOrigin) || API_BASE_URL;

export function runtimeUrl(path: string, base = "") {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function apiUrl(path: string) {
  return runtimeUrl(path, API_BASE_URL);
}

export function storageUrl(path: string) {
  return runtimeUrl(path, STORAGE_BASE_URL);
}

export function publicAppUrl(path: string) {
  return runtimeUrl(path, PUBLIC_APP_ORIGIN);
}
