import type { Octokit } from 'octokit';
import { prisma } from './db.js';
import { newSideLines, type NotReviewed } from './diff.js';
import type { Severity } from './generated/prisma/client.js';

const LABEL: Record<Severity, string> = { bug: 'Bug', risk: 'Risk', style: 'Style' };
const FOOTER = '<sub>Reviewed by ReviewPal</sub>';

// "Not reviewed: package-lock.json (lock file), big.ts (too large)"
export function notReviewedNote(files: NotReviewed[]): string {
  return `Not reviewed: ${files.map((f) => `\`${f.filename}\` (${f.reason})`).join(', ')}`;
}

// "**Bug**: the comment"
function formatComment(c: { severity: Severity; body: string }): string {
  return `**${LABEL[c.severity]}**: ${c.body}`;
}

// "1 bug", "2 bugs"
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// "ReviewPal found 3 things: 1 bug, 1 risk, 1 style." (zero counts are left out)
function summary(comments: { severity: Severity }[]): string {
  const parts = (Object.keys(LABEL) as Severity[])
    .map((s) => [s, comments.filter((c) => c.severity === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => plural(n, s));
  return `ReviewPal found ${plural(comments.length, 'thing')}: ${parts.join(', ')}.`;
}

// Posts the saved AI comments as ONE review on the GitHub pull request.
// Never throws: a failure is logged and saved in review.postError.
export async function postReviewToGitHub(octokit: Octokit, reviewId: string): Promise<void> {
  try {
    const review = await prisma.review.findUniqueOrThrow({
      where: { id: reviewId },
      include: { repo: true, files: true, comments: { orderBy: [{ path: 'asc' }, { line: 'asc' }] } },
    });

    // Already posted (never post twice), or nothing to say
    if (review.githubReviewId || review.comments.length === 0) return;

    // Which lines of each file GitHub will accept a comment on
    const allowed = new Map<string, Set<number>>();
    for (const f of review.files) {
      if (f.patch) allowed.set(f.filename, newSideLines(f.patch));
    }

    // Comments on allowed lines go inline; the rest are listed in the review body
    const inline: { path: string; line: number; side: 'RIGHT'; body: string }[] = [];
    const outside: string[] = [];
    for (const c of review.comments) {
      if (allowed.get(c.path)?.has(c.line)) {
        inline.push({ path: c.path, line: c.line, side: 'RIGHT', body: formatComment(c) });
      } else {
        outside.push(`- \`${c.path}:${c.line}\` - ${formatComment(c)}`);
      }
    }

    // Saved by runReview as JSON: the files the AI never saw, and why
    const notReviewed = (review.notReviewed ?? []) as NotReviewed[];

    const body = [
      summary(review.comments),
      ...(outside.length > 0 ? ['**Comments on lines outside the diff:**', outside.join('\n')] : []),
      ...(notReviewed.length > 0 ? [notReviewedNote(notReviewed)] : []),
      FOOTER,
    ].join('\n\n');

    const { data } = await octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
      owner: review.repo.owner,
      repo: review.repo.name,
      pull_number: review.prNumber,
      commit_id: review.headSha,
      event: 'COMMENT',
      body,
      comments: inline,
    });

    await prisma.review.update({
      where: { id: reviewId },
      data: { githubReviewId: String(data.id), postedAt: new Date(), postError: null },
    });
    console.log(`Posted review ${reviewId} to GitHub: ${inline.length} inline, ${outside.length} in body`);
  } catch (err) {
    // Only the message: the full Octokit error also carries request details we don't want in logs
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Could not post review ${reviewId} to GitHub: ${message}`);
    try {
      await prisma.review.update({ where: { id: reviewId }, data: { postError: message } });
    } catch (dbErr) {
      console.error('Could not save the post error:', dbErr);
    }
  }
}
