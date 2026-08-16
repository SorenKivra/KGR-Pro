import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { analyzeKeyword } from "./kgr";
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
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
