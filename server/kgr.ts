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
  source: "Google USA via Serper.dev";
};

type SerperSearchResponse = {
  searchInformation?: {
    totalResults?: number | string;
  };
  message?: string;
};

const SERPER_ENDPOINT = "https://google.serper.dev/search";

export function getKgrTier(kgr: number): KgrTier {
  if (kgr < 0.25) return "hot";
  if (kgr <= 1) return "ok";
  return "competitive";
}

export function calculateKgr(allintitleCount: number, monthlySearchVolume: number) {
  if (!Number.isFinite(allintitleCount) || allintitleCount < 0) {
    throw new Error("Allintitle count must be a non-negative number.");
  }
  if (!Number.isFinite(monthlySearchVolume) || monthlySearchVolume <= 0) {
    throw new Error("Monthly search volume must be greater than zero.");
  }
  return allintitleCount / monthlySearchVolume;
}

export function readTotalResults(payload: SerperSearchResponse): number | null {
  const rawValue = payload.searchInformation?.totalResults;
  if (typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue >= 0) {
    return rawValue;
  }

  if (typeof rawValue === "string") {
    const normalized = rawValue.replace(/[^0-9]/g, "");
    const parsed = Number.parseInt(normalized, 10);
    if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
  }

  return null;
}

export async function fetchGoogleUsaAllintitle(keyword: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);

  try {
    const response = await fetch(SERPER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q: `allintitle:${keyword}`,
        gl: "us",
        hl: "en",
        autocorrect: false,
        num: 1,
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as SerperSearchResponse;

    if (!response.ok) {
      const providerMessage = payload.message ? ` ${payload.message}` : "";
      throw new TRPCError({
        code: response.status === 429 ? "TOO_MANY_REQUESTS" : "BAD_GATEWAY",
        message: `Serper.dev request failed (${response.status}).${providerMessage}`,
      });
    }

    return readTotalResults(payload);
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new TRPCError({ code: "TIMEOUT", message: "The Serper.dev request timed out. Please retry this keyword." });
    }
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: error instanceof Error ? error.message : "Unable to reach Serper.dev.",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeKeyword(input: {
  keyword: string;
  monthlySearchVolume: number;
  apiKey: string;
}): Promise<KgrResult> {
  const keyword = input.keyword.trim();
  const allintitleCount = await fetchGoogleUsaAllintitle(keyword, input.apiKey);
  if (allintitleCount === null) {
    return {
      keyword,
      allintitleCount: null,
      monthlySearchVolume: input.monthlySearchVolume,
      kgr: null,
      tier: "unavailable",
      status: "unavailable",
      reason: "Serper.dev returned SERP listings but no exact total-result field for this query.",
      queriedAt: Date.now(),
      source: "Google USA via Serper.dev",
    };
  }

  const kgr = calculateKgr(allintitleCount, input.monthlySearchVolume);

  return {
    keyword,
    allintitleCount,
    monthlySearchVolume: input.monthlySearchVolume,
    kgr,
    tier: getKgrTier(kgr),
    status: "exact",
    queriedAt: Date.now(),
    source: "Google USA via Serper.dev",
  };
}
