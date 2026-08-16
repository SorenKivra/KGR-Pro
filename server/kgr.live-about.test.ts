import { describe, expect, it } from "vitest";
import { analyzeKeyword } from "./kgr";

describe("live Google About-results verification", () => {
  it("returns Scrapingdog total-results metadata for the screenshot phrase", async () => {
    const apiKey = process.env.SCRAPINGDOG_API_KEY;
    expect(apiKey).toBeTruthy();

    const result = await analyzeKeyword({ keyword: "What can give a false-positive on a PET scan?", monthlySearchVolume: 1000, apiKey: apiKey! });

    expect(result.source).toBe("Google USA via Scrapingdog");
    expect(result.status).toBe("exact");
    expect(result.allintitleCount).toEqual(expect.any(Number));
    expect(result.allintitleCount!).toBeGreaterThan(0);
    expect(result.kgr).toBeCloseTo(result.allintitleCount! / 1000, 10);
  }, 45_000);
});
