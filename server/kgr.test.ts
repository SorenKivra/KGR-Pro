import { describe, expect, it } from "vitest";
import { calculateKgr, formatAllintitleQuery, getKgrTier, isClassicKgrEligible, parseAboutResults, readTotalResults } from "./kgr";

describe("KGR calculation", () => {
  it("computes the ratio from authentic result and volume inputs", () => {
    expect(calculateKgr(50, 400)).toBe(0.125);
  });

  it("uses allintitle count divided by monthly search volume for the final KGR", () => {
    expect(calculateKgr(337, 1200)).toBeCloseTo(337 / 1200, 10);
    expect(calculateKgr(25, 50)).toBe(0.5);
  });

  it("classifies all KGR threshold bands consistently", () => {
    expect(getKgrTier(0.2499)).toBe("hot");
    expect(getKgrTier(0.25)).toBe("ok");
    expect(getKgrTier(1)).toBe("ok");
    expect(getKgrTier(1.0001)).toBe("competitive");
  });

  it("reads numeric, formatted, and visible About-result payloads without inventing values", () => {
    expect(readTotalResults({ search_information: { total_results: 934 } })).toBe(934);
    expect(readTotalResults({ search_information: { total_results: "1,004" } })).toBe(1004);
    expect(readTotalResults({ text: "About 337 results (0.38s)" })).toBe(337);
    expect(parseAboutResults("About 337 results (0.38s)")).toBe(337);
    expect(calculateKgr(readTotalResults({ text: "About 337 results (0.38s)" })!, 1000)).toBe(0.337);
    expect(readTotalResults({})).toBeNull();
  });

  it("supports the approved unquoted default and optional quoted allintitle forms", () => {
    expect(formatAllintitleQuery("What can give a false-positive on a PET scan?")).toBe("allintitle:What can give a false-positive on a PET scan?");
    expect(formatAllintitleQuery("What can give a false-positive on a PET scan?", "quoted")).toBe('allintitle:"What can give a false-positive on a PET scan?"');
  });

  it("marks only monthly volumes below 250 as classic KGR eligible", () => {
    expect(isClassicKgrEligible(249)).toBe(true);
    expect(isClassicKgrEligible(250)).toBe(false);
    expect(isClassicKgrEligible(1000)).toBe(false);
  });
});
