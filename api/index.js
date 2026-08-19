// server/app.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, desc, eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { boolean, double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var kgrBatches = mysqlTable("kgr_batches", {
  id: varchar("id", { length: 36 }).primaryKey(),
  visitorId: varchar("visitorId", { length: 64 }).notNull(),
  queryMode: mysqlEnum("queryMode", ["quoted", "unquoted"]).notNull(),
  exactProvider: mysqlEnum("exactProvider", ["scrapingdog", "scrapingbee"]).notNull(),
  keywordCount: int("keywordCount").notNull(),
  exactCount: int("exactCount").notNull().default(0),
  hotCount: int("hotCount").notNull().default(0),
  status: mysqlEnum("status", ["completed", "partial", "failed"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var kgrResults = mysqlTable("kgr_results", {
  id: int("id").autoincrement().primaryKey(),
  batchId: varchar("batchId", { length: 36 }).notNull(),
  visitorId: varchar("visitorId", { length: 64 }).notNull(),
  keyword: varchar("keyword", { length: 240 }).notNull(),
  monthlySearchVolume: int("monthlySearchVolume").notNull(),
  allintitleCount: int("allintitleCount"),
  kgr: double("kgr"),
  tier: mysqlEnum("tier", ["hot", "ok", "competitive", "unavailable"]).notNull(),
  classicEligible: boolean("classicEligible").notNull().default(false),
  status: mysqlEnum("status", ["exact", "unavailable"]).notNull(),
  reason: text("reason"),
  source: varchar("source", { length: 120 }).notNull(),
  queriedAt: timestamp("queriedAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function saveKgrBatch(batch, results) {
  const db = await getDb();
  if (!db) return false;
  await db.insert(kgrBatches).values(batch);
  if (results.length) await db.insert(kgrResults).values(results);
  return true;
}
async function listKgrHistory(visitorId, search, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  const batches = await db.select().from(kgrBatches).where(eq(kgrBatches.visitorId, visitorId)).orderBy(desc(kgrBatches.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
  if (!search?.trim()) return batches;
  const matching = await db.select({ batchId: kgrResults.batchId }).from(kgrResults).where(and(eq(kgrResults.visitorId, visitorId), like(kgrResults.keyword, `%${search.trim()}%`))).limit(1e3);
  const ids = new Set(matching.map((row) => row.batchId));
  return batches.filter((batch) => ids.has(batch.id));
}
async function getKgrHistoryResults(visitorId, batchId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(kgrResults).where(and(eq(kgrResults.visitorId, visitorId), eq(kgrResults.batchId, batchId))).orderBy(desc(kgrResults.id));
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
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
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { z as z2 } from "zod";

// server/kgr.ts
import { TRPCError } from "@trpc/server";
var SCRAPINGDOG_ENDPOINT = "https://api.scrapingdog.com/google/";
var SCRAPINGBEE_ENDPOINT = "https://app.scrapingbee.com/api/v1/store/google";
var SERPER_ENDPOINT = "https://google.serper.dev/search";
function formatAllintitleQuery(keyword, queryMode = "unquoted") {
  const phrase = keyword.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return queryMode === "quoted" ? `allintitle:"${phrase}"` : `allintitle:${phrase}`;
}
function parseAboutResults(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/about\s+([\d,]+(?:\.\d+)?)\s+results?/i) ?? value.match(/([\d,]+)\s+results?/i);
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
function getKgrTier(kgr) {
  if (kgr < 0.25) return "hot";
  if (kgr <= 1) return "ok";
  return "competitive";
}
function isClassicKgrEligible(monthlySearchVolume) {
  return Number.isFinite(monthlySearchVolume) && monthlySearchVolume < 250;
}
function calculateKgr(allintitleCount, monthlySearchVolume) {
  if (!Number.isFinite(allintitleCount) || allintitleCount < 0) throw new Error("Allintitle count must be a non-negative number.");
  if (!Number.isFinite(monthlySearchVolume) || monthlySearchVolume <= 0) throw new Error("Monthly search volume must be greater than zero.");
  return allintitleCount / monthlySearchVolume;
}
function readTotalResults(payload) {
  const information = payload.search_information ?? payload.searchInformation;
  const rawValue = information?.total_results ?? payload.meta_data?.number_of_results;
  if (typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue >= 0) return rawValue;
  if (typeof rawValue === "string") {
    const parsed = Number.parseInt(rawValue.replace(/[^0-9]/g, ""), 10);
    if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
  }
  return [information?.formattedTotalResults, payload.resultStats, payload.text, payload.markdown, payload.html].map(parseAboutResults).find((value) => value !== null) ?? null;
}
async function readProviderResponse(response, provider) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = payload.message ? ` ${payload.message}` : "";
    throw new TRPCError({ code: response.status === 429 ? "TOO_MANY_REQUESTS" : "BAD_GATEWAY", message: `${provider} request failed (${response.status}).${providerMessage}` });
  }
  return payload;
}
async function fetchScrapingdogUsaAllintitle(keyword, apiKey, queryMode = "unquoted") {
  const url = new URL(SCRAPINGDOG_ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", formatAllintitleQuery(keyword, queryMode));
  url.searchParams.set("country", "us");
  url.searchParams.set("language", "en");
  url.searchParams.set("results", "10");
  url.searchParams.set("advance_search", "true");
  return readTotalResults(await readProviderResponse(await fetch(url, { signal: AbortSignal.timeout(2e4) }), "Scrapingdog"));
}
async function fetchScrapingbeeUsaAllintitle(keyword, apiKey, queryMode = "unquoted") {
  const url = new URL(SCRAPINGBEE_ENDPOINT);
  url.searchParams.set("search", formatAllintitleQuery(keyword, queryMode));
  url.searchParams.set("country_code", "us");
  url.searchParams.set("search_type", "classic");
  url.searchParams.set("light_request", "true");
  return readTotalResults(await readProviderResponse(await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(2e4) }), "ScrapingBee"));
}
async function fetchSerperUsaSearch(keyword, apiKey, queryMode = "unquoted") {
  const response = await fetch(SERPER_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "X-API-KEY": apiKey }, body: JSON.stringify({ q: formatAllintitleQuery(keyword, queryMode), gl: "us", hl: "en", autocorrect: false, num: 10 }), signal: AbortSignal.timeout(18e3) });
  return readProviderResponse(response, "Serper.dev");
}
async function analyzeKeyword(input) {
  const keyword = input.keyword.trim();
  const queryMode = input.queryMode ?? "unquoted";
  const keys = { scrapingdog: input.scrapingdogApiKey || process.env.SCRAPINGDOG_API_KEY, scrapingbee: input.scrapingbeeApiKey || process.env.SCRAPINGBEE_API_KEY };
  const serperKey = input.serperApiKey || process.env.SERPER_API_KEY;
  if (serperKey) await fetchSerperUsaSearch(keyword, serperKey, queryMode).catch(() => void 0);
  const providers = [input.exactProvider, ...input.fallbackProvider && input.fallbackProvider !== input.exactProvider ? [input.fallbackProvider] : []];
  let lastReason = "No exact-count provider returned total-results metadata.";
  for (const provider of providers) {
    const apiKey = keys[provider];
    if (!apiKey) {
      lastReason = `${provider === "scrapingdog" ? "Scrapingdog" : "ScrapingBee"} has no API key configured.`;
      continue;
    }
    try {
      const count = provider === "scrapingdog" ? await fetchScrapingdogUsaAllintitle(keyword, apiKey, queryMode) : await fetchScrapingbeeUsaAllintitle(keyword, apiKey, queryMode);
      if (count === null) {
        lastReason = `${provider === "scrapingdog" ? "Scrapingdog" : "ScrapingBee"} returned SERP data without exact total-results metadata.`;
        continue;
      }
      const kgr = calculateKgr(count, input.monthlySearchVolume);
      return { keyword, allintitleCount: count, monthlySearchVolume: input.monthlySearchVolume, kgr, tier: getKgrTier(kgr), classicEligible: isClassicKgrEligible(input.monthlySearchVolume), status: "exact", queriedAt: Date.now(), source: provider === "scrapingdog" ? "Google USA via Scrapingdog" : "Google USA via ScrapingBee" };
    } catch (error) {
      if (error instanceof TRPCError && error.code === "TOO_MANY_REQUESTS") throw error;
      lastReason = error instanceof Error ? error.message : lastReason;
    }
  }
  return { keyword, allintitleCount: null, monthlySearchVolume: input.monthlySearchVolume, kgr: null, tier: "unavailable", classicEligible: isClassicKgrEligible(input.monthlySearchVolume), status: "unavailable", reason: lastReason, queriedAt: Date.now(), source: input.exactProvider === "scrapingbee" ? "Google USA via ScrapingBee" : "Google USA via Scrapingdog" };
}
async function analyzeKeywords(inputs, concurrency = 8, onProgress) {
  const results = new Array(inputs.length);
  let cursor = 0;
  let processed = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= inputs.length) return;
      try {
        let lastError;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            results[index] = await analyzeKeyword(inputs[index]);
            lastError = void 0;
            break;
          } catch (error) {
            lastError = error;
            if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
          }
        }
        if (!results[index]) throw lastError;
      } catch (error) {
        results[index] = {
          keyword: inputs[index].keyword,
          allintitleCount: null,
          monthlySearchVolume: inputs[index].monthlySearchVolume,
          kgr: null,
          tier: "unavailable",
          classicEligible: isClassicKgrEligible(inputs[index].monthlySearchVolume),
          status: "unavailable",
          reason: error instanceof Error ? error.message : "Analysis failed",
          queriedAt: Date.now(),
          source: inputs[index].exactProvider === "scrapingbee" ? "Google USA via ScrapingBee" : "Google USA via Scrapingdog"
        };
      }
      processed += 1;
      onProgress?.(processed);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), inputs.length) }, worker));
  return results;
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError as TRPCError2 } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError2({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError2({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError3 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError3({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError3({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
var kgrBatchInput = z2.object({
  visitorId: z2.string().trim().min(16).max(64),
  queryMode: z2.enum(["quoted", "unquoted"]).default("unquoted"),
  exactProvider: z2.enum(["scrapingdog", "scrapingbee"]).default("scrapingdog"),
  fallbackProvider: z2.enum(["scrapingdog", "scrapingbee"]).optional(),
  serperApiKey: z2.string().max(300).optional(),
  scrapingdogApiKey: z2.string().max(300).optional(),
  scrapingbeeApiKey: z2.string().max(300).optional(),
  keywords: z2.array(z2.object({ keyword: z2.string().trim().min(1).max(240), monthlySearchVolume: z2.number().int().positive().max(1e8) })).min(1).max(1e4)
});
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  kgr: router({
    configuration: publicProcedure.query(() => ({
      configured: Boolean(process.env.SCRAPINGDOG_API_KEY || process.env.SCRAPINGBEE_API_KEY),
      exactCountProvider: "Scrapingdog or ScrapingBee",
      serperConfigured: Boolean(process.env.SERPER_API_KEY),
      scrapingdogConfigured: Boolean(process.env.SCRAPINGDOG_API_KEY),
      scrapingbeeConfigured: Boolean(process.env.SCRAPINGBEE_API_KEY),
      region: "United States",
      engine: "Google"
    })),
    analyzeKeyword: publicProcedure.input(
      z2.object({
        keyword: z2.string().trim().min(1, "A keyword is required.").max(240, "Keywords must be 240 characters or fewer."),
        monthlySearchVolume: z2.number().finite().positive("Monthly volume must be greater than zero.").max(1e8),
        queryMode: z2.enum(["quoted", "unquoted"]).default("unquoted"),
        exactProvider: z2.enum(["scrapingdog", "scrapingbee"]).default("scrapingdog"),
        fallbackProvider: z2.enum(["scrapingdog", "scrapingbee"]).optional(),
        serperApiKey: z2.string().max(300).optional(),
        scrapingdogApiKey: z2.string().max(300).optional(),
        scrapingbeeApiKey: z2.string().max(300).optional()
      })
    ).mutation(async ({ input }) => {
      const hasExactKey = input.exactProvider === "scrapingbee" ? input.scrapingbeeApiKey || process.env.SCRAPINGBEE_API_KEY : input.scrapingdogApiKey || process.env.SCRAPINGDOG_API_KEY;
      if (!hasExactKey) throw new Error(`${input.exactProvider === "scrapingbee" ? "ScrapingBee" : "Scrapingdog"} is not configured. Add its key in API settings.`);
      return analyzeKeyword(input);
    }),
    analyzeBatch: publicProcedure.input(kgrBatchInput).mutation(async ({ input }) => {
      const hasExactKey = input.exactProvider === "scrapingbee" ? input.scrapingbeeApiKey || process.env.SCRAPINGBEE_API_KEY : input.scrapingdogApiKey || process.env.SCRAPINGDOG_API_KEY;
      if (!hasExactKey) throw new Error(`${input.exactProvider === "scrapingbee" ? "ScrapingBee" : "Scrapingdog"} is not configured. Add its key in API settings.`);
      const results = await analyzeKeywords(input.keywords.map((item) => ({ ...item, exactProvider: input.exactProvider, queryMode: input.queryMode, fallbackProvider: input.fallbackProvider, serperApiKey: input.serperApiKey, scrapingdogApiKey: input.scrapingdogApiKey, scrapingbeeApiKey: input.scrapingbeeApiKey })), 8);
      const batchId = crypto.randomUUID();
      const exactResults = results.filter((result) => result.status === "exact");
      await saveKgrBatch({ id: batchId, visitorId: input.visitorId, queryMode: input.queryMode, exactProvider: input.exactProvider, keywordCount: results.length, exactCount: exactResults.length, hotCount: results.filter((result) => result.tier === "hot").length, status: exactResults.length === results.length ? "completed" : exactResults.length ? "partial" : "failed" }, results.map((result) => ({ batchId, visitorId: input.visitorId, keyword: result.keyword, monthlySearchVolume: result.monthlySearchVolume, allintitleCount: result.allintitleCount, kgr: result.kgr, tier: result.tier, classicEligible: isClassicKgrEligible(result.monthlySearchVolume), status: result.status, reason: result.reason, source: result.source, queriedAt: new Date(result.queriedAt) })));
      return { batchId, results };
    }),
    history: publicProcedure.input(z2.object({ visitorId: z2.string().trim().min(16).max(64), search: z2.string().max(120).optional(), limit: z2.number().int().min(1).max(100).default(30) })).query(({ input }) => listKgrHistory(input.visitorId, input.search, input.limit)),
    historyResults: publicProcedure.input(z2.object({ visitorId: z2.string().trim().min(16).max(64), batchId: z2.string().uuid() })).query(({ input }) => getKgrHistoryResults(input.visitorId, input.batchId))
  })
  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/app.ts
function createApp() {
  const app2 = express();
  app2.use(express.json({ limit: "50mb" }));
  app2.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app2);
  registerOAuthRoutes(app2);
  app2.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app2;
}

// server/vercel.ts
var app = createApp();
var vercel_default = app;
export {
  vercel_default as default
};
