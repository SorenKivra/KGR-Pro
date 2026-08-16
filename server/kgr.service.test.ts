import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeKeyword } from "./kgr";

const nativeFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = nativeFetch;
  vi.restoreAllMocks();
});

describe("live allintitle analysis service", () => {
  it("sends the exact USA Scrapingdog request and returns its KGR result", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      search_information: {
        total_results: 125,
        query_displayed: 'allintitle:"best enamel cookware"',
        time_taken: 0.38,
      },
      organic_results: [],
    }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const result = await analyzeKeyword({ keyword: "best enamel cookware", monthlySearchVolume: 1000, apiKey: "test-key" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl] = fetchMock.mock.calls[0] as [URL | string];
    const url = new URL(String(requestUrl));
    expect(url.hostname).toBe("api.scrapingdog.com");
    expect(url.pathname).toBe("/google/");
    expect(url.searchParams.get("api_key")).toBe("test-key");
    expect(url.searchParams.get("query")).toBe('allintitle:"best enamel cookware"');
    expect(url.searchParams.get("country")).toBe("us");
    expect(url.searchParams.get("language")).toBe("en");
    expect(url.searchParams.get("advance_search")).toBe("true");
    expect(result).toMatchObject({ keyword: "best enamel cookware", allintitleCount: 125, monthlySearchVolume: 1000, kgr: 0.125, tier: "hot", status: "exact", source: "Google USA via Scrapingdog" });
  });
});
