import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { canAccessRepo, visibleRepoIds } from './auth/access.js';
import type { Auth } from './auth/session.js';
import { prisma } from './db.js';
import { Prisma } from './generated/prisma/client.js';
import { githubApp } from './github-app.js';
import { prepareRerun, processReview } from './pipeline.js';

// Every route here runs after requireUser (see index.ts), so req.auth is always set.
// Users only ever see reviews of repos they can access; anything else is "not found".
export const apiRouter = express.Router();

function auth(req: Request): Auth {
  if (!req.auth) throw new Error('requireUser must run before the API routes');
  return req.auth;
}

// The ids of the repos in our database that this user may see
async function myRepoIds(req: Request): Promise<string[]> {
  const repos = await prisma.repo.findMany({ select: { id: true, owner: true, name: true, installationId: true } });
  return visibleRepoIds(repos, auth(req).allowed);
}

// GET /api/me: who is signed in (for the sidebar)
apiRouter.get('/me', (req, res) => {
  const { login, name, avatarUrl } = auth(req).user;
  res.json({ login, name, avatarUrl });
});

// GET /api/reviews: the 50 newest reviews the user can see, with comment counts
apiRouter.get('/reviews', async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { repoId: { in: await myRepoIds(req) } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      repo: { select: { owner: true, name: true } },
      comments: { select: { severity: true } },
    },
  });

  res.json(
    reviews.map(({ repo, comments, ...review }) => ({
      id: review.id,
      repo: `${repo.owner}/${repo.name}`,
      prNumber: review.prNumber,
      prTitle: review.prTitle,
      prUrl: review.prUrl,
      status: review.status,
      filesChanged: review.filesChanged,
      createdAt: review.createdAt,
      commentCount: comments.length,
      counts: {
        bug: comments.filter((c) => c.severity === 'bug').length,
        risk: comments.filter((c) => c.severity === 'risk').length,
        style: comments.filter((c) => c.severity === 'style').length,
      },
    }))
  );
});

// GET /api/reviews/:id: one review with its files (and diffs) and comments
apiRouter.get('/reviews/:id', async (req, res) => {
  const review = await prisma.review.findUnique({
    where: { id: req.params.id },
    include: {
      repo: { select: { owner: true, name: true, installationId: true } },
      files: { orderBy: { filename: 'asc' } },
      comments: { orderBy: [{ path: 'asc' }, { line: 'asc' }] },
    },
  });
  // 404, not 403, for reviews the user can't see: don't reveal that they exist
  if (!review || !canAccessRepo(auth(req).allowed, review.repo)) {
    return res.status(404).json({ error: 'Review not found' });
  }
  const { repo: { installationId: _installationId, ...repo }, ...rest } = review;
  res.json({ ...rest, repo });
});

// POST /api/reviews/:id/rerun: review the same commit again (CSRF-checked like every change).
// Replies 202 right away; the review then shows "pending" until the background run finishes.
apiRouter.post('/reviews/:id/rerun', async (req, res) => {
  const review = await prisma.review.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      status: true,
      headSha: true,
      prNumber: true,
      repo: { select: { owner: true, name: true, installationId: true } },
    },
  });
  // Same rule as viewing: 404 for reviews the user can't see
  if (!review || !canAccessRepo(auth(req).allowed, review.repo)) {
    return res.status(404).json({ error: 'Review not found' });
  }

  const result = await prepareRerun(githubApp, review);
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  console.log(`Re-run requested by ${auth(req).user.login} for review ${review.id}`);
  res.status(202).json({ status: 'pending' });
  void processReview(githubApp, review.id); // never throws; marks the review done or failed
});

// PATCH /api/comments/:id/feedback: rate a comment
const FeedbackBody = z.object({ feedback: z.enum(['useful', 'not_useful']) });

apiRouter.patch('/comments/:id/feedback', async (req, res) => {
  // 1. Check the body has the right shape
  const parsed = FeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
  }

  // 2. Only comments on reviews the user can see (404 otherwise, like a missing comment)
  const existing = await prisma.reviewComment.findUnique({
    where: { id: req.params.id },
    select: { review: { select: { repo: { select: { owner: true, name: true, installationId: true } } } } },
  });
  if (!existing || !canAccessRepo(auth(req).allowed, existing.review.repo)) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  // 3. Save it. P2025 means "no row with that id" (deleted in the meantime).
  try {
    const comment = await prisma.reviewComment.update({
      where: { id: req.params.id },
      data: { feedback: parsed.data.feedback },
    });
    res.json(comment);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Comment not found' });
    }
    throw err;
  }
});

// GET /api/stats: totals and how useful the rated comments were, for the user's repos only
apiRouter.get('/stats', async (req, res) => {
  const repoIds = await myRepoIds(req);
  const mine = { review: { repoId: { in: repoIds } } };
  const [totalReviews, totalComments, useful, notUseful, bySeverity] = await Promise.all([
    prisma.review.count({ where: { repoId: { in: repoIds } } }),
    prisma.reviewComment.count({ where: mine }),
    prisma.reviewComment.count({ where: { ...mine, feedback: 'useful' } }),
    prisma.reviewComment.count({ where: { ...mine, feedback: 'not_useful' } }),
    prisma.reviewComment.groupBy({ by: ['severity'], where: mine, _count: true }),
  ]);
  const rated = useful + notUseful;

  // groupBy only returns severities that exist, so start every count at 0
  const counts = { bug: 0, risk: 0, style: 0 };
  for (const row of bySeverity) counts[row.severity] = row._count;

  res.json({
    totalReviews,
    totalComments,
    counts,
    usefulPercent: rated === 0 ? null : Math.round((useful / rated) * 100),
  });
});

// Any unexpected error in the routes above ends up here (Express 5 forwards async errors)
apiRouter.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(`API error: ${err instanceof Error ? err.message : String(err)}`);
  res.status(500).json({ error: 'Internal server error' });
});
