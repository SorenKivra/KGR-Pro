import { describe, expect, it } from "vitest";
import { calculateKgr, getKgrTier, readTotalResults } from "./kgr";

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

  it("reads numeric and formatted Google total-result payloads without inventing values", () => {
    expect(readTotalResults({ searchInformation: { totalResults: 934 } })).toBe(934);
    expect(readTotalResults({ searchInformation: { totalResults: "1,004" } })).toBe(1004);
    expect(readTotalResults({})).toBeNull();
  });
});
