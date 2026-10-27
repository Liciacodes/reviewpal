# Deploying ReviewPal

The API and webhook server runs on **Render** (free tier). The dashboard runs on **Vercel**.
The database stays on **Neon**.

```
GitHub ──webhook──▶ Render  https://<api>.onrender.com/webhook
Browser ──────────▶ Vercel  https://<dashboard>.vercel.app
                      └─ /api, /auth, /health are forwarded to Render (Next.js rewrites)
```

The browser only ever talks to Vercel, so the sign-in cookies stay on one domain.

Work through the steps in order. Wherever you see `<api>` or `<dashboard>`, use your real names.

---

## 0. Before you start

- [ ] Commit and push everything to GitHub. Render and Vercel deploy from the repo.
- [ ] Run `npm run test:all` and `npm run build` locally. Both must pass.
- [ ] Choose your names now. Then you know both URLs before creating anything:
  - Render service name, e.g. `reviewpal-api` → `https://reviewpal-api.onrender.com`
  - Vercel project name, e.g. `reviewpal` → `https://reviewpal.vercel.app`
  - If a name is taken, the URL gets a suffix. Then use the real URL in the later steps.
- [ ] Database and encryption key: decide together, because they must match.
  - **Same Neon database as local** (simplest; production's demo then shows the reviews you already have):
    use the **same** `TOKEN_ENCRYPTION_KEY` as your local `.env`. Your GitHub token is stored once per user,
    encrypted with the key of the environment you last signed in to. With two different keys, signing in on one
    makes the other fail with "Couldn't check your GitHub access" (since then it asks you to sign in again).
  - **Separate data:** create a Neon branch called `production`, use its two URLs below, and generate a
    **new** key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

## Which settings go where

| Variable | Render (API) | Vercel (dashboard) | Value |
|---|:-:|:-:|---|
| `NODE_ENV` | ✅ | (set by Vercel) | `production` |
| `DATABASE_URL` | ✅ | | Neon **pooled** URL (the one with `-pooler`) |
| `DIRECT_URL` | ✅ | | Neon **direct** URL (used only by migrations, during the build) |
| `WEBHOOK_SECRET` | ✅ | | same as in the GitHub App's webhook settings |
| `GITHUB_APP_ID` | ✅ | | App ID (GitHub App → General → About) |
| `GITHUB_PRIVATE_KEY_PATH` | ✅ | | `/etc/secrets/github-app.pem` (see the Secret File in step 1) |
| `GITHUB_PRIVATE_KEY` | (alternative) | | the whole `.pem` content, only if you don't use the Secret File |
| `GITHUB_CLIENT_ID` | ✅ | | Client ID (General → About) |
| `GITHUB_CLIENT_SECRET` | ✅ | | from the Credentials tab |
| `TOKEN_ENCRYPTION_KEY` | ✅ | | same as local if you share the database, a new one if not (step 0) |
| `DASHBOARD_URL` | ✅ | | `https://<dashboard>.vercel.app` (no trailing slash) |
| `GROQ_API_KEY` | ✅ | | from console.groq.com |
| `GROQ_MODEL` | optional | | leave unset for `openai/gpt-oss-120b` |
| `DEMO_REPO` | optional | | `Liciacodes/reviewpal-playground`: the public repo shown in the read-only demo (leave unset to turn the demo off) |
| `REVIEWS_PER_INSTALLATION_PER_DAY` | optional | | AI reviews per installation per day (default `10`) |
| `REVIEWS_PER_DAY` | optional | | AI reviews per day for everyone together (default `100`), so one busy day can't use up the Groq quota |
| `MAX_PR_FILES` | optional | | PRs with more changed files are skipped with a comment (default `30`) |
| `MAX_PR_LINES` | optional | | PRs with more added + deleted lines are skipped with a comment (default `3000`) |
| `API_ORIGIN` | | ✅ | `https://<api>.onrender.com` (no trailing slash) |
| `PUBLIC_SIGNIN` | | optional | `true` once the GitHub App is public: "Sign in with GitHub" becomes the main button, "View demo" the second one. Unset: "View demo" is the main button. Needs a redeploy to change |

- Render sets `PORT` by itself.
- `DASHBOARD_ORIGIN` and `NEXT_PUBLIC_API_URL` are not used any more.
- If something required is missing, the server refuses to start. Its log then lists exactly
  which names are missing (never the values). The same goes for a limit that is set but isn't a
  positive whole number.
- Limits reset at midnight UTC. Webhook reviews and dashboard re-runs both count.

---

## 1. Render: the API

Render dashboard → **New** → **Web Service** → connect your GitHub repo.

| Setting | Value |
|---|---|
| Name | `reviewpal-api` (this becomes the URL) |
| Region | the one closest to your Neon database (e.g. Frankfurt if Neon is `eu-central-1`) |
| Branch | `master` |
| Root Directory | *(leave empty: the server is in the repo root)* |
| Runtime | Node (the version comes from `"engines": { "node": "22.x" }` in `package.json`) |
| Build Command | `npm ci --include=dev && npm run build && npm run migrate:deploy` |
| Start Command | `npm start` |
| Instance Type | Free |

Why the build command looks like this:
- **`--include=dev`:** with `NODE_ENV=production`, npm would skip devDependencies. But the build
  needs two of them: TypeScript and the Prisma CLI.
- **`npm run build`:** runs `prisma generate` and compiles `src/` to `dist/`.
- **`migrate:deploy`:** applies any new database migrations. The free tier has no "pre-deploy
  command", so migrations run at the end of the build. If a migration fails, the deploy stops
  and the old version keeps running.

**Environment** (on the same page, or later under the service's **Environment** tab):
- [ ] Add every ✅ Render variable from the table.
- [ ] **Secret File:** click **Add Secret File**. Filename `github-app.pem`, contents: paste the
  whole `.pem` file, including the `-----BEGIN…` and `-----END…` lines. Render puts it at
  `/etc/secrets/github-app.pem`, which matches `GITHUB_PRIVATE_KEY_PATH`.

**Advanced:**
- [ ] Health Check Path: `/health`
- [ ] Auto-Deploy: Yes

Click **Create Web Service** and watch the logs. A good deploy ends with:
```
ReviewPal running on port 10000
```
- [ ] Open `https://<api>.onrender.com/health`. It should say `OK`.

## 2. Vercel: the dashboard

Vercel → **Add New** → **Project** → import the same repo.

| Setting | Value |
|---|---|
| Project Name | `reviewpal` (this becomes the URL) |
| Framework Preset | Next.js (detected) |
| **Root Directory** | `web` |
| Build / Output / Install | leave the defaults |

**Environment Variables:** add these **before** the first deploy. The rewrites to Render are
fixed at build time, so if you add or change this variable later, you must **redeploy**.
- [ ] `API_ORIGIN` = `https://<api>.onrender.com`, for Production (and Preview if you use it)

Click **Deploy**.
- [ ] Open `https://<dashboard>.vercel.app`. You should land on **Sign in** (don't sign in yet).
- [ ] Open `https://<dashboard>.vercel.app/health`. It should say `OK`, which proves Vercel reaches Render.
- [ ] If your Vercel URL differs from the `DASHBOARD_URL` you set on Render, fix it on Render.
  Saving restarts the service.

## 3. GitHub App

GitHub → Settings → Developer settings → GitHub Apps → **ReviewPal AI** → **Edit**.
(The app's public page is `https://github.com/apps/reviewpal-ai`.)

**Permissions & events**
- [ ] Repository permissions: **Pull requests: Read and write** (Metadata: Read-only is added by GitHub).
- [ ] Subscribe to events: **Pull request**. That covers opened, new commits, reopened and "ready for review".
- Install and uninstall events (`installation`, `installation_repositories`) need no ticking: GitHub sends
  them to every app automatically, and they keep the database in sync (see "Going public" below).

**General → Identifying and authorizing users**
- [ ] Add a second **Redirect URI**: `https://<dashboard>.vercel.app/auth/callback`
  (keep the `localhost:3001` one for local development).

**General → Webhook**
- [ ] Webhook URL: `https://<api>.onrender.com/webhook`
- [ ] Webhook secret: unchanged. It must equal `WEBHOOK_SECRET` on Render.
- [ ] Active: ticked.
- [ ] **Save changes**.

⚠️ A GitHub App has **one** webhook URL. From now on, webhooks go to Render, not to your local tunnel.
For local work on webhooks, either switch the URL back temporarily, or create a second
"ReviewPal (dev)" GitHub App for local use. Local sign-in keeps working either way.

## 4. Keep Render awake

**The problem:** Render's free tier sleeps after 15 minutes without traffic, and waking up
takes about 50 seconds. GitHub waits only 10 seconds for a webhook, then marks it failed and
**doesn't retry**. So without a fix, a PR opened while the server sleeps gets no review.

| Option | Cost | Trade-off |
|---|---|---|
| **Keep-alive ping** (recommended) | free | One always-on service uses about 744 of the 750 free hours a month, so it fits, but only for one free service. Deploys still cause a short gap (see the safety net below). |
| Render Starter plan | about $7/month | Never sleeps, also gets a pre-deploy command, and no ping is needed. The simplest choice once the project matters. |
| Another host (Railway, Fly.io…) | usually paid now | More to learn and move. Not worth it for now. |

**Set up the keep-alive** (cron-job.org, free):
- [ ] Sign up, then **Create cronjob**
- [ ] URL: `https://<api>.onrender.com/health`
- [ ] Schedule: every **10 minutes** (less than Render's 15-minute sleep timer)
- [ ] Save, then check its history shows `200 OK`

UptimeRobot works too: an HTTP(s) monitor with a 5-minute interval on the same URL.

**Safety net (already in the code):** when the server starts in production, it asks GitHub for
`pull_request` webhooks that failed in the **last 6 hours** and requests them again (up to 20).
This covers deploys and any missed ping.
- Duplicates are harmless: a commit is never reviewed twice.
- Look for `Asked GitHub to redeliver N missed webhook(s)` in the Render logs.
- Code: `src/missed-webhooks.ts`.

## 5. Test it end to end

- [ ] **Demo:** in a private window, open `https://<dashboard>.vercel.app` and click **View demo**. If Render
  was asleep, you'll see "Waking up the server…" for up to a minute. Then you land on the Overview with the banner
  "You're viewing a demo". Only `DEMO_REPO` reviews are listed, the rating buttons are greyed out, there is
  no ⋯ menu, and the sidebar says "Demo visitor". **Sign in** in the banner takes you back to the sign-in page.

- [ ] **Sign-in:** open `https://<dashboard>.vercel.app`, then **Sign in with GitHub**, then authorize. You land on the
  Overview, with your avatar in the sidebar.
- [ ] **Your data:** your playground reviews are listed (if you kept the same database), and stats show.
- [ ] **Cookies:** in DevTools → Application → Cookies on the Vercel domain, `rp_session` has
  **HttpOnly** and **Secure** ticked and SameSite **Lax**.
- [ ] **A new review:** push a small commit to a `reviewpal-playground` PR. Within a minute:
  - the GitHub App's **Advanced → Recent Deliveries** shows the delivery with a green `200`
  - the Render logs show `Reviewed … N comments` and `Posted review …`
  - the PR has the ReviewPal review
  - the dashboard shows it (the page updates by itself while it's pending)
- [ ] **Rating:** click Useful on a comment. It saves (no error under the buttons).
- [ ] **Re-run:** on the new review, use **⋯ → Re-run review**. It goes pending, then done, and no second review appears on GitHub.
- [ ] **Sign out:** you land on Sign in, and opening `/reviews` sends you back to Sign in.
- [ ] **Sleep test** (optional, after setting up the keep-alive): pause the cron job, wait 20 minutes until
  Render shows the service as sleeping, open a PR, and resume the cron job. Within a few minutes the
  wake-up redelivers the missed webhook and the review appears. Log line: `Asked GitHub to redeliver 1 missed webhook(s)`.

## 6. Going public

Until now the GitHub App is private: only your account can install it or sign in. These steps let anyone
install **ReviewPal AI**, with the daily limits protecting the free Groq quota.

**What the code already does**
- **Limits:** at most `REVIEWS_PER_INSTALLATION_PER_DAY` reviews per installation and `REVIEWS_PER_DAY` in total, each day
  (UTC). PRs over `MAX_PR_FILES` files or `MAX_PR_LINES` lines are skipped. A skipped PR doesn't call the AI: it gets
  one short comment ("Daily review limit reached…" or "…too large…"), at most once per PR, and shows as
  **Skipped** on the dashboard.
- **Ignored:** PRs opened by bots, and drafts. A draft is reviewed when it's marked ready for review.
- **Install sync:** installing ReviewPal adds its repos. Removing a repo, or uninstalling, **deletes** those repos'
  reviews, files, comments and notices (code: `src/installations.ts`).
- **Onboarding:** "Install ReviewPal on your repos" in the sidebar and on the empty dashboard, and a public `/privacy` page.

**⚠️ Shared database.** Local and production use the same Neon database. The `usage_limits` migration only adds
things (a status value, a column, two tables, indexes), so it deletes nothing. Render applies migrations with
`migrate:deploy`, which never resets a database. Don't run `npm run db:migrate` (`migrate dev`) against the
shared database: if it finds differences, it offers to **reset** it.

**Checklist, in this order**
1. [ ] **Push** the code to `master`. Vercel and Render both start deploying.
   - The dashboard must be live **before or together with** the API: an older dashboard has no "Skipped" badge and
     breaks on a skipped review. If Render finishes first, nothing goes wrong until a review is skipped. To be safe,
     wait for Vercel's deploy to finish before testing.
2. [ ] **Render:** the limit variables are optional (defaults 10 / 100 / 30 / 3000). Add them only to change a value.
   Check the deploy log: `migrate:deploy` says the migration is applied (or that there's nothing to apply), then
   `ReviewPal running on port 10000`.
3. [ ] **GitHub App → Permissions & events:** Pull requests: Read and write, and the Pull request event (step 3).
4. [ ] **GitHub App → Advanced → Danger zone → Make public.** Anyone can now install it from
   `https://github.com/apps/reviewpal-ai`. You can make it private again later, as long as only your account has it installed.
5. [ ] **Vercel:** set `PUBLIC_SIGNIN` = `true` (Production), then **Redeploy**. The value is read when the page is
   built, so saving it isn't enough.
6. [ ] Do the smoke test below.

**Smoke test** (on production; webhooks go to Render, not your tunnel)
- Use a **separate test repo, `reviewpal-test`**, for anything that removes data. **Never remove `reviewpal-playground`**:
  it's the `DEMO_REPO`, and its reviews power the public demo.
- [ ] Render: set `REVIEWS_PER_INSTALLATION_PER_DAY` = `1` (saving restarts the service).
- [ ] Add `reviewpal-test` to the installation (GitHub → Settings → Applications → ReviewPal AI → Configure).
  The Render log shows `installation …: 1 repo(s) added, 0 removed`.
- [ ] Open a PR in `reviewpal-test`. It's reviewed as usual (unless today's one review is already used up).
- [ ] Push another commit. The PR gets **one** "Daily review limit reached" comment, and the dashboard shows **Skipped**
  with the explanation. Push a third time: no new comment.
- [ ] Open a **draft** PR. Nothing happens (log: `Not reviewing …: draft`). Mark it ready for review: it's skipped,
  because the limit is still reached, and it gets its own single comment.
- [ ] *(Optional)* A PR with more than 30 files or 3000 changed lines gets one "too large" comment.
- [ ] Remove `reviewpal-test` from the installation. The log shows `… 0 repo(s) added, 1 removed`, and its reviews
  disappear from the dashboard. The demo (`reviewpal-playground`) is unchanged.
- [ ] Sign-in page in a private window: **Sign in with GitHub** is the main button, **View demo** the second one,
  and the **Privacy** link opens `/privacy` without signing in.
- [ ] Render: set `REVIEWS_PER_INSTALLATION_PER_DAY` back to `10` (or delete it: the default is 10).

## Troubleshooting

| What you see | Likely cause |
|---|---|
| Render log: `ReviewPal cannot start. Fix these settings…` | A variable is missing or wrong; the list names it |
| `GITHUB_PRIVATE_KEY_PATH points to a file that does not exist` | The Secret File name isn't exactly `github-app.pem` |
| Build fails at `tsc` or `prisma: not found` | The build command is missing `--include=dev` |
| Build fails at `migrate:deploy` | `DIRECT_URL` is missing or wrong (it must be the non-pooler URL) |
| GitHub says `redirect_uri is not associated with this application` | The Vercel callback URL isn't in the App's Redirect URIs, or `DASHBOARD_URL` doesn't match it exactly |
| Signed in, but sent back to Sign in straight away | `DASHBOARD_URL` doesn't match the address you're using (e.g. a Vercel preview URL) |
| Dashboard shows "Can't reach the API", or `/health` on Vercel fails | `API_ORIGIN` is wrong or was set after the build (redeploy on Vercel), or Render is waking up (try again in a minute) |
| Recent Deliveries show timeouts | The keep-alive isn't running. The safety net catches them on the next restart. |
| Everyone was signed out after a deploy | `TOKEN_ENCRYPTION_KEY` changed. Expected; just sign in again |
| Signing in locally signs you out in production (or the other way round) | Shared database with two different `TOKEN_ENCRYPTION_KEY`s: use the same key on both (step 0) |
| **View demo** shows "The demo isn't available right now." | `DEMO_REPO` isn't set on Render (or the service wasn't restarted after setting it) |
| Demo shows no reviews | `DEMO_REPO` has a typo, or that repo has no reviews in this database yet |
| Render log: `Could not post the notice on …: Resource not accessible by integration` | The app can't comment on that PR. Add **Issues: Read and write** under Permissions & events, then accept the new permission on each installation (GitHub emails the owners) |
| No "Install ReviewPal on your repos" button, or it opens the app's old name | The server asks GitHub for the app's address once and remembers it: restart the service (**Manual Deploy → Restart service**) after renaming the app |
| Every PR is "Skipped" straight away | `REVIEWS_PER_DAY` or `REVIEWS_PER_INSTALLATION_PER_DAY` is set very low (e.g. still `1` after the smoke test) |
| Sign-in page still shows "View demo" first | `PUBLIC_SIGNIN` was set on Vercel without a redeploy, or isn't exactly `true` |
| A removed repo's reviews are still listed | GitHub's delivery for the removal failed: check **Advanced → Recent Deliveries** and click **Redeliver** |

## Updating later

Push to `master`. Render and Vercel both redeploy by themselves. Render applies new database
migrations during its build. The dashboard is unaffected while Render rebuilds, but API calls may fail for
about a minute during the switch.
