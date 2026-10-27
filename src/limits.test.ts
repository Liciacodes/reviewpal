import { describe, expect, it } from 'vitest';
import {
  limitProblems,
  noticeKind,
  noticeText,
  prSize,
  pullRequestDecision,
  quotaDecision,
  readLimits,
  rerunRefusal,
  sizeDecision,
  startOfUtcDay,
  type PullRequestEvent,
} from './limits.js';

const limits = readLimits({}); // the defaults: 10 per installation, 100 overall, 30 files, 3000 lines

describe('readLimits', () => {
  it('uses the defaults when nothing is set', () => {
    expect(limits).toEqual({ perInstallationPerDay: 10, perDay: 100, maxFiles: 30, maxLines: 3000 });
  });

  it('reads the env vars', () => {
    expect(
      readLimits({ REVIEWS_PER_INSTALLATION_PER_DAY: '3', REVIEWS_PER_DAY: '50', MAX_PR_FILES: '20', MAX_PR_LINES: '1000' })
    ).toEqual({ perInstallationPerDay: 3, perDay: 50, maxFiles: 20, maxLines: 1000 });
  });

  it('reports values that are not positive whole numbers (for the startup check)', () => {
    expect(limitProblems({ REVIEWS_PER_DAY: 'ten', MAX_PR_FILES: '0', MAX_PR_LINES: '2.5', REVIEWS_PER_INSTALLATION_PER_DAY: '5' })).toEqual([
      'REVIEWS_PER_DAY must be a positive whole number, or be left unset',
      'MAX_PR_FILES must be a positive whole number, or be left unset',
      'MAX_PR_LINES must be a positive whole number, or be left unset',
    ]);
  });
});

describe('quotaDecision: per installation', () => {
  it('allows the 10th review of the day', () => {
    expect(quotaDecision({ installation: 9, global: 9 }, limits)).toBe('ok');
  });

  it('refuses the 11th', () => {
    expect(quotaDecision({ installation: 10, global: 10 }, limits)).toBe('installation_limit');
  });

  it("isn't affected by other installations", () => {
    expect(quotaDecision({ installation: 0, global: 99 }, limits)).toBe('ok');
  });
});

describe('quotaDecision: global', () => {
  it('allows the 100th review of the day for everyone', () => {
    expect(quotaDecision({ installation: 0, global: 99 }, limits)).toBe('ok');
  });

  it('refuses the 101st', () => {
    expect(quotaDecision({ installation: 0, global: 100 }, limits)).toBe('global_limit');
  });

  it('wins when both limits are reached', () => {
    expect(quotaDecision({ installation: 10, global: 100 }, limits)).toBe('global_limit');
  });
});

describe('sizeDecision: big pull requests', () => {
  it('reviews a PR exactly at the limits', () => {
    expect(sizeDecision({ changedFiles: 30, changedLines: 3000 }, limits)).toBe('ok');
  });

  it('skips more files than allowed', () => {
    expect(sizeDecision({ changedFiles: 31, changedLines: 10 }, limits)).toBe('too_large');
  });

  it('skips more changed lines than allowed', () => {
    expect(sizeDecision({ changedFiles: 2, changedLines: 3001 }, limits)).toBe('too_large');
  });

  it('reads the size from the webhook (additions + deletions)', () => {
    expect(prSize({ changed_files: 4, additions: 120, deletions: 30 })).toEqual({ changedFiles: 4, changedLines: 150 });
  });
});

describe('pullRequestDecision: bots and drafts', () => {
  const event = (action: string, pr: PullRequestEvent['pull_request'] = {}): PullRequestEvent => ({
    action,
    pull_request: { user: { type: 'User', login: 'felicia' }, draft: false, ...pr },
  });

  it.each(['opened', 'synchronize', 'reopened', 'ready_for_review'])('reviews "%s"', (action) => {
    expect(pullRequestDecision(event(action))).toEqual({ review: true });
  });

  it.each(['closed', 'edited', 'labeled', 'converted_to_draft'])('ignores "%s"', (action) => {
    expect(pullRequestDecision(event(action)).review).toBe(false);
  });

  it('ignores PRs opened by bots', () => {
    expect(pullRequestDecision(event('opened', { user: { type: 'Bot', login: 'dependabot[bot]' } }))).toEqual({
      review: false,
      why: 'opened by a bot',
    });
    expect(pullRequestDecision(event('opened', { user: { type: 'User', login: 'renovate[bot]' } })).review).toBe(false);
  });

  it('ignores drafts, then reviews them when marked ready for review', () => {
    expect(pullRequestDecision(event('opened', { draft: true }))).toEqual({ review: false, why: 'draft' });
    expect(pullRequestDecision(event('synchronize', { draft: true })).review).toBe(false);
    expect(pullRequestDecision(event('ready_for_review', { draft: false }))).toEqual({ review: true });
  });
});

describe('days and notices', () => {
  it('starts the day at midnight UTC', () => {
    expect(startOfUtcDay(new Date('2026-10-23T23:59:00Z')).toISOString()).toBe('2026-10-23T00:00:00.000Z');
  });

  it('gives a PR at most one "limit reached" comment, whichever limit it was', () => {
    expect(noticeKind('installation_limit')).toBe(noticeKind('global_limit'));
    expect(noticeKind('too_large')).not.toBe(noticeKind('global_limit'));
  });

  it('writes friendly notices with the numbers', () => {
    expect(noticeText('too_large', limits, { changedFiles: 42, changedLines: 900 })).toContain('42 files and 900 changed lines');
    expect(noticeText('installation_limit', limits)).toContain('10 reviews a day');
    expect(noticeText('global_limit', limits)).toContain('midnight UTC');
  });

  it('says "1 review a day", not "1 reviews", when the limit is 1', () => {
    const one = { ...limits, perInstallationPerDay: 1, maxFiles: 1, maxLines: 1 };
    expect(noticeText('installation_limit', one)).toContain('(1 review a day)');
    expect(noticeText('too_large', one, { changedFiles: 2, changedLines: 1 })).toContain(
      '(2 files and 1 changed line; the limits are 1 file and 1 line)'
    );
    expect(rerunRefusal('too_large', one)).toContain('the limits are 1 file and 1 line');
  });
});
