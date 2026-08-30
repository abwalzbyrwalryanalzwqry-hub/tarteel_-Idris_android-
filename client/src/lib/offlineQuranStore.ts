export interface LocalQuranBookmark {
  id: number;
  referenceType: "page" | "ayah";
  referenceKey: string;
  pageNumber: number;
  surahNumber: number | null;
  ayahNumber: number | null;
  label: string | null;
  updatedAt: number;
}

export interface LocalVersePreference {
  id: number;
  verseKey: string;
  pageNumber: number;
  surahNumber: number;
  ayahNumber: number;
  isFavorite: boolean;
  note: string | null;
  updatedAt: number;
}

type BookmarkMutation =
  | { id: string; kind: "save"; bookmark: LocalQuranBookmark }
  | { id: string; kind: "remove"; referenceKey: string; pageNumber: number; surahNumber: number | null; ayahNumber: number | null; updatedAt: number };

type PreferenceMutation =
  | { id: string; kind: "save"; preference: LocalVersePreference }
  | { id: string; kind: "remove"; verseKey: string; pageNumber: number; surahNumber: number; ayahNumber: number; updatedAt: number };

export interface OfflineQuranState {
  bookmarks: LocalQuranBookmark[];
  versePreferences: LocalVersePreference[];
  bookmarkMutations: BookmarkMutation[];
  preferenceMutations: PreferenceMutation[];
}

const STORAGE_KEY = "tartee…n.v2";
const DB_NAME = "tarteel-offline";
const DB_VERSION = 1;
const DB_STORE = "quran_state";
const CHANGE_EVENT = "tarteel:offline-quran-change";

const EMPTY_STATE: OfflineQuranState = {
  bookmarks: [],
  versePreferences: [],
  bookmarkMutations: [],
  preferenceMutations: [],
};

function cloneState(state: OfflineQuranState): OfflineQuranState {
  return JSON.parse(JSON.stringify(state)) as OfflineQuranState;
}

function readLocalState(): OfflineQuranState {
  if (typeof window === "undefined") return cloneState(EMPTY_STATE);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      versePreferences: Array.isArray(parsed.versePreferences) ? parsed.versePreferences : [],
      bookmarkMutations: Array.isArray(parsed.bookmarkMutations) ? parsed.bookmarkMutations : [],
      preferenceMutations: Array.isArray(parsed.preferenceMutations) ? parsed.preferenceMutations : [],
    };
  } catch {
    return cloneState(EMPTY_STATE);
  }
}

function writeLocalState(state: OfflineQuranState) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function readIndexedState(): Promise<OfflineQuranState | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    const transaction = db.transaction(DB_STORE, "readonly");
    const request = transaction.objectStore(DB_STORE).get("current");
    request.onsuccess = () => resolve(request.result?.state ? request.result.state as OfflineQuranState : null);
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => { db.close(); resolve(null); };
  });
}

async function writeIndexedState(state: OfflineQuranState) {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(DB_STORE, "readwrite");
    transaction.objectStore(DB_STORE).put({ id: "current", version: 2, updatedAt: Date.now(), state: cloneState(state) });
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); resolve(); };
    transaction.onabort = () => { db.close(); resolve(); };
  });
}

function emitChange() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

let hydrated = false;
let hydrationPromise: Promise<OfflineQuranState> | null = null;

export async function hydrateOfflineQuranState() {
  if (hydrated) return readLocalState();
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = readIndexedState().then((indexed) => {
    const local = readLocalState();
    const state = indexed ?? local;
    if (!indexed) void writeIndexedState(state);
    writeLocalState(state);
    hydrated = true;
    emitChange();
    return state;
  });
  return hydrationPromise;
}

function persist(state: OfflineQuranState) {
  writeLocalState(state);
  void writeIndexedState(state);
  emitChange();
}

function updateState(update: (state: OfflineQuranState) => OfflineQuranState) {
  const next = update(readLocalState());
  persist(next);
  return next;
}

export function loadOfflineQuranState() {
  return readLocalState();
}

