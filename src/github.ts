import type { Octokit } from 'octokit';
import { prisma } from './db.js';
import type { NotReviewed } from './diff.js';
import { reviewBody, splitComments } from './review-body.js';

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

    // Comments on lines in the diff go inline; the rest are listed in the review text
    const { inline, outside } = splitComments(review.comments, review.files);

    // Saved by runReview as JSON: the files the AI never saw, and why
    const notReviewed = (review.notReviewed ?? []) as NotReviewed[];
    const body = reviewBody(review.comments, outside, notReviewed);

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
