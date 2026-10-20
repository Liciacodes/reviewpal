import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';

const app = express();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) throw new Error('WEBHOOK_SECRET is missing');

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
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

  res.status(200).send('ok');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`ReviewPal running on port ${PORT}`);
});