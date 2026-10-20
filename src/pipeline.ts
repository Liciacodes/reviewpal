import type { App } from 'octokit';
import { prisma } from './db.js';
import { Prisma } from './generated/prisma/client.js';
import { postReviewToGitHub } from './github.js';
import { MODEL, reviewFiles } from './review.js';

// The parts of the GitHub pull_request webhook payload we use
type PullRequestPayload = {
  installation: { id: number };
  repository: { name: string; owner: { login: string } };
  pull_request: { number: number; title: string; html_url: string; head: { sha: string } };
};

// Runs one full review: save to DB, fetch files, ask the AI, save the result.
// It never throws: every error ends up logged and stored on the Review.
export async function runReview(githubApp: App, payload: PullRequestPayload): Promise<void> {
  const owner = payload.repository.owner.login;
  const name = payload.repository.name;
  const pr = payload.pull_request;
  const label = `${owner}/${name}#${pr.number}@${pr.head.sha.slice(0, 7)}`;

  let reviewId: string | undefined;

  try {
    // 1. Make sure the repo exists in the DB (create it the first time)
    const repo = await prisma.repo.upsert({
      where: { owner_name: { owner, name } },
      update: { installationId: payload.installation.id },
      create: { owner, name, installationId: payload.installation.id },
    });

    // 2. Create the review as "pending". If this exact commit was already
    //    reviewed (GitHub redelivered the webhook), the unique rule rejects it.
    try {
      const review = await prisma.review.create({
        data: {
          repoId: repo.id,
          prNumber: pr.number,
          prTitle: pr.title,
          prUrl: pr.html_url,
          headSha: pr.head.sha,
          model: MODEL,
        },
      });
      reviewId = review.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        console.log(`Already reviewed ${label}, skipping`);
        return;
      }
      throw err;
    }

    // 3. Fetch the changed files from GitHub and save them
    const octokit = await githubApp.getInstallationOctokit(payload.installation.id);
    const { data: files } = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
      { owner, repo: name, pull_number: pr.number }
    );

    await prisma.reviewFile.createMany({
      data: files.map((f) => ({
        reviewId: reviewId!,
        filename: f.filename,
        status: f.status,
        patch: f.patch ?? null,
      })),
    });

    // 4. Ask the AI, save its comments, and mark the review as done
    const result = await reviewFiles(files);

    await prisma.reviewComment.createMany({
      data: result.comments.map((c) => ({ reviewId: reviewId!, ...c })),
    });

    await prisma.review.update({
      where: { id: reviewId },
      data: { status: 'done', filesChanged: files.length },
    });

    console.log(`Reviewed ${label}: ${files.length} files, ${result.comments.length} comments`);

    // 5. Post the comments on the pull request. It saves its own error and never throws,
    //    so a failed post leaves the review "done".
    await postReviewToGitHub(octokit, reviewId);
  } catch (err) {
    // 6. Something failed: record it on the review (if we got that far)
    console.error(`Review failed for ${label}:`, err);
    if (!reviewId) return;
    try {
      await prisma.review.update({
        where: { id: reviewId },
        data: {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
    } catch (dbErr) {
      console.error('Could not mark review as failed:', dbErr);
    }
  }
}
