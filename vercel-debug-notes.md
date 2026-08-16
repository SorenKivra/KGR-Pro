# Vercel deployment debugging notes

Source URL: https://kgr-pro-gsa4.vercel.app/

Observed on 2026-08-16: The deployed page returns a JavaScript bundle beginning with `// server/_core/index.ts`, followed by imports such as `dotenv/config`, `express`, `http`, `net`, and `@trpc/server/adapters/express`, plus server-side Drizzle and OAuth code. The page is not rendering the React dashboard. This indicates the Vercel deployment is serving the bundled Node/Express server entry as browser HTML/JavaScript instead of serving the built client output from `dist/public/index.html`.

The uploaded user attachment contains a similar bundled server output beginning at `server/_core/index.ts`, confirming the deployment is using the wrong Vercel build/output/runtime mapping rather than a normal client-page runtime error.

Likely deployment mismatch to investigate: this project uses a Vite client build plus an esbuild Express server bundle, while Vercel needs an explicit frontend output configuration and a serverless function mapping; the Manus WebDev runtime is not automatically equivalent to Vercel's default static/Node detection.
