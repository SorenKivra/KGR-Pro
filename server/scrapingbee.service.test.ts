import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeKeyword } from "./kgr";

const nativeFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = nativeFetch;
  vi.restoreAllMocks();
});

describe("ScrapingBee exact-count provider", () => {
  it("uses the official Google Store endpoint and reads number_of_results", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ organic: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        meta_data: { number_of_results: 337, number_of_organic_results: 20 },
        organic_results: [],
      }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const result = await analyzeKeyword({
      keyword: "best enamel cookware",
      monthlySearchVolume: 1000,
      exactProvider: "scrapingbee",
      serperApiKey: "serper-test",
      scrapingbeeApiKey: "bee-test",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [requestUrl, requestInit] = fetchMock.mock.calls[1] as [URL | string, RequestInit];
    const url = new URL(String(requestUrl));
    expect(url.hostname).toBe("app.scrapingbee.com");
    expect(url.pathname).toBe("/api/v1/store/google");
    expect(url.searchParams.get("search")).toBe("allintitle:best enamel cookware");
    expect(url.searchParams.get("country_code")).toBe("us");
    expect(requestInit.headers).toMatchObject({ Authorization: "Bearer bee-test" });
    expect(result).toMatchObject({ allintitleCount: 337, kgr: 0.337, status: "exact", source: "Google USA via ScrapingBee" });
  });
});
