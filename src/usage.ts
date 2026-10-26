// Daily AI usage and "once per PR" notices, in the database. The rules themselves are in limits.ts.
import type { Octokit } from 'octokit';
import { prisma } from './db.js';
import { Prisma } from './generated/prisma/client.js';
import { quotaDecision, startOfUtcDay, type Limits, type QuotaDecision } from './limits.js';

// Any fixed number: all quota checks take this lock, one at a time
const QUOTA_LOCK = 741_302;

// Counts today's AI calls and, if a limit allows it, records one more, all inside one locked
// transaction, so two webhooks arriving at the same moment can't both take the last slot.
export async function reserveAiUse(
  installationId: number,
  reviewId: string,
  limits: Limits,
  now = new Date()
): Promise<{ decision: QuotaDecision; usageId?: string }> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(${QUOTA_LOCK})`;
    const since = startOfUtcDay(now);
    const [installation, global] = await Promise.all([
      tx.aiUsage.count({ where: { installationId, createdAt: { gte: since } } }),
      tx.aiUsage.count({ where: { createdAt: { gte: since } } }),
    ]);
    const decision = quotaDecision({ installation, global }, limits);
    if (decision !== 'ok') return { decision };
    const usage = await tx.aiUsage.create({ data: { installationId, reviewId } });
    return { decision, usageId: usage.id };
  });
}

// Gives back a reserved slot (e.g. the re-run couldn't start after all)
export async function releaseAiUse(usageId: string): Promise<void> {
  await prisma.aiUsage.delete({ where: { id: usageId } }).catch(() => {});
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

export type NoticeSteps = {
  createNotice: () => Promise<unknown>; // fails with P2002 if this notice was already posted
  deleteNotice: () => Promise<unknown>;
  postComment: () => Promise<unknown>;
};

// Posts a notice at most once: the database row is the "already posted" flag. If posting fails,
// the row is removed again so a later push can try once more. Never throws.
export async function postNoticeOnce(steps: NoticeSteps, label: string): Promise<'posted' | 'already-posted' | 'failed'> {
  try {
    await steps.createNotice();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return 'already-posted';
    console.error(`Could not record the notice for ${label}: ${messageOf(err)}`);
    return 'failed';
  }
  try {
    await steps.postComment();
    return 'posted';
  } catch (err) {
    console.error(`Could not post the notice on ${label}: ${messageOf(err)}`);
    await steps.deleteNotice().catch(() => {});
    return 'failed';
  }
}

// The real thing: a PrNotice row, and a comment on the pull request
export function notifyPullRequestOnce(
  octokit: Octokit,
  repo: { id: string; owner: string; name: string },
  prNumber: number,
  kind: string,
  text: string
) {
  const label = `${repo.owner}/${repo.name}#${prNumber}`;
  return postNoticeOnce(
    {
      createNotice: () => prisma.prNotice.create({ data: { repoId: repo.id, prNumber, kind } }),
      deleteNotice: () => prisma.prNotice.deleteMany({ where: { repoId: repo.id, prNumber, kind } }),
      postComment: () =>
        octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
          owner: repo.owner,
          repo: repo.name,
          issue_number: prNumber,
          body: text,
        }),
    },
    label
  );
}
