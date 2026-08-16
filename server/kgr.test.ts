import { describe, expect, it } from "vitest";
import { calculateKgr, formatAllintitleQuery, getKgrTier, parseAboutResults, readTotalResults } from "./kgr";

describe("KGR calculation", () => {
  it("computes the ratio from authentic result and volume inputs", () => {
    expect(calculateKgr(50, 400)).toBe(0.125);
  });

  it("classifies all KGR threshold bands consistently", () => {
    expect(getKgrTier(0.2499)).toBe("hot");
    expect(getKgrTier(0.25)).toBe("ok");
    expect(getKgrTier(1)).toBe("ok");
    expect(getKgrTier(1.0001)).toBe("competitive");
  });

  it("reads numeric, formatted, and visible About-result payloads without inventing values", () => {
    expect(readTotalResults({ searchInformation: { totalResults: 934 } })).toBe(934);
    expect(readTotalResults({ searchInformation: { totalResults: "1,004" } })).toBe(1004);
    expect(readTotalResults({ text: "About 337 results (0.38s)" })).toBe(337);
    expect(parseAboutResults("About 337 results (0.38s)")).toBe(337);
    expect(calculateKgr(readTotalResults({ text: "About 337 results (0.38s)" })!, 1000)).toBe(0.337);
    expect(readTotalResults({})).toBeNull();
  });

  it("quotes multi-word phrases exactly for Google allintitle searches", () => {
    expect(formatAllintitleQuery("What can give a false-positive on a PET scan?")).toBe("allintitle:What can give a false-positive on a PET scan?");
  });
});
