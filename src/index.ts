import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import cors from 'cors';
import { App } from 'octokit';
import { apiRouter } from './api.js';
import { runReview } from './pipeline.js';

const app = express();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) throw new Error('WEBHOOK_SECRET is missing');

const githubApp = new App({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: fs.readFileSync(process.env.GITHUB_PRIVATE_KEY_PATH!, 'utf8'),
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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

  // 6. When a PR is opened or updated, run the review (it saves everything and never throws)
  if (event === 'pull_request' && ['opened', 'synchronize'].includes(payload.action)) {
    await runReview(githubApp, payload);
  }
});

// 7. JSON API for the dashboard. express.json is only used here, never on /webhook.
const DASHBOARD_ORIGIN = process.env.DASHBOARD_ORIGIN ?? 'http://localhost:3001';
app.use('/api', cors({ origin: DASHBOARD_ORIGIN }), express.json(), apiRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`ReviewPal running on port ${PORT}`);
});