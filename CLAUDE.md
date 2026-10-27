# ReviewPal

A GitHub App that reviews pull requests with AI. When a PR is opened or updated,
GitHub sends a webhook; ReviewPal fetches the changed files, asks an LLM (via Groq)
for review comments, and stores everything in Postgres. A dashboard shows the
reviews and lets you rate each comment as useful or not. ReviewPal also posts the
review on the pull request itself. Users sign in with GitHub and only see reviews
for repos where the app is installed and they have access.

## Stack
- **API / webhook server**: Express 5 + TypeScript, run with `tsx` in dev (no build step);
  in production `npm run build` compiles `src/` to `dist/` (`tsconfig.build.json`, tests excluded)
  and `npm start` runs `node dist/index.js`
- **Hosting**: API on Render (free tier), dashboard on Vercel (Root Directory `web`), database on
  Neon. Step-by-step setup and which env var goes where: `DEPLOY.md`
- **GitHub**: `octokit`, one shared `App` in `src/github-app.ts`: installation tokens for
  webhooks and posting reviews, plus the App's own OAuth (`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`) for sign-in
- **AI**: `groq-sdk`, default model `openai/gpt-oss-120b` (override with `GROQ_MODEL`).
  The SDK's own retries are off (`maxRetries: 0`); we retry once ourselves (`src/retry.ts`)
- **Validation**: `zod` (AI output and API request bodies)
- **Database**: Prisma 7 + PostgreSQL on Neon
  - `DATABASE_URL` (pooled) is used by the running app via `@prisma/adapter-pg` (`src/db.ts`)
  - `DIRECT_URL` (direct) is used by the Prisma CLI for migrations (`prisma.config.ts`)
- **Dashboard**: Next.js (App Router) + Tailwind v4 + lucide-react in `/web`, port 3001.
  The browser only talks to the dashboard: `web/next.config.ts` rewrites `/api`, `/auth`
  and `/health` to the API at `API_ORIGIN` (default `http://localhost:3000`). So cookies
  are first-party and there is no CORS.
- **Sign-in**: sessions in Postgres (`Session` stores only a SHA-256 of the cookie token),
  `rp_session` (httpOnly) + `rp_csrf` (readable) cookies, SameSite=Lax, Secure in production.
  GitHub user tokens are AES-256-GCM encrypted with `TOKEN_ENCRYPTION_KEY`. The allowed-repos
  list is cached on `User` for 10 minutes. `DASHBOARD_URL` builds the OAuth callback URL.
- **Demo**: `/auth/demo` sets an `rp_demo` cookie (not secret). With no session, `requireUser` treats it as a
  read-only visitor whose only allowed repo is `DEMO_REPO` (unset = demo off). `rejectDemoWrites` (in `apiGuards`)
  answers 403 to every non-GET from a demo visitor; `src/api-demo.test.ts` checks every write route automatically.
- **Tests**: Vitest in both packages (`src/**/*.test.ts`, `web/lib|components/**/*.test.ts`).
  No database, network or API keys needed.

## Layout
- `src/index.ts`: Express app, `/health`, `/webhook` (signature check), `/auth`, `/api`
  (behind `requireUser` + `requireCsrf`); starts the stuck-review sweeper and, in production,
  the missed-webhook redelivery
