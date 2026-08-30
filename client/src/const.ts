import { Capacitor } from "@capacitor/core";
import { OAUTH_STATE_COOKIE, encodeOAuthState, isOAuthLoginAttemptLocked } from "@shared/const";
import { apiUrl } from "./lib/runtimeConfig";

// Capacitor builds do not receive the hosting platform's Vite env injection.
// Keep these public OAuth identifiers available in the APK while leaving
// server credentials exclusively on the backend.
const OAUTH_PORTAL_ORIGIN = "https://manus.im";
const OAUTH_APP_ID = "8KMXG5HuLxbvvs33zAzb6B";
const NATIVE_OAUTH_CALLBACK = "com.tarteel.quran://oauth/callback";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export const startLogin = async () => {
  // Several unauthenticated queries can fail together on mobile. Keep the first
  // navigation authoritative so a second call cannot overwrite its nonce cookie.
  try {
    const startedAt = sessionStorage.getItem("tarteel:oauth-login-started-at");
    if (isOAuthLoginAttemptLocked(startedAt)) return;
    sessionStorage.setItem("tarteel:oauth-login-started-at", String(Date.now()));
  } catch {
    // Storage may be blocked; the nonce guard on the server still fails closed.
  }

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL?.trim() || OAUTH_PORTAL_ORIGIN;
  const appId = import.meta.env.VITE_APP_ID?.trim() || OAUTH_APP_ID;
  if (!appId || !oauthPortalUrl) {
    throw new Error("OAuth configuration is incomplete");
  }

  let redirectUri: string;
  let state: string;
  if (Capacitor.isNativePlatform()) {
    // Set the __Host- nonce cookie from the API origin first. The external
    // provider then returns to the app's registered deep link, and the app
    // exchanges the code back against this same API-origin cookie.
    const response = await fetch(apiUrl("/api/oauth/native-start"), {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Unable to start native OAuth");
    const payload = await response.json() as { state?: string; redirectUri?: string };
    state = payload.state || "";
    redirectUri = payload.redirectUri || NATIVE_OAUTH_CALLBACK;
    if (!state || !redirectUri) throw new Error("OAuth configuration is incomplete");
  } else {
    redirectUri = apiUrl("/api/oauth/callback");
    const nonce = crypto.randomUUID();
    document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
    state = encodeOAuthState({ redirectUri, nonce });
  }

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  window.location.href = url.toString();
};

export const clearPendingOAuthLoginAttempt = () => {
  try {
    sessionStorage.removeItem("tarteel:oauth-login-started-at");
  } catch {
    // Storage may be unavailable; a later attempt simply waits for the lock.
  }
};
