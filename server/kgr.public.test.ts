import { describe, expect, it } from "vitest";
import { appRouter, kgrBatchInput } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("public KGR access", () => {
  it("accepts any positive batch size and rejects only above the safe maximum", () => {
    const base = { visitorId: "visitor-12345678901234", queryMode: "unquoted" as const, exactProvider: "scrapingdog" as const, keywords: [{ keyword: "one keyword", monthlySearchVolume: 100 }] };
    expect(kgrBatchInput.parse(base).keywords).toHaveLength(1);
    expect(() => kgrBatchInput.parse({ ...base, keywords: Array.from({ length: 10001 }, (_, index) => ({ keyword: `keyword ${index}`, monthlySearchVolume: 100 })) })).toThrow();
  });

  it("exposes provider configuration without requiring a Manus session", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const configuration = await caller.kgr.configuration();

    expect(configuration.region).toBe("United States");
    expect(configuration.engine).toBe("Google");
    expect(configuration.exactCountProvider).toBe("Scrapingdog or ScrapingBee");
    expect(configuration).toHaveProperty("scrapingbeeConfigured");
  });
});