export function subscribeOfflineQuranState(listener: () => void) {
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function newMutationId(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function withoutBookmarkMutation(state: OfflineQuranState, referenceKey: string) {
  return state.bookmarkMutations.filter((mutation) => mutation.kind === "save" ? mutation.bookmark.referenceKey !== referenceKey : mutation.referenceKey !== referenceKey);
}

function withoutPreferenceMutation(state: OfflineQuranState, verseKey: string) {
  return state.preferenceMutations.filter((mutation) => mutation.kind === "save" ? mutation.preference.verseKey !== verseKey : mutation.verseKey !== verseKey);
}

export function saveOfflineBookmark(input: Omit<LocalQuranBookmark, "updatedAt">) {
  const bookmark = { ...input, updatedAt: Date.now() };
  updateState((state) => ({
    ...state,
    bookmarks: [...state.bookmarks.filter((item) => item.referenceKey !== bookmark.referenceKey), bookmark],
    bookmarkMutations: [...withoutBookmarkMutation(state, bookmark.referenceKey), { id: newMutationId("bookmark"), kind: "save", bookmark }],
  }));
  return bookmark;
}

export function removeOfflineBookmark(input: string | Pick<LocalQuranBookmark, "referenceKey" | "pageNumber" | "surahNumber" | "ayahNumber">) {
  const referenceKey = typeof input === "string" ? input : input.referenceKey;
  const previous = typeof input === "string" ? readLocalState().bookmarks.find((item) => item.referenceKey === referenceKey) : input;
  const updatedAt = Date.now();
  updateState((state) => ({
    ...state,
    bookmarks: state.bookmarks.filter((item) => item.referenceKey !== referenceKey),
    bookmarkMutations: [...withoutBookmarkMutation(state, referenceKey), { id: newMutationId("bookmark"), kind: "remove", referenceKey, pageNumber: previous?.pageNumber ?? 1, surahNumber: previous?.surahNumber ?? null, ayahNumber: previous?.ayahNumber ?? null, updatedAt }],
  }));
}

export function markOfflineBookmarkSynced(referenceKey: string, operation: "save" | "remove") {
  updateState((state) => ({
    ...state,
    bookmarkMutations: state.bookmarkMutations.filter((mutation) => {
      if (mutation.kind !== operation) return true;
      return mutation.kind === "save" ? mutation.bookmark.referenceKey !== referenceKey : mutation.referenceKey !== referenceKey;
    }),
  }));
}

export function saveOfflineVersePreference(input: Omit<LocalVersePreference, "updatedAt">) {
  const preference = { ...input, updatedAt: Date.now() };
  updateState((state) => ({
    ...state,
    versePreferences: [...state.versePreferences.filter((item) => item.verseKey !== preference.verseKey), preference],
    preferenceMutations: [...withoutPreferenceMutation(state, preference.verseKey), { id: newMutationId("preference"), kind: "save", preference }],
  }));
  return preference;
}

export function removeOfflineVersePreference(input: string | Pick<LocalVersePreference, "verseKey" | "pageNumber" | "surahNumber" | "ayahNumber">) {
  const verseKey = typeof input === "string" ? input : input.verseKey;
  const previous = typeof input === "string" ? readLocalState().versePreferences.find((item) => item.verseKey === verseKey) : input;
  const updatedAt = Date.now();
  updateState((state) => ({
    ...state,
    versePreferences: state.versePreferences.filter((item) => item.verseKey !== verseKey),
    preferenceMutations: [...withoutPreferenceMutation(state, verseKey), { id: newMutationId("preference"), kind: "remove", verseKey, pageNumber: previous?.pageNumber ?? 1, surahNumber: previous?.surahNumber ?? 1, ayahNumber: previous?.ayahNumber ?? 1, updatedAt }],
  }));
}

export function markOfflineVersePreferenceSynced(verseKey: string, operation: "save" | "remove") {
  updateState((state) => ({
    ...state,
    preferenceMutations: state.preferenceMutations.filter((mutation) => {
      if (mutation.kind !== operation) return true;
      return mutation.kind === "save" ? mutation.preference.verseKey !== verseKey : mutation.verseKey !== verseKey;
    }),
  }));
}
