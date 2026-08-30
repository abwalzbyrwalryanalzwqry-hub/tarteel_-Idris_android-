import { randomUUID } from "node:crypto";
import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState, encodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

const NATIVE_OAUTH_CALLBACK = "com.tarteel.quran://oauth/callback";

function isNativeRedirectUri(redirectUri: string) {
  return redirectUri === NATIVE_OAUTH_CALLBACK;
}

function allowNativeWebViewCors(req: Request, res: Response) {
  const requestOrigin = req.headers.origin;
  if (requestOrigin === "http://localhost" || requestOrigin === "capacitor://localhost") {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/native-start", (req: Request, res: Response) => {
    allowNativeWebViewCors(req, res);
    const nonce = randomUUID();
    const redirectUri = NATIVE_OAUTH_CALLBACK;
    const state = encodeOAuthState({ redirectUri, nonce });
    res.cookie(OAUTH_STATE_COOKIE, nonce, {
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 10 * 60 * 1000,
    });
    res.json({ state, redirectUri });
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    allowNativeWebViewCors(req, res);
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF guard: the nonce in `state` must match the one-time cookie that
    // startLogin set in the browser that began this login. An attacker can
    // forge `state`, but cannot plant this cookie in the victim's browser.
    const { nonce, redirectUri } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    // Native OAuth returns to the Android app through its registered deep link.
    // The app exchanges the code back against the API-originated cookie, so the
    // same nonce check protects both browser and native flows.
    if (!nonce || nonce !== expectedNonce) {
      // Keep the CSRF failure closed, clear any stale browser state, and return
      // to the app's retry screen rather than leaving a mobile browser on JSON.
      res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
      res.redirect(302, "/login?authError=oauth_state");
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      if (isNativeRedirectUri(redirectUri)) {
        res.status(200).json({ ok: true });
      } else {
        res.redirect(302, "/");
      }
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
