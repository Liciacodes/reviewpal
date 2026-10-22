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
- [ ] Database: you can keep the same Neon database. Then local and production share the same
  reviews, which is fine for a personal project. For separate data, create a Neon branch called
  `production` and use its two URLs below.
- [ ] Generate a **new** `TOKEN_ENCRYPTION_KEY` for production:
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

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
| `TOKEN_ENCRYPTION_KEY` | ✅ | | the new key from step 0 |
| `DASHBOARD_URL` | ✅ | | `https://<dashboard>.vercel.app` (no trailing slash) |
| `GROQ_API_KEY` | ✅ | | from console.groq.com |
| `GROQ_MODEL` | optional | | leave unset for `openai/gpt-oss-120b` |
| `DEMO_REPO` | optional | | `Liciacodes/reviewpal-playground`: the public repo shown in the read-only demo (leave unset to turn the demo off) |
| `API_ORIGIN` | | ✅ | `https://<api>.onrender.com` (no trailing slash) |

- Render sets `PORT` by itself.
- `DASHBOARD_ORIGIN` and `NEXT_PUBLIC_API_URL` are not used any more.
- If something required is missing, the server refuses to start. Its log then lists exactly
  which names are missing (never the values).

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

GitHub → Settings → Developer settings → GitHub Apps → your app → **Edit**.

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
  Overview, with your avatar in the sidebar. Production uses a new encryption key, so this is a fresh sign-in.
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
| **View demo** shows "The demo isn't available right now." | `DEMO_REPO` isn't set on Render (or the service wasn't restarted after setting it) |
| Demo shows no reviews | `DEMO_REPO` has a typo, or that repo has no reviews in this database yet |

## Updating later

Push to `master`. Render and Vercel both redeploy by themselves. Render applies new database
migrations during its build. The dashboard is unaffected while Render rebuilds, but API calls may fail for
about a minute during the switch.