- `src/check-config.ts`: imported first by `index.ts`; exits with a list of missing/invalid settings
- `src/config.ts`: `configProblems()` (required env vars, by name only) and `loadPrivateKey()`
  (`GITHUB_PRIVATE_KEY_PATH` file, e.g. a Render Secret File, or `GITHUB_PRIVATE_KEY` with `
` escapes) (pure)
- `src/missed-webhooks.ts`: on production startup, asks GitHub to redeliver `pull_request` webhooks
  that failed in the last 6 hours (Render's free tier sleeps; GitHub waits only 10s)
- `src/pipeline.ts`: `runReview(payload)` (webhook: creates the pending Review) ->
  `processReview(id)` (files -> AI -> DB -> post to GitHub; also used by re-runs),
  `prepareRerun()` (obeys the limits too), skipped reviews (`status: skipped` + `skipReason`), `markStuckReviews()` (pending > 10 min since `startedAt` -> failed)
- `src/limits.ts`: which PRs get reviewed (bots, drafts, size) and the daily limits
  (`REVIEWS_PER_INSTALLATION_PER_DAY`, `REVIEWS_PER_DAY`, `MAX_PR_FILES`, `MAX_PR_LINES`; reset at midnight UTC), notice texts (pure)
- `src/usage.ts`: `reserveAiUse()` (counts `AiUsage` rows under a Postgres advisory lock) and `notifyPullRequestOnce()`
  (a `PrNotice` row means "already commented", so at most one notice per PR and kind)
- `src/installations.ts`: `installation` / `installation_repositories` webhooks keep `Repo` in sync; removing a repo
  or uninstalling deletes its data (cascades from `Repo`)
- `src/review.ts`: `reviewFiles()` calls Groq, validates the JSON with zod, retries once
- `src/retry.ts`: which AI errors are retried (429, 5xx, network, bad JSON/shape) and `withOneRetry`
- `src/stuck.ts`: the stuck-review rule (pure)
- `src/diff.ts`: numbered diff for the AI, skip rules, fair character budget (pure)
- `src/review-body.ts`: GitHub review text and inline/body split (pure)
- `src/github.ts`: `postReviewToGitHub()` (never posts twice: `githubReviewId` check)
- `src/auth/`: `routes.ts` (`/auth/login`, `/auth/callback`, `POST /auth/logout`), `session.ts`
  (cookies, `requireUser`, `requireCsrf`), `github-user.ts` (profile, allowed repos, token refresh),
  `access.ts` (who can see what, pure), `crypto.ts` (encryption, hashing, pure), `demo.ts` (demo rules)
- `src/api.ts`: JSON endpoints for the dashboard, scoped to the signed-in user's repos
  (404, not 403, for anything they can't see); `POST /api/reviews/:id/rerun`
- `src/db.ts`: the shared Prisma client
- `prisma/schema.prisma`: data models; `prisma/migrations/`: SQL history
- `src/generated/prisma/`: generated client (git-ignored, created by `prisma generate`)
- `web/`: the dashboard (Next.js 16, App Router)
  - `web/app/(dashboard)/`: the signed-in pages (`/`, `/reviews`, `/reviews/[id]`, `/settings`)
    with the sidebar layout and `loading.tsx` skeletons; `web/app/sign-in/`: the sign-in page (no sidebar)
  - `web/proxy.ts`: redirects to `/sign-in` when there is no session or demo cookie (cookie check only).
    Its `matcher` lists the dashboard pages only (`/`, `/reviews/*`, `/settings/*`): **add new dashboard pages
    there**. Every other address shows `web/app/not-found.tsx` (404; "Go to overview" or "View demo")
  - `web/app/sign-in/`: "View demo" is the main button unless `PUBLIC_SIGNIN=true` (read when the page is
    built, so a change on Vercel needs a redeploy). The GitHub App is private: other accounts get a 404 from GitHub
  - `web/app/privacy/`: the public privacy page (no sidebar, not in the proxy matcher). Keep it in step with what's stored
  - `web/components/`: UI pieces (`InstallButton.tsx`: link to the GitHub App's install page from `/api/me`); `web/components/review/`: diff view, comment cards, re-run controls
  - `web/lib/`: API client (`api.ts`: CSRF header on changes, 401 -> `/sign-in`), `useApi` hook
    (`retry()` shows loading, `refresh()` is quiet), diff parser, time helpers
  - Read `web/AGENTS.md` first: this Next.js version differs from older docs
    (Cache Components is on, so `usePathname`/`useParams` need a `<Suspense>` boundary)

## Commands
- `npm run dev`: start the server on port 3000 (watch mode)
- `npm run db:migrate -- --name <what_changed>`: create/apply a migration after editing the schema,
  then `npm run db:generate` (Prisma 7's `migrate dev` does not regenerate the client)
- `npm run db:generate`: regenerate the Prisma client
- `npm run db:studio`: browse the database in the browser
- `npx tsc --noEmit`: type-check the server
- `npm test` / `npm run test:watch`: server tests; `npm run test:all`: server + dashboard tests
- `npm run build` / `npm start`: production build to `dist/` and run it (what Render does)
- `npm run migrate:deploy`: apply pending migrations without prompts (production; Render runs it in its build)
- **Local and production share one Neon database**: never run `migrate dev` against it, not even with `--create-only`
  (both can offer a reset). To create a migration, point `DIRECT_URL` at a throwaway Neon branch, run `migrate dev` there,
  check the SQL only adds things, then apply it to the shared database with `migrate:deploy` (never resets). If a step
  would drop or reset data, stop and ask the owner
- `cd web && npm run dev`: start the dashboard on port 3001
- `cd web && npm run lint` / `npm run build` / `npm test`: check the dashboard

## Rules
- **ESM**: the project is `"type": "module"`. Local imports must end in `.js`
  (e.g. `import { prisma } from './db.js'`), even though the files are `.ts`.
- `/webhook` must use `express.raw` (the signature is computed over the raw bytes).
  `express.json` is only applied to `/api`.
- **Never commit secrets**: `.env`, `*.pem` and keys stay out of git. Never print
  secret values in logs or output. Log `err.message` only, never whole error objects
  (Octokit/Groq errors carry request details), tokens, OAuth codes or cookies.
- **Every `/api` route is for signed-in users or demo visitors** and must check access with `canAccessRepo` /
  `visibleRepoIds` (404 when not allowed). Changes (non-GET) need the CSRF header and are refused for demo visitors
  by `apiGuards`. A new write route needs no extra demo code, but keep it non-GET.
- In the dashboard, anything that changes data must be hidden or disabled when `me.demo` is true.
- Keep logic that can be pure in pure modules, with Vitest tests next to them.
- **New env var?** Add it to `REQUIRED` in `src/config.ts` (if the server needs it), to `.env`,
  and to the table in `DEPLOY.md` (Render or Vercel). Dashboard env vars used in `next.config.ts`
  are baked in at build time: changing one on Vercel needs a redeploy.
- The owner is learning: after every change, explain in plain language what
  changed and why, list the files, and give exact steps to run and test it.
- Work in small phases and stop after each one so it can be tested.
