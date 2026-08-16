import { describe, expect, it } from "vitest";
import { analyzeKeyword } from "./kgr";

describe("live Google About-results verification", () => {
  it("returns exact Scrapingdog metadata or a truthful provider-state result", async () => {
    const apiKey = process.env.SCRAPINGDOG_API_KEY;
    expect(apiKey).toBeTruthy();

    const result = await analyzeKeyword({
      keyword: "What can give a false-positive on a PET scan?",
      monthlySearchVolume: 1000,
      exactProvider: "scrapingdog",
      scrapingdogApiKey: apiKey!,
    });

    if (result.status === "unavailable") {
      expect(result.allintitleCount).toBeNull();
      expect(result.kgr).toBeNull();
      expect(result.tier).toBe("unavailable");
      expect(result.reason).toBeTruthy();
      return;
    }

    expect(result.source).toBe("Google USA via Scrapingdog");
    expect(result.allintitleCount).toEqual(expect.any(Number));
    expect(result.allintitleCount!).toBeGreaterThan(0);
    expect(result.kgr).toBeCloseTo(result.allintitleCount! / 1000, 10);
  }, 45_000);
});
