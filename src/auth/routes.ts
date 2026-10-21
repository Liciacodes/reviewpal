// Sign-in with GitHub (the GitHub App's own OAuth) and sign-out.
// These run behind the dashboard's rewrites, so relative redirects land on the dashboard.
import express, { type Response } from 'express';
import { prisma } from '../db.js';
import { githubApp, oauthConfigured } from '../github-app.js';
import { safeNext } from './access.js';
import { randomToken, safeEqual } from './crypto.js';
import { encryptTokens, fetchAllowedRepos, fetchProfile } from './github-user.js';
import { clearSessionCookies, cookieOptions, createSession, findSession } from './session.js';

export const authRouter = express.Router();

const OAUTH_COOKIE = 'rp_oauth'; // the `state` and where to go after sign-in, for 10 minutes
const OAUTH_TTL_MS = 10 * 60 * 1000;

// GitHub sends the user back here. It must match a Callback URL in the GitHub App settings.
const DASHBOARD_URL = (process.env.DASHBOARD_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const CALLBACK_URL = `${DASHBOARD_URL}/auth/callback`;

function backToSignIn(res: Response, message: string) {
  res.redirect(`/sign-in?error=${encodeURIComponent(message)}`);
}

// 1. Start: remember a random `state`, then send the browser to GitHub
authRouter.get('/login', (req, res) => {
  if (!oauthConfigured || !process.env.TOKEN_ENCRYPTION_KEY) {
    return backToSignIn(res, 'Sign-in is not set up on the server yet.');
  }
  const state = randomToken();
  const next = safeNext(req.query.next);
  res.cookie(OAUTH_COOKIE, JSON.stringify({ state, next }), cookieOptions(OAUTH_TTL_MS));

  const { url } = githubApp.oauth.getWebFlowAuthorizationUrl({ state, redirectUrl: CALLBACK_URL });
  res.redirect(url);
});

// 2. GitHub sends the user back with a one-time `code`
authRouter.get('/callback', async (req, res) => {
  let saved: { state?: unknown; next?: unknown } = {};
  try {
    saved = JSON.parse(String(req.cookies?.[OAUTH_COOKIE] ?? '{}'));
  } catch {
    // a broken cookie is treated like a missing one
  }
  const { maxAge: _maxAge, ...oauthCookie } = cookieOptions(0);
  res.clearCookie(OAUTH_COOKIE, oauthCookie);

  if (req.query.error) return backToSignIn(res, 'Sign-in was cancelled.');

  // The state must match the one we set: proves this sign-in was started by this browser
  const { code, state } = req.query;
  if (typeof code !== 'string' || typeof state !== 'string' || typeof saved.state !== 'string' || !safeEqual(state, saved.state)) {
    return backToSignIn(res, 'Sign-in expired. Please try again.');
  }

  try {
    const { authentication } = await githubApp.oauth.createToken({ code, state, redirectUrl: CALLBACK_URL });
    const profile = await fetchProfile(authentication.token);
    const allowedRepos = await fetchAllowedRepos(authentication.token);
    const data = { ...profile, ...encryptTokens(authentication), allowedRepos, accessCheckedAt: new Date() };

    const user = await prisma.user.upsert({ where: { githubId: profile.githubId }, update: data, create: data });
    await createSession(res, user.id);
    console.log(`Signed in: ${user.login}`);
    res.redirect(safeNext(saved.next));
  } catch (err) {
    // Only the message: never the code or tokens
    console.error(`Sign-in failed: ${(err as Error).message}`);
    backToSignIn(res, 'Could not sign in with GitHub. Please try again.');
  }
});

// 3. Sign out: delete the session. Needs the CSRF header, like every change.
authRouter.post('/logout', async (req, res) => {
  try {
    const session = await findSession(req);
    if (session) {
      if (!safeEqual(req.header('x-csrf-token') ?? '', session.csrfToken)) {
        return res.status(403).json({ error: 'Invalid or missing CSRF token' });
      }
      await prisma.session.delete({ where: { id: session.id } });
    }
    clearSessionCookies(res);
    res.status(204).end();
  } catch (err) {
    console.error(`Sign-out failed: ${(err as Error).message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});
