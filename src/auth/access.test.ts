import { describe, expect, it } from 'vitest';
import { canAccessRepo, isStale, parseAllowedRepos, safeNext, visibleRepoIds, type AllowedRepo } from './access.js';

// Felicia can access the playground repo through installation 101
const felicia: AllowedRepo[] = [{ installationId: 101, fullName: 'liciacodes/reviewpal-playground' }];

const playground = { id: 'repo-1', owner: 'Liciacodes', name: 'reviewpal-playground', installationId: 101 };
const someoneElses = { id: 'repo-2', owner: 'other-org', name: 'secret-app', installationId: 202 };

describe('canAccessRepo', () => {
  it('lets a user see reviews of their own repo', () => {
    expect(canAccessRepo(felicia, playground)).toBe(true);
  });

  it("does not let a user see another account's repo", () => {
    expect(canAccessRepo(felicia, someoneElses)).toBe(false);
  });

  it('needs the installation to match too, not just the name', () => {
    expect(canAccessRepo(felicia, { ...playground, installationId: 999 })).toBe(false);
  });

  it('ignores upper/lower case in owner and repo names (GitHub does too)', () => {
    expect(canAccessRepo(felicia, { ...playground, owner: 'LICIACODES', name: 'ReviewPal-Playground' })).toBe(true);
  });

  it('lets a user with no allowed repos see nothing', () => {
    expect(canAccessRepo([], playground)).toBe(false);
  });
});

describe('visibleRepoIds', () => {
  it('keeps only the repos the user can see', () => {
    expect(visibleRepoIds([playground, someoneElses], felicia)).toEqual(['repo-1']);
  });
});

describe('isStale', () => {
  const checkedAt = new Date('2026-10-21T12:00:00Z');

  it('trusts the cached list for 10 minutes', () => {
    expect(isStale(checkedAt, new Date('2026-10-21T12:09:59Z'))).toBe(false);
  });

  it('asks GitHub again after 10 minutes', () => {
    expect(isStale(checkedAt, new Date('2026-10-21T12:10:00Z'))).toBe(true);
  });

  it('asks GitHub when the list was never fetched', () => {
    expect(isStale(null, new Date())).toBe(true);
  });
});

describe('parseAllowedRepos', () => {
  it('reads the cached list and drops anything malformed', () => {
    expect(parseAllowedRepos([...felicia, { installationId: 'x' }, null, 'junk'])).toEqual(felicia);
    expect(parseAllowedRepos(null)).toEqual([]);
  });
});

describe('safeNext', () => {
  it('allows paths on the dashboard', () => {
    expect(safeNext('/reviews')).toBe('/reviews');
    expect(safeNext('/reviews/abc?x=1')).toBe('/reviews/abc?x=1');
  });

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'reviews', '', undefined, ['/a']])(
    'sends %j to the home page instead of leaving the site',
    (next) => {
      expect(safeNext(next)).toBe('/');
    }
  );
});
