// Builds what we send to GitHub for a review: which comments go inline, and the review text.
// Pure functions (no database, no network), so they can be tested on their own.
import { newSideLines, type NotReviewed } from './diff.js';
import type { Severity } from './generated/prisma/client.js';

const LABEL: Record<Severity, string> = { bug: 'Bug', risk: 'Risk', style: 'Style' };
const FOOTER = '<sub>Reviewed by ReviewPal</sub>';

type Comment = { path: string; line: number; severity: Severity; body: string };
export type InlineComment = { path: string; line: number; side: 'RIGHT'; body: string };

// "**Bug**: the comment"
export function formatComment(c: { severity: Severity; body: string }): string {
  return `**${LABEL[c.severity]}**: ${c.body}`;
}

// "1 bug", "2 bugs"
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// "ReviewPal found 3 things: 1 bug, 1 risk, 1 style." (zero counts are left out)
export function summary(comments: { severity: Severity }[]): string {
  const parts = (Object.keys(LABEL) as Severity[])
    .map((s) => [s, comments.filter((c) => c.severity === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => plural(n, s));
  return `ReviewPal found ${plural(comments.length, 'thing')}: ${parts.join(', ')}.`;
}

// "Not reviewed: package-lock.json (lock file), big.ts (too large)"
export function notReviewedNote(files: NotReviewed[]): string {
  return `Not reviewed: ${files.map((f) => `\`${f.filename}\` (${f.reason})`).join(', ')}`;
}

// Comments on lines that appear in the file's diff go inline (GitHub rejects any other line).
// The rest become "- `path:line` - **Bug**: ..." lines for the review text, so nothing is lost.
export function splitComments(
  comments: Comment[],
  files: { filename: string; patch: string | null }[]
): { inline: InlineComment[]; outside: string[] } {
  const allowed = new Map<string, Set<number>>();
  for (const f of files) {
    if (f.patch) allowed.set(f.filename, newSideLines(f.patch));
  }

  const inline: InlineComment[] = [];
  const outside: string[] = [];
  for (const c of comments) {
    if (allowed.get(c.path)?.has(c.line)) {
      inline.push({ path: c.path, line: c.line, side: 'RIGHT', body: formatComment(c) });
    } else {
      outside.push(`- \`${c.path}:${c.line}\` - ${formatComment(c)}`);
    }
  }
  return { inline, outside };
}

// The review text: summary, comments outside the diff, files not reviewed, footer
export function reviewBody(comments: Comment[], outside: string[], notReviewed: NotReviewed[]): string {
  return [
    summary(comments),
    ...(outside.length > 0 ? ['**Comments on lines outside the diff:**', outside.join('\n')] : []),
    ...(notReviewed.length > 0 ? [notReviewedNote(notReviewed)] : []),
    FOOTER,
  ].join('\n\n');
}
