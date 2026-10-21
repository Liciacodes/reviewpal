// The one GitHub App client, shared by the webhook (installation tokens) and sign-in (user OAuth).
import 'dotenv/config';
import fs from 'node:fs';
import { App } from 'octokit';

const clientId = process.env.GITHUB_CLIENT_ID ?? '';
const clientSecret = process.env.GITHUB_CLIENT_SECRET ?? '';

// Sign-in needs the App's Client ID and secret (GitHub App settings → General)
export const oauthConfigured = clientId !== '' && clientSecret !== '';
if (!oauthConfigured) {
  console.warn('Sign-in is not configured: set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env');
}

export const githubApp = new App({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: fs.readFileSync(process.env.GITHUB_PRIVATE_KEY_PATH!, 'utf8'),
  oauth: { clientId, clientSecret },
});
