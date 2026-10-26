import 'dotenv/config';
import './check-config.js'; // first: stops with a clear list if a setting is missing
import cookieParser from 'cookie-parser';
import express from 'express';
import crypto from 'node:crypto';
import { apiRouter } from './api.js';
import { authRouter } from './auth/routes.js';
import { apiGuards, requireUser } from './auth/session.js';
import { githubApp } from './github-app.js';
import { handleInstallationEvent } from './installations.js';
import { redeliverMissedWebhooks } from './missed-webhooks.js';
import { runReview, startStuckReviewSweeper } from './pipeline.js';

const app = express();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!; // checked by check-config.ts

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // 0. No JSON body (express.raw only reads application/json): nothing GitHub signed, so reject
  if (!Buffer.isBuffer(req.body)) return res.status(401).send('Invalid signature');

  // 1. The signature GitHub sent
  const signature = req.header('x-hub-signature-256') ?? '';

  // 2. The signature we expect, made from the raw body and our secret
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', WEBHOOK_SECRET).update(req.body).digest('hex');

  // 3. Compare them safely. If they differ, reject.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).send('Invalid signature');
  }

  // 4. It's really from GitHub, so read it
  const event = req.header('x-github-event');
  const payload = JSON.parse(req.body.toString());
  console.log(event, payload.action, payload.pull_request?.title);

  // 5. Reply to GitHub quickly, then do the slow work
  res.status(200).send('ok');

  // 6. Pull requests: runReview decides (bots, drafts, size, daily limits) and never throws.
  //    Installs and uninstalls keep the database in sync (uninstall deletes that data).
  if (event === 'pull_request') {
    await runReview(githubApp, payload);
  } else if (event === 'installation' || event === 'installation_repositories') {
    await handleInstallationEvent(event, payload);
  }
});

// 7. Sign in / sign out with GitHub. The dashboard forwards /auth/* here (Next.js rewrites),
//    so the browser only ever talks to the dashboard's domain and no CORS is needed.
app.use('/auth', cookieParser(), authRouter);

// 8. JSON API for the dashboard: signed-in users (or read-only demo visitors), and changes need
//    the CSRF token. express.json is only used here, never on /webhook.
app.use('/api', cookieParser(), express.json(), requireUser, ...apiGuards, apiRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`ReviewPal running on port ${PORT}`);
  // Reviews left "pending" by a restart (or hanging) become "failed", now and every 5 minutes
  startStuckReviewSweeper();
  // Production only: webhooks GitHub couldn't deliver while we were asleep or restarting.
  // A few seconds' delay so the server is surely ready to receive them.
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => void redeliverMissedWebhooks(githubApp), 5000).unref();
  }
});