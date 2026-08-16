import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("public KGR access", () => {
  it("exposes provider configuration without requiring a Manus session", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const configuration = await caller.kgr.configuration();

    expect(configuration.region).toBe("United States");
    expect(configuration.engine).toBe("Google");
    expect(configuration.exactCountProvider).toBe("Scrapingdog");
  });
});
