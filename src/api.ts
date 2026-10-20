import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from './db.js';
import { Prisma } from './generated/prisma/client.js';

export const apiRouter = express.Router();

// GET /api/reviews: the 50 newest reviews with comment counts
apiRouter.get('/reviews', async (req, res) => {
  const reviews = await prisma.review.findMany({
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
      repo: { select: { owner: true, name: true } },
      files: { orderBy: { filename: 'asc' } },
      comments: { orderBy: [{ path: 'asc' }, { line: 'asc' }] },
    },
  });
  if (!review) return res.status(404).json({ error: 'Review not found' });
  res.json(review);
});

// PATCH /api/comments/:id/feedback: rate a comment
const FeedbackBody = z.object({ feedback: z.enum(['useful', 'not_useful']) });

apiRouter.patch('/comments/:id/feedback', async (req, res) => {
  // 1. Check the body has the right shape
  const parsed = FeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
  }

  // 2. Save it. P2025 means "no row with that id".
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

// GET /api/stats: totals and how useful the rated comments were
apiRouter.get('/stats', async (req, res) => {
  const [totalReviews, totalComments, useful, notUseful, bySeverity] = await Promise.all([
    prisma.review.count(),
    prisma.reviewComment.count(),
    prisma.reviewComment.count({ where: { feedback: 'useful' } }),
    prisma.reviewComment.count({ where: { feedback: 'not_useful' } }),
    prisma.reviewComment.groupBy({ by: ['severity'], _count: true }),
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
  console.error('API error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
