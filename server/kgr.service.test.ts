import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeKeyword } from "./kgr";

const nativeFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = nativeFetch;
  vi.restoreAllMocks();
});

describe("live allintitle analysis service", () => {
  it("sends the exact USA allintitle request and returns its KGR result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ searchInformation: { totalResults: 125 } }), { status: 200 }),
    );
    globalThis.fetch = fetchMock;

    const result = await analyzeKeyword({
      keyword: "best enamel cookware",
      monthlySearchVolume: 1000,
      apiKey: "test-key",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toMatchObject({ "X-API-KEY": "test-key" });
    expect(JSON.parse(String(options.body))).toMatchObject({
      q: "allintitle:best enamel cookware",
      gl: "us",
      hl: "en",
      autocorrect: false,
    });
    expect(result).toMatchObject({
      keyword: "best enamel cookware",
      allintitleCount: 125,
      monthlySearchVolume: 1000,
      kgr: 0.125,
      tier: "hot",
      source: "Google USA via Serper.dev",
    });
  });
});
