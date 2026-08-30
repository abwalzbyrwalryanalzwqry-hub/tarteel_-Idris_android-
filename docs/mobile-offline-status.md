# Mobile and offline status

## Implemented

- Capacitor consumes the local web bundle from `android-wrapper/www`.
- `pnpm mobile:build` builds the web app and refreshes the wrapper assets.
- A production service worker caches the app shell and same-origin static assets.
- Quran text, navigation metadata, and the Mushaf manifest are bundled locally.
- The reader has an optional on-device Quran asset pack: it downloads all 604 page SVG files and 604 interaction files into IndexedDB, with progress feedback and resumable per-file downloads.
- The reader uses the downloaded local asset pack first, then the bundled asset path, and finally the online storage mirror if an asset is unavailable.
- Reading progress, bookmarks, verse favorites, and notes use an IndexedDB-backed repository with a localStorage fallback.
- Offline mutations are durable and are attempted again after authentication/connection returns.
- The UI displays offline status and pending local operations.
- API and storage origins can be configured independently with `VITE_API_BASE_URL`, `VITE_STORAGE_BASE_URL`, and `VITE_PUBLIC_APP_URL`.

## Current limitations

- tRPC/API data, authentication, center management, attendance, reports, messaging, AI, and server-side exports still require the backend.
- Tafsir content still loads from the storage backend and is not packaged yet.
- The current offline queue is intentionally limited to Quran personal state. It is not yet a general-purpose sync engine for center data.
- The optional full Mushaf asset pack is about 384 MB before compression and is not included in the base APK/AAB. A release build must still be measured.
- The current client-side queue is a bridge until the server exposes cursor/version fields and idempotency keys. It should not be treated as conflict-free multi-device sync.

## Recommended next boundary

1. Add a server sync endpoint with cursor/version fields, idempotency keys, and authenticated user scoping.
2. Replace the temporary client-side replay with that sync contract and explicit conflict rules.
3. Add automated browser/device tests for offline save, reload, reconnect, and duplicate replay.
4. Extend the local repository to attendance/lesson drafts only after the sync contract is verified with two devices.
5. Measure the Android artifact and test the on-demand asset pack on a real device, including resume-after-interruption and available-storage errors.
