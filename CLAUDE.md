# ReviewPal

A GitHub App that reviews pull requests with AI. When a PR is opened or updated,
GitHub sends a webhook; ReviewPal fetches the changed files, asks an LLM (via Groq)
for review comments, and stores everything in Postgres. A dashboard shows the
reviews and lets you rate each comment as useful or not.

## Stack
- **API / webhook server**: Express 5 + TypeScript, run with `tsx` (no build step in dev)
- **GitHub**: `octokit` (GitHub App auth, installation tokens)
- **AI**: `groq-sdk`, default model `openai/gpt-oss-120b` (override with `GROQ_MODEL`)
- **Validation**: `zod` (AI output and API request bodies)
- **Database**: Prisma 7 + PostgreSQL on Neon
  - `DATABASE_URL` (pooled) is used by the running app via `@prisma/adapter-pg` (`src/db.ts`)
  - `DIRECT_URL` (direct) is used by the Prisma CLI for migrations (`prisma.config.ts`)
- **Dashboard**: Next.js (App Router) + Tailwind in `/web`, port 3001

## Layout
- `src/index.ts`: Express app, `/health`, `/webhook` (signature check), mounts `/api`
- `src/pipeline.ts`: `runReview(payload)`, the webhook -> DB -> AI -> DB flow
- `src/review.ts`: `reviewFiles()` calls Groq and validates the JSON with zod
- `src/api.ts`: JSON endpoints for the dashboard
- `src/db.ts`: the shared Prisma client
- `prisma/schema.prisma`: data models; `prisma/migrations/`: SQL history
- `src/generated/prisma/`: generated client (git-ignored, created by `prisma generate`)
- `web/`: the dashboard

## Commands
- `npm run dev`: start the server on port 3000 (watch mode)
- `npm run db:migrate`: create/apply a migration after editing the schema
- `npm run db:generate`: regenerate the Prisma client
- `npm run db:studio`: browse the database in the browser
- `npx tsc --noEmit`: type-check

## Rules
- **ESM**: the project is `"type": "module"`. Local imports must end in `.js`
  (e.g. `import { prisma } from './db.js'`), even though the files are `.ts`.
- `/webhook` must use `express.raw` (the signature is computed over the raw bytes).
  `express.json` is only applied to `/api`.
- **Never commit secrets**: `.env`, `*.pem` and keys stay out of git. Never print
  secret values in logs or output.
- The owner is learning: after every change, explain in plain language what
  changed and why, list the files, and give exact steps to run and test it.
- Work in small phases and stop after each one so it can be tested.
