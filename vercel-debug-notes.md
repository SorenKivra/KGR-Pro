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

## Vercel project/deployment state

The connected Vercel dashboard shows projects `kgr-pro` and `kgr-pro-gsa4`, both linked to `SorenKivra/KGR-Pro`. The latest visible deployment cards still show the earlier checkpoint message mentioning the shared Express app and `vercel.json`; the current alias `kgr-pro-gsa4.vercel.app` continues to return `FUNCTION_INVOCATION_FAILED` after the GitHub push. Vercel dashboard access is available in the connected browser, but no function stack trace is shown on the public error page.

## Definitive root cause from Vercel Logs

Vercel logs show every API request fails before Express starts:

`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/app' imported from /var/task/api/index.js`

The Vercel Node runtime is executing the TypeScript API entrypoint as ESM without resolving the extensionless `../server/app` import. This is a deployment bundling/module-resolution problem, not an API key, database, or frontend button problem. The fix must make the Vercel function bundle its server dependencies or use runtime-resolvable `.js` imports.

## Post-push deployment check

The public API still returns `FUNCTION_INVOCATION_FAILED` after commit `23314d7` was pushed. Vercel Logs continue to show `ERR_MODULE_NOT_FOUND` for `/var/task/server/app` imported from `/var/task/api/index.js`. The active Vercel project has not picked up the bundled `api/index.js` configuration yet; this is now a deployment/project-source issue rather than a local build issue. The GitHub repository contains `vercel.json` with `build:vercel-api`, `api/index.js`, `api/index.ts`, `package.json`, and `server/app.ts`.

## Post-redeployment verification

After the user reported redeployment, `https://kgr-pro-gsa4.vercel.app/api/trpc/kgr.configuration` still returned HTTP 500 `FUNCTION_INVOCATION_FAILED` with request ID `sin1::sd6qf-1786897587553-ada69647529f`. The Vercel logs page opened in the connected browser but then presented a Vercel login page, so the latest runtime stack trace could not be read from this session. The live deployment is not yet verified healthy.
