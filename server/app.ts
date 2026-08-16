import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { serveStatic, setupVite } from "./_core/vite";

export async function createApp(options: { development?: boolean; staticFiles?: boolean } = {}) {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  if (options.development) {
    throw new Error("Development Vite middleware requires the local server instance");
  }

  if (options.staticFiles) {
    serveStatic(app);
  }

  return app;
}

export async function createDevelopmentApp(server: import("http").Server) {
  const app = await createApp();
  await setupVite(app, server);
  return app;
}
