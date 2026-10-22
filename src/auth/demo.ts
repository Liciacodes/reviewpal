// Read-only demo: visitors can explore ONE public repo (DEMO_REPO) without signing in.
//
// The demo cookie is not a secret and doesn't need to be: all it can ever unlock is read
// access to DEMO_REPO, which is public on GitHub anyway. Writes are refused in rejectDemoWrites.
import type { NextFunction, Request, Response } from 'express';
import { fullNameOf, type AllowedRepo } from './access.js';

export const DEMO_COOKIE = 'rp_demo';
export const DEMO_TTL_MS = 24 * 60 * 60 * 1000;

// What /api/me shows for a demo visitor: no personal data
export const DEMO_PROFILE = { login: 'demo', name: 'Demo visitor', avatarUrl: null, demo: true } as const;

export const DEMO_READ_ONLY_MESSAGE = 'The demo is read-only. Sign in to use ReviewPal on your repos.';

// "Liciacodes/reviewpal-playground" -> "liciacodes/reviewpal-playground"; anything else -> null (demo off)
export function parseDemoRepo(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return /^[\w.-]+\/[\w.-]+$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

// The demo visitor's "allowed repos": only rows of the demo repo (with their real installation id,
// so the normal canAccessRepo check applies unchanged)
export function demoAllowedRepos(
  repos: { owner: string; name: string; installationId: number }[],
  demoRepo: string
): AllowedRepo[] {
  return repos
    .filter((r) => fullNameOf(r) === demoRepo)
    .map((r) => ({ installationId: r.installationId, fullName: fullNameOf(r) }));
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// In front of every /api route: a demo visitor may only read
export function rejectDemoWrites(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.kind === 'demo' && !READ_METHODS.has(req.method)) {
    return res.status(403).json({ error: DEMO_READ_ONLY_MESSAGE });
  }
  next();
}
