// Which pull requests get an AI review, and the daily limits that protect the Groq quota.
// Pure: settings, counts and payloads are passed in, so every rule is easy to test.

type Env = Record<string, string | undefined>;

export type Limits = {
  perInstallationPerDay: number; // REVIEWS_PER_INSTALLATION_PER_DAY
  perDay: number; //                REVIEWS_PER_DAY (everyone together)
  maxFiles: number; //              MAX_PR_FILES
  maxLines: number; //              MAX_PR_LINES (additions + deletions)
};

const SETTINGS: { name: string; key: keyof Limits; fallback: number }[] = [
  { name: 'REVIEWS_PER_INSTALLATION_PER_DAY', key: 'perInstallationPerDay', fallback: 10 },
  { name: 'REVIEWS_PER_DAY', key: 'perDay', fallback: 100 },
  { name: 'MAX_PR_FILES', key: 'maxFiles', fallback: 30 },
  { name: 'MAX_PR_LINES', key: 'maxLines', fallback: 3000 },
];

const isPositiveWhole = (value: string) => /^\d+$/.test(value.trim()) && Number(value) > 0;

// Settings that are set but not a positive whole number (for the startup config check)
export function limitProblems(env: Env): string[] {
  return SETTINGS.filter(({ name }) => env[name]?.trim() && !isPositiveWhole(env[name]!)).map(
    ({ name }) => `${name} must be a positive whole number, or be left unset`
  );
}

export function readLimits(env: Env): Limits {
  const limits = {} as Limits;
  for (const { name, key, fallback } of SETTINGS) {
    const value = env[name];
    limits[key] = value && isPositiveWhole(value) ? Number(value) : fallback;
  }
  return limits;
}

// The parts of the pull_request webhook payload these rules use
export type PullRequestEvent = {
  action: string;
  pull_request: {
    draft?: boolean;
    user?: { type?: string; login?: string } | null;
    changed_files?: number;
    additions?: number;
    deletions?: number;
  };
};

const REVIEW_ACTIONS = new Set(['opened', 'synchronize', 'reopened', 'ready_for_review']);

// Should this webhook start a review at all? "ignore" saves and posts nothing.
export function pullRequestDecision(event: PullRequestEvent): { review: true } | { review: false; why: string } {
  const pr = event.pull_request;
  if (!REVIEW_ACTIONS.has(event.action)) return { review: false, why: `action "${event.action}"` };
  if (pr.user?.type === 'Bot' || pr.user?.login?.endsWith('[bot]')) return { review: false, why: 'opened by a bot' };
  if (pr.draft) return { review: false, why: 'draft' }; // reviewed later, on "ready_for_review"
  return { review: true };
}

export type PrSize = { changedFiles: number; changedLines: number };

export function prSize(pr: PullRequestEvent['pull_request']): PrSize {
  return { changedFiles: pr.changed_files ?? 0, changedLines: (pr.additions ?? 0) + (pr.deletions ?? 0) };
}

export function sizeDecision(size: PrSize, limits: Limits): 'ok' | 'too_large' {
  return size.changedFiles > limits.maxFiles || size.changedLines > limits.maxLines ? 'too_large' : 'ok';
}

export type QuotaDecision = 'ok' | 'installation_limit' | 'global_limit';

// Counts are AI calls made so far today (UTC). The global limit is checked first.
export function quotaDecision(today: { installation: number; global: number }, limits: Limits): QuotaDecision {
  if (today.global >= limits.perDay) return 'global_limit';
  if (today.installation >= limits.perInstallationPerDay) return 'installation_limit';
  return 'ok';
}

// Limits reset at midnight UTC
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export type SkipReason = 'too_large' | 'installation_limit' | 'global_limit';

// Both limit reasons share one notice kind: a PR gets at most one "limit reached" comment
export function noticeKind(reason: SkipReason): 'too_large' | 'limit' {
  return reason === 'too_large' ? 'too_large' : 'limit';
}

// "1 review", "10 reviews": the word in singular only for exactly one
export function count(n: number, word: string): string {
  return `${n} ${n === 1 ? word : `${word}s`}`;
}

// The short, friendly comment posted on the PR instead of a review
export function noticeText(reason: SkipReason, limits: Limits, size?: PrSize): string {
  const footer = '\n\n<sub>ReviewPal</sub>';
  switch (reason) {
    case 'too_large':
      return (
        `ReviewPal didn't review this pull request because it's too large` +
        (size ? ` (${count(size.changedFiles, 'file')} and ${count(size.changedLines, 'changed line')};` : ' (') +
        ` the limits are ${count(limits.maxFiles, 'file')} and ${count(limits.maxLines, 'line')}). ` +
        'Smaller pull requests are easier to review, for people and for AI.' +
        footer
      );
    case 'installation_limit':
      return (
        `ReviewPal has reached today's review limit for this account (${count(limits.perInstallationPerDay, 'review')} a day), ` +
        "so this pull request wasn't reviewed. Limits reset at midnight UTC: push a new commit after that to get a review." +
        footer
      );
    case 'global_limit':
      return (
        "ReviewPal has reached its daily review limit, so this pull request wasn't reviewed. " +
        'Limits reset at midnight UTC: push a new commit after that to get a review.' +
        footer
      );
  }
}

// What a re-run that's refused says in the dashboard
export function rerunRefusal(reason: SkipReason, limits: Limits): string {
  if (reason === 'too_large') {
    return `This pull request is too large to review (the limits are ${count(limits.maxFiles, 'file')} and ${count(limits.maxLines, 'line')}).`;
  }
  return 'Daily review limit reached. Try again after midnight UTC.';
}
