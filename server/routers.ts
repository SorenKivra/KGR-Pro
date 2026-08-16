import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { analyzeKeyword, analyzeKeywords, isClassicKgrEligible } from "./kgr";
import { getKgrHistoryResults, listKgrHistory, saveKgrBatch } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  kgr: router({
    configuration: publicProcedure.query(() => ({
      configured: Boolean(process.env.SCRAPINGDOG_API_KEY || process.env.SCRAPINGBEE_API_KEY),
      exactCountProvider: "Scrapingdog or ScrapingBee",
      serperConfigured: Boolean(process.env.SERPER_API_KEY),
      scrapingdogConfigured: Boolean(process.env.SCRAPINGDOG_API_KEY),
      scrapingbeeConfigured: Boolean(process.env.SCRAPINGBEE_API_KEY),
      region: "United States",
      engine: "Google",
    })),
    analyzeKeyword: publicProcedure
      .input(
        z.object({
          keyword: z.string().trim().min(1, "A keyword is required.").max(240, "Keywords must be 240 characters or fewer."),
          monthlySearchVolume: z.number().finite().positive("Monthly volume must be greater than zero.").max(100_000_000),
          queryMode: z.enum(["quoted", "unquoted"]).default("unquoted"),
          exactProvider: z.enum(["scrapingdog", "scrapingbee"]).default("scrapingdog"),
          fallbackProvider: z.enum(["scrapingdog", "scrapingbee"]).optional(),
          serperApiKey: z.string().max(300).optional(),
          scrapingdogApiKey: z.string().max(300).optional(),
          scrapingbeeApiKey: z.string().max(300).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const hasExactKey = input.exactProvider === "scrapingbee" ? (input.scrapingbeeApiKey || process.env.SCRAPINGBEE_API_KEY) : (input.scrapingdogApiKey || process.env.SCRAPINGDOG_API_KEY);
        if (!hasExactKey) throw new Error(`${input.exactProvider === "scrapingbee" ? "ScrapingBee" : "Scrapingdog"} is not configured. Add its key in API settings.`);
        return analyzeKeyword(input);
      }),
    analyzeBatch: publicProcedure
      .input(z.object({
        visitorId: z.string().trim().min(16).max(64),
        queryMode: z.enum(["quoted", "unquoted"]).default("unquoted"),
        exactProvider: z.enum(["scrapingdog", "scrapingbee"]).default("scrapingdog"),
        fallbackProvider: z.enum(["scrapingdog", "scrapingbee"]).optional(),
        serperApiKey: z.string().max(300).optional(),
        scrapingdogApiKey: z.string().max(300).optional(),
        scrapingbeeApiKey: z.string().max(300).optional(),
        keywords: z.array(z.object({ keyword: z.string().trim().min(1).max(240), monthlySearchVolume: z.number().int().positive().max(100_000_000) })).min(1).max(10000),
      }))
      .mutation(async ({ input }) => {
        const hasExactKey = input.exactProvider === "scrapingbee" ? (input.scrapingbeeApiKey || process.env.SCRAPINGBEE_API_KEY) : (input.scrapingdogApiKey || process.env.SCRAPINGDOG_API_KEY);
        if (!hasExactKey) throw new Error(`${input.exactProvider === "scrapingbee" ? "ScrapingBee" : "Scrapingdog"} is not configured. Add its key in API settings.`);
        const results = await analyzeKeywords(input.keywords.map(item => ({ ...item, exactProvider: input.exactProvider, queryMode: input.queryMode, fallbackProvider: input.fallbackProvider, serperApiKey: input.serperApiKey, scrapingdogApiKey: input.scrapingdogApiKey, scrapingbeeApiKey: input.scrapingbeeApiKey })), 8);
        const batchId = crypto.randomUUID();
        const exactResults = results.filter(result => result.status === "exact");
        await saveKgrBatch({ id: batchId, visitorId: input.visitorId, queryMode: input.queryMode, exactProvider: input.exactProvider, keywordCount: results.length, exactCount: exactResults.length, hotCount: results.filter(result => result.tier === "hot").length, status: exactResults.length === results.length ? "completed" : exactResults.length ? "partial" : "failed" }, results.map(result => ({ batchId, visitorId: input.visitorId, keyword: result.keyword, monthlySearchVolume: result.monthlySearchVolume, allintitleCount: result.allintitleCount, kgr: result.kgr, tier: result.tier, classicEligible: isClassicKgrEligible(result.monthlySearchVolume), status: result.status, reason: result.reason, source: result.source, queriedAt: new Date(result.queriedAt) })));
        return { batchId, results };
      }),
    history: publicProcedure
      .input(z.object({ visitorId: z.string().trim().min(16).max(64), search: z.string().max(120).optional(), limit: z.number().int().min(1).max(100).default(30) }))
      .query(({ input }) => listKgrHistory(input.visitorId, input.search, input.limit)),
    historyResults: publicProcedure
      .input(z.object({ visitorId: z.string().trim().min(16).max(64), batchId: z.string().uuid() }))
      .query(({ input }) => getKgrHistoryResults(input.visitorId, input.batchId)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
