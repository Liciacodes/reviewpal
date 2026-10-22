// Talks to GitHub as the signed-in user: profile, allowed repos, token refresh.
// Tokens are decrypted only in memory here and never logged.
import { Octokit } from 'octokit';
import { prisma } from '../db.js';
import { githubApp } from '../github-app.js';
import { isStale, parseAllowedRepos, type AllowedRepo } from './access.js';
import { decrypt, encrypt, parseKey, tryDecrypt } from './crypto.js';

// Read lazily so the server can start (webhooks keep working) before sign-in is configured
let cachedKey: Buffer | undefined;
function key(): Buffer {
  cachedKey ??= parseKey(process.env.TOKEN_ENCRYPTION_KEY);
  return cachedKey;
}

// GitHub no longer accepts the user's token (revoked, or the refresh failed): sign in again
export class GitHubAccessRevoked extends Error {}

type UserTokens = { token: string; expiresAt?: string | undefined; refreshToken?: string | undefined };

// The token columns of a User row, encrypted
export function encryptTokens(t: UserTokens) {
  return {
    accessToken: encrypt(t.token, key()),
    accessTokenExpires: t.expiresAt ? new Date(t.expiresAt) : null,
    refreshToken: t.refreshToken ? encrypt(t.refreshToken, key()) : null,
  };
}

export async function fetchProfile(token: string) {
  const { data } = await new Octokit({ auth: token }).request('GET /user');
  return { githubId: String(data.id), login: data.login, name: data.name ?? null, avatarUrl: data.avatar_url };
}

// Every repo the user can access in every installation of ReviewPal they can see
export async function fetchAllowedRepos(token: string): Promise<AllowedRepo[]> {
  const octokit = new Octokit({ auth: token });
  const installations = await octokit.paginate('GET /user/installations', { per_page: 100 });
  const allowed: AllowedRepo[] = [];
  for (const installation of installations) {
    const repos = await octokit.paginate('GET /user/installations/{installation_id}/repositories', {
      installation_id: installation.id,
      per_page: 100,
    });
    for (const repo of repos) allowed.push({ installationId: installation.id, fullName: repo.full_name.toLowerCase() });
  }
  return allowed;
}

type StoredUser = {
  id: string;
  accessToken: string;
  accessTokenExpires: Date | null;
  refreshToken: string | null;
  allowedRepos: unknown;
  accessCheckedAt: Date | null;
};

// A usable token: the stored one, or a fresh one if it expires within a minute
async function validToken(user: StoredUser, now: Date): Promise<string> {
  const expiresSoon = user.accessTokenExpires && user.accessTokenExpires.getTime() - 60_000 < now.getTime();
  if (!expiresSoon) {
    const token = tryDecrypt(user.accessToken, key());
    if (token === null) {
      // Usually: local and production share one database but have different TOKEN_ENCRYPTION_KEYs,
      // so the last sign-in on one makes the token unreadable on the other. Ask for a new sign-in.
      console.warn('Stored GitHub token is unreadable with this TOKEN_ENCRYPTION_KEY (different key at sign-in?). Asking the user to sign in again.');
      throw new GitHubAccessRevoked('Stored token unreadable');
    }
    return token;
  }
  if (!user.refreshToken) throw new GitHubAccessRevoked('Token expired');

  try {
    const { authentication } = await githubApp.oauth.refreshToken({ refreshToken: decrypt(user.refreshToken, key()) });
    await prisma.user.update({ where: { id: user.id }, data: encryptTokens(authentication) });
    return authentication.token;
  } catch {
    throw new GitHubAccessRevoked('Token refresh failed');
  }
}

// One check per user at a time: refresh tokens work only once, and the dashboard sends
// several requests at the same moment. Later callers wait for the running check.
const inFlight = new Map<string, Promise<AllowedRepo[]>>();

// The repos this user may see: from the cache if it is recent, otherwise asked from GitHub
export async function getAllowedRepos(user: StoredUser, now = new Date()): Promise<AllowedRepo[]> {
  if (!isStale(user.accessCheckedAt, now)) return parseAllowedRepos(user.allowedRepos);

  const running = inFlight.get(user.id);
  if (running) return running;

  const check = (async () => {
    const token = await validToken(user, now);
    let allowed: AllowedRepo[];
    try {
      allowed = await fetchAllowedRepos(token);
    } catch (err) {
      if ((err as { status?: number }).status === 401) throw new GitHubAccessRevoked('Token rejected');
      throw err;
    }
    await prisma.user.update({ where: { id: user.id }, data: { allowedRepos: allowed, accessCheckedAt: now } });
    return allowed;
  })();

  inFlight.set(user.id, check);
  try {
    return await check;
  } finally {
    inFlight.delete(user.id);
  }
}
