// Who can see what. Pure functions, so the rules are easy to test.
//
// A user may see a repo's reviews only when ReviewPal is installed on it AND the user has access.
// GitHub tells us both at once: /user/installations lists the user's installations of THIS app,
// and /user/installations/{id}/repositories lists the repos in it the user can access.

// One repo the user may see, as cached on the User row
export type AllowedRepo = { installationId: number; fullName: string }; // fullName is lowercase "owner/name"

// How long the cached list is trusted before asking GitHub again
export const ACCESS_TTL_MS = 10 * 60 * 1000;

// GitHub owner/repo names are case-insensitive, so compare them in lowercase
export function fullNameOf(repo: { owner: string; name: string }): string {
  return `${repo.owner}/${repo.name}`.toLowerCase();
}

// Can this user see this repo? Both the installation and the name must match.
export function canAccessRepo(allowed: AllowedRepo[], repo: { owner: string; name: string; installationId: number }): boolean {
  const fullName = fullNameOf(repo);
  return allowed.some((a) => a.installationId === repo.installationId && a.fullName === fullName);
}

// The ids of the repos (from our database) this user can see
export function visibleRepoIds(
  repos: { id: string; owner: string; name: string; installationId: number }[],
  allowed: AllowedRepo[]
): string[] {
  return repos.filter((r) => canAccessRepo(allowed, r)).map((r) => r.id);
}

// Is the cached list too old to trust?
export function isStale(checkedAt: Date | null, now: Date): boolean {
  return !checkedAt || now.getTime() - checkedAt.getTime() >= ACCESS_TTL_MS;
}

// Reads the cached JSON from the database, dropping anything that isn't the right shape
export function parseAllowedRepos(value: unknown): AllowedRepo[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is AllowedRepo =>
      typeof v === 'object' && v !== null && typeof v.installationId === 'number' && typeof v.fullName === 'string'
  );
}

// Where to send the user after sign-in. Only paths on our own site: "/reviews" is fine,
// "//evil.com" and "https://evil.com" are not (they would leave the dashboard).
export function safeNext(next: unknown): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}
