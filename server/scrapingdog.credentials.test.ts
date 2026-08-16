import { describe, expect, it } from "vitest";

describe("Scrapingdog credential", () => {
  it("authenticates a lightweight Google USA request", async () => {
    const apiKey = process.env.SCRAPINGDOG_API_KEY;
    expect(apiKey, "SCRAPINGDOG_API_KEY must be configured").toBeTruthy();

    const url = new URL("https://api.scrapingdog.com/google");
    url.searchParams.set("api_key", apiKey!);
    url.searchParams.set("query", "allintitle:kgr test");
    url.searchParams.set("country", "us");
    url.searchParams.set("results", "1");

    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const body = await response.text();
    expect(response.status, body.slice(0, 500)).toBe(200);
    expect(body.length).toBeGreaterThan(0);
  }, 30_000);
});
