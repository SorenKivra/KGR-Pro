import { TRPCError } from "@trpc/server";

export const KGR_TIERS = ["hot", "ok", "competitive"] as const;
export type KgrTier = (typeof KGR_TIERS)[number];

export type KgrResult = {
  keyword: string;
  allintitleCount: number | null;
  monthlySearchVolume: number;
  kgr: number | null;
  tier: KgrTier | "unavailable";
  status: "exact" | "unavailable";
  reason?: string;
  queriedAt: number;
  source: "Google USA via Scrapingdog";
};

type SearchInformation = {
  total_results?: number | string;
  formattedTotalResults?: string;
  query_displayed?: string;
  time_taken?: number;
};

type SearchResponse = {
  search_information?: SearchInformation;
  searchInformation?: SearchInformation;
  resultStats?: string;
  text?: string;
  markdown?: string;
  html?: string;
  message?: string;
};

const SCRAPINGDOG_ENDPOINT = "https://api.scrapingdog.com/google/";
const SERPER_ENDPOINT = "https://google.serper.dev/search";

export function formatAllintitleQuery(keyword: string, quotePhrase = true) {
  const phrase = keyword.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return quotePhrase ? `allintitle:"${phrase}"` : `allintitle:${phrase}`;
}

export function parseAboutResults(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/about\s+([\d,]+(?:\.\d+)?)\s+results?/i) ?? value.match(/([\d,]+)\s+results?/i);
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function getKgrTier(kgr: number): KgrTier {
  if (kgr < 0.25) return "hot";
  if (kgr <= 1) return "ok";
  return "competitive";
}

export function calculateKgr(allintitleCount: number, monthlySearchVolume: number) {
  if (!Number.isFinite(allintitleCount) || allintitleCount < 0) throw new Error("Allintitle count must be a non-negative number.");
  if (!Number.isFinite(monthlySearchVolume) || monthlySearchVolume <= 0) throw new Error("Monthly search volume must be greater than zero.");
  return allintitleCount / monthlySearchVolume;
}

export function readTotalResults(payload: SearchResponse): number | null {
  const information = payload.search_information ?? payload.searchInformation;
  const rawValue = information?.total_results;
  if (typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue >= 0) return rawValue;
  if (typeof rawValue === "string") {
    const normalized = rawValue.replace(/[^0-9]/g, "");
    const parsed = Number.parseInt(normalized, 10);
    if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
  }
  return [information?.formattedTotalResults, payload.resultStats, payload.text, payload.markdown, payload.html]
    .map(parseAboutResults).find((value): value is number => value !== null) ?? null;
}

export async function fetchScrapingdogUsaAllintitle(keyword: string, apiKey: string) {
  const url = new URL(SCRAPINGDOG_ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", formatAllintitleQuery(keyword));
  url.searchParams.set("country", "us");
  url.searchParams.set("language", "en");
  url.searchParams.set("results", "10");
  url.searchParams.set("advance_search", "true");

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const payload = (await response.json().catch(() => ({}))) as SearchResponse;
  if (!response.ok) {
    const providerMessage = payload.message ? ` ${payload.message}` : "";
    throw new TRPCError({ code: response.status === 429 ? "TOO_MANY_REQUESTS" : "BAD_GATEWAY", message: `Scrapingdog request failed (${response.status}).${providerMessage}` });
  }
  return readTotalResults(payload);
}

/** Preserved as a separate Serper-only path for diagnostics and future provider selection. */
export async function fetchSerperUsaSearch(keyword: string, apiKey: string) {
  const response = await fetch(SERPER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ q: formatAllintitleQuery(keyword), gl: "us", hl: "en", autocorrect: false, num: 1 }),
    signal: AbortSignal.timeout(18_000),
  });
  const payload = (await response.json().catch(() => ({}))) as SearchResponse;
  if (!response.ok) throw new TRPCError({ code: response.status === 429 ? "TOO_MANY_REQUESTS" : "BAD_GATEWAY", message: `Serper.dev request failed (${response.status}).` });
  return payload;
}

export async function fetchGoogleUsaAllintitle(keyword: string, apiKey: string) {
  return fetchScrapingdogUsaAllintitle(keyword, apiKey);
}

export async function analyzeKeyword(input: { keyword: string; monthlySearchVolume: number; apiKey: string }): Promise<KgrResult> {
  const keyword = input.keyword.trim();
  const allintitleCount = await fetchScrapingdogUsaAllintitle(keyword, input.apiKey);
  if (allintitleCount === null) {
    return { keyword, allintitleCount: null, monthlySearchVolume: input.monthlySearchVolume, kgr: null, tier: "unavailable", status: "unavailable", reason: "Scrapingdog returned SERP data without an exact Google total-results field.", queriedAt: Date.now(), source: "Google USA via Scrapingdog" };
  }
  const kgr = calculateKgr(allintitleCount, input.monthlySearchVolume);
  return { keyword, allintitleCount, monthlySearchVolume: input.monthlySearchVolume, kgr, tier: getKgrTier(kgr), status: "exact", queriedAt: Date.now(), source: "Google USA via Scrapingdog" };
}
