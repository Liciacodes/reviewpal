// The one GitHub App client, shared by the webhook (installation tokens) and sign-in (user OAuth).
// src/check-config.ts has already checked that every setting used here exists.
import 'dotenv/config';
import fs from 'node:fs';
import { App } from 'octokit';
import { loadPrivateKey } from './config.js';

export const githubApp = new App({
  appId: process.env.GITHUB_APP_ID!,
  // From a file (local .pem, or a Render Secret File) or from the GITHUB_PRIVATE_KEY variable
  privateKey: loadPrivateKey(process.env, (path) => fs.readFileSync(path, 'utf8')),
  oauth: { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! },
});
