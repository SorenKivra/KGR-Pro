import { describe, expect, it } from "vitest";
import { analyzeKeyword } from "./kgr";

describe("live Google About-results verification", () => {
  it("does not fabricate a count when Serper omits the Google About summary", async () => {
    const apiKey = process.env.SERPER_API_KEY;
    expect(apiKey).toBeTruthy();

    const result = await analyzeKeyword({
      keyword: "What can give a false-positive on a PET scan?",
      monthlySearchVolume: 1000,
      apiKey: apiKey!,
    });

    expect(result.source).toBe("Google USA via Serper.dev");
    expect(["exact", "unavailable"]).toContain(result.status);
    if (result.status === "unavailable") {
      expect(result.allintitleCount).toBeNull();
      expect(result.kgr).toBeNull();
      expect(result.reason).toContain("exact total-result");
    } else {
      expect(result.allintitleCount).toEqual(expect.any(Number));
      expect(result.kgr).toEqual(expect.any(Number));
    }
  }, 45_000);
});
