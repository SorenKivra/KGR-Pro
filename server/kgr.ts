import { TRPCError } from "@trpc/server";

export const KGR_TIERS = ["hot", "ok", "competitive"] as const;
export type KgrTier = (typeof KGR_TIERS)[number];
export type ExactProvider = "scrapingdog" | "scrapingbee";

export type KgrResult = {
  keyword: string;
  allintitleCount: number | null;
  monthlySearchVolume: number;
  kgr: number | null;
  tier: KgrTier | "unavailable";
  status: "exact" | "unavailable";
  reason?: string;
  queriedAt: number;
  source: "Google USA via Scrapingdog" | "Google USA via ScrapingBee";
};

type SearchInformation = { total_results?: number | string; formattedTotalResults?: string; query_displayed?: string; time_taken?: number };
type SearchResponse = { search_information?: SearchInformation; searchInformation?: SearchInformation; meta_data?: { number_of_results?: number | string; number_of_organic_results?: number | string }; resultStats?: string; text?: string; markdown?: string; html?: string; message?: string };

const SCRAPINGDOG_ENDPOINT = "https://api.scrapingdog.com/google/";
const SCRAPINGBEE_ENDPOINT = "https://app.scrapingbee.com/api/v1/store/google";
const SERPER_ENDPOINT = "https://google.serper.dev/search";

export function formatAllintitleQuery(keyword: string, quotePhrase = false) {
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

export function getKgrTier(kgr: number): KgrTier { if (kgr < 0.25) return "hot"; if (kgr <= 1) return "ok"; return "competitive"; }
export function calculateKgr(allintitleCount: number, monthlySearchVolume: number) {
  if (!Number.isFinite(allintitleCount) || allintitleCount < 0) throw new Error("Allintitle count must be a non-negative number.");
  if (!Number.isFinite(monthlySearchVolume) || monthlySearchVolume <= 0) throw new Error("Monthly search volume must be greater than zero.");
  return allintitleCount / monthlySearchVolume;
}

export function readTotalResults(payload: SearchResponse): number | null {
  const information = payload.search_information ?? payload.searchInformation;
  const rawValue = information?.total_results ?? payload.meta_data?.number_of_results;
  if (typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue >= 0) return rawValue;
  if (typeof rawValue === "string") { const parsed = Number.parseInt(rawValue.replace(/[^0-9]/g, ""), 10); if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed; }
  return [information?.formattedTotalResults, payload.resultStats, payload.text, payload.markdown, payload.html].map(parseAboutResults).find((value): value is number => value !== null) ?? null;
}

async function readProviderResponse(response: Response, provider: string) {
  const payload = (await response.json().catch(() => ({}))) as SearchResponse;
  if (!response.ok) {
    const providerMessage = payload.message ? ` ${payload.message}` : "";
    throw new TRPCError({ code: response.status === 429 ? "TOO_MANY_REQUESTS" : "BAD_GATEWAY", message: `${provider} request failed (${response.status}).${providerMessage}` });
  }
  return payload;
}

export async function fetchScrapingdogUsaAllintitle(keyword: string, apiKey: string) {
  const url = new URL(SCRAPINGDOG_ENDPOINT);
  url.searchParams.set("api_key", apiKey); url.searchParams.set("query", formatAllintitleQuery(keyword)); url.searchParams.set("country", "us"); url.searchParams.set("language", "en"); url.searchParams.set("results", "10"); url.searchParams.set("advance_search", "true");
  return readTotalResults(await readProviderResponse(await fetch(url, { signal: AbortSignal.timeout(20_000) }), "Scrapingdog"));
}

export async function fetchScrapingbeeUsaAllintitle(keyword: string, apiKey: string) {
  const url = new URL(SCRAPINGBEE_ENDPOINT);
  url.searchParams.set("search", formatAllintitleQuery(keyword)); url.searchParams.set("country_code", "us"); url.searchParams.set("search_type", "classic"); url.searchParams.set("light_request", "true");
  return readTotalResults(await readProviderResponse(await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20_000) }), "ScrapingBee"));
}

/** Serper remains a separate keyword/SERP diagnostic path and is not used as an exact-count substitute. */
export async function fetchSerperUsaSearch(keyword: string, apiKey: string) {
  const response = await fetch(SERPER_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "X-API-KEY": apiKey }, body: JSON.stringify({ q: keyword, gl: "us", hl: "en", autocorrect: false, num: 10 }), signal: AbortSignal.timeout(18_000) });
  return readProviderResponse(response, "Serper.dev");
}

export async function analyzeKeyword(input: { keyword: string; monthlySearchVolume: number; exactProvider: ExactProvider; scrapingdogApiKey?: string; scrapingbeeApiKey?: string; serperApiKey?: string; fallbackProvider?: ExactProvider }): Promise<KgrResult> {
  const keyword = input.keyword.trim();
  const keys: Record<ExactProvider, string | undefined> = { scrapingdog: input.scrapingdogApiKey || process.env.SCRAPINGDOG_API_KEY, scrapingbee: input.scrapingbeeApiKey || process.env.SCRAPINGBEE_API_KEY };
  const serperKey = input.serperApiKey || process.env.SERPER_API_KEY;
  if (serperKey) await fetchSerperUsaSearch(keyword, serperKey).catch(() => undefined);
  const providers: ExactProvider[] = [input.exactProvider, ...(input.fallbackProvider && input.fallbackProvider !== input.exactProvider ? [input.fallbackProvider] : [])];
  let lastReason = "No exact-count provider returned total-results metadata.";
  for (const provider of providers) {
    const apiKey = keys[provider];
    if (!apiKey) { lastReason = `${provider === "scrapingdog" ? "Scrapingdog" : "ScrapingBee"} has no API key configured.`; continue; }
    try {
      const count = provider === "scrapingdog" ? await fetchScrapingdogUsaAllintitle(keyword, apiKey) : await fetchScrapingbeeUsaAllintitle(keyword, apiKey);
      if (count === null) { lastReason = `${provider === "scrapingdog" ? "Scrapingdog" : "ScrapingBee"} returned SERP data without exact total-results metadata.`; continue; }
      const kgr = calculateKgr(count, input.monthlySearchVolume);
      return { keyword, allintitleCount: count, monthlySearchVolume: input.monthlySearchVolume, kgr, tier: getKgrTier(kgr), status: "exact", queriedAt: Date.now(), source: provider === "scrapingdog" ? "Google USA via Scrapingdog" : "Google USA via ScrapingBee" };
    } catch (error) { if (error instanceof TRPCError && error.code === "TOO_MANY_REQUESTS") throw error; lastReason = error instanceof Error ? error.message : lastReason; }
  }
  return { keyword, allintitleCount: null, monthlySearchVolume: input.monthlySearchVolume, kgr: null, tier: "unavailable", status: "unavailable", reason: lastReason, queriedAt: Date.now(), source: input.exactProvider === "scrapingbee" ? "Google USA via ScrapingBee" : "Google USA via Scrapingdog" };
}
