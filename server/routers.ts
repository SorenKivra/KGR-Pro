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
    configuration: protectedProcedure.query(() => ({
      configured: Boolean(process.env.SERPER_API_KEY),
      provider: "Serper.dev",
      region: "United States",
      engine: "Google",
    })),
    analyzeKeyword: protectedProcedure
      .input(
        z.object({
          keyword: z.string().trim().min(1, "A keyword is required.").max(240, "Keywords must be 240 characters or fewer."),
          monthlySearchVolume: z.number().finite().positive("Monthly volume must be greater than zero.").max(100_000_000),
        }),
      )
      .mutation(async ({ input }) => {
        const apiKey = process.env.SERPER_API_KEY;
        if (!apiKey) {
          throw new Error("Serper.dev is not configured. Add SERPER_API_KEY in project settings.");
        }
        return analyzeKeyword({ ...input, apiKey });
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
