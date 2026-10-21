// Sessions: a random token in an httpOnly cookie, its SHA-256 hash in the database.
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';
import type { AllowedRepo } from './access.js';
import { randomToken, safeEqual, sha256 } from './crypto.js';
import { GitHubAccessRevoked, getAllowedRepos } from './github-user.js';

export const SESSION_COOKIE = 'rp_session';
export const CSRF_COOKIE = 'rp_csrf'; // readable by the dashboard, which copies it into X-CSRF-Token
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Secure cookies (HTTPS only) in production; COOKIE_SECURE=true/false overrides
const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';

export function cookieOptions(maxAge: number, httpOnly = true): CookieOptions {
  return { httpOnly, secure, sameSite: 'lax', path: '/', maxAge };
}

// What requireUser attaches to the request
export type Auth = {
  user: { id: string; login: string; name: string | null; avatarUrl: string | null };
  session: { id: string; csrfToken: string };
  allowed: AllowedRepo[];
};

declare global {
  namespace Express {
    interface Request {
      auth?: Auth;
    }
  }
}

export async function createSession(res: Response, userId: string): Promise<void> {
  const token = randomToken();
  const csrfToken = randomToken();
  await prisma.session.create({
    data: { tokenHash: sha256(token), csrfToken, userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_MS));
  res.cookie(CSRF_COOKIE, csrfToken, cookieOptions(SESSION_TTL_MS, false));
}

export function clearSessionCookies(res: Response): void {
  const { maxAge: _maxAge, ...options } = cookieOptions(0);
  res.clearCookie(SESSION_COOKIE, options);
  res.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
}

// The session for this request's cookie, or null (missing, unknown or expired)
export async function findSession(req: Request) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token === '') return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session;
}

function notSignedIn(res: Response) {
  clearSessionCookies(res);
  res.status(401).json({ error: 'Not signed in' });
}

// Lets the request through only with a valid session, and attaches the user and the repos they may see
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await findSession(req);
    if (!session) return notSignedIn(res);

    let allowed: AllowedRepo[];
    try {
      allowed = await getAllowedRepos(session.user);
    } catch (err) {
      if (err instanceof GitHubAccessRevoked) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
        return notSignedIn(res);
      }
      console.error(`Could not check GitHub access for ${session.user.login}: ${(err as Error).message}`);
      return res.status(502).json({ error: "Couldn't check your GitHub access. Try again in a moment." });
    }

    const { id, login, name, avatarUrl } = session.user;
    req.auth = { user: { id, login, name, avatarUrl }, session: { id: session.id, csrfToken: session.csrfToken }, allowed };
    next();
  } catch (err) {
    console.error(`Session check failed: ${(err as Error).message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Changes (PATCH, POST...) must send the session's CSRF token in the X-CSRF-Token header.
// Another site can make the browser send our cookie, but it can't read the token to copy it.
export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  const sent = req.header('x-csrf-token') ?? '';
  if (!req.auth || !safeEqual(sent, req.auth.session.csrfToken)) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }
  next();
}
