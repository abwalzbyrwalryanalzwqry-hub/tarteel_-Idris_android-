import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { apiUrl } from "./runtimeConfig";
const NATIVE_OAUTH_CALLBACK = "com.tarteel.quran://oauth/callback";

let listenerInstalled = false;

async function completeNativeOAuth(url: string) {
  const callback = new URL(url);
  const code = callback.searchParams.get("code");
  const state = callback.searchParams.get("state");
  const error = callback.searchParams.get("error");

  if (callback.protocol !== "com.tarteel.quran:" || callback.hostname !== "oauth") return;
  if (error || !code || !state) {
    window.location.replace(`/login?authError=${encodeURIComponent(error || "oauth_callback")}`);
    return;
  }

  // The native callback carries the provider's code back to the WebView. The
  // server performs the code exchange and sets the normal app session cookie.
  const exchangeUrl = new URL(apiUrl("/api/oauth/callback"), window.location.origin);
  exchangeUrl.searchParams.set("code", code);
  exchangeUrl.searchParams.set("state", state);

  const response = await fetch(exchangeUrl.toString(), {
    method: "GET",
    credentials: "include",
    redirect: "manual",
  });

  if (!response.ok) {
    throw new Error("Native OAuth exchange failed");
  }

  // A native callback must never leave the user on the external browser page.
  try {
    sessionStorage.removeItem("tarteel:native-oauth-nonce");
    sessionStorage.removeItem("tarteel:oauth-login-started-at");
  } catch {}
  window.location.replace("/");
}

export async function installNativeOAuthListener() {
  if (!Capacitor.isNativePlatform() || listenerInstalled) return;
  listenerInstalled = true;

  const handle = (event: { url: string } | string) => {
    const url = typeof event === "string" ? event : event.url;
    void completeNativeOAuth(url).catch(() => {
      window.location.replace("/login?authError=oauth_callback");
    });
  };

  await App.addListener("appUrlOpen", handle as (event: { url: string }) => void);
  const launch = await App.getLaunchUrl();
  if (launch?.url) handle(launch.url);
}

export { NATIVE_OAUTH_CALLBACK };
