# Vercel deployment debugging notes

Source URL: https://kgr-pro-gsa4.vercel.app/

Observed on 2026-08-16: The deployed page returns a JavaScript bundle beginning with `// server/_core/index.ts`, followed by imports such as `dotenv/config`, `express`, `http`, `net`, and `@trpc/server/adapters/express`, plus server-side Drizzle and OAuth code. The page is not rendering the React dashboard. This indicates the Vercel deployment is serving the bundled Node/Express server entry as browser HTML/JavaScript instead of serving the built client output from `dist/public/index.html`.

The uploaded user attachment contains a similar bundled server output beginning at `server/_core/index.ts`, confirming the deployment is using the wrong Vercel build/output/runtime mapping rather than a normal client-page runtime error.

Likely deployment mismatch to investigate: this project uses a Vite client build plus an esbuild Express server bundle, while Vercel needs an explicit frontend output configuration and a serverless function mapping; the Manus WebDev runtime is not automatically equivalent to Vercel's default static/Node detection.

## Current live deployment evidence

Source URL: https://kgr-pro-gsa4.vercel.app/

The live URL now renders the React dashboard titled `KGR Pro Analyzer`, not the raw server bundle. The page remains stuck on `VERIFYING CONNECTION`; it shows the public workspace, keyword input, query-mode selector, and `Run KGR analysis`, but no completed connection state. The dashboard text says API settings are available and the analysis uses Serper.dev plus Scrapingdog/ScrapingBee. This narrows the current issue from static routing to a runtime/API connection or frontend tRPC request problem.

## Direct API reproduction

The deployed endpoint `https://kgr-pro-gsa4.vercel.app/api/trpc/kgr.configuration` returns Vercel `500: INTERNAL_SERVER_ERROR` with `FUNCTION_INVOCATION_FAILED`. The page explicitly says the connection and Vercel are working, but the serverless function crashed. The React dashboard therefore remains in `VERIFYING CONNECTION`, and Run KGR analysis cannot work because its tRPC backend endpoint crashes before procedure execution.

## Vercel crash identifier

A second inspection confirms the same Vercel response: HTTP 500, code `FUNCTION_INVOCATION_FAILED`, deployment ID `sin1::ncmx8-1786896156494-6e922025b329`. The error page does not expose a stack trace publicly; Vercel says the connection and platform are working and the serverless function itself crashed.
