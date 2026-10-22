import type { App } from 'octokit';
import { prisma } from './db.js';
import { Prisma } from './generated/prisma/client.js';
import { postReviewToGitHub } from './github.js';
import { MODEL, reviewFiles } from './review.js';
import { stuckCutoff, SWEEP_EVERY_MS, TIMED_OUT_MESSAGE } from './stuck.js';

// The parts of the GitHub pull_request webhook payload we use
type PullRequestPayload = {
  installation: { id: number };
  repository: { name: string; owner: { login: string } };
  pull_request: { number: number; title: string; html_url: string; head: { sha: string } };
};

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

// Webhook: a PR was opened or updated. Save the review as "pending", then do the work.
// It never throws: every error ends up logged and stored on the Review.
export async function runReview(githubApp: App, payload: PullRequestPayload): Promise<void> {
  const owner = payload.repository.owner.login;
  const name = payload.repository.name;
  const pr = payload.pull_request;
  const label = `${owner}/${name}#${pr.number}@${pr.head.sha.slice(0, 7)}`;

  try {
    // 1. Make sure the repo exists in the DB (create it the first time)
    const repo = await prisma.repo.upsert({
      where: { owner_name: { owner, name } },
      update: { installationId: payload.installation.id },
      create: { owner, name, installationId: payload.installation.id },
    });

    // 2. Create the review as "pending". If this exact commit was already
    //    reviewed (GitHub redelivered the webhook), the unique rule rejects it.
    const review = await prisma.review.create({
      data: { repoId: repo.id, prNumber: pr.number, prTitle: pr.title, prUrl: pr.html_url, headSha: pr.head.sha, model: MODEL },
    });

    await processReview(githubApp, review.id);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      console.log(`Already reviewed ${label}, skipping`);
      return;
    }
    console.error(`Could not start the review for ${label}: ${messageOf(err)}`);
  }
}

// The actual work for a pending review: fetch the files, ask the AI, save, post to GitHub.
// Used by the webhook and by "Re-run review". Never throws: a failure marks the review "failed".
export async function processReview(githubApp: App, reviewId: string): Promise<void> {
  let label = reviewId;
  try {
    const review = await prisma.review.findUniqueOrThrow({ where: { id: reviewId }, include: { repo: true } });
    const { owner, name, installationId } = review.repo;
    label = `${owner}/${name}#${review.prNumber}@${review.headSha.slice(0, 7)}`;

    // 3. Fetch the changed files from GitHub and save them
    const octokit = await githubApp.getInstallationOctokit(installationId);
    const { data: files } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
      owner,
      repo: name,
      pull_number: review.prNumber,
    });

    await prisma.reviewFile.createMany({
      data: files.map((f) => ({ reviewId, filename: f.filename, status: f.status, patch: f.patch ?? null })),
    });

    // 4. Ask the AI (retries once on temporary problems), save its comments, and mark the review as done
    const result = await reviewFiles(files);

    await prisma.reviewComment.createMany({
      data: result.comments.map((c) => ({ reviewId, ...c })),
    });

    await prisma.review.update({
      where: { id: reviewId },
      data: { status: 'done', filesChanged: files.length, notReviewed: result.notReviewed },
    });

    console.log(`Reviewed ${label}: ${files.length} files, ${result.comments.length} comments`);

    // 5. Post the comments on the pull request. It never posts twice (githubReviewId check),
    //    saves its own error, and never throws, so a failed post leaves the review "done".
    await postReviewToGitHub(octokit, reviewId);
  } catch (err) {
    // 6. Something failed: record it on the review
    console.error(`Review failed for ${label}: ${messageOf(err)}`);
    try {
      await prisma.review.update({ where: { id: reviewId }, data: { status: 'failed', errorMessage: messageOf(err) } });
    } catch (dbErr) {
      console.error(`Could not mark review as failed: ${messageOf(dbErr)}`);
    }
  }
}

export type RerunResult = { ok: true } | { ok: false; status: 409; error: string };

// "Re-run review": checks it can run, then resets the review to pending (old files and comments
// are removed). The caller then runs processReview in the background.
export async function prepareRerun(
  githubApp: App,
  review: { id: string; status: string; headSha: string; prNumber: number; repo: { owner: string; name: string; installationId: number } }
): Promise<RerunResult> {
  if (review.status === 'pending') return { ok: false, status: 409, error: 'This review is already running.' };

  // GitHub only gives us the files at the PR's CURRENT head, so a re-run is only
  // the same review while the PR still points at the commit we reviewed.
  const octokit = await githubApp.getInstallationOctokit(review.repo.installationId);
  const { data: pr } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner: review.repo.owner,
    repo: review.repo.name,
    pull_number: review.prNumber,
  });
  if (pr.head.sha !== review.headSha) {
    return { ok: false, status: 409, error: 'This pull request has newer commits. The newest commit has its own review.' };
  }

  // Claim it in one step: only succeeds if it is not pending, so two clicks can't start two runs
  const claimed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.review.updateMany({
      where: { id: review.id, status: { not: 'pending' } },
      data: {
        status: 'pending',
        startedAt: new Date(),
        errorMessage: null,
        postError: null, // posting is tried again at the end if it hasn't succeeded yet
        filesChanged: 0,
        notReviewed: Prisma.DbNull,
      },
    });
    if (count === 0) return false;
    await tx.reviewComment.deleteMany({ where: { reviewId: review.id } });
    await tx.reviewFile.deleteMany({ where: { reviewId: review.id } });
    return true;
  });
  return claimed ? { ok: true } : { ok: false, status: 409, error: 'This review is already running.' };
}

// Marks reviews that have been pending too long as failed (see stuck.ts)
export async function markStuckReviews(now = new Date()): Promise<number> {
  const { count } = await prisma.review.updateMany({
    where: { status: 'pending', startedAt: { lt: stuckCutoff(now) } },
    data: { status: 'failed', errorMessage: TIMED_OUT_MESSAGE },
  });
  if (count > 0) console.warn(`Marked ${count} stuck review(s) as failed`);
  return count;
}

// On server start and every 5 minutes
export function startStuckReviewSweeper(): void {
  const sweep = () => markStuckReviews().catch((err) => console.error(`Stuck-review check failed: ${messageOf(err)}`));
  void sweep();
  setInterval(sweep, SWEEP_EVERY_MS).unref(); // unref: never keeps the process alive on its own
}
