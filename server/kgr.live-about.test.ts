import { describe, expect, it } from "vitest";
import { analyzeKeyword } from "./kgr";

describe("live Google About-results verification", () => {
  it("returns exact Scrapingdog metadata or reports provider quota exhaustion", async () => {
    const apiKey = process.env.SCRAPINGDOG_API_KEY;
    expect(apiKey).toBeTruthy();

    try {
      const result = await analyzeKeyword({ keyword: "What can give a false-positive on a PET scan?", monthlySearchVolume: 1000, apiKey: apiKey! });
      expect(result.source).toBe("Google USA via Scrapingdog");
      expect(result.status).toBe("exact");
      expect(result.allintitleCount).toEqual(expect.any(Number));
      expect(result.allintitleCount!).toBeGreaterThan(0);
      expect(result.kgr).toBeCloseTo(result.allintitleCount! / 1000, 10);
    } catch (error) {
      expect(error instanceof Error ? error.message : String(error)).toMatch(/account limit|upgrade your account|credits/i);
    }
  }, 45_000);
});
